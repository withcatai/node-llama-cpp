import {DisposedError} from "lifecycle-utils";
import {Token} from "../types.js";

export class TokenStreamRegulator {
    /** @internal */ private readonly _queue: QueuedTokenRelease[] = [];

    public addChunk({tokens, text}: {tokens: Token[], text: string}) {
        const queuedRelease = QueuedTokenRelease._create(tokens, text);

        this._queue.push(queuedRelease);

        return queuedRelease;
    }

    public popFreeChunkTokens() {
        const res: Token[] = [];

        while (this._queue.length > 0 && this._queue[0].isFree)
            res.push(...this._queue.shift()!.tokens);

        return res;
    }

    public getPartiallyFreeChunk() {
        if (this._queue.length > 0 && this._queue[0].isPartiallyFree) {
            const queuedRelease = this._queue[0];

            return {
                tokens: queuedRelease.tokens.slice(0, queuedRelease.getFreeTokenIndex()),
                text: queuedRelease.text.slice(0, queuedRelease.getFreeTextIndex())
            };
        }

        return {
            tokens: [] satisfies Token[],
            text: ""
        };
    }

    public getAllQueuedChunkTokens() {
        return this._queue.flatMap((queuedRelease) => queuedRelease.tokens);
    }
}

export class QueuedTokenRelease {
    /** @internal */ private readonly _textLocks = new Set<QueuedTokenReleaseLock>();
    /** @internal */ private readonly _tokenLocks = new Set<QueuedTokenReleaseLock>();
    /** @internal */ private _tokens: readonly Token[];
    /** @internal */ private _text: string;

    private constructor(tokens: readonly Token[], text: string) {
        this._tokens = tokens;
        this._text = text;
    }

    public get tokens() {
        return this._tokens;
    }

    public get text() {
        return this._text;
    }

    public get isFree() {
        return this._textLocks.size === 0 && this._tokenLocks.size === 0;
    }

    public get isPartiallyFree() {
        return this._textLocks.size !== 0 && this._tokenLocks.size !== 0;
    }

    public getFreeTextIndex() {
        if (this._textLocks.size === 0)
            return this.text.length;

        return [...this._textLocks]
            .reduce((res, lock) => Math.min(res, lock.index), this.text.length);
    }

    public getFreeTokenIndex() {
        if (this._tokenLocks.size === 0)
            return this.tokens.length;

        return [...this._tokenLocks]
            .reduce((res, lock) => Math.min(res, lock.index), this.tokens.length);
    }

    public createTextIndexLock(startIndex: number) {
        const lock = QueuedTokenReleaseLock._create(startIndex, this._textLocks);

        if (startIndex >= 0 && startIndex < this.text.length)
            this._textLocks.add(lock);

        return lock;
    }

    public createTokenIndexLock(startIndex: number) {
        const lock = QueuedTokenReleaseLock._create(startIndex, this._tokenLocks);

        if (startIndex >= 0 && startIndex < this.tokens.length)
            this._tokenLocks.add(lock);

        return lock;
    }

    public modifyTokensAndText(tokens: readonly Token[], text: string) {
        this._tokens = tokens;
        this._text = text;
    }

    /** @internal */
    public static _create(tokens: Token[], text: string) {
        return new QueuedTokenRelease(tokens, text);
    }
}

export class QueuedTokenReleaseLock {
    /** @internal */ private readonly _index;
    /** @internal */ private readonly _locks: Set<QueuedTokenReleaseLock>;

    private constructor(index: number, locks: Set<QueuedTokenReleaseLock>) {
        this._index = index;
        this._locks = locks;
    }

    public get index() {
        return this._index;
    }

    public duplicate() {
        if (!this._locks.has(this))
            throw new DisposedError();

        const lock = QueuedTokenReleaseLock._create(this._index, this._locks);

        this._locks.add(lock);

        return lock;
    }

    public dispose() {
        this._locks.delete(this);
    }

    public [Symbol.dispose]() {
        this.dispose();
    }

    /** @internal */
    public static _create(length: number, locks: Set<QueuedTokenReleaseLock>) {
        return new QueuedTokenReleaseLock(length, locks);
    }
}
