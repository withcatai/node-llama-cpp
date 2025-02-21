import {DisposedError} from "lifecycle-utils";
import {Token, Tokenizer} from "../types.js";
import {maxRecentDetokenizerTokens} from "../consts.js";
import {pushAll} from "./pushAll.js";

export class TokenStreamRegulator {
    /** @internal */ private readonly _queue: QueuedTokenRelease[] = [];
    /** @internal */ private readonly _LastTokens: Token[] = [];

    public addChunk({tokens, text}: {tokens: Token[], text: string}) {
        const queuedRelease = QueuedTokenRelease._create(tokens, text);

        this._queue.push(queuedRelease);

        return queuedRelease;
    }

    public popFreeChunkTokens() {
        const res: Token[] = [];

        while (this._queue.length > 0 && this._queue[0]!.isFree) {
            const tokens = this._queue.shift()!.tokens;
            pushAll(res, tokens);
            pushAll(this._LastTokens, tokens);
        }

        if (this._LastTokens.length > maxRecentDetokenizerTokens)
            this._LastTokens.splice(0, this._LastTokens.length - maxRecentDetokenizerTokens);

        return res;
    }

    public getPartiallyFreeChunk(tokenizer: Tokenizer) {
        if (this._queue.length > 0 && this._queue[0]!.isPartiallyFree) {
            const queuedRelease = this._queue[0]!;

            if (queuedRelease.hasTextLocks && !queuedRelease.hasTokenLocks)
                return {
                    tokens: [],
                    text: queuedRelease.text.slice(0, queuedRelease.getFreeTextIndex())
                };
            else if (queuedRelease.hasTokenLocks && !queuedRelease.hasTextLocks) {
                const tokens = queuedRelease.tokens.slice(0, queuedRelease.getFreeTokenIndex());
                return {
                    tokens,
                    text: tokenizer.detokenize(tokens, false, this._LastTokens)
                };
            }

            const freeTokenIndex = queuedRelease.getFreeTokenIndex();
            const tokens = queuedRelease.tokens.slice(0, freeTokenIndex);
            const tokensText = tokenizer.detokenize(tokens, false, this._LastTokens);

            const freeTextIndex = queuedRelease.getFreeTextIndex();
            const text = queuedRelease.text.slice(0, freeTextIndex);

            if (text.length > tokensText.length) {
                return {
                    tokens,
                    text: tokensText
                };
            } else if (text.length < tokensText.length) {
                const resTokens: Token[] = [];
                let resTokensText = "";

                const lastTokens = this._LastTokens.slice();
                for (const token of tokens) {
                    const tokenText = tokenizer.detokenize([token], false, lastTokens);
                    lastTokens.push(token);

                    // ensure partial tokens are detokenized correctly
                    if (resTokensText.length + tokenText.length > text.length)
                        resTokensText = tokenizer.detokenize(resTokens, false, this._LastTokens);

                    if (resTokensText.length + tokenText.length > text.length) {
                        const remainingText = text.slice(resTokensText.length);
                        const remainingTokens = tokenizer(remainingText, false, "trimLeadingSpace");
                        pushAll(resTokens, remainingTokens);
                        break;
                    }

                    resTokens.push(token);
                    resTokensText += tokenText;
                }

                return {
                    tokens: resTokens,
                    text
                };
            }

            return {
                tokens: queuedRelease.tokens.slice(0, freeTokenIndex),
                text: queuedRelease.text.slice(0, freeTextIndex)
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

    public getLastQueuedChunkTokens(maxTokens: number = maxRecentDetokenizerTokens) {
        const res: Token[] = [];

        for (let i = this._queue.length - 1; i >= 0 && res.length < maxTokens; i--) {
            const tokens = this._queue[i]!.tokens;
            for (let j = tokens.length - 1; j >= 0 && res.length < maxTokens; j--)
                res.unshift(tokens[j]!);
        }

        return this._queue.flatMap((queuedRelease) => queuedRelease.tokens);
    }

    public clearQueue() {
        this._queue.length = 0;
    }

    public reset() {
        this.clearQueue();
        this._LastTokens.length = 0;
    }

    public removeChunkIfLast(queuedTokenRelease: QueuedTokenRelease | undefined) {
        if (this._queue.at(-1) === queuedTokenRelease)
            return this._queue.pop() != null;

        return false;
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

    public get hasTextLocks() {
        return this._textLocks.size > 0;
    }

    public get hasTokenLocks() {
        return this._tokenLocks.size > 0;
    }

    public get isPartiallyFree() {
        if (this.isFree)
            return true;

        const freeTextIndex = this.getFreeTextIndex();
        const freeTokenIndex = this.getFreeTokenIndex();
        return freeTextIndex > 0 && freeTokenIndex > 0;
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
