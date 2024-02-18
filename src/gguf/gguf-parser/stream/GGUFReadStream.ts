import fs from "fs/promises";
import retry from "async-retry";
import AwaitLock from "await-lock";
import GgufBaseStream, {ALLOCATION_SIZE} from "./GGUFBaseStream.js";

type GGUFReadStreamOptions = {
    retry?: retry.Options
    mode: string;
};

const DEFAULT_OPTIONS: GGUFReadStreamOptions = {
    mode: "r"
};

export default class GGUFReadStream extends GgufBaseStream {
    private _lock = new ("default" in AwaitLock && AwaitLock || AwaitLock)();
    public readonly options: GGUFReadStreamOptions;

    constructor(public readonly path: string, options: Partial<GGUFReadStreamOptions> = {}) {
        super();
        this.options = {...DEFAULT_OPTIONS, ...options};
    }

    override async readNBytes(numBytes: number, offset = 0): Promise<Buffer> {
        await this._lock.acquireAsync();

        try {
            if (offset + numBytes < this._buffer.length) {
                return this._buffer.subarray(offset, offset + numBytes);
            }

            const readMissingBytes = await retry(async () => {
                return await this._readBytesWithoutRetry(numBytes + ALLOCATION_SIZE, this._buffer.length);
            }, this.options.retry);

            this._addToBuffer(readMissingBytes);
            return this.readNBytes(numBytes, offset);
        } finally {
            this._lock.release();
        }
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
