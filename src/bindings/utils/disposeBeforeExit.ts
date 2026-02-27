let disposeRefs = new Set<DisposableWeakRef>();

export function registerDisposeBeforeExit(ref: DisposableWeakRef) {
    if (disposeRefs.size === 0)
        process.once("beforeExit", onBeforeExit);

    disposeRefs.add(ref);
}

export function unregisterDisposeBeforeExit(ref: DisposableWeakRef) {
    const hadRefs = disposeRefs.size !== 0;

    disposeRefs.delete(ref);

    if (hadRefs && disposeRefs.size === 0)
        process.off("beforeExit", onBeforeExit);
}

function onBeforeExit() {
    const refs = disposeRefs;
    disposeRefs = new Set();

    const promises: Promise<void>[] = [];

    for (const ref of refs) {
        const disposeTarget = ref.deref();
        if (disposeTarget == null)
            continue;

        if (isAsyncDisposable(disposeTarget))
            promises.push(disposeTarget[Symbol.asyncDispose]());
        else if (isDisposable(disposeTarget))
            disposeTarget[Symbol.dispose]();
    }

    if (promises.length > 0)
        return Promise.all(promises).then(() => undefined);

    return undefined;
}

type DisposableWeakRef = WeakRef<{[Symbol.dispose](): void} | {[Symbol.asyncDispose](): Promise<void>}>;

function isAsyncDisposable(target: any): target is {[Symbol.asyncDispose](): Promise<void>} {
    return Symbol.asyncDispose in target && target[Symbol.asyncDispose] instanceof Function;
}

function isDisposable(target: any): target is {[Symbol.dispose](): void} {
    return Symbol.dispose in target && target[Symbol.dispose] instanceof Function;
}
