import {GgufFileReader} from "../fileReaders/GgufFileReader.js";
import {GgufReadOffset} from "../utils/GgufReadOffset.js";
import {UnsupportedGgufValueTypeError} from "../errors/UnsupportedGgufValueTypeError.js";
import {
    GgufValueType, GgufVersionParserOptions, GgufVersionParserResult, MetadataKeyValueRecord, MetadataValue
} from "../types/GgufFileInfoTypes.js";
import {GgufMetadata} from "../types/GgufMetadataTypes.js";
import {GgmlType, GgufTensorInfo} from "../types/GgufTensorInfoTypes.js";
import {convertMetadataKeyValueRecordToNestedObject} from "../utils/convertMetadataKeyValueRecordToNestedObject.js";
import {promisableLoop, Promisable, transformPromisable, transformPromisables} from "../../utils/transformPromisable.js";

export class GgufV2Parser {
    private readonly _fileReader: GgufFileReader;
    private readonly _shouldReadTensorInfo: boolean;
    private readonly _ignoreKeys: string[];
    private readonly _readOffset: GgufReadOffset;
    private readonly _logWarnings: boolean;

    public constructor({fileReader, readTensorInfo = true, ignoreKeys = [], readOffset, logWarnings}: GgufVersionParserOptions) {
        this._fileReader = fileReader;
        this._shouldReadTensorInfo = readTensorInfo;
        this._ignoreKeys = ignoreKeys;
        this._readOffset = readOffset;
        this._logWarnings = logWarnings;
    }

    public async parse(): Promise<GgufVersionParserResult> {
        const readOffset = this._readOffset;
        const initialOffset = readOffset.offset;

        const headerReadResultPromisable = this._readRawHeader(readOffset);
        const headerReadResult = headerReadResultPromisable instanceof Promise
            ? await headerReadResultPromisable
            : headerReadResultPromisable;
        const tensorReadResultPromisable = this._shouldReadTensorInfo
            ? await this._readTensorInfo(headerReadResult.tensorCount, readOffset)
            : null;
        const tensorReadResult = tensorReadResultPromisable instanceof Promise
            ? await tensorReadResultPromisable
            : tensorReadResultPromisable;
        const metadata = convertMetadataKeyValueRecordToNestedObject(headerReadResult.metadata, {
            logOverrideWarnings: this._logWarnings,
            ignoreKeys: this._ignoreKeys
        });

        return {
            tensorCount: headerReadResult.tensorCount,
            metadata: metadata as any as GgufMetadata,
            tensorInfo: tensorReadResult?.tensorInfo,
            metadataSize: headerReadResult.headerSize + initialOffset,
            tensorInfoSize: tensorReadResult?.tensorInfoSize
        };
    }

    protected _readGgufValue(type: GgufValueType, offset: number | GgufReadOffset): Promisable<MetadataValue> {
        const readOffset = GgufReadOffset.resolveReadOffset(offset);

        switch (type) {
            case GgufValueType.Uint8: return this._fileReader.readUint8(readOffset);
            case GgufValueType.Int8: return this._fileReader.readInt8(readOffset);
            case GgufValueType.Uint16: return this._fileReader.readUint16(readOffset);
            case GgufValueType.Int16: return this._fileReader.readInt16(readOffset);
            case GgufValueType.Uint32: return this._fileReader.readUint32(readOffset);
            case GgufValueType.Int32: return this._fileReader.readInt32(readOffset);
            case GgufValueType.Float32: return this._fileReader.readFloat32(readOffset);
            case GgufValueType.Bool: return this._fileReader.readBool(readOffset);
            case GgufValueType.String: return this._readStringValue(readOffset);
            case GgufValueType.Uint64: return this._fileReader.readUint64(readOffset);
            case GgufValueType.Int64: return this._fileReader.readInt64(readOffset);
            case GgufValueType.Float64: return this._fileReader.readFloat64(readOffset);
        }

        if (type === GgufValueType.Array) {
            const arrayTypePromisable = this._fileReader.readUint32(readOffset);
            const arrayLengthPromisable = this._fileReader.readUint64(readOffset);

            return transformPromisables([arrayTypePromisable, arrayLengthPromisable], ([arrayType, arrayLength]) => {
                const arrayValues: MetadataValue[] = [];
                let i = 0;

                return promisableLoop({
                    condition: () => i < arrayLength,
                    callback: () => {
                        return transformPromisable(this._readGgufValue(arrayType, readOffset), (value) => {
                            arrayValues.push(value);
                        });
                    },
                    afterthought: () => void i++,
                    returnValue: () => arrayValues
                });
            });
        }

        throw new UnsupportedGgufValueTypeError(type);
    }

    protected _readStringValue(offset: number | GgufReadOffset) {
        return this._fileReader.readString(offset);
    }

    protected async _readRawHeader(readOffset: GgufReadOffset) {
        const initialOffset = readOffset.offset;

        const tensorCountPromisable = this._fileReader.readUint64(readOffset);
        const metadataKVCountPromisable = transformPromisable(this._fileReader.readUint64(readOffset), Number);

        const tensorCount = tensorCountPromisable instanceof Promise ? await tensorCountPromisable : tensorCountPromisable;
        const metadataKVCount = metadataKVCountPromisable instanceof Promise ? await metadataKVCountPromisable : metadataKVCountPromisable;

        const metadata: MetadataKeyValueRecord = {};

        let i = 0;
        return promisableLoop({
            condition: () => i < metadataKVCount,
            callback: () => {
                const keyResultPromisable = this._readStringValue(readOffset);
                const valueTypePromisable = this._fileReader.readUint32(readOffset);

                return transformPromisables([keyResultPromisable, valueTypePromisable], ([keyResult, valueType]) => {
                    return transformPromisable(this._readGgufValue(valueType, readOffset), (value) => {
                        metadata[keyResult] = value;
                    });
                });
            },
            afterthought: () => void i++,
            returnValue: () => ({
                tensorCount: GgufFileReader.castNumberIfSafe(tensorCount),
                metadata: metadata,
                headerSize: readOffset.offset - initialOffset
            })
        });
    }

    private _readTensorInfo(tensorCount: number | bigint, readOffset: GgufReadOffset) {
        const initialOffset = readOffset.offset;
        const tensorInfo: GgufTensorInfo[] = [];

        let i = 0n;
        return promisableLoop({
            condition: () => i < BigInt(tensorCount),
            callback: () => {
                const namePromisable = this._readStringValue(readOffset);
                const dimensionsNumberPromisable = this._fileReader.readUint32(readOffset);
                const dimensions: (number | bigint)[] = [];

                return transformPromisables([namePromisable, dimensionsNumberPromisable], ([name, dimensionsNumber]) => {
                    let d = 0;
                    return promisableLoop({
                        condition: () => d < dimensionsNumber,
                        callback: () => {
                            return transformPromisable(this._fileReader.readUint64(readOffset), (dimension) => {
                                dimensions.push(GgufFileReader.castNumberIfSafe(dimension));
                            });
                        },
                        afterthought: () => void d++,
                        returnValue: () => {
                            const ggmlTypePromisable = this._fileReader.readUint32(readOffset);
                            const offsetPromisable = this._fileReader.readUint64(readOffset);

                            return transformPromisables([ggmlTypePromisable, offsetPromisable], ([ggmlType, offset]) => {
                                tensorInfo.push({
                                    name,
                                    dimensions,
                                    ggmlType: ggmlType as GgmlType,
                                    offset: GgufFileReader.castNumberIfSafe(offset)
                                });
                            });
                        }
                    });
                });
            },
            afterthought: () => void i++,
            returnValue: () => ({
                tensorInfo,
                tensorInfoSize: readOffset.offset - initialOffset
            })
        });
    }
}
