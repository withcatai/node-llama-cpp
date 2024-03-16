import {DisposedError} from "lifecycle-utils";

export class DisposeGuard {
    /** @internal */ private _preventionHandles: number = 0;
    /** @internal */ private _awaitingDisposeLockCallbacks: (() => void)[] = [];
    /** @internal */ private _disposeActivated: boolean = false;
    /** @internal */ private _parentDisposeGuardsLocks: Map<DisposeGuard, DisposalPreventionHandle | null> = new Map();

    public constructor(parentDisposeGuards: DisposeGuard[] = []) {
        for (const parent of parentDisposeGuards)
            this._parentDisposeGuardsLocks.set(parent, null);
    }

    public addParentDisposeGuard(parent: DisposeGuard) {
        if (this._parentDisposeGuardsLocks.has(parent))
            return;

        this._parentDisposeGuardsLocks.set(parent, null);

        if (this._preventionHandles > 0)
            this._parentDisposeGuardsLocks.set(parent, parent.createPreventDisposalHandle(true));
    }

    public removeParentDisposeGuard(parent: DisposeGuard) {
        const parentLock = this._parentDisposeGuardsLocks.get(parent);

        if (parentLock != null) {
            parentLock.dispose();
            this._parentDisposeGuardsLocks.delete(parent);
        }
    }

    public async acquireDisposeLock() {
        return new Promise<void>((accept) => {
            if (this._preventionHandles > 0)
                this._awaitingDisposeLockCallbacks.push(accept);
            else {
                this._disposeActivated = true;
                accept();
            }
        });
    }

    public createPreventDisposalHandle(ignoreAwaitingDispose: boolean = false) {
        if (this._isDisposeActivated() || (!ignoreAwaitingDispose && this._hasAwaitingDisposeLocks()))
            throw new DisposedError();

        this._preventionHandles++;
        try {
            this._updateParentDisposeGuardLocks();
        } catch (err) {
            this._preventionHandles--;

            if (this._preventionHandles === 0)
                this._updateParentDisposeGuardLocks();

            throw err;
        }

        return DisposalPreventionHandle._create(() => {
            this._preventionHandles--;

            this._activateLocksIfNeeded();
            this._updateParentDisposeGuardLocks(true);
        });
    }

    /** @internal */
    private _isDisposeActivated(): boolean {
        if (this._disposeActivated)
            return true;

        return [...this._parentDisposeGuardsLocks.keys()].some((parent) => parent._isDisposeActivated());
    }

    /** @internal */
    private _activateLocksIfNeeded() {
        if (this._preventionHandles > 0)
            return;

        while (this._awaitingDisposeLockCallbacks.length > 0) {
            this._disposeActivated = true;
            this._awaitingDisposeLockCallbacks.shift()!();
        }
    }

    /** @internal */
    private _updateParentDisposeGuardLocks(onlyAllowRemoval: boolean = false) {
        if (this._preventionHandles === 0) {
            for (const parent of this._parentDisposeGuardsLocks.keys()) {
                const parentLock = this._parentDisposeGuardsLocks.get(parent);

                if (parentLock == null)
                    continue;

                parentLock.dispose();
                this._parentDisposeGuardsLocks.set(parent, null);
            }
        } else if (!onlyAllowRemoval) {
            for (const parent of this._parentDisposeGuardsLocks.keys()) {
                if (this._parentDisposeGuardsLocks.get(parent) != null)
                    continue;

                this._parentDisposeGuardsLocks.set(parent, parent.createPreventDisposalHandle(true));
            }
        }
    }

    /** @internal */
    private _hasAwaitingDisposeLocks(): boolean {
        if (this._awaitingDisposeLockCallbacks.length > 0)
            return true;

        return [...this._parentDisposeGuardsLocks.keys()].some((parent) => parent._hasAwaitingDisposeLocks());
    }
}

export class DisposalPreventionHandle {
    /** @internal */
    private _dispose: (() => void) | null;

    private constructor(dispose: () => void) {
        this._dispose = dispose;

        this.dispose = this.dispose.bind(this);
        this[Symbol.dispose] = this[Symbol.dispose].bind(this);
    }

    public dispose() {
        if (this._dispose != null) {
            this._dispose();
            this._dispose = null;
        }
    }

    public [Symbol.dispose]() {
        this.dispose();
    }

    public get disposed() {
        return this._dispose == null;
    }

    /** @internal */
    public static _create(dispose: () => void) {
        return new DisposalPreventionHandle(dispose);
    }
}
