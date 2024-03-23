import fs from "node:fs/promises";
import retry from "async-retry";
import {withLock} from "lifecycle-utils";
import {GgufReadOffset} from "../utils/GgufReadOffset.js";
import {defaultExtraAllocationSize, ggufDefaultRetryOptions} from "../consts.js";
import {GgufFileReader} from "./GgufFileReader.js";

type GgufFsFileReaderOptions = {
    filePath: string,
    retryOptions?: retry.Options
};

export class GgufFsFileReader extends GgufFileReader {
    public readonly filePath: string;
    public readonly retryOptions: retry.Options;

    public constructor({filePath, retryOptions = ggufDefaultRetryOptions}: GgufFsFileReaderOptions) {
        super();
        this.filePath = filePath;
        this.retryOptions = retryOptions;
    }

    public async readByteRange(offset: number | GgufReadOffset, length: number) {
        const readOffset = GgufReadOffset.resolveReadOffset(offset);
        const endOffset = readOffset.offset + length;

        if (endOffset >= this._buffer.length)
            await this._readToExpandBufferUpToOffset(endOffset);

        const res = this._buffer.subarray(readOffset.offset, endOffset);
        readOffset.moveBy(length);
        return res;
    }

    private async _readToExpandBufferUpToOffset(endOffset: number, extraAllocationSize: number = defaultExtraAllocationSize) {
        return await withLock(this, "modifyBuffer", async () => {
            if (endOffset < this._buffer.length)
                return;

            const missingBytesBuffer = await retry(async () => {
                return await this._readByteRange(this._buffer.length, endOffset + extraAllocationSize - this._buffer.length);
            }, this.retryOptions);

            this._addToBuffer(missingBytesBuffer);
        });
    }

    private async _readByteRange(start: number, length: number) {
        const fd = await fs.open(this.filePath, "r");
        try {
            const buffer = Buffer.alloc(length);
            await fd.read(buffer, 0, length, start);
            return buffer;
        } finally {
            await fd.close();
        }
    }
}
