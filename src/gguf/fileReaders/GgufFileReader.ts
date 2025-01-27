import {GgufReadOffset} from "../utils/GgufReadOffset.js";
import {Promisable, transformPromisable} from "../../utils/transformPromisable.js";

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

    public abstract readByteRange(offset: number | GgufReadOffset, length: number): Promisable<Buffer>;
    protected abstract ensureHasByteRange(offset: number | GgufReadOffset, length: number): Promisable<void>;

    public readUint8(offset: number | GgufReadOffset) {
        return this._withBufferRead(offset, valueTypeToBytesToRead.uint8, (resolvedOffset) => {
            return this._buffer.readUInt8(resolvedOffset);
        });
    }

    public readUint16(offset: number | GgufReadOffset) {
        return this._withBufferRead(offset, valueTypeToBytesToRead.uint16, (resolvedOffset) => {
            return this._buffer.readUInt16LE(resolvedOffset);
        });
    }

    public readUint32(offset: number | GgufReadOffset) {
        return this._withBufferRead(offset, valueTypeToBytesToRead.uint32, (resolvedOffset) => {
            return this._buffer.readUInt32LE(resolvedOffset);
        });
    }

    public readUint64(offset: number | GgufReadOffset) {
        return this._withBufferRead(offset, valueTypeToBytesToRead.uint64, (resolvedOffset) => {
            return this._buffer.readBigUInt64LE(resolvedOffset);
        });
    }

    public readInt8(offset: number | GgufReadOffset) {
        return this._withBufferRead(offset, valueTypeToBytesToRead.int8, (resolvedOffset) => {
            return this._buffer.readInt8(resolvedOffset);
        });
    }

    public readInt16(offset: number | GgufReadOffset) {
        return this._withBufferRead(offset, valueTypeToBytesToRead.int16, (resolvedOffset) => {
            return this._buffer.readInt16LE(resolvedOffset);
        });
    }

    public readInt32(offset: number | GgufReadOffset) {
        return this._withBufferRead(offset, valueTypeToBytesToRead.int32, (resolvedOffset) => {
            return this._buffer.readInt32LE(resolvedOffset);
        });
    }

    public readInt64(offset: number | GgufReadOffset) {
        return this._withBufferRead(offset, valueTypeToBytesToRead.int64, (resolvedOffset) => {
            return this._buffer.readBigInt64LE(resolvedOffset);
        });
    }

    public readFloat32(offset: number | GgufReadOffset) {
        return this._withBufferRead(offset, valueTypeToBytesToRead.float32, (resolvedOffset) => {
            return this._buffer.readFloatLE(resolvedOffset);
        });
    }

    public readFloat64(offset: number | GgufReadOffset) {
        return this._withBufferRead(offset, valueTypeToBytesToRead.float64, (resolvedOffset) => {
            return this._buffer.readDoubleLE(resolvedOffset);
        });
    }

    public readBool(offset: number | GgufReadOffset) {
        return this._withBufferRead(offset, valueTypeToBytesToRead.uint8, (resolvedOffset) => {
            return this._buffer.readUInt8(resolvedOffset) === 1;
        });
    }

    public readString(offset: number | GgufReadOffset) {
        const readOffset = GgufReadOffset.resolveReadOffset(offset);

        return transformPromisable(this.readUint64(readOffset), (length) => {
            return this.readStringWithLength(readOffset, Number(length));
        });
    }

    public readStringWithLength(offset: number | GgufReadOffset, length: number) {
        const readLength = valueTypeToBytesToRead.uint8 * length;

        return this._withBufferRead(offset, readLength, (resolvedOffset) => {
            return this._buffer.toString("utf8", resolvedOffset, Math.min(resolvedOffset + readLength, this._buffer.length));
        });
    }

    protected _addToBuffer(buffer: Buffer) {
        const newBuffer = Buffer.alloc(this._buffer.byteLength + buffer.byteLength);
        this._buffer.copy(newBuffer);
        buffer.copy(newBuffer, this._buffer.byteLength);

        this._buffer = newBuffer;
    }

    private _withBufferRead<T>(offset: number | GgufReadOffset, length: number, reader: (resolvedOffset: number) => T): Promisable<T> {
        return transformPromisable(this.ensureHasByteRange(offset, length), () => {
            const resolvedOffset = GgufReadOffset.resolveReadOffset(offset);

            return transformPromisable(reader(resolvedOffset.offset), (res) => {
                resolvedOffset.moveBy(Math.min(length, this._buffer.length - resolvedOffset.offset));

                return res;
            });
        });
    }

    public static castNumberIfSafe(value: bigint) {
        if (value > Number.MAX_SAFE_INTEGER)
            return value;

        return Number(value);
    }
}
