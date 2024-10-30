import {DisposedError, DisposableHandle} from "lifecycle-utils";
import type {Promisable} from "./transformPromisable.js";

export class ThreadsSplitter {
    private readonly _threadDemands = new MaxNumberCollection();
    private readonly _threadFreeCallbacks: (() => void)[] = [];
    private _activeThreads: number = 0;
    private _totalWantedThreads: number = 0;
    public maxThreads: number;

    /**
     * Set to `0` to disable the limit
     * @param maxThreads
     */
    public constructor(maxThreads: number) {
        this.maxThreads = Math.floor(Math.max(0, maxThreads));

        this._removeWantedThreads = this._removeWantedThreads.bind(this);
        this._removeThreadDemand = this._removeThreadDemand.bind(this);
    }

    public createConsumer(wantedThreads: number, minThreads: number = 1) {
        if (wantedThreads !== 0 && minThreads > wantedThreads)
            minThreads = wantedThreads;

        if (this.maxThreads !== 0 && wantedThreads === 0)
            wantedThreads = this.maxThreads;

        return new ThreadsSplitterConsumer(this, wantedThreads, minThreads);
    }

    public normalizeThreadsValue(threads: number) {
        if (this.maxThreads === 0)
            return Math.floor(Math.max(0, threads));

        return Math.floor(Math.max(0, Math.min(this.maxThreads, threads)));
    }

    /** @internal */
    public _getUpdatedActiveThreads(inUsed: number, wanted: number, demanded: number) {
        const initialActiveThreads = this._activeThreads;
        if (inUsed > wanted)
            this._activeThreads -= inUsed - wanted;

        const idealThreads = this._calculateIdealProportion(wanted, demanded);
        let allocatedThreads = Math.min(inUsed, wanted); // already allocated

        if (allocatedThreads === idealThreads) {
            this._callOnActiveThreadsFreeIfCan(initialActiveThreads);
            return idealThreads;
        } else if (allocatedThreads > idealThreads) {
            this._activeThreads -= allocatedThreads - idealThreads;
            this._callOnActiveThreadsFreeIfCan(initialActiveThreads);
            return idealThreads;
        }

        const neededThreads = idealThreads - allocatedThreads;
        const availableThreads = this.maxThreads - this._activeThreads;
        if (neededThreads <= availableThreads) {
            this._activeThreads += neededThreads;
            this._callOnActiveThreadsFreeIfCan(initialActiveThreads);
            return idealThreads;
        }

        allocatedThreads += availableThreads;
        this._activeThreads += availableThreads;

        this._callOnActiveThreadsFreeIfCan(initialActiveThreads);
        return allocatedThreads;
    }

    private _callOnActiveThreadsFreeIfCan(lastActiveThreads: number) {
        if (this._activeThreads >= lastActiveThreads)
            return;

        while (this._threadFreeCallbacks.length > 0)
            this._threadFreeCallbacks.shift()?.();
    }

    private _calculateIdealProportion(wantedThreads: number, demandedThreads: number) {
        return Math.min(
            wantedThreads,
            Math.max(
                demandedThreads,
                Math.ceil(
                    (wantedThreads / this._totalWantedThreads) *
                    Math.max(1, this.maxThreads - (Math.max(demandedThreads, this._threadDemands.maxNumber) - demandedThreads))
                )
            )
        );
    }

    /** @internal */
    public _waitForFreeThread() {
        return new Promise<void>((resolve) => this._threadFreeCallbacks.push(resolve));
    }

    /** @internal */
    public _addWantedThreads(wantedThreads: number) {
        this._totalWantedThreads += wantedThreads;
    }

    /** @internal */
    public _removeWantedThreads(wantedThreads: number) {
        this._totalWantedThreads -= wantedThreads;
    }

    /** @internal */
    public _addThreadDemand(demandedThreads: number) {
        this._threadDemands.add(demandedThreads);
    }

    /** @internal */
    public _removeThreadDemand(demandedThreads: number) {
        const isHighestDemand = this._threadDemands.maxNumber === demandedThreads;
        this._threadDemands.remove(demandedThreads);

        if (demandedThreads !== 0 && isHighestDemand && this._threadDemands.maxNumber !== demandedThreads) {
            while (this._threadFreeCallbacks.length > 0)
                this._threadFreeCallbacks.shift()?.();
        }
    }
}

export class ThreadsSplitterConsumer {
    private readonly _threadsSplitter: ThreadsSplitter;
    private readonly _wantedThreads: number;
    private readonly _demandedThreads: number;
    private readonly _wantedThreadsGcRegistry: FinalizationRegistry<number>;
    private readonly _demandedThreadsGcRegistry: FinalizationRegistry<number>;
    private _usedThreads: number = 0;
    private _disposed: boolean = false;

    public constructor(threadsSplitter: ThreadsSplitter, wantedThreads: number, minThreads: number) {
        this._threadsSplitter = threadsSplitter;
        this._wantedThreads = wantedThreads;
        this._demandedThreads = minThreads;

        this._threadsSplitter._addWantedThreads(this._wantedThreads);
        this._threadsSplitter._addThreadDemand(this._demandedThreads);

        this._wantedThreadsGcRegistry = new FinalizationRegistry(this._threadsSplitter._removeWantedThreads);
        this._wantedThreadsGcRegistry.register(this, this._wantedThreads);

        this._demandedThreadsGcRegistry = new FinalizationRegistry(this._threadsSplitter._removeThreadDemand);
        this._demandedThreadsGcRegistry.register(this, this._demandedThreads);
    }

    public [Symbol.dispose]() {
        this.dispose();
    }

    public dispose() {
        if (this._disposed)
            return;

        this._disposed = true;

        this._threadsSplitter._removeWantedThreads(this._wantedThreads);
        this._threadsSplitter._removeThreadDemand(this._demandedThreads);

        this._wantedThreadsGcRegistry.unregister(this);
        this._demandedThreadsGcRegistry.unregister(this);
    }

    public getAllocationToConsume(): Promisable<[threadsToUse: number, usageHandle: DisposableHandle]> {
        if (this._disposed)
            throw new DisposedError();

        if (this._threadsSplitter.maxThreads === 0)
            return [this._wantedThreads, new DisposableHandle(() => {})];

        return this._getAsyncAllocationToConsume();
    }

    private async _getAsyncAllocationToConsume(): Promise<[threadsToUse: number, usageHandle: DisposableHandle]> {
        do {
            this._usedThreads = this._threadsSplitter._getUpdatedActiveThreads(
                this._usedThreads, this._wantedThreads, this._demandedThreads
            );

            if (this._usedThreads < this._demandedThreads) {
                this._usedThreads = this._threadsSplitter._getUpdatedActiveThreads(this._usedThreads, 0, 0);
                await this._threadsSplitter._waitForFreeThread();
            }
        } while (this._usedThreads < this._demandedThreads);

        return [this._usedThreads, new DisposableHandle(() => {
            this._usedThreads = this._threadsSplitter._getUpdatedActiveThreads(this._usedThreads, 0, 0);
        })];
    }
}

class MaxNumberCollection {
    private _countMap: Map<number, number> = new Map();
    private _maxNumber: number = 0;

    public add(number: number) {
        const count = this._countMap.get(number) ?? 0;
        this._countMap.set(number, count + 1);

        if (number > this._maxNumber)
            this._maxNumber = number;
    }

    public remove(number: number) {
        const count = this._countMap.get(number);
        if (count == null)
            return;

        if (count === 1) {
            this._countMap.delete(number);
            if (number === this._maxNumber)
                this._maxNumber = this._findMaxNumber();
        } else
            this._countMap.set(number, count - 1);
    }

    public get maxNumber() {
        return this._maxNumber;
    }

    private _findMaxNumber() {
        let maxNumber = 0;
        for (const number of this._countMap.keys()) {
            if (number > maxNumber)
                maxNumber = number;
        }

        return maxNumber;
    }
}
