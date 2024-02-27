import retry from "async-retry";
import {withLock} from "lifecycle-utils";

import GgufBaseStream, {ALLOCATION_SIZE} from "./GGUFBaseStream.js";

type GGUFFetchStreamOptions = {
    retry: retry.Options
};

export default class GGUFFetchStream extends GgufBaseStream {
    public readonly url: string;
    public readonly options: Partial<GGUFFetchStreamOptions> = {};

    public constructor(url: string, options: Partial<GGUFFetchStreamOptions> = {}) {
        super();
        this.options = options;
        this.url = url;
    }

    public override async readNBytes(numBytes: number, offset = 0): Promise<Buffer> {
        return await withLock(this, "_lock", async function readNBytesWithoutLock(): Promise<Buffer> {
            if (offset + numBytes < this._buffer.length) {
                return this._buffer.subarray(offset, offset + numBytes);
            }

            const fetchMissingBytes = await retry(async () => {
                return await this._fetchBytesWithoutRetry(this._buffer.length, offset + numBytes + ALLOCATION_SIZE);
            }, this.options.retry);

            this._addToBuffer(fetchMissingBytes);
            return await readNBytesWithoutLock.call(this);
        });
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


