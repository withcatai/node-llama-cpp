import {GgufReadOffset} from "../utils/GgufReadOffset.js";

export const METHOD_TO_BYTE_COUNT = {
    readUint8: 1,
    readUint16: 2,
    readUint32: 4,
    readUint64: 8,
    readInt8: 1,
    readInt16: 2,
    readInt32: 4,
    readInt64: 8,
    readFloat32: 4,
    readFloat64: 8,
    readBool: 1
} as const;

export const ALLOCATION_SIZE = 1024 * 1024 * 1.5; // 1.5MB

export abstract class GgufBaseStream {
    protected _buffer = Buffer.alloc(0);

    public abstract readByteRange(offset: number | GgufReadOffset, length: number): Promise<Buffer>;

    public async readUint8(offset: number | GgufReadOffset) {
        const response = await this._readByteRangeAndUpdateOffset(offset, METHOD_TO_BYTE_COUNT.readUint8);
        return response.readUInt8();
    }

    public async readUint16(offset: number | GgufReadOffset) {
        const response = await this._readByteRangeAndUpdateOffset(offset, METHOD_TO_BYTE_COUNT.readUint16);
        return response.readUInt16LE();
    }

    public async readUint32(offset: number | GgufReadOffset) {
        const response = await this._readByteRangeAndUpdateOffset(offset, METHOD_TO_BYTE_COUNT.readUint32);
        return response.readUInt32LE();
    }

    public async readUint64(offset: number | GgufReadOffset) {
        const response = await this._readByteRangeAndUpdateOffset(offset, METHOD_TO_BYTE_COUNT.readUint64);
        return response.readBigUInt64LE();
    }

    public async readInt8(offset: number | GgufReadOffset) {
        const response = await this._readByteRangeAndUpdateOffset(offset, METHOD_TO_BYTE_COUNT.readInt8);
        return response.readInt8();
    }

    public async readInt16(offset: number | GgufReadOffset) {
        const response = await this._readByteRangeAndUpdateOffset(offset, METHOD_TO_BYTE_COUNT.readInt16);
        return response.readInt16LE();
    }

    public async readInt32(offset: number | GgufReadOffset) {
        const response = await this._readByteRangeAndUpdateOffset(offset, METHOD_TO_BYTE_COUNT.readInt32);
        return response.readInt32LE();
    }

    public async readInt64(offset: number | GgufReadOffset) {
        const response = await this._readByteRangeAndUpdateOffset(offset, METHOD_TO_BYTE_COUNT.readInt64);
        return response.readBigInt64LE();
    }

    public async readFloat32(offset: number | GgufReadOffset) {
        const response = await this._readByteRangeAndUpdateOffset(offset, METHOD_TO_BYTE_COUNT.readFloat32);
        return response.readFloatLE();
    }

    public async readFloat64(offset: number | GgufReadOffset) {
        const response = await this._readByteRangeAndUpdateOffset(offset, METHOD_TO_BYTE_COUNT.readFloat64);
        return response.readDoubleLE();
    }

    public async readBool(offset: number | GgufReadOffset) {
        const response = await this._readByteRangeAndUpdateOffset(offset, METHOD_TO_BYTE_COUNT.readUint8);
        return response.readUInt8() === 1;
    }

    public async readString(offset: number | GgufReadOffset) {
        const readOffset = GgufReadOffset.resolveReadOffset(offset);
        const length = Number(await this.readUint64(readOffset));

        const readLength = METHOD_TO_BYTE_COUNT.readUint8 * length;
        const stringBytes = await this.readByteRange(readOffset, readLength);

        return String.fromCharCode(...stringBytes);
    }

    protected _addToBuffer(buffer: Buffer){
        this._buffer = Buffer.concat([this._buffer, buffer]);
    }

    private async _readByteRangeAndUpdateOffset(offset: number | GgufReadOffset, length: number) {
        const readOffset = GgufReadOffset.resolveReadOffset(offset);

        const response = await this.readByteRange(readOffset.offset, length);
        readOffset.moveBy(length);

        return response;
    }

    public static castNumber(value: bigint) {
        if (value > Number.MAX_SAFE_INTEGER) return value;
        return Number(value);
    }
}
