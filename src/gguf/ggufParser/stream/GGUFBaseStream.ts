import {Buffer} from "buffer";

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
};

export const ALLOCATION_SIZE = 1024 * 1024 * 1.5; // 1.5MB

export default abstract class GGUFBaseStream {
    protected _buffer = Buffer.alloc(0);
    protected constructor() {
    }

    public abstract readNBytes(numBytes: number, offset?: number): Promise<Buffer>;

    public async readUint8(offset: number) {
        const response = await this.readNBytes(METHOD_TO_BYTE_COUNT.readUint8, offset);
        return response.readUInt8();
    }

    public async readUint16(offset: number) {
        const response = await this.readNBytes(METHOD_TO_BYTE_COUNT.readUint16, offset);
        return response.readUInt16LE();
    }

    public async readUint32(offset: number) {
        const response = await this.readNBytes(METHOD_TO_BYTE_COUNT.readUint32, offset);
        return response.readUInt32LE();
    }

    public async readUint64(offset: number) {
        const response = await this.readNBytes(METHOD_TO_BYTE_COUNT.readUint64, offset);
        return response.readBigUInt64LE();
    }

    public async readInt8(offset: number) {
        const response = await this.readNBytes(METHOD_TO_BYTE_COUNT.readInt8, offset);
        return response.readInt8();
    }

    public async readInt16(offset: number) {
        const response = await this.readNBytes(METHOD_TO_BYTE_COUNT.readInt16, offset);
        return response.readInt16LE();
    }

    public async readInt32(offset: number) {
        const response = await this.readNBytes(METHOD_TO_BYTE_COUNT.readInt32, offset);
        return response.readInt32LE();
    }

    public async readInt64(offset: number) {
        const response = await this.readNBytes(METHOD_TO_BYTE_COUNT.readInt64, offset);
        return response.readBigInt64LE();
    }

    public async readFloat32(offset: number) {
        const response = await this.readNBytes(METHOD_TO_BYTE_COUNT.readFloat32, offset);
        return response.readFloatLE();
    }

    public async readFloat64(offset: number) {
        const response = await this.readNBytes(METHOD_TO_BYTE_COUNT.readFloat64, offset);
        return response.readDoubleLE();
    }

    public async readBool(offset: number) {
        const response = await this.readNBytes(METHOD_TO_BYTE_COUNT.readUint8, offset);
        return response.readUInt8() === 1;
    }

    public async readString(offset: number) {
        const length = Number(await this.readUint64(offset));
        offset += METHOD_TO_BYTE_COUNT.readUint64;

        const readLength = METHOD_TO_BYTE_COUNT.readUint8 * length;
        const stringBytes = await this.readNBytes(readLength, offset);

        return {
            string: String.fromCharCode(...stringBytes),
            newOffset: offset + readLength
        };
    }

    protected _addToBuffer(buffer: Buffer){
        this._buffer = Buffer.concat([this._buffer, buffer]);
    }

    public static castNumber(value: bigint) {
        if (value > Number.MAX_SAFE_INTEGER) return value;
        return Number(value);
    }
}
