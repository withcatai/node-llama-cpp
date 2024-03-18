import {GgufReadOffset} from "../utils/GgufReadOffset.js";

export const valueTypeToBytesToRead = {
    uint8: 1,
    uint16: 2,
    uint32: 4,
    uint64: 8,
    int8: 1,
    int16: 2,
    int32: 4,
    int64: 8,
    float32: 4,
    float64: 8,
    bool: 1
} as const;

export abstract class GgufFileReader {
    protected _buffer = Buffer.alloc(0);

    public abstract readByteRange(offset: number | GgufReadOffset, length: number): Promise<Buffer>;

    public async readUint8(offset: number | GgufReadOffset) {
        const response = await this._readByteRangeAndUpdateOffset(offset, valueTypeToBytesToRead.uint8);
        return response.readUInt8();
    }

    public async readUint16(offset: number | GgufReadOffset) {
        const response = await this._readByteRangeAndUpdateOffset(offset, valueTypeToBytesToRead.uint16);
        return response.readUInt16LE();
    }

    public async readUint32(offset: number | GgufReadOffset) {
        const response = await this._readByteRangeAndUpdateOffset(offset, valueTypeToBytesToRead.uint32);
        return response.readUInt32LE();
    }

    public async readUint64(offset: number | GgufReadOffset) {
        const response = await this._readByteRangeAndUpdateOffset(offset, valueTypeToBytesToRead.uint64);
        return response.readBigUInt64LE();
    }

    public async readInt8(offset: number | GgufReadOffset) {
        const response = await this._readByteRangeAndUpdateOffset(offset, valueTypeToBytesToRead.int8);
        return response.readInt8();
    }

    public async readInt16(offset: number | GgufReadOffset) {
        const response = await this._readByteRangeAndUpdateOffset(offset, valueTypeToBytesToRead.int16);
        return response.readInt16LE();
    }

    public async readInt32(offset: number | GgufReadOffset) {
        const response = await this._readByteRangeAndUpdateOffset(offset, valueTypeToBytesToRead.int32);
        return response.readInt32LE();
    }

    public async readInt64(offset: number | GgufReadOffset) {
        const response = await this._readByteRangeAndUpdateOffset(offset, valueTypeToBytesToRead.int64);
        return response.readBigInt64LE();
    }

    public async readFloat32(offset: number | GgufReadOffset) {
        const response = await this._readByteRangeAndUpdateOffset(offset, valueTypeToBytesToRead.float32);
        return response.readFloatLE();
    }

    public async readFloat64(offset: number | GgufReadOffset) {
        const response = await this._readByteRangeAndUpdateOffset(offset, valueTypeToBytesToRead.float64);
        return response.readDoubleLE();
    }

    public async readBool(offset: number | GgufReadOffset) {
        const response = await this._readByteRangeAndUpdateOffset(offset, valueTypeToBytesToRead.uint8);
        return response.readUInt8() === 1;
    }

    public async readString(offset: number | GgufReadOffset) {
        const readOffset = GgufReadOffset.resolveReadOffset(offset);
        const length = Number(await this.readUint64(readOffset));

        const readLength = valueTypeToBytesToRead.uint8 * length;
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
