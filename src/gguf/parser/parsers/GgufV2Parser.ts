import {GgufFileReader, valueTypeToBytesToRead} from "../fileReaders/GgufFileReader.js";
import {GgufReadOffset} from "../utils/GgufReadOffset.js";
import {UnsupportedGgufValueTypeError} from "../../errors/UnsupportedGgufValueTypeError.js";
import {
    GgufValueType, GgufVersionParserOptions, GgufVersionParserResult, MetadataKeyValueRecord, MetadataValue
} from "../types/GgufFileInfoTypes.js";
import {GgufMetadata} from "../types/GgufMetadataTypes.js";
import {GgmlType, GgufTensorInfo} from "../types/GgufTensorInfoTypes.js";
import {convertMetadataKeyValueRecordToNestedObject} from "../utils/convertMetadataKeyValueRecordToNestedObject.js";

export class GgufV2Parser {
    private readonly _fileReader: GgufFileReader;
    private readonly _readTensorInfo: boolean;
    private readonly _ignoreKeys: string[];
    private readonly _readOffset: GgufReadOffset;
    private readonly _logWarnings: boolean;

    public constructor({fileReader, readTensorInfo = true, ignoreKeys = [], readOffset, logWarnings}: GgufVersionParserOptions) {
        this._fileReader = fileReader;
        this._readTensorInfo = readTensorInfo;
        this._ignoreKeys = ignoreKeys;
        this._readOffset = readOffset;
        this._logWarnings = logWarnings;
    }

    public async parse(): Promise<GgufVersionParserResult> {
        const readOffset = this._readOffset;
        const initialOffset = readOffset.offset;

        const headerReadResult = await this._readRawHeader(readOffset);
        const tensorReadResult = this._readTensorInfo
            ? await this._parseTensorInfo(headerReadResult.tensorCount, readOffset)
            : null;
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

    protected async _readGgufValue(type: GgufValueType, offset: number | GgufReadOffset): Promise<MetadataValue> {
        const readOffset = GgufReadOffset.resolveReadOffset(offset);

        switch (type) {
            case GgufValueType.Uint8: return await this._fileReader.readUint8(readOffset);
            case GgufValueType.Int8: return await this._fileReader.readInt8(readOffset);
            case GgufValueType.Uint16: return await this._fileReader.readUint16(readOffset);
            case GgufValueType.Int16: return await this._fileReader.readInt16(readOffset);
            case GgufValueType.Uint32: return await this._fileReader.readUint32(readOffset);
            case GgufValueType.Int32: return await this._fileReader.readInt32(readOffset);
            case GgufValueType.Float32: return await this._fileReader.readFloat32(readOffset);
            case GgufValueType.Bool: return await this._fileReader.readBool(readOffset);
            case GgufValueType.String: return await this._readStringValue(readOffset);
            case GgufValueType.Uint64: return await this._fileReader.readUint64(readOffset);
            case GgufValueType.Int64: return await this._fileReader.readInt64(readOffset);
            case GgufValueType.Float64: return await this._fileReader.readFloat64(readOffset);
        }

        if (type === GgufValueType.Array) {
            const arrayType = await this._fileReader.readUint32(readOffset);
            const arrayLength = await this._fileReader.readUint64(readOffset);

            const arrayValues: MetadataValue[] = [];
            for (let i = 0; i < arrayLength; i++) {
                const value = await this._readGgufValue(arrayType, readOffset);
                arrayValues.push(value);
            }
            return arrayValues;
        }

        throw new UnsupportedGgufValueTypeError(type);
    }

    protected async _readStringValue(offset: number | GgufReadOffset) {
        const readOffset = GgufReadOffset.resolveReadOffset(offset);
        const length = Number(await this._fileReader.readUint64(readOffset));

        const readLength = valueTypeToBytesToRead.uint8 * length;
        const stringBytes = await this._fileReader.readByteRange(readOffset, readLength);

        return String.fromCharCode(...stringBytes);
    }

    protected async _readRawHeader(readOffset: GgufReadOffset) {
        const initialOffset = readOffset.offset;

        const tensorCount = await this._fileReader.readUint64(readOffset);
        const metadataKVCount = Number(await this._fileReader.readUint64(readOffset));

        const metadata: MetadataKeyValueRecord = {};

        for (let i = 0; i < metadataKVCount; i++) {
            const keyResult = await this._readStringValue(readOffset);
            const valueType = await this._fileReader.readUint32(readOffset);
            metadata[keyResult] = await this._readGgufValue(valueType, readOffset);
        }

        return {
            tensorCount: GgufFileReader.castNumberIfSafe(tensorCount),
            metadata: metadata,
            headerSize: readOffset.offset - initialOffset
        };
    }

    private async _parseTensorInfo(tensorCount: number | bigint, readOffset: GgufReadOffset) {
        const initialOffset = readOffset.offset;
        const tensorInfo: GgufTensorInfo[] = [];

        for (let i = 0n; i < BigInt(tensorCount); i++) {
            const name = await this._readStringValue(readOffset);
            const dimensionsNumber = await this._fileReader.readUint32(readOffset);
            const dimensions: (number | bigint)[] = [];

            for (let i = 0; i < dimensionsNumber; i++) {
                const dimension = await this._fileReader.readUint64(readOffset);
                dimensions.push(GgufFileReader.castNumberIfSafe(dimension));
            }

            const ggmlType = await this._fileReader.readUint32(readOffset);
            const offset = await this._fileReader.readUint64(readOffset);

            tensorInfo.push({
                name,
                dimensions,
                ggmlType: ggmlType as GgmlType,
                offset: GgufFileReader.castNumberIfSafe(offset)
            });
        }

        return {
            tensorInfo,
            tensorInfoSize: readOffset.offset - initialOffset
        };
    }
}
