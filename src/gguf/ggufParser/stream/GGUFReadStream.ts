import fs from "fs/promises";
import retry from "async-retry";
import {withLock} from "lifecycle-utils";
import GgufBaseStream, {ALLOCATION_SIZE} from "./GGUFBaseStream.js";

type GGUFReadStreamOptions = {
    retry?: retry.Options,
    mode: string
};

const DEFAULT_OPTIONS: GGUFReadStreamOptions = {
    mode: "r"
};

export default class GGUFReadStream extends GgufBaseStream {
    public readonly options: GGUFReadStreamOptions;
    public readonly path: string;

    public constructor(path: string, options: Partial<GGUFReadStreamOptions> = {}) {
        super();
        this.path = path;
        this.options = {...DEFAULT_OPTIONS, ...options};
    }

    public override async readNBytes(numBytes: number, offset = 0): Promise<Buffer> {
        return await withLock(this, "_lock", async function readNBytesWithoutLock(): Promise<Buffer> {
            if (offset + numBytes < this._buffer.length) {
                return this._buffer.subarray(offset, offset + numBytes);
            }

            const readMissingBytes = await retry(async () => {
                return await this._readBytesWithoutRetry(numBytes + ALLOCATION_SIZE, this._buffer.length);
            }, this.options.retry);

            this._addToBuffer(readMissingBytes);
            return await readNBytesWithoutLock.call(this);
        });
    }

    private async _readBytesWithoutRetry(numBytes: number, offset: number) {
        const fd = await fs.open(this.path, this.options.mode);
        try {
            const buffer = Buffer.alloc(numBytes);
            await fd.read(buffer, 0, numBytes, offset);
            return buffer;
        } finally {
            await fd.close();
        }
    }
}
