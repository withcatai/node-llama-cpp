import {InvalidGgufMagicError} from "../errors/InvalidGgufMagicError.js";
import UnsupportedGgufMetadataTypeError from "../errors/UnsupportedMetadataTypeError.js";
import {getConsoleLogPrefix} from "../../utils/getConsoleLogPrefix.js";
import {GgufReadOffset} from "./utils/GgufReadOffset.js";
import {parseGgufFileTypeNumber} from "./utils/parseGgufFileTypeNumber.js";
import {GgufMetadataAny} from "./GgufMetadataTypes.js";
import {GgufFileReader, valueTypeToBytesToRead} from "./fileReaders/GgufFileReader.js";

const enum MetadataValueType {
    Uint8 = 0,
    Int8 = 1,
    Uint16 = 2,
    Int16 = 3,
    Uint32 = 4,
    Int32 = 5,
    Float32 = 6,
    Bool = 7,
    String = 8,
    Array = 9
}

const ggufMagic = "GGUF";

// these keys are ignored by default because they contain very long values that aren't very useful in the JS side of this library
const defaultIgnoreMetadataKeys = [
    "tokenizer.ggml.tokens",
    "tokenizer.ggml.scores",
    "tokenizer.ggml.token_type",
    "tokenizer.ggml.merges"
];

export type GgufParsedMetadataResult = {
    metadataSize: number,
    metadata: GgufMetadataAny
};

export type GgufParserOptions = {
    fileReader: GgufFileReader,
    ignoreKeys?: string[]
};

export class GgufParser {
    private readonly _fileReader: GgufFileReader;
    public readonly ignoreKeys = defaultIgnoreMetadataKeys;

    public constructor({fileReader, ignoreKeys = defaultIgnoreMetadataKeys}: GgufParserOptions) {
        this.ignoreKeys = ignoreKeys;
        this._fileReader = fileReader;
    }

    public async parseMetadata({logWarnings = true}: {logWarnings?: boolean} = {}): Promise<GgufParsedMetadataResult> {
        const metadataRaw = await this._parseMetadataRaw();
        const metadata: { [key: string]: any } = {};

        for (const [key, value] of Object.entries(metadataRaw.metadata)) {
            if (this.ignoreKeys.includes(key))
                continue;

            const {lastObject, lastKey} = GgufParser._getNestedObject(key, metadata);
            if (Object.hasOwn(lastObject, lastKey) && logWarnings)
                console.warn(getConsoleLogPrefix() + `Metadata key "${key}" is already occupied by a value. Overwriting it.`);

            lastObject[lastKey] = value;
        }

        if (typeof metadata?.general?.file_type === "number") {
            metadata.general["file_type"] = parseGgufFileTypeNumber(metadata.general.file_type) || metadata.general.file_type;
        }

        return {
            metadata: metadata as GgufMetadataAny,
            metadataSize: metadataRaw.metadataSize
        };
    }

    private async _readMetadataValue(type: MetadataValueType, offset: number | GgufReadOffset): Promise<any> {
        const readOffset = GgufReadOffset.resolveReadOffset(offset);

        switch (type) {
            case MetadataValueType.Uint8: return await this._fileReader.readUint8(readOffset);
            case MetadataValueType.Int8: return await this._fileReader.readInt8(readOffset);
            case MetadataValueType.Uint16: return await this._fileReader.readUint16(readOffset);
            case MetadataValueType.Int16: return await this._fileReader.readInt16(readOffset);
            case MetadataValueType.Uint32: return await this._fileReader.readUint32(readOffset);
            case MetadataValueType.Int32: return await this._fileReader.readInt32(readOffset);
            case MetadataValueType.Float32: return await this._fileReader.readFloat32(readOffset);
            case MetadataValueType.Bool: return await this._fileReader.readBool(readOffset);
            case MetadataValueType.String: return await this._fileReader.readString(readOffset);
        }

        if (type === MetadataValueType.Array) {
            const arrayType = await this._fileReader.readUint32(readOffset);
            const arrayLength = await this._fileReader.readUint64(readOffset);

            const arrayValues: any[] = [];
            for (let i = 0; i < arrayLength; i++) {
                const value = await this._readMetadataValue(arrayType, readOffset);
                arrayValues.push(value);
            }
            return arrayValues;
        }

        throw new UnsupportedGgufMetadataTypeError(type);
    }

    private async _parseMetadataRaw(): Promise<{metadata: Record<string, any>, metadataSize: number}> {
        const readOffset = new GgufReadOffset(0);

        const fileMagicBytes = await this._fileReader.readByteRange(readOffset, valueTypeToBytesToRead.uint8 * ggufMagic.length);
        const fileMagicText = String.fromCharCode(...fileMagicBytes);

        if (fileMagicText !== ggufMagic)
            throw new InvalidGgufMagicError(ggufMagic, fileMagicText);

        const version = await this._fileReader.readUint32(readOffset);
        const tensorCount = await this._fileReader.readUint64(readOffset);
        const metadataKVCount = Number(await this._fileReader.readUint64(readOffset));

        const metadata: { [key: string]: any } = {
            version,
            tensorCount: GgufFileReader.castNumber(tensorCount)
        };

        for (let i = 0; i < metadataKVCount; i++) {
            const keyResult = await this._fileReader.readString(readOffset);
            const valueType = await this._fileReader.readUint32(readOffset);
            metadata[keyResult] = await this._readMetadataValue(valueType, readOffset);
        }

        return {
            metadata: metadata,
            metadataSize: readOffset.offset
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
