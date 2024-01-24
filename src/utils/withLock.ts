const locks = new Map<any, Map<string, Promise<any>>>();

export async function withLock<ReturnType>(scope: any, key: string, callback: () => Promise<ReturnType>): Promise<ReturnType> {
    while (locks.get(scope)?.has(key)) {
        await locks.get(scope)?.get(key);
    }

    const promise = callback();

    if (!locks.has(scope))
        locks.set(scope, new Map());

    locks.get(scope)!.set(key, promise);

    try {
        return await promise;
    } finally {
        locks.get(scope)?.delete(key);

        if (locks.get(scope)?.size === 0)
            locks.delete(scope);
    }
}
