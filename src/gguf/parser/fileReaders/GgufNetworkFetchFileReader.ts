import retry from "async-retry";
import {withLock} from "lifecycle-utils";
import {GgufReadOffset} from "../utils/GgufReadOffset.js";
import {defaultExtraAllocationSize, ggufDefaultRetryOptions} from "../../consts.js";
import {GgufFileReader} from "./GgufFileReader.js";

type GgufFetchFileReaderOptions = {
    url: string,
    retryOptions?: retry.Options,
    headers?: Record<string, string>
};

export class GgufNetworkFetchFileReader extends GgufFileReader {
    public readonly url: string;
    public readonly retryOptions: retry.Options;
    public readonly headers: Record<string, string>;

    public constructor({url, retryOptions = ggufDefaultRetryOptions, headers}: GgufFetchFileReaderOptions) {
        super();
        this.url = url;
        this.retryOptions = retryOptions;
        this.headers = headers ?? {};
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

    private async _fetchToExpandBufferUpToOffset(endOffset: number, extraAllocationSize: number = defaultExtraAllocationSize) {
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
                ...this.headers,
                Range: `bytes=${start}-${start + length}`,
                accept: "*/*"
            }
        });

        if (!response.ok)
            throw new Error(`Failed to fetch byte range: ${response.status} ${response.statusText}`);

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }
}
