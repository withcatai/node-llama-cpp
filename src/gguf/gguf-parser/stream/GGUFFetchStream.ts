import retry from "async-retry";
import AwaitLock from "await-lock";
import GgufBaseStream, {ALLOCATION_SIZE} from "./GGUFBaseStream.js";

type GGUFFetchStreamOptions = {
    retry: retry.Options
};

export default class GGUFFetchStream extends GgufBaseStream {
    private _lock = new ("default" in AwaitLock && AwaitLock || AwaitLock)();

    constructor(public readonly url: string, public readonly options: Partial<GGUFFetchStreamOptions> = {}) {
        super();
    }

    override async readNBytes(numBytes: number, offset = 0): Promise<Buffer> {
        await this._lock.acquireAsync();

        try {
            if (offset + numBytes < this._buffer.length) {
                return this._buffer.subarray(offset, offset + numBytes);
            }

            const fetchMissingBytes = await retry(async () => {
                return await this._fetchBytesWithoutRetry(this._buffer.length, offset + numBytes + ALLOCATION_SIZE);
            }, this.options.retry);

            this._addToBuffer(fetchMissingBytes);
            return this.readNBytes(numBytes, offset);
        } finally {
            this._lock.release();
        }
    }

    private async _fetchBytesWithoutRetry(start: number, end: number) {
        const response = await fetch(this.url, {
            headers: {
                Range: `bytes=${start}-${end}`,
                accept: "*/*"
            }
        });
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }
}


