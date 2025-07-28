export class LruCache<Key, Value> {
    public readonly maxSize: number;
    /** @internal */ private readonly _cache = new Map<Key, Value>();
    /** @internal */ private readonly _onDelete?: (key: Key, value: Value) => void;

    public constructor(maxSize: number, {
        onDelete
    }: {
        onDelete?(key: Key, value: Value): void
    } = {}) {
        this.maxSize = maxSize;
        this._onDelete = onDelete;
    }

    public get(key: Key): Value | undefined {
        if (!this._cache.has(key))
            return undefined;

        // move the key to the end of the cache
        const item = this._cache.get(key)!;
        this._cache.delete(key);
        this._cache.set(key, item);
        return item;
    }

    public set(key: Key, value: Value) {
        if (this._cache.has(key))
            this._cache.delete(key);
        else if (this._cache.size >= this.maxSize) {
            const firstKey = this.firstKey!;

            if (this._onDelete != null)
                this._onDelete(firstKey, this._cache.get(firstKey)!);

            this._cache.delete(firstKey);
        }

        this._cache.set(key, value);
        return this;
    }

    public get firstKey() {
        return this._cache.keys()
            .next().value;
    }

    public clear() {
        this._cache.clear();
    }

    public keys() {
        return this._cache.keys();
    }

    public delete(key: Key) {
        this._cache.delete(key);
    }
}
