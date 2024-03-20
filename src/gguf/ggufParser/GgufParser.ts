import {InvalidGgufMagicError} from "../errors/InvalidGgufMagicError.js";
import {UnsupportedGgufValueTypeError} from "../errors/UnsupportedGgufValueTypeError.js";
import {getConsoleLogPrefix} from "../../utils/getConsoleLogPrefix.js";
import {GgufReadOffset} from "./utils/GgufReadOffset.js";
import {GgufMetadata} from "./types/GgufMetadataTypes.js";
import {GgufFileReader, valueTypeToBytesToRead} from "./fileReaders/GgufFileReader.js";
import {GgufFileInfo} from "./types/GgufFileInfoTypes.js";
import {GgmlType, GgufTensorInfo} from "./types/GgufTensorInfoTypes.js";

// source: `enum gguf_type` in `ggml.h` in the `llama.cpp` source code
const enum GgufValueType {
    Uint8 = 0,
    Int8 = 1,
    Uint16 = 2,
    Int16 = 3,
    Uint32 = 4,
    Int32 = 5,
    Float32 = 6,
    Bool = 7,
    String = 8,
    Array = 9,
    Uint64 = 10,
    Int64 = 11,
    Float64 = 12
}

const ggufMagic = "GGUF";


export type GgufParserOptions = {
    fileReader: GgufFileReader,
    readTensorInfo?: boolean,
    ignoreKeys?: string[]
};

export class GgufParser {
    private readonly _fileReader: GgufFileReader;
    private readonly _readTensorInfo: boolean;
    private readonly _ignoreKeys: string[];

    public constructor({fileReader, readTensorInfo = true, ignoreKeys = []}: GgufParserOptions) {
        this._fileReader = fileReader;
        this._readTensorInfo = readTensorInfo;
        this._ignoreKeys = ignoreKeys;
    }

    public async parseFileInfo({logWarnings = true}: {logWarnings?: boolean} = {}): Promise<GgufFileInfo> {
        const readOffset = new GgufReadOffset(0);
        const headerReadResult = await this._parseHeaderRaw(readOffset);
        const tensorReadResult = this._readTensorInfo
            ? await this._parseTensorInfo(headerReadResult.tensorCount, readOffset)
            : null;
        const metadata: { [key: string]: any } = {};

        for (const [key, value] of Object.entries(headerReadResult.metadata)) {
            if (this._ignoreKeys.includes(key))
                continue;

            const {lastObject, lastKey} = GgufParser._getNestedObject(key, metadata);
            if (Object.hasOwn(lastObject, lastKey) && logWarnings)
                console.warn(getConsoleLogPrefix() + `Metadata key "${key}" is already occupied by a value. Overwriting it.`);

            lastObject[lastKey] = value;
        }

        return {
            version: headerReadResult.version,
            tensorCount: headerReadResult.tensorCount,
            metadata: metadata as GgufMetadata,
            tensorInfo: tensorReadResult?.tensorInfo,
            metadataSize: headerReadResult.metadataSize,
            tensorInfoSize: tensorReadResult?.tensorInfoSize
        };
    }

    private async _readGgufValue(type: GgufValueType, offset: number | GgufReadOffset): Promise<any> {
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
            case GgufValueType.String: return await this._fileReader.readString(readOffset);
            case GgufValueType.Uint64: return await this._fileReader.readUint64(readOffset);
            case GgufValueType.Int64: return await this._fileReader.readInt64(readOffset);
            case GgufValueType.Float64: return await this._fileReader.readFloat64(readOffset);
        }

        if (type === GgufValueType.Array) {
            const arrayType = await this._fileReader.readUint32(readOffset);
            const arrayLength = await this._fileReader.readUint64(readOffset);

            const arrayValues: any[] = [];
            for (let i = 0; i < arrayLength; i++) {
                const value = await this._readGgufValue(arrayType, readOffset);
                arrayValues.push(value);
            }
            return arrayValues;
        }

        throw new UnsupportedGgufValueTypeError(type);
    }

    private async _parseHeaderRaw(readOffset: GgufReadOffset) {
        const initialOffset = readOffset.offset;
        const fileMagicBytes = await this._fileReader.readByteRange(readOffset, valueTypeToBytesToRead.uint8 * ggufMagic.length);
        const fileMagicText = String.fromCharCode(...fileMagicBytes);

        if (fileMagicText !== ggufMagic)
            throw new InvalidGgufMagicError(ggufMagic, fileMagicText);

        const version = await this._fileReader.readUint32(readOffset);
        const tensorCount = await this._fileReader.readUint64(readOffset);
        const metadataKVCount = Number(await this._fileReader.readUint64(readOffset));

        const metadata: Record<string, any> = {};

        for (let i = 0; i < metadataKVCount; i++) {
            const keyResult = await this._fileReader.readString(readOffset);
            const valueType = await this._fileReader.readUint32(readOffset);
            metadata[keyResult] = await this._readGgufValue(valueType, readOffset);
        }

        return {
            version,
            tensorCount: GgufFileReader.castNumber(tensorCount),
            metadata: metadata,
            metadataSize: readOffset.offset - initialOffset
        };
    }

    private async _parseTensorInfo(tensorCount: number | bigint, readOffset: GgufReadOffset) {
        const initialOffset = readOffset.offset;
        const tensorInfo: GgufTensorInfo[] = [];

        for (let i = 0n; i < BigInt(tensorCount); i++) {
            const name = await this._fileReader.readString(readOffset);
            const dimensionsNumber = await this._fileReader.readUint32(readOffset);
            const dimensions: (number | bigint)[] = [];

            for (let i = 0; i < dimensionsNumber; i++) {
                const dimension = await this._fileReader.readUint64(readOffset);
                dimensions.push(GgufFileReader.castNumber(dimension));
            }

            const ggmlType = await this._fileReader.readUint32(readOffset);
            const offset = await this._fileReader.readUint64(readOffset);

            tensorInfo.push({
                name,
                dimensions,
                ggmlType: ggmlType as GgmlType,
                offset: GgufFileReader.castNumber(offset)
            });
        }

        return {
            tensorInfo,
            tensorInfoSize: readOffset.offset - initialOffset
        };
    }

    private static _getNestedObject(key: string, currentNestedObject: any) {
        const nestedKey = key.split(".");
        const lastKey = nestedKey.pop()!;

        while (nestedKey.length > 0) {
            const currentKey = nestedKey.shift()!;
            if (!Object.hasOwn(currentNestedObject, currentKey))
                currentNestedObject[currentKey] = {};
            else {
                const value = currentNestedObject[currentKey];
                if (value instanceof Array || value == null || typeof value !== "object")
                    throw new Error(
                        `Cannot create nested object for key "${key}". The key "${currentKey}" is already occupied by a non-object value.`
                    );
            }

            currentNestedObject = currentNestedObject[currentKey];
        }

        return {
            lastObject: currentNestedObject,
            lastKey
        };
    }
}
