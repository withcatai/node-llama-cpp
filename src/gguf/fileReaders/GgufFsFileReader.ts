import fs from "node:fs/promises";
import path from "node:path";
import {withLock} from "lifecycle-utils";
import {GgufReadOffset} from "../utils/GgufReadOffset.js";
import {defaultExtraAllocationSize} from "../consts.js";
import {GgufFileReader} from "./GgufFileReader.js";

type GgufFsFileReaderOptions = {
    filePath: string,
    signal?: AbortSignal
};

export class GgufFsFileReader extends GgufFileReader {
    public readonly filePath: string;
    private readonly _signal?: AbortSignal;

    public constructor({filePath, signal}: GgufFsFileReaderOptions) {
        super();
        this.filePath = path.resolve(process.cwd(), filePath);
        this._signal = signal;
    }

    public readByteRange(offset: number | GgufReadOffset, length: number) {
        const readOffset = GgufReadOffset.resolveReadOffset(offset);
        const endOffset = readOffset.offset + length;

        if (endOffset >= this._buffer.length)
            return this._readToExpandBufferUpToOffset(endOffset)
                .then(() => {
                    const res = this._buffer.subarray(readOffset.offset, endOffset);
                    readOffset.moveBy(length);
                    return res;
                });

        const res = this._buffer.subarray(readOffset.offset, endOffset);
        readOffset.moveBy(length);
        return res;
    }

    protected ensureHasByteRange(offset: number | GgufReadOffset, length: number) {
        const readOffset = GgufReadOffset.resolveReadOffset(offset);
        const endOffset = readOffset.offset + length;

        if (endOffset >= this._buffer.length)
            return this._readToExpandBufferUpToOffset(endOffset)
                .then(() => {
                    if (endOffset >= this._buffer.length)
                        throw new Error("Expected buffer to be long enough for the requested byte range");
                });

        return undefined;
    }

    private async _readToExpandBufferUpToOffset(endOffset: number, extraAllocationSize: number = defaultExtraAllocationSize) {
        return await withLock([this as GgufFsFileReader, "modifyBuffer"], this._signal, async () => {
            if (endOffset < this._buffer.length)
                return;

            const missingBytesBuffer = await this._readByteRange(
                this._buffer.length,
                endOffset + extraAllocationSize - this._buffer.length
            );

            this._addToBuffer(missingBytesBuffer);
        });
    }

    private async _readByteRange(start: number, length: number) {
        const fd = await fs.open(this.filePath, "r");
        try {
            if (this._signal?.aborted)
                throw this._signal.reason;

            const buffer = Buffer.alloc(length);
            await fd.read(buffer, 0, length, start);
            return buffer;
        } finally {
            await fd.close();
        }
    }
}
