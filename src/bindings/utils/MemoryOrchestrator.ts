import {EventRelay} from "lifecycle-utils";

export class MemoryOrchestrator {
    /** @internal */ private readonly _getMemoryState: () => {free: number, total: number, unifiedSize: number};
    /** @internal */ private _reservedMemory: number = 0;

    public readonly onMemoryReservationRelease = new EventRelay<void>();

    public constructor(getMemoryState: () => {free: number, total: number, unifiedSize: number}) {
        this._getMemoryState = getMemoryState;
    }

    public reserveMemory(bytes: number) {
        this._reservedMemory += bytes;

        return MemoryReservation._create(bytes, () => {
            this._reservedMemory -= bytes;
            this.onMemoryReservationRelease.dispatchEvent();
        });
    }

    public async getMemoryState() {
        const {free, total, unifiedSize} = this._getMemoryState();

        return {
            free: Math.max(0, free - this._reservedMemory),
            total,
            unifiedSize
        };
    }
}

export class MemoryReservation {
    /** @internal */ private readonly _size: number;
    /** @internal */ private _dispose: (() => void) | null;

    private constructor(size: number, dispose: () => void) {
        this._size = size;
        this._dispose = dispose;
    }

    public get size(): number {
        return this._size;
    }

    public get disposed(): boolean {
        return this._dispose == null;
    }

    public [Symbol.dispose](): void {
        this.dispose();
    }

    public dispose(): void {
        if (this._dispose != null)
            this._dispose();

        this._dispose = null;
    }

    public static _create(bytes: number, dispose: () => void): MemoryReservation {
        return new MemoryReservation(bytes, dispose);
    }
}
