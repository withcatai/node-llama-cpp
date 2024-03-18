import retry from "async-retry";
import {withLock} from "lifecycle-utils";
import {GgufReadOffset} from "../utils/GgufReadOffset.js";
import {GgufBaseFileReader, ALLOCATION_SIZE} from "./GgufBaseFileReader.js";

type GgufFetchFileReaderOptions = {
    url: string,
    retryOptions?: retry.Options
};

const defaultRetryOptions: retry.Options = {
    retries: 10,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 1000 * 16
} as const;

export class GgufFetchFileReader extends GgufBaseFileReader {
    public readonly url: string;
    public readonly retryOptions: retry.Options;

    public constructor({url, retryOptions = defaultRetryOptions}: GgufFetchFileReaderOptions) {
        super();
        this.url = url;
        this.retryOptions = retryOptions;
    }

    public async readByteRange(offset: number | GgufReadOffset, length: number) {
        const readOffset = GgufReadOffset.resolveReadOffset(offset);
        const endOffset = readOffset.offset + length;

        if (endOffset >= this._buffer.length)
            await this._fetchToExpandBufferUpToOffset(endOffset);

        const res = this._buffer.subarray(readOffset.offset, endOffset);
        readOffset.moveBy(length);
        return res;
    }

    private async _fetchToExpandBufferUpToOffset(endOffset: number, extraAllocationSize: number = ALLOCATION_SIZE) {
        await withLock(this, "modifyBuffer", async () => {
            if (endOffset < this._buffer.length)
                return;

            const missingBytesBuffer = await retry(async () => {
                return await this._fetchByteRange(this._buffer.length, endOffset + extraAllocationSize - this._buffer.length);
            }, this.retryOptions);
            this._addToBuffer(missingBytesBuffer);
        });
    }

    private async _fetchByteRange(start: number, length: number) {
        const response = await fetch(this.url, {
            headers: {
                Range: `bytes=${start}-${start + length}`,
                accept: "*/*"
            }
        });
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }
}
