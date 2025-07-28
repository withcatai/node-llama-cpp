import retry from "async-retry";
import {withLock} from "lifecycle-utils";
import {GgufReadOffset} from "../utils/GgufReadOffset.js";
import {defaultExtraAllocationSize, ggufDefaultFetchRetryOptions} from "../consts.js";
import {ModelFileAccessTokens, resolveModelFileAccessTokensTryHeaders} from "../../utils/modelFileAccessTokens.js";
import {ModelDownloadEndpoints} from "../../utils/modelDownloadEndpoints.js";
import {GgufFileReader} from "./GgufFileReader.js";

type GgufFetchFileReaderOptions = {
    url: string,
    retryOptions?: retry.Options,
    headers?: Record<string, string>,
    signal?: AbortSignal,
    tokens?: ModelFileAccessTokens,
    endpoints?: ModelDownloadEndpoints
};

export class GgufNetworkFetchFileReader extends GgufFileReader {
    public readonly url: string;
    public readonly retryOptions: retry.Options;
    public readonly headers: Record<string, string>;
    public readonly tokens?: ModelFileAccessTokens;
    public readonly endpoints?: ModelDownloadEndpoints;
    private readonly _signal?: AbortSignal;
    private _tryHeaders: Record<string, string>[] | undefined = undefined;

    public constructor({url, retryOptions = ggufDefaultFetchRetryOptions, headers, tokens, endpoints, signal}: GgufFetchFileReaderOptions) {
        super();
        this.url = url;
        this.retryOptions = retryOptions;
        this.headers = headers ?? {};
        this.tokens = tokens;
        this.endpoints = endpoints;
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
        await withLock([this as GgufNetworkFetchFileReader, "modifyBuffer"], this._signal, async () => {
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

    private async _fetchByteRange(start: number, length: number): Promise<Buffer> {
        if (this._tryHeaders == null)
            this._tryHeaders = await resolveModelFileAccessTokensTryHeaders(this.url, this.tokens, this.endpoints, this.headers);

        const headersToTry = [this.headers, ...this._tryHeaders];

        while (headersToTry.length > 0) {
            const headers = headersToTry.shift();

            const response = await fetch(this.url, {
                headers: {
                    ...headers,
                    Range: `bytes=${start}-${start + length}`,
                    accept: "*/*"
                },
                signal: this._signal
            });

            if ((response.status >= 500 || response.status === 429 || response.status === 401) && headersToTry.length > 0)
                continue;

            if (!response.ok)
                throw new Error(`Failed to fetch byte range: ${response.status} ${response.statusText}`);

            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        }

        throw new Error("Failed to fetch byte range: no more headers to try");
    }
}
