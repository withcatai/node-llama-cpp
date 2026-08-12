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
    private _fileSize?: number;
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

        if (endOffset > this._buffer.length)
            return this._fetchToExpandBufferUpToOffset(endOffset)
                .then(() => {
                    if (endOffset >= this._buffer.length)
                        throw new Error("Expected buffer to be long enough for the requested byte range");
                });

        return undefined;
    }

    private async _fetchToExpandBufferUpToOffset(endOffset: number, extraAllocationSize: number = defaultExtraAllocationSize) {
        await withLock([this as GgufNetworkFetchFileReader, "modifyBuffer"], this._signal, async () => {
            if (endOffset <= this._buffer.length)
                return;

            const missingBytesBuffer = await retry(async (bail) => {
                try {
                    return await this._fetchByteRange(this._buffer.length, endOffset + extraAllocationSize - this._buffer.length);
                } catch (err) {
                    if (this._signal?.aborted) {
                        bail(this._signal.reason);
                        throw this._signal.reason;
                    } else if (err instanceof FetchError && !err.canRetry) {
                        bail(err);
                        throw err;
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

        if (this._fileSize != null && start >= this._fileSize)
            throw new FetchError(`Requested byte range starting at index ${start} exceeds the file size of ${this._fileSize}`, false);

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

            const technicalIssue = response.status >= 500 || response.status === 429;
            const cannotAccess = response.status >= 400 && response.status <= 404;
            if (headersToTry.length > 0 && (technicalIssue || cannotAccess))
                continue;

            if (!response.ok)
                throw new FetchError(`Failed to fetch byte range: ${response.status} ${response.statusText}`, technicalIssue);

            const fileSizeHeader = response.headers.get("content-range")?.split("/")[1] ?? response.headers.get("x-linked-size");
            if (fileSizeHeader != null) {
                const fileSize = Number(fileSizeHeader);
                if (Number.isSafeInteger(fileSize) && fileSize >= 0 && (this._fileSize == null || fileSize > this._fileSize))
                    this._fileSize = fileSize;
            }

            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        }

        throw new Error("Failed to fetch byte range: no more headers to try");
    }
}

class FetchError extends Error {
    public readonly canRetry: boolean;

    public constructor(message: string, canRetry: boolean) {
        super(message);
        this.canRetry = canRetry;

        Object.defineProperty(this, "canRetry" satisfies keyof this, {
            enumerable: false,
            configurable: false,
            value: canRetry
        });
    }
}
