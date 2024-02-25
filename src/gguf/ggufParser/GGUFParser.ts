import InvalidGGUFMagicError from "../errors/InvalidGGUFMagicError.js";
import UnsupportedMetadataTypeError from "../errors/UnsupportedMetadataTypeError.js";
import {fileTypeIntToString} from "./checkArchitecture.js";
import {GGUFMetadataAny} from "./GGUFTypes.js";
import GGUFBaseStream, {METHOD_TO_BYTE_COUNT} from "./stream/GGUFBaseStream.js";

const METADATA_VALUE_TO_METHOD: { [key: number]: keyof typeof METHOD_TO_BYTE_COUNT } = {
    0: "readUint8",
    1: "readInt8",
    2: "readUint16",
    3: "readInt16",
    4: "readUint32",
    5: "readInt32",
    6: "readFloat32",
    7: "readBool"
};

const METADATA_STRING = 8;
const METADATA_ARRAY = 9;

const GGUF_MAGIC = "GGUF";

const DEFAULT_IGNORE_METADATA_KEYS = ["tokenizer.ggml.tokens", "tokenizer.ggml.scores", "tokenizer.ggml.token_type", "tokenizer.ggml.merges"];

export type GGUFMetadataResponse = {
    metadataSize: number,
    metadata: GGUFMetadataAny
};

export default class GGUFParser {
    constructor(protected readonly _stream: GGUFBaseStream, public ignoreKeys = DEFAULT_IGNORE_METADATA_KEYS) {
    }

    private async _readMetadataValue(type: keyof typeof METADATA_VALUE_TO_METHOD | 8 | 9, offset: number): Promise<{
        value: any,
        newOffset: number
    }> {
        const numberMethod = METADATA_VALUE_TO_METHOD[type];
        if (numberMethod) {
            return { // Numbers
                value: await this._stream[numberMethod](offset),
                newOffset: offset + METHOD_TO_BYTE_COUNT[numberMethod]
            };
        }

        if (METADATA_STRING === type) {
            const {string, newOffset} = await this._stream.readString(offset);
            return {value: string, newOffset};
        }

        if (METADATA_ARRAY === type) {
            const arrayType = await this._stream.readUint32(offset);
            offset += METHOD_TO_BYTE_COUNT.readUint32;

            const arrayLength = await this._stream.readUint64(offset);
            offset += METHOD_TO_BYTE_COUNT.readUint64;

            const arrayValues = [];
            for (let i = 0; i < arrayLength; i++) {
                const {value, newOffset} = await this._readMetadataValue(arrayType, offset);
                arrayValues.push(value);
                offset = newOffset;
            }
            return {value: arrayValues, newOffset: offset};
        }

        throw new UnsupportedMetadataTypeError(type);
    }

    private async _parseMetadataRaw(): Promise<{metadata: { [key: string]: any }, metadataSize: number}> {
        let offset = 0;

        const readMagicBytesLength = METHOD_TO_BYTE_COUNT.readUint8 * GGUF_MAGIC.length;
        const magicBytes = await this._stream.readNBytes(readMagicBytesLength);
        offset += readMagicBytesLength;

        const magicText = String.fromCharCode(...magicBytes);
        if (magicText !== GGUF_MAGIC) {
            throw new InvalidGGUFMagicError();
        }

        const version = await this._stream.readUint32(offset);
        offset += METHOD_TO_BYTE_COUNT.readUint32;

        const tensorCount = await this._stream.readUint64(offset);
        offset += METHOD_TO_BYTE_COUNT.readUint64;

        const metadataKVCount = await this._stream.readUint64(offset);
        offset += METHOD_TO_BYTE_COUNT.readUint64;

        const metadata: { [key: string]: any } = {
            version,
            tensorCount: GGUFBaseStream.castNumber(tensorCount as bigint)
        };

        for (let i = 0; i < Number(metadataKVCount); i++) {
            // read key
            const keyResult = await this._stream.readString(offset);
            offset = keyResult.newOffset;

            // read the value type
            const valueType = await this._stream.readUint32(offset);
            offset += METHOD_TO_BYTE_COUNT.readUint32;

            // read value
            const valueResult = await this._readMetadataValue(valueType, offset);
            offset = valueResult.newOffset;
            metadata[keyResult.string] = valueResult.value;
        }

        return {
            metadata: metadata,
            metadataSize: offset
        };
    }

    async parseMetadata(): Promise<GGUFMetadataResponse> {
        const metadataRaw = await this._parseMetadataRaw();
        const metadata: { [key: string]: any } = {};

        for (const [key, value] of Object.entries(metadataRaw.metadata)) {
            if (this.ignoreKeys.includes(key)) {
                continue;
            }
            const {lastObject, lastKey} = GGUFParser._getNestedObject(key, metadata);
            lastObject[lastKey] = value;
        }

        if (typeof metadata?.general?.file_type === "number") {
            metadata.general["file_type"] = fileTypeIntToString(metadata.general.file_type) || metadata.general.file_type;
        }

        return {
            metadata: metadata as GGUFMetadataAny,
            metadataSize: metadataRaw.metadataSize
        };
    }

    protected static _getNestedObject(key: string, currentNestedObject: any) {
        const nestedKey = key.split(".");
        const lastKey = nestedKey.pop()!;

        while (nestedKey.length > 0) {
            const currentKey = nestedKey.shift()!;
            if (!currentNestedObject[currentKey]) {
                currentNestedObject[currentKey] = {};
            }
            currentNestedObject = currentNestedObject[currentKey];
        }

        return {
            lastObject: currentNestedObject,
            lastKey
        };
    }
}
