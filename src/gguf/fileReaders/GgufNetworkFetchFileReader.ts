import retry from "async-retry";
import {withLock} from "lifecycle-utils";
import {GgufReadOffset} from "../utils/GgufReadOffset.js";
import {defaultExtraAllocationSize, ggufDefaultFetchRetryOptions} from "../consts.js";
import {GgufFileReader} from "./GgufFileReader.js";

type GgufFetchFileReaderOptions = {
    url: string,
    retryOptions?: retry.Options,
    headers?: Record<string, string>,
    signal?: AbortSignal
};

export class GgufNetworkFetchFileReader extends GgufFileReader {
    public readonly url: string;
    public readonly retryOptions: retry.Options;
    public readonly headers: Record<string, string>;
    private readonly _signal?: AbortSignal;

    public constructor({url, retryOptions = ggufDefaultFetchRetryOptions, headers, signal}: GgufFetchFileReaderOptions) {
        super();
        this.url = url;
        this.retryOptions = retryOptions;
        this.headers = headers ?? {};
        this._signal = signal;
    }

    public readByteRange(offset: number | GgufReadOffset, length: number) {
        const readOffset = GgufReadOffset.resolveReadOffset(offset);
        const endOffset = readOffset.offset + length;

        if (endOffset >= this._buffer.length)
            return this._fetchToExpandBufferUpToOffset(endOffset)
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
            return this._fetchToExpandBufferUpToOffset(endOffset)
                .then(() => {
                    if (endOffset >= this._buffer.length)
                        throw new Error("Expected buffer to be long enough for the requested byte range");
                });

        return undefined;
    }

    private async _fetchToExpandBufferUpToOffset(endOffset: number, extraAllocationSize: number = defaultExtraAllocationSize) {
        await withLock(this, "modifyBuffer", this._signal, async () => {
            if (endOffset < this._buffer.length)
                return;

            const missingBytesBuffer = await retry(async (bail) => {
                try {
                    return await this._fetchByteRange(this._buffer.length, endOffset + extraAllocationSize - this._buffer.length);
                } catch (err) {
                    if (this._signal?.aborted) {
                        bail(this._signal.reason);
                        throw this._signal.reason;
                    }

                    throw err;
                }
            }, this.retryOptions);

            if (this._signal?.aborted)
                throw this._signal.reason;

            this._addToBuffer(missingBytesBuffer);
        });
    }

    private async _fetchByteRange(start: number, length: number) {
        const response = await fetch(this.url, {
            headers: {
                ...this.headers,
                Range: `bytes=${start}-${start + length}`,
                accept: "*/*"
            },
            signal: this._signal
        });

        if (!response.ok)
            throw new Error(`Failed to fetch byte range: ${response.status} ${response.statusText}`);

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }
}
