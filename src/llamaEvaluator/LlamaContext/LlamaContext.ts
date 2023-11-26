import {DisposeAggregator, EventRelay, withLock, DisposedError} from "lifecycle-utils";
import {removeNullFields} from "../../utils/removeNullFields.js";
import {Token} from "../../types.js";
import {BatchLogitIndex} from "../../utils/getBin.js";
import {AddonContext} from "../LlamaBins.js";
import {LlamaModel} from "../LlamaModel.js";
import {LlamaGrammarEvaluationState} from "../LlamaGrammarEvaluationState.js";
import {
    BatchingOptions, BatchItem, ContextShiftOptions, ContextTokensDeleteRange, EvaluationPriority, LlamaContextOptions,
    LlamaContextRepeatPenalty, PrioritizedBatchItem, TokenPriority
} from "./types.js";
import {resolveBatchItemsPrioritizingStrategy} from "./utils/resolveBatchItemsPrioritizingStrategy.js";


export class LlamaContext {
    /** @internal */ public readonly _ctx: AddonContext;
    /** @internal */ public readonly _onReclaimUnusedSequenceId = new EventRelay<void>();

    /** @internal */ private readonly _model: LlamaModel;
    /** @internal */ private readonly _contextSize: number;
    /** @internal */ private readonly _batchSize: number;
    /** @internal */ private readonly _totalSequences: number;
    /** @internal */ private readonly _unusedSequenceIds: number[] = [];
    /** @internal */ private readonly _batchingOptions: Required<BatchingOptions>;
    /** @internal */ private readonly _queuedDecodeSequenceIds = new Set<number>();
    /** @internal */ private readonly _queuedDecodes: InternalQueuedDecode[] = [];
    /** @internal */ private readonly _disposeAggregator = new DisposeAggregator();
    /** @internal */ private _nextGeneratedSequenceId = 0;
    /** @internal */ private _dispatchDecodeScheduled = false;
    /** @internal */ private _batchDispatchPending = false;
    /** @internal */ private _currentDispatchBatchHandle: object = {};
    /** @internal */ private _allocatedContextSize?: number;
    /** @internal */ private _disposed: boolean = false;

    public readonly onDispose = new EventRelay<void>();

    /**
     * @param options
     */
    public constructor({
        model,
        sequences = 1,
        seed = null,
        contextSize = model.trainContextSize,
        batchSize = contextSize,
        f16Kv,
        logitsAll,
        embedding,
        threads = 6,
        batching: {
            dispatchSchedule: batchingDispatchSchedule = "nextTick",
            itemsPrioritizingStrategy: batchingItemsPrioritizingStrategy = "maximumParallelism"
        } = {}
    }: LlamaContextOptions) {
        if (model.disposed)
            throw new DisposedError();

        this._model = model;
        this._totalSequences = Math.max(1, Math.floor(sequences));
        this._contextSize = Math.max(2, contextSize);
        this._batchSize = Math.max(batchSize, this._totalSequences);
        this._ctx = new AddonContext(this._model._model, removeNullFields({
            seed: seed != null ? Math.max(-1, Math.floor(seed)) : undefined,
            contextSize: contextSize * this._totalSequences, // each sequence needs its own <contextSize> of cells
            batchSize: this._batchSize,
            f16Kv,
            logitsAll,
            embedding,
            threads
        }));
        this._batchingOptions = {
            dispatchSchedule: batchingDispatchSchedule,
            itemsPrioritizingStrategy: batchingItemsPrioritizingStrategy
        };

        this._reclaimUnusedSequenceId = this._reclaimUnusedSequenceId.bind(this);

        this._disposeAggregator.add(this._onReclaimUnusedSequenceId);
        this._disposeAggregator.add(this.onDispose.dispatchEvent);
        this._disposeAggregator.add(() => {
            this._ctx.dispose();
        });

        this._disposeAggregator.add(
            this.model.onDispose.createListener(
                disposeContextIfReferenced.bind(null, new WeakRef(this))
            )
        );
    }

    public dispose() {
        if (this._disposed)
            return;

        this._disposed = true;

        this._disposeAggregator.dispose();
    }

    public [Symbol.dispose]() {
        return this.dispose();
    }

    public get disposed() {
        return this._disposed;
    }

    public get model() {
        return this._model;
    }

    public get contextSize(): number {
        return this._contextSize;
    }

    public get batchSize(): number {
        return this._batchSize;
    }

    public getAllocatedContextSize(): number {
        this._ensureNotDisposed();

        if (this._allocatedContextSize == null)
            this._allocatedContextSize = this._ctx.getContextSize();

        return this._allocatedContextSize;
    }

    public get totalSequences(): number {
        return this._totalSequences;
    }

    public get sequencesLeft() {
        return this._totalSequences - this._nextGeneratedSequenceId + this._unusedSequenceIds.length;
    }

    /**
     * Before calling this method, make sure to call `sequencesLeft` to check if there are any sequences left.
     * When there are no sequences left, this method will throw an error.
     * @param [options]
     */
    public getSequence({
        prependBos = true,
        contextShift: {
            size: contextShiftSize = Math.min(100, Math.ceil(this.contextSize / 2)),
            strategy: contextShiftStrategy = "eraseBeginning"
        } = {}
    }: {
        prependBos?: boolean,
        contextShift?: ContextShiftOptions
    } = {}): LlamaContextSequence {
        this._ensureNotDisposed();

        const nextSequenceId = this._popSequenceId();

        if (nextSequenceId == null)
            throw new Error("No sequences left");

        return LlamaContextSequence._create({
            sequenceId: nextSequenceId,
            context: this,
            prependBos,
            contextShift: {
                size: contextShiftSize,
                strategy: contextShiftStrategy
            }
        });
    }

    public dispatchPendingBatch() {
        this._currentDispatchBatchHandle = {};
        this._dispatchDecodeScheduled = false;

        if (this._batchDispatchPending)
            return;

        this._batchDispatchPending = true;

        void withLock(this, "context", async () => {
            this._currentDispatchBatchHandle = {};
            this._dispatchDecodeScheduled = false;
            this._batchDispatchPending = false;

            let prioritizeStrategy: ReturnType<typeof resolveBatchItemsPrioritizingStrategy>;
            try {
                this._ensureNotDisposed();
                prioritizeStrategy = resolveBatchItemsPrioritizingStrategy(this._batchingOptions.itemsPrioritizingStrategy);
            } catch (err) {
                this._dispatchErrorForQueuedDecodesAndDequeue(new Set(this._queuedDecodes), err);
                return;
            }

            let shouldHaveAnotherBatch = this._queuedDecodes.length > 0;

            while (shouldHaveAnotherBatch) {
                const batchItemToQueuedDecodeMap = new Map<BatchItem, InternalQueuedDecode>();
                const batchItemsList: BatchItem[] = [];

                for (const queuedDecode of this._queuedDecodes) {
                    const batchItem: BatchItem = {
                        tokens: queuedDecode.tokens,
                        evaluationPriority: queuedDecode.evaluationPriority
                    };
                    batchItemToQueuedDecodeMap.set(batchItem, queuedDecode);
                    batchItemsList.push(batchItem);
                }

                let prioritizedItems: PrioritizedBatchItem[];
                try {
                    prioritizedItems = prioritizeStrategy({
                        items: batchItemsList,
                        size: this._batchSize
                    });
                } catch (err) {
                    this._dispatchErrorForQueuedDecodesAndDequeue(new Set(this._queuedDecodes), err);
                    return;
                }

                let batchTokenSlotsLeft = this._batchSize;
                const afterDecodeActions: Array<{
                    batchLogitIndex: BatchLogitIndex | undefined,
                    response: [accept: (res: any) => void, reject: (reason: unknown) => void],
                    onDone?: (batchLogitIndex: BatchLogitIndex) => any
                }> = [];
                const queuedDecodesToDelete = new Set<InternalQueuedDecode>();
                const currentQueuedDecodeItems = new Set<InternalQueuedDecode>();

                const currentBatchItems: Array<{
                    queuedDecode: InternalQueuedDecode,
                    processAmount: number
                }> = [];
                let currentBatchSize = 0;

                for (const prioritizedItem of prioritizedItems) {
                    const queuedDecode = batchItemToQueuedDecodeMap.get(prioritizedItem.item);

                    if (queuedDecode == null)
                        throw new Error(
                            "Received invalid batch item. Make sure you keep the original object reference " +
                            "of the batch item on `item` on `PrioritizedBatchItem` in your custom prioritization strategy"
                        );

                    const processAmount = Math.min(queuedDecode.tokens.length, prioritizedItem.processAmount, batchTokenSlotsLeft);

                    if (processAmount <= 0)
                        continue;

                    batchTokenSlotsLeft -= processAmount;

                    currentBatchItems.push({
                        queuedDecode,
                        processAmount
                    });
                    currentBatchSize += processAmount;
                }

                if (currentBatchSize !== 0)
                    this._ctx.initBatch(currentBatchSize);

                for (const {queuedDecode, processAmount} of currentBatchItems) {
                    let batchLogitIndex: ReturnType<typeof this._ctx.addToBatch>;
                    try {
                        batchLogitIndex = this._ctx.addToBatch(
                            queuedDecode.sequenceId,
                            queuedDecode.firstTokenSequenceIndex,
                            Uint32Array.from(queuedDecode.tokens.slice(0, processAmount)),
                            queuedDecode.generateLogitAtTheEnd && processAmount === queuedDecode.tokens.length
                        );
                    } catch (err) {
                        this._dispatchErrorForQueuedDecodesAndDequeue(new Set([queuedDecode]), err);
                        continue;
                    }
                    currentQueuedDecodeItems.add(queuedDecode);

                    if (queuedDecode.tokens.length === processAmount) {
                        queuedDecodesToDelete.add(queuedDecode);
                        afterDecodeActions.push({
                            batchLogitIndex,
                            response: queuedDecode.response,
                            onDone: queuedDecode.onDone
                        });
                    } else {
                        queuedDecode.tokens = queuedDecode.tokens.slice(processAmount);
                        queuedDecode.firstTokenSequenceIndex += processAmount;
                    }

                    if (batchTokenSlotsLeft === 0)
                        break;
                }

                for (let i = 0; i < this._queuedDecodes.length; i++) {
                    const queuedDecode = this._queuedDecodes[i];
                    if (queuedDecodesToDelete.has(queuedDecode)) {
                        this._queuedDecodes.splice(i, 1);
                        this._queuedDecodeSequenceIds.delete(queuedDecode.sequenceId);
                        i--;
                    }
                }

                shouldHaveAnotherBatch = this._queuedDecodes.length > 0;

                try {
                    if (currentBatchSize !== 0)
                        await this._ctx.decodeBatch();
                } catch (err) {
                    this._dispatchErrorForQueuedDecodesAndDequeue(currentQueuedDecodeItems, err);
                    return;
                }

                for (const action of afterDecodeActions) {
                    const [accept, reject] = action.response;
                    if (action.onDone != null && action.batchLogitIndex != null) {
                        try {
                            accept(action.onDone(action.batchLogitIndex ?? null));
                        } catch (err) {
                            reject(err);
                        }
                    }

                    accept(undefined);
                }
            }
        });
    }

    /** @internal */
    public async _decodeTokens<T>({
        sequenceId, firstTokenSequenceIndex, tokens, generateLogitAtTheEnd = false, evaluationPriority = 5
    }: {
        sequenceId: number, firstTokenSequenceIndex: number, tokens: Token[], generateLogitAtTheEnd?: boolean,
        evaluationPriority?: EvaluationPriority
    }, onDone?: ((batchLogitIndex: BatchLogitIndex) => (T | Promise<T>))): Promise<T> {
        return await new Promise((accept, reject) => {
            this._queuedDecodes.push({
                sequenceId,
                tokens,
                firstTokenSequenceIndex,
                generateLogitAtTheEnd,
                evaluationPriority,
                response: [accept, reject],
                onDone
            });
            this._queuedDecodeSequenceIds.add(sequenceId);

            this._scheduleDecode();
        });
    }

    /** @internal */
    public _reclaimUnusedSequenceId(sequenceId: number) {
        if (this._disposed)
            return;

        void withLock(this, "context", async () => {
            this._ctx.disposeSequence(sequenceId);
            this._unusedSequenceIds.push(sequenceId);
            this._onReclaimUnusedSequenceId.dispatchEvent();
        });
    }

    /** @internal */
    private _popSequenceId(): number | null {
        if (this._unusedSequenceIds.length > 0)
            return this._unusedSequenceIds.shift()!;

        if (this._nextGeneratedSequenceId < this._totalSequences) {
            const sequenceId = this._nextGeneratedSequenceId;

            this._nextGeneratedSequenceId++;

            return sequenceId;
        }

        return null;
    }

    /** @internal */
    private _scheduleDecode() {
        if (this._dispatchDecodeScheduled || this._batchDispatchPending)
            return;

        this._dispatchDecodeScheduled = true;

        const currentPendingBatchHandle = this._currentDispatchBatchHandle;
        const dispatch = () => {
            if (this._currentDispatchBatchHandle !== currentPendingBatchHandle)
                return;

            this.dispatchPendingBatch();
        };

        const dispatchSchedule = this._batchingOptions.dispatchSchedule;

        if (this._queuedDecodeSequenceIds.size === this._totalSequences)
            dispatch();
        if (dispatchSchedule === "nextTick")
            setTimeout(dispatch, 0);
        else
            dispatchSchedule(dispatch);
    }

    /** @internal */
    private _dispatchErrorForQueuedDecodesAndDequeue(queuedDecodes: ReadonlySet<InternalQueuedDecode>, err: unknown) {
        for (const pendingDecode of queuedDecodes) {
            const [, reject] = pendingDecode.response;
            reject(err);
        }

        for (let i = 0; i < this._queuedDecodes.length; i++) {
            const item = this._queuedDecodes[i];
            if (queuedDecodes.has(item)) {
                this._queuedDecodes.splice(i, 1);
                this._queuedDecodeSequenceIds.delete(item.sequenceId);
                i--;
            }
        }
    }

    /** @internal */
    private _ensureNotDisposed() {
        if (this._disposed)
            throw new DisposedError();
    }
}

export class LlamaContextSequence {
    /** @internal */ private readonly _sequenceId: number;
    /** @internal */ private readonly _gcRegistry: FinalizationRegistry<number>;
    /** @internal */ private readonly _context: LlamaContext;
    /** @internal */ private readonly _prependBos: boolean;
    /** @internal */ private readonly _contextShift: Required<ContextShiftOptions>;
    /** @internal */ private readonly _disposeAggregator = new DisposeAggregator();
    /** @internal */ private _contextTokens: Token[] = [];
    /** @internal */ private _contextTokenPriorities: TokenPriority[] = [];
    /** @internal */ private _nextTokenIndex: number = 0;
    /** @internal */ private _prependTokens: Token[] = [];
    /** @internal */ private _prependTokenPriorities: TokenPriority[] = [];
    /** @internal */ private _disposed = false;

    public readonly onDispose = new EventRelay<void>();

    private constructor({
        sequenceId, context, prependBos, contextShift
    }: {
        sequenceId: number,
        context: LlamaContext,
        prependBos: boolean,
        contextShift: Required<ContextShiftOptions>
    }) {
        this._sequenceId = sequenceId;
        this._context = context;
        this._contextShift = contextShift;
        this._gcRegistry = new FinalizationRegistry(this._context._reclaimUnusedSequenceId);

        this._prependTokens = [];
        this._prependTokenPriorities = [];
        if (prependBos && this._context.model.tokens.bos != null) {
            this._prependTokens.unshift(this._context.model.tokens.bos);
            this._prependTokenPriorities.unshift(1);
            this._prependBos = true;
        } else
            this._prependBos = false;

        this._gcRegistry.register(this, sequenceId);
        this._disposeAggregator.add(() => this._gcRegistry.unregister(this));

        this._disposeAggregator.add(this.onDispose.dispatchEvent);

        this._disposeAggregator.add(
            this.model.onDispose.createListener(
                disposeContextSequenceIfReferenced.bind(null, new WeakRef(this))
            )
        );
        this._disposeAggregator.add(() => {
            this._context._reclaimUnusedSequenceId(this._sequenceId);
        });
    }

    public dispose() {
        if (this._disposed)
            return;

        this._disposeAggregator.dispose();

        this._contextTokens.length = 0;
        this._contextTokenPriorities.length = 0;

        this._disposed = true;
    }

    public [Symbol.dispose]() {
        return this.dispose();
    }

    public get disposed() {
        return this._disposed;
    }

    public get context() {
        return this._context;
    }

    public get model() {
        return this._context.model;
    }

    public get prependBos() {
        return this._prependBos;
    }

    public get nextTokenIndex() {
        return this._nextTokenIndex;
    }

    public get contextTokens() {
        return this._contextTokens.slice();
    }

    public get contextTokenPriorities() {
        return this._contextTokenPriorities.slice();
    }

    /**
     * Clear the history of the sequence.
     * If `prependBos` was enabled, the BOS token will be prepended to the sequence again.
     */
    public async clearHistory() {
        this._ensureNotDisposed();

        await this.eraseContextTokenRanges([{start: 0, end: this._nextTokenIndex}]);

        this._prependTokens.length = 0;
        this._prependTokenPriorities.length = 0;

        if (this._prependBos && this._context.model.tokens.bos != null) {
            this._prependTokens.push(this._context.model.tokens.bos);
            this._prependTokenPriorities.push(1);
        }
    }

    /**
     * Erase context tokens in the provided ranges to free up space for new tokens to be generated.
     * the start and end of each range are exclusive.
     * For example, the range `{start: 0, end: 1}` will remove the token at the `0` index only.
     */
    public async eraseContextTokenRanges(ranges: ContextTokensDeleteRange[]) {
        this._ensureNotDisposed();

        await withLock(this._context, "context", async () => {
            this._ensureNotDisposed();

            if (ranges.length === 0)
                return;

            const resolvedRanges = ranges
                .map(({start, end}) => {
                    if (start === end)
                        return null;

                    if (start > end)
                        [start, end] = [end, start];

                    if (end > this._nextTokenIndex)
                        end = this._nextTokenIndex;

                    if (start >= this._nextTokenIndex)
                        return null;

                    return {start, end};
                })
                .filter((range): range is ContextTokensDeleteRange => range != null)
                .sort((a, b) => a.start - b.start)
                .reduce((ranges, range) => {
                    if (ranges.length === 0)
                        return [range];

                    const lastRange = ranges[ranges.length - 1];
                    if (lastRange.end >= range.start) {
                        lastRange.end = Math.max(lastRange.end, range.end);
                        return ranges;
                    }

                    ranges.push(range);
                    return ranges;
                }, [] as ContextTokensDeleteRange[]);

            let removedTokens = 0;
            let lastDeleteRangeEndPos: number | null = null;
            for (const range of resolvedRanges) {
                this._contextTokens.splice(range.start - removedTokens, range.end - range.start);
                this._contextTokenPriorities.splice(range.start - removedTokens, range.end - range.start);
                this._context._ctx.removeTokenCellsFromSequence(this._sequenceId, range.start, range.end);

                if (lastDeleteRangeEndPos != null && removedTokens > 0 && lastDeleteRangeEndPos !== range.start)
                    this._context._ctx.shiftSequenceTokenCells(this._sequenceId, lastDeleteRangeEndPos, range.start, -removedTokens);

                removedTokens += range.end - range.start;
                lastDeleteRangeEndPos = range.end;
            }

            if (lastDeleteRangeEndPos != null && removedTokens > 0 && lastDeleteRangeEndPos !== this._nextTokenIndex)
                this._context._ctx.shiftSequenceTokenCells(this._sequenceId, lastDeleteRangeEndPos, this._nextTokenIndex, -removedTokens);

            this._nextTokenIndex -= removedTokens;
        });
    }

    /**
     * @param tokens
     * @param [options]
     */
    public evaluate(tokens: Token[], {
        temperature = 0,
        topK = 40,
        topP = 0.95,
        grammarEvaluationState,
        repeatPenalty,
        evaluationPriority = 5,
        tokenPriority = 1
    }: {
        temperature?: number, topK?: number, topP?: number, grammarEvaluationState?: LlamaGrammarEvaluationState,
        repeatPenalty?: LlamaContextRepeatPenalty,

        /**
         * When a lot of tokens are queued for the next batch, more than the configured `batchSize`, the tokens for each sequence will be
         * evaluated based on the strategy chosen for the context.
         * By default, the `"maximumParallelism"` strategy is used, which will try to evaluate as many sequences in parallel as possible,
         * but at some point, it'll have to choose which sequences to evaluate more tokens of, so it'll prioritize the sequences with the
         * highest evaluation priority.
         * Also, a custom strategy can be used to prioritize the sequences differently, but generally, the higher the evaluation priority
         * is, the more likely and more tokens will be evaluated for that sequence in the next queued batch.
         */
        evaluationPriority?: EvaluationPriority,

        /**
         * When the context is full, tokens will be erased based on the context shift strategy chosen.
         * By default, the lowest priority tokens at the beginning of the context will be erased.
         * To mark the priority of the evaluated tokens, use this option.
         * The higher the priority is, the less likely it will be erased.
         * The default priority is `1`.
         */
        tokenPriority?: TokenPriority | TokenPriority[]
    } = {}): AsyncGenerator<Token, void> {
        return this._evaluate(tokens, {
            temperature,
            topK,
            topP,
            grammarEvaluationState,
            repeatPenalty,
            evaluationPriority,
            tokenPriority
        });
    }

    /**
     * Evaluate the provided tokens into the context sequence without generating new tokens.
     * @param tokens
     * @param [options]
     */
    public async evaluateWithoutGeneratingNewTokens(tokens: Token[], {
        evaluationPriority = 5, tokenPriority = 1
    }: {
        grammarEvaluationState?: LlamaGrammarEvaluationState,

        /**
         * When a lot of tokens are queued for the next batch, more than the configured `batchSize`, the tokens for each sequence will be
         * evaluated based on the strategy chosen for the context.
         * By default, the `"maximumParallelism"` strategy is used, which will try to evaluate as many sequences in parallel as possible,
         * but at some point, it'll have to choose which sequences to evaluate more tokens of, so it'll prioritize the sequences with the
         * highest evaluation priority.
         * Also, a custom strategy can be used to prioritize the sequences differently, but generally, the higher the evaluation priority
         * is, the more likely and more tokens will be evaluated for that sequence in the next queued batch.
         */
        evaluationPriority?: EvaluationPriority,

        /**
         * When the context is full, tokens will be erased based on the context shift strategy chosen.
         * By default, the lowest priority tokens at the beginning of the context will be erased.
         * To mark the priority of the evaluated tokens, use this option.
         * The higher the priority is, the less likely it will be erased.
         * The default priority is `1`.
         */
        tokenPriority?: TokenPriority | TokenPriority[]
    } = {}): Promise<void> {
        const iterator = this._evaluate(tokens, {
            generateNewTokens: false,
            evaluationPriority,
            tokenPriority
        });

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const token of iterator) {
            // Array.from doesn't work with async generators, so we have to iterate over the generator
        }
    }

    /** @internal */
    private async *_evaluate(tokens: Token[], {
        temperature = 0,
        topK = 40,
        topP = 0.95,
        grammarEvaluationState,
        repeatPenalty,
        evaluationPriority = 5,
        tokenPriority = 1,
        generateNewTokens = true
    }: {
        temperature?: number, topK?: number, topP?: number, grammarEvaluationState?: LlamaGrammarEvaluationState,
        repeatPenalty?: LlamaContextRepeatPenalty, evaluationPriority?: EvaluationPriority, tokenPriority?: TokenPriority | TokenPriority[],
        generateNewTokens?: boolean
    } = {}): AsyncGenerator<Token, void> {
        this._ensureNotDisposed();

        if (!(tokenPriority instanceof Array))
            tokenPriority = Array(tokens.length).fill(tokenPriority);

        let evalTokens = tokens;

        if (generateNewTokens && tokens.length === 0)
            return;

        if (this._prependTokens.length > 0) {
            evalTokens = this._prependTokens.concat(tokens);
            tokenPriority = this._prependTokenPriorities.concat(tokenPriority);
            this._prependTokens = [];
            this._prependTokenPriorities = [];
        }

        if (evalTokens.length === 0)
            return;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            this._ensureNotDisposed();

            // Evaluate to get the next token.
            const nextToken: Token | null = await this._decodeTokens(
                evalTokens,
                generateNewTokens,
                evaluationPriority,
                tokenPriority,
                (batchLogitIndex) => {
                    return this._context._ctx.sampleToken(batchLogitIndex, removeNullFields({
                        temperature,
                        topK,
                        topP,
                        repeatPenalty: repeatPenalty?.penalty,
                        repeatPenaltyTokens: repeatPenalty?.punishTokens instanceof Function
                            ? repeatPenalty.punishTokens()
                            : repeatPenalty?.punishTokens,
                        repeatPenaltyPresencePenalty: repeatPenalty?.presencePenalty,
                        repeatPenaltyFrequencyPenalty: repeatPenalty?.frequencyPenalty,
                        grammarEvaluationState: grammarEvaluationState?._state
                    }));
                }
            );

            if (nextToken == null)
                return;

            // the model finished generating text
            if (nextToken === this._context.model.tokens.eos)
                break;

            yield nextToken;

            // Create tokens for the next eval.
            evalTokens = [nextToken];
        }
    }

    /** @internal */
    private async _decodeTokens<T>(
        tokens: Token[],
        generateLogit: boolean,
        evaluationPriority: EvaluationPriority,
        tokenPriority: TokenPriority[],
        onDecodeDone: ((batchLogitIndex: BatchLogitIndex) => T | Promise<T>)
    ): Promise<T | null> {
        this._ensureNotDisposed();

        const tokensLeftToDecode = tokens.slice();

        return await withLock(this, "evaluate", async (): Promise<T | null> => {
            while (tokensLeftToDecode.length > 0) {
                this._ensureNotDisposed();

                let freeSpace = this._context.contextSize - this._nextTokenIndex;

                if (freeSpace === 0) {
                    await this._freeUpSpaceForTokens();
                    freeSpace = this._context.contextSize - this._nextTokenIndex;

                    if (freeSpace === 0)
                        throw new Error("Failed to free up space for new tokens");
                }

                const tokensToDecode = tokensLeftToDecode.splice(0, freeSpace);
                const generateLogitAtTheEnd = generateLogit && tokensLeftToDecode.length === 0;

                const nextToken = await this._context._decodeTokens({
                    sequenceId: this._sequenceId,
                    tokens: tokensToDecode,
                    firstTokenSequenceIndex: this._nextTokenIndex,
                    generateLogitAtTheEnd,
                    evaluationPriority
                }, !generateLogitAtTheEnd
                    ? undefined
                    : onDecodeDone
                );
                this._nextTokenIndex += tokensToDecode.length;
                this._contextTokens = this._contextTokens.concat(tokensToDecode);

                for (let i = 0; i < tokensToDecode.length; i++) {
                    this._contextTokenPriorities.push(
                        tokenPriority[i] ?? tokenPriority[tokenPriority.length - 1] ?? 1
                    );
                }

                if (generateLogitAtTheEnd && nextToken != null)
                    return nextToken;
            }

            return null;
        });
    }

    /** @internal */
    private async _freeUpSpaceForTokens() {
        this._ensureNotDisposed();

        const size = Math.min(
            this._nextTokenIndex,
            Math.max(
                1,
                this._contextShift.size instanceof Function
                    ? await this._contextShift.size(this)
                    : this._contextShift.size
            )
        );

        this._ensureNotDisposed();

        if (this._contextShift.strategy === "eraseLowestTokenPriorityBeginning") {
            let leftTokensToErase = Math.min(size, this._contextTokenPriorities.length);
            let previousLowestPriority: number | null = null;
            let indexesToErase: number[] = [];

            while (leftTokensToErase > 0 && this._contextTokenPriorities.length > 0) {
                let currentLowestPriorityIndexes: number[] = [];
                let currentLowestPriorityFound: number | null = null;

                for (let i = 0; leftTokensToErase > currentLowestPriorityIndexes.length && i < this._contextTokenPriorities.length; i++) {
                    const tokenPriority = this._contextTokenPriorities[i];

                    if (currentLowestPriorityFound == null || (
                        tokenPriority < currentLowestPriorityFound && (
                            previousLowestPriority == null || tokenPriority > previousLowestPriority
                        )
                    )) {
                        currentLowestPriorityFound = tokenPriority;
                        currentLowestPriorityIndexes = [i];
                    } else if (tokenPriority === currentLowestPriorityFound) {
                        currentLowestPriorityIndexes.push(i);
                    }
                }

                previousLowestPriority = currentLowestPriorityFound;
                indexesToErase = indexesToErase.concat(currentLowestPriorityIndexes);
                leftTokensToErase -= currentLowestPriorityIndexes.length;
            }

            await this.eraseContextTokenRanges(
                indexesToErase.reduce((ranges, index) => {
                    if (ranges.length === 0)
                        return [{start: index, end: index + 1}];

                    const lastRange = ranges[ranges.length - 1];
                    if (lastRange.end >= index) {
                        lastRange.end = Math.max(lastRange.end, index + 1);
                        return ranges;
                    }

                    ranges.push({start: index, end: index + 1});
                    return ranges;
                }, [] as ContextTokensDeleteRange[])
            );
        } else if (this._contextShift.strategy === "eraseBeginning") {
            await this.eraseContextTokenRanges([{start: 0, end: size}]);
        } else {
            const ranges = await this._contextShift.strategy({
                sequence: this,
                size
            });

            if (ranges == null)
                throw new Error("Invalid delete ranges");

            await this.eraseContextTokenRanges(ranges);

            if (this.nextTokenIndex >= this._context.contextSize)
                await this.eraseContextTokenRanges([{start: 0, end: size}]);
        }
    }

    /** @internal */
    private _ensureNotDisposed() {
        if (this._disposed)
            throw new DisposedError();
    }

    /**
     * We need this to make it impossible to manually create instances of this class outside the code of this library
     * @internal
     */
    public static _create({
        sequenceId, context, prependBos = true,
        contextShift: {
            size: contextShiftSize = Math.min(100, Math.ceil(context.contextSize / 2)),
            strategy: contextShiftStrategy = "eraseBeginning"
        } = {}
    }: {
        sequenceId: number,
        context: LlamaContext,
        prependBos?: boolean,
        contextShift?: ContextShiftOptions
    }): LlamaContextSequence {
        return new LlamaContextSequence({
            sequenceId,
            context,
            prependBos,
            contextShift: {
                size: contextShiftSize,
                strategy: contextShiftStrategy
            }
        });
    }
}

type InternalQueuedDecode = {
    sequenceId: number,
    firstTokenSequenceIndex: number,
    tokens: readonly Token[],
    generateLogitAtTheEnd: boolean,
    evaluationPriority: EvaluationPriority,
    response: [accept: (res: any) => void, reject: (reason: unknown) => void],
    onDone?: (batchLogitIndex: BatchLogitIndex) => any
};

function disposeContextIfReferenced(contextRef: WeakRef<LlamaContext>) {
    const context = contextRef.deref();

    if (context != null)
        context.dispose();
}

function disposeContextSequenceIfReferenced(contextRef: WeakRef<LlamaContextSequence>) {
    const context = contextRef.deref();

    if (context != null)
        context.dispose();
}
