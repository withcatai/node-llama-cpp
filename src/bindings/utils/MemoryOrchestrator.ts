import {EventRelay} from "lifecycle-utils";

export class MemoryOrchestrator {
    /** @internal */ private readonly _getMemoryState: () => {free: number, total: number, unifiedSize: number};
    /** @internal */ private _reservedMemory: number = 0;
    /** @internal */ public _markedMemory: number = 0;
    /** @internal */ private _memoryCap: number | null = null;
    /** @internal */ private _padding: number = 0;

    public readonly onMemoryReservationRelease = new EventRelay<void>();
    public readonly onMemoryMarkingRelease = new EventRelay<void>();

    public constructor(getMemoryState: () => {free: number, total: number, unifiedSize: number}) {
        this._getMemoryState = getMemoryState;

        this._onMarkFinalized = this._onMarkFinalized.bind(this);
    }

    public reserveMemory(bytes: number) {
        this._reservedMemory += bytes;

        return MemoryReservation._create(bytes, () => {
            this._reservedMemory -= bytes;
            this.onMemoryReservationRelease.dispatchEvent();
        });
    }

    public markAllocation(bytes: number) {
        this._markedMemory += bytes;

        return MemoryMarking._create(bytes, this);
    }

    public set padding(bytes: number) {
        this._padding = bytes;
    }

    public get padding() {
        return this._padding;
    }

    public set memoryCap(maxBytes: number | null) {
        this._memoryCap = maxBytes ?? null;
    }

    public get memoryCap() {
        return this._memoryCap;
    }

    public get markedMemory() {
        return this._markedMemory;
    }

    public async getMemoryState() {
        let {free, total, unifiedSize} = this._getMemoryState();

        free = Math.max(0, free - this._padding);

        if (this._memoryCap != null) {
            total = Math.min(total, this._memoryCap);
            free = Math.max(0, Math.min(free, this._memoryCap, total - this._markedMemory));
            unifiedSize = Math.min(unifiedSize, this._memoryCap);
        }

        return {
            free: Math.max(0, free - this._reservedMemory),
            total,
            unifiedSize
        };
    }

    /** @internal */
    public _onMarkFinalized(bytes: number) {
        this._markedMemory -= bytes;
        this.onMemoryMarkingRelease.dispatchEvent();
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

export class MemoryMarking {
    /** @internal */ private readonly _size: number;
    /** @internal */ private _orchestrator?: MemoryOrchestrator;
    /** @internal */ private _finalizationRegistry: FinalizationRegistry<number>;

    private constructor(size: number, orchestrator: MemoryOrchestrator) {
        this._size = size;
        this._orchestrator = orchestrator;
        this._finalizationRegistry = new FinalizationRegistry(orchestrator._onMarkFinalized);
        this._finalizationRegistry.register(this, size);
    }

    public get size(): number {
        return this._size;
    }

    public get disposed(): boolean {
        return this._orchestrator == null;
    }

    public [Symbol.dispose](): void {
        this.dispose();
    }

    public dispose(): void {
        if (this._orchestrator != null) {
            this._orchestrator._onMarkFinalized(this._size);
            this._finalizationRegistry.unregister(this);
        }

        this._orchestrator = undefined;
    }

    public static _create(bytes: number, orchestrator: MemoryOrchestrator): MemoryMarking {
        return new MemoryMarking(bytes, orchestrator);
    }
}
