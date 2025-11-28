import path from "path";
import {acquireLock, AsyncDisposeAggregator, DisposeAggregator, DisposedError, EventRelay, Lock, withLock} from "lifecycle-utils";
import {removeNullFields} from "../../utils/removeNullFields.js";
import {Token} from "../../types.js";
import {AddonContext, AddonModelLora, BatchLogitIndex} from "../../bindings/AddonTypes.js";
import {LlamaGrammarEvaluationState} from "../LlamaGrammarEvaluationState.js";
import {compareTokens} from "../../utils/compareTokens.js";
import {DisposalPreventionHandle, DisposeGuard} from "../../utils/DisposeGuard.js";
import {TokenMeter} from "../TokenMeter.js";
import {TokenBias} from "../TokenBias.js";
import {LlamaModel} from "../LlamaModel/LlamaModel.js";
import {UnsupportedError} from "../../utils/UnsupportedError.js";
import {ThreadsSplitterConsumer} from "../../utils/ThreadsSplitter.js";
import {pushAll} from "../../utils/pushAll.js";
import {safeEventCallback} from "../../utils/safeEventCallback.js";
import {GgufArchitectureType} from "../../gguf/types/GgufMetadataTypes.js";
import {
    BatchingOptions, BatchItem, ContextShiftOptions, ContextTokensDeleteRange, ControlledEvaluateIndexOutput, ControlledEvaluateInputItem,
    EvaluationPriority, LlamaContextOptions, LlamaContextSequenceRepeatPenalty, PrioritizedBatchItem, SequenceEvaluateMetadataOptions,
    SequenceEvaluateOptions, SequenceEvaluateOutput
} from "./types.js";
import {resolveBatchItemsPrioritizationStrategy} from "./utils/resolveBatchItemsPrioritizationStrategy.js";
import {LlamaSampler} from "./LlamaSampler.js";
import {TokenPredictor} from "./TokenPredictor.js";
import {padSafeContextSize} from "./utils/padSafeContextSize.js";
import type {Llama} from "../../bindings/Llama.js";

const defaultLoraScale = 1;
const shrinkRetriesMinContextSize = 4096;
const defaultMaxPunishTokens = 64;
const defaultFailedCreationRemedy = {
    retries: 16,
    autoContextSizeShrink: 0.16
} as const satisfies Required<LlamaContextOptions["failedCreationRemedy"]>;
const defaultEvaluationPriority: EvaluationPriority = 5;

const decodeSyncWorkaround = {
    vulkanLock: {}
};

export class LlamaContext {
    /** @internal */ public readonly _llama: Llama;
    /** @internal */ public readonly _ctx: AddonContext;
    /** @internal */ public readonly _onReclaimUnusedSequenceId = new EventRelay<void>();
    /** @internal */ public readonly _backendContextDisposeGuard: DisposeGuard;

    /** @internal */ private readonly _model: LlamaModel;
    /** @internal */ private readonly _contextSize: number;
    /** @internal */ private readonly _batchSize: number;
    /** @internal */ private readonly _flashAttention: boolean;
    /** @internal */ private readonly _idealThreads: number;
    /** @internal */ private readonly _minThreads: number;
    /** @internal */ private readonly _performanceTracking: boolean;
    /** @internal */ private readonly _totalSequences: number;
    /** @internal */ private readonly _unusedSequenceIds: number[] = [];
    /** @internal */ private readonly _batchingOptions: Required<BatchingOptions>;
    /** @internal */ private readonly _swaFullCache: boolean = false;
    /** @internal */ private readonly _queuedDecodeSequenceIds = new Set<number>();
    /** @internal */ private readonly _queuedDecodes: InternalQueuedDecode[] = [];
    /** @internal */ private readonly _disposeAggregator = new AsyncDisposeAggregator();
    /** @internal */ private readonly _modelPreventDisposalHandle: DisposalPreventionHandle;
    /** @internal */ private readonly _loraAdapters = new Set<AddonModelLora>();
    /** @internal */ private readonly _gcRegistry: FinalizationRegistry<Set<AddonModelLora>>;
    /** @internal */ private _nextGeneratedSequenceId = 0;
    /** @internal */ private _dispatchDecodeScheduled = false;
    /** @internal */ private _batchDispatchPending = false;
    /** @internal */ private _threadSplitterConsumer?: ThreadsSplitterConsumer;
    /** @internal */ private _freeReservedThreadsTimeout?: ReturnType<typeof setTimeout>;
    /** @internal */ private _currentDispatchBatchHandle: object = {};
    /** @internal */ private _allocatedContextSize?: number;
    /** @internal */ private _disposed: boolean = false;

    public readonly onDispose = new EventRelay<void>();

    private constructor({
        _model
    }: {
        _model: LlamaModel
    }, {
        sequences,
        contextSize,
        batchSize,
        flashAttention = _model.defaultContextFlashAttention,
        threads,
        batching: {
            dispatchSchedule: batchingDispatchSchedule = "nextCycle",
            itemPrioritizationStrategy: batchingItemsPrioritizationStrategy = "maximumParallelism"
        } = {},
        swaFullCache = _model.defaultContextSwaFullCache,
        performanceTracking = false,
        _embeddings,
        _ranking
    }: LlamaContextOptions & {
        sequences: number,
        contextSize: number,
        batchSize: number,
        flashAttention: boolean
    }) {
        if (_model.disposed)
            throw new DisposedError();

        const kvUnified = false;
        this._llama = _model._llama;
        this._model = _model;
        this._backendContextDisposeGuard = new DisposeGuard([this._model._backendModelDisposeGuard]);
        this._modelPreventDisposalHandle = this._model._backendModelDisposeGuard.createPreventDisposalHandle();
        this._totalSequences = Math.max(1, Math.floor(sequences));
        this._contextSize = kvUnified
            ? Math.floor(padSafeContextSize(Math.max(2, contextSize) * this._totalSequences, "up") / this._totalSequences)
            : padSafeContextSize(Math.max(2, contextSize), "up");
        this._batchSize = Math.max(batchSize, this._totalSequences);
        this._flashAttention = flashAttention;
        this._idealThreads = typeof threads === "number"
            ? this._llama._threadsSplitter.normalizeThreadsValue(threads)
            : this._llama._threadsSplitter.normalizeThreadsValue(
                threads?.ideal ?? (
                    this._llama.maxThreads === 0
                        ? this._llama.cpuMathCores
                        : this._llama.maxThreads
                )
            );
        this._minThreads = Math.max(
            1,
            typeof threads === "number"
                ? 1
                : this._llama._threadsSplitter.normalizeThreadsValue(threads?.min ?? 1)
        );
        this._performanceTracking = !!performanceTracking;
        this._swaFullCache = !!swaFullCache;
        this._ctx = new this._llama._bindings.AddonContext(this._model._model, removeNullFields({
            contextSize: padSafeContextSize(this._contextSize * this._totalSequences, "up"), // each sequence needs its own <contextSize> of cells
            batchSize: this._batchSize + (
                (!this._swaFullCache && this.model.fileInsights.swaSize != null && this.model.fileInsights.swaSize > 0)
                    ? 1 // +1 to handle edge cases with SWA KV cache
                    : 0
            ),
            sequences: this._totalSequences,
            flashAttention: this._flashAttention,
            threads: this._idealThreads,
            embeddings: _embeddings,
            ranking: _ranking,
            performanceTracking: this._performanceTracking,
            swaFullCache: this._swaFullCache
        }));
        this._batchingOptions = {
            dispatchSchedule: batchingDispatchSchedule,
            itemPrioritizationStrategy: batchingItemsPrioritizationStrategy
        };
        this._gcRegistry = new FinalizationRegistry(this._model._removeLoraUsage);
        this._gcRegistry.register(this, this._loraAdapters);

        this._reclaimUnusedSequenceId = this._reclaimUnusedSequenceId.bind(this);
        this._freeReservedThreads = this._freeReservedThreads.bind(this);

        this._disposeAggregator.add(() => {
            this._disposed = true;
        });
        this._disposeAggregator.add(() => void this._gcRegistry.unregister(this));
        this._disposeAggregator.add(this._onReclaimUnusedSequenceId);
        this._disposeAggregator.add(this.onDispose.dispatchEvent);
        this._disposeAggregator.add(
            this.model.onDispose.createListener(
                disposeContextIfReferenced.bind(null, new WeakRef(this))
            )
        );
        this._disposeAggregator.add((): Promise<void> | void => {
            if (this._loraAdapters.size > 0) {
                const loraAdapters = new Set(this._loraAdapters);
                this._loraAdapters.clear();
                return this._model._removeLoraUsage(loraAdapters);
            }
        });

        this._disposeAggregator.add(async () => {
            await this._backendContextDisposeGuard.acquireDisposeLock();
            await this._ctx.dispose();
            this._modelPreventDisposalHandle.dispose();
        });
    }

    public async dispose() {
        if (this._disposed)
            return;

        this._disposed = true;

        await this._disposeAggregator.dispose();
    }

    /** @hidden */
    public [Symbol.asyncDispose]() {
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

    public get flashAttention(): boolean {
        return this._flashAttention;
    }

    /**
     * The actual size of the state in the memory in bytes.
     * This value is provided by `llama.cpp` and doesn't include all the memory overhead of the context.
     */
    public get stateSize() {
        this._ensureNotDisposed();

        return this._ctx.getStateSize();
    }

    /** The number of threads currently used to evaluate tokens */
    public get currentThreads() {
        this._ensureNotDisposed();

        return this._ctx.getThreads();
    }

    /**
     * The number of threads that are preferred to be used to evaluate tokens.
     *
     * The actual number of threads used may be lower when other evaluations are running in parallel.
     */
    public get idealThreads() {
        return this._idealThreads;
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
     */
    public getSequence(options: {
        contextShift?: ContextShiftOptions,

        /**
         * Token predictor to use for the sequence.
         * Don't share the same token predictor between multiple sequences.
         *
         * Using a token predictor doesn't affect the generation output itself -
         * it only allows for greater parallelization of the token evaluation to speed up the generation.
         *
         * > **Note:** that if a token predictor is too resource intensive,
         * > it can slow down the generation process due to the overhead of running the predictor.
         * >
         * > Testing the effectiveness of a token predictor on the target machine is recommended before using it in production.
         *
         * Automatically disposed when disposing the sequence.
         * @see [Using Token Predictors](https://node-llama-cpp.withcat.ai/guide/token-prediction)
         */
        tokenPredictor?: TokenPredictor,

        /** @internal */
        _tokenMeter?: TokenMeter
    } = {}): LlamaContextSequence {
        const {
            contextShift: {
                size: contextShiftSize = Math.min(100, Math.ceil(this.contextSize / 2)),
                strategy: contextShiftStrategy = "eraseBeginning"
            } = {},
            tokenPredictor,

            _tokenMeter
        } = options;
        this._ensureNotDisposed();

        const nextSequenceId = this._popSequenceId();

        if (nextSequenceId == null)
            throw new Error("No sequences left");

        return LlamaContextSequence._create({
            sequenceId: nextSequenceId,
            context: this,
            tokenMeter: _tokenMeter,
            contextShift: {
                size: contextShiftSize,
                strategy: contextShiftStrategy
            },
            tokenPredictor
        });
    }

    public dispatchPendingBatch() {
        this._currentDispatchBatchHandle = {};
        this._dispatchDecodeScheduled = false;

        if (this._batchDispatchPending)
            return;

        this._batchDispatchPending = true;

        void withLock([this as LlamaContext, "context"], async () => {
            this._currentDispatchBatchHandle = {};
            this._dispatchDecodeScheduled = false;
            this._batchDispatchPending = false;

            let shouldHaveAnotherLoop = this._queuedDecodes.length > 0;
            const queuedDecodeToMappedLogits = new Map<InternalQueuedDecode, [tokenIndex: number, value: any][]>();

            const resolvePrioritizationStrategy = () => {
                try {
                    this._ensureNotDisposed();
                    return resolveBatchItemsPrioritizationStrategy(this._batchingOptions.itemPrioritizationStrategy);
                } catch (err) {
                    this._dispatchErrorForQueuedDecodesAndDequeue(new Set(this._queuedDecodes), err);
                }

                return null;
            };

            const getOrderedQueuedDecodes = (
                prioritizationStrategy: ReturnType<typeof resolveBatchItemsPrioritizationStrategy>
            ): null | CurrentBatchItem[] => {
                const batchItemToQueuedDecodeMap = new Map<BatchItem, InternalQueuedDecode>();
                const batchItemsList: BatchItem[] = [];

                for (const queuedDecode of this._queuedDecodes) {
                    const batchItem: BatchItem = {
                        tokens: queuedDecode.tokens,
                        logits: queuedDecode.logits,
                        evaluationPriority: queuedDecode.evaluationPriority
                    };
                    batchItemToQueuedDecodeMap.set(batchItem, queuedDecode);
                    batchItemsList.push(batchItem);
                }

                let prioritizedItems: PrioritizedBatchItem[];
                try {
                    prioritizedItems = prioritizationStrategy({
                        items: batchItemsList,
                        size: this._batchSize
                    });
                } catch (err) {
                    this._dispatchErrorForQueuedDecodesAndDequeue(new Set(this._queuedDecodes), err);
                    return null;
                }

                return prioritizedItems.map((prioritizedItem): CurrentBatchItem => {
                    const queuedDecode = batchItemToQueuedDecodeMap.get(prioritizedItem.item);

                    if (queuedDecode == null)
                        throw new Error(
                            "Received invalid batch item. Make sure you keep the original object reference " +
                            "of the batch item on `item` on `PrioritizedBatchItem` in your custom prioritization strategy"
                        );

                    return {
                        queuedDecode,
                        processAmount: prioritizedItem.processAmount
                    };
                });
            };

            const fitQueuedDecodesToABatch = (queuedDecodes: CurrentBatchItem[], batchSize: number) => {
                const currentBatchItems: CurrentBatchItem[] = [];
                let currentBatchSize = 0;
                let batchTokenSlotsLeft = batchSize;

                for (const {queuedDecode, processAmount} of queuedDecodes) {
                    const resolvedProcessAmount = Math.min(
                        processAmount <= 0 ? 1 : processAmount, queuedDecode.tokens.length, batchTokenSlotsLeft
                    );

                    if (resolvedProcessAmount <= 0) {
                        if (batchTokenSlotsLeft === 0)
                            break;

                        continue;
                    }

                    batchTokenSlotsLeft -= resolvedProcessAmount;
                    currentBatchSize += resolvedProcessAmount;

                    currentBatchItems.push({
                        queuedDecode,
                        processAmount: resolvedProcessAmount
                    });
                }

                return {
                    currentBatchItems,
                    currentBatchSize
                };
            };

            const decodeTokenBatchItems = async (batchItems: CurrentBatchItem[], currentBatchSize: number) => {
                const afterDecodeActions: Array<{
                    queuedDecode: InternalQueuedDecode,
                    batchLogitIndexes: Uint32Array,
                    batchLogitTokenIndexes: number[],
                    firstTokenIndex: number,
                    returnResults?: true
                }> = [];
                const queuedDecodesToDelete = new Set<InternalQueuedDecode>();
                const currentQueuedDecodeItems = new Set<InternalQueuedDecode>();

                if (currentBatchSize !== 0)
                    this._ctx.initBatch(currentBatchSize);

                for (const {queuedDecode, processAmount} of batchItems) {
                    let batchLogitIndexes: ReturnType<typeof this._ctx.addToBatch>;
                    const tokensToProcess = queuedDecode.tokens.slice(0, processAmount);
                    const tokenIndexesWithLogitsToProcess = queuedDecode.logits.slice(0, processAmount)
                        .map((logit, index) => (logit ? index : undefined))
                        .filter((index) => index != undefined);

                    const numberOfOutputTokens = tokenIndexesWithLogitsToProcess.length;
                    TokenMeter.useTokens(queuedDecode.tokenMeter, Math.max(0, tokensToProcess.length - numberOfOutputTokens), "input");
                    TokenMeter.useTokens(queuedDecode.tokenMeter, numberOfOutputTokens, "output");

                    try {
                        batchLogitIndexes = this._ctx.addToBatch(
                            queuedDecode.sequenceId,
                            queuedDecode.firstTokenSequenceIndex,
                            Uint32Array.from(tokensToProcess),
                            Uint32Array.from(tokenIndexesWithLogitsToProcess)
                        );
                    } catch (err) {
                        this._dispatchErrorForQueuedDecodesAndDequeue(new Set([queuedDecode]), err);
                        continue;
                    }
                    currentQueuedDecodeItems.add(queuedDecode);

                    if (queuedDecode.tokens.length === processAmount) {
                        queuedDecodesToDelete.add(queuedDecode);
                        afterDecodeActions.push({
                            queuedDecode,
                            batchLogitIndexes,
                            batchLogitTokenIndexes: tokenIndexesWithLogitsToProcess,
                            firstTokenIndex: queuedDecode.firstTokenSequenceIndex,
                            returnResults: true
                        });
                    } else {
                        if (batchLogitIndexes.length > 0)
                            afterDecodeActions.push({
                                queuedDecode,
                                batchLogitIndexes,
                                batchLogitTokenIndexes: tokenIndexesWithLogitsToProcess,
                                firstTokenIndex: queuedDecode.firstTokenSequenceIndex
                            });

                        queuedDecode.tokens = queuedDecode.tokens.slice(processAmount);
                        queuedDecode.logits = queuedDecode.logits.slice(processAmount);
                        queuedDecode.firstTokenSequenceIndex += processAmount;
                    }
                }

                for (let i = 0; i < this._queuedDecodes.length; i++) {
                    const queuedDecode = this._queuedDecodes[i]!;
                    if (queuedDecodesToDelete.has(queuedDecode)) {
                        this._queuedDecodes.splice(i, 1);
                        this._queuedDecodeSequenceIds.delete(queuedDecode.sequenceId);
                        i--;
                    }
                }

                if (currentBatchSize !== 0) {
                    const allocationResult = this._threadSplitterConsumer?.getAllocationToConsume();
                    const [threadsToUse, consumerHandle] = allocationResult instanceof Promise
                        ? await allocationResult ?? []
                        : allocationResult ?? [];

                    try {
                        if (threadsToUse != null)
                            this._ctx.setThreads(threadsToUse);

                        await this._ctx.decodeBatch();
                        consumerHandle?.dispose();
                    } catch (err) {
                        consumerHandle?.dispose();
                        this._dispatchErrorForQueuedDecodesAndDequeue(currentQueuedDecodeItems, err);
                        return;
                    }
                }

                function finishAfterDecodeAction(
                    action: typeof afterDecodeActions[number],
                    mappedLogitValues?: [index: number, value: any][]
                ) {
                    if (mappedLogitValues != null && mappedLogitValues.length > 0) {
                        if (queuedDecodeToMappedLogits.has(action.queuedDecode))
                            pushAll(queuedDecodeToMappedLogits.get(action.queuedDecode)!, mappedLogitValues);
                        else
                            queuedDecodeToMappedLogits.set(action.queuedDecode, mappedLogitValues);
                    }

                    if (action.returnResults != null) {
                        const [accept] = action.queuedDecode.response;
                        const mappedLogits = queuedDecodeToMappedLogits.get(action.queuedDecode) ?? [];
                        queuedDecodeToMappedLogits.delete(action.queuedDecode);
                        accept(mappedLogits);
                    }
                }

                const afterDecodeActionResults = afterDecodeActions.map((action): Promise<void> | void => {
                    if (action.batchLogitIndexes.length === 0) {
                        finishAfterDecodeAction(action);
                        return undefined;
                    }

                    const mappedLogitValues: ([index: number, value: any] | Promise<[index: number, value: any]>)[] = [];
                    let promiseChain: Promise<void> | undefined = undefined;

                    const batchLogitIndexes = action.batchLogitIndexes;
                    const batchLogitTokenIndexes = action.batchLogitTokenIndexes;
                    for (let i = 0; i < batchLogitIndexes.length; i++) {
                        const tokenIndex = batchLogitTokenIndexes[i]!;

                        const mappedValue: Promise<any> | any = promiseChain != null
                            ? promiseChain
                                .then(() => action.queuedDecode.logitDataMapper(
                                    batchLogitIndexes[i]! as BatchLogitIndex,
                                    tokenIndex + action.firstTokenIndex
                                ))
                            : action.queuedDecode.logitDataMapper(
                                batchLogitIndexes[i]! as BatchLogitIndex,
                                tokenIndex + action.firstTokenIndex
                            );

                        if (mappedValue instanceof Promise) {
                            promiseChain = mappedValue;
                            mappedLogitValues.push(
                                mappedValue
                                    .then((value) => [tokenIndex + action.firstTokenIndex, value])
                            );
                        } else
                            mappedLogitValues.push([tokenIndex + action.firstTokenIndex, mappedValue]);
                    }

                    if (promiseChain != null)
                        return Promise.all(mappedLogitValues)
                            .then((resolvedMappedLogitValues) => finishAfterDecodeAction(action, resolvedMappedLogitValues));

                    finishAfterDecodeAction(action, mappedLogitValues as [index: number, value: any][]);
                    return undefined;
                });

                await Promise.all(afterDecodeActionResults);
            };

            const prioritizationStrategy = resolvePrioritizationStrategy();
            if (prioritizationStrategy == null) return; // all queued items are rejected and dequeued when we get here

            this._reserveThreads();
            try {
                while (shouldHaveAnotherLoop) {
                    const orderedQueuedDecodes = getOrderedQueuedDecodes(prioritizationStrategy);
                    if (orderedQueuedDecodes == null) return; // all queued items are rejected and dequeued when we get here

                    const {
                        currentBatchItems,
                        currentBatchSize
                    } = fitQueuedDecodesToABatch(orderedQueuedDecodes, this._batchSize);

                    let preventDisposalHandle: DisposalPreventionHandle;
                    try {
                        preventDisposalHandle = this._backendContextDisposeGuard.createPreventDisposalHandle();
                    } catch (err) {
                        this._dispatchErrorForQueuedDecodesAndDequeue(new Set(this._queuedDecodes), err);
                        return;
                    }

                    let decodeLock: Lock | undefined;
                    // this is a workaround to prevent Vulkan from crashing the process when decoding on multiple contexts in parallel
                    if (this._llama.gpu === "vulkan")
                        decodeLock = await acquireLock([decodeSyncWorkaround.vulkanLock, "decode"]);

                    try {
                        await decodeTokenBatchItems(currentBatchItems, currentBatchSize);

                        shouldHaveAnotherLoop = this._queuedDecodes.length > 0;
                    } finally {
                        decodeLock?.dispose();
                        preventDisposalHandle.dispose();
                    }
                }
            } finally {
                this._scheduleToFreeReservedThreads();
            }
        });
    }

    /**
     * Print the timings of token evaluation since that last print for this context.
     *
     * Requires the `performanceTracking` option to be enabled.
     *
     * > **Note:** it prints on the `LlamaLogLevel.info` level, so if you set the level of your `Llama` instance higher than that,
     * it won't print anything.
     */
    public async printTimings() {
        this._ensureNotDisposed();

        if (!this._performanceTracking)
            throw new UnsupportedError("Performance tracking is not enabled");

        this._ctx.printTimings();
        await new Promise((accept) => setTimeout(accept, 0)); // wait for the logs to finish printing
    }

    /** @internal */
    public async _decodeTokens<T>({
        sequenceId, firstTokenSequenceIndex, tokens, logits, evaluationPriority = defaultEvaluationPriority, tokenMeter
    }: {
        sequenceId: number, firstTokenSequenceIndex: number, tokens: Token[], logits: (true | undefined)[],
        evaluationPriority?: EvaluationPriority, tokenMeter: TokenMeter
    }, logitDataMapper: ((batchLogitIndex: BatchLogitIndex, tokenIndex: number) => T | Promise<T>)): Promise<[index: number, value: T][]> {
        return await new Promise((accept, reject) => {
            this._queuedDecodes.push({
                sequenceId,
                tokens,
                logits,
                firstTokenSequenceIndex,
                evaluationPriority,
                tokenMeter,
                response: [accept, reject],
                logitDataMapper
            });
            this._queuedDecodeSequenceIds.add(sequenceId);

            this._scheduleDecode();
        });
    }

    /** @internal */
    public _reclaimUnusedSequenceId(sequenceId: number) {
        if (this._disposed)
            return;

        void withLock([this as LlamaContext, "context"], async () => {
            if (this._disposed)
                return;

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
        if (dispatchSchedule === "nextCycle") {
            if (typeof setImmediate === "function")
                setImmediate(dispatch);
            else
                setTimeout(dispatch, 0);
        } else if (typeof dispatchSchedule === "function")
            dispatchSchedule(dispatch);
        else {
            if (typeof setImmediate === "function")
                setImmediate(dispatch);
            else
                setTimeout(dispatch, 0);
        }
    }

    /** @internal */
    private _dispatchErrorForQueuedDecodesAndDequeue(queuedDecodes: ReadonlySet<InternalQueuedDecode>, err: unknown) {
        for (const pendingDecode of queuedDecodes) {
            const [, reject] = pendingDecode.response;
            reject(err);
        }

        for (let i = 0; i < this._queuedDecodes.length; i++) {
            const item = this._queuedDecodes[i]!;
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

    /** @internal */
    private async _setLora({
        filePath, scale
    }: {
        filePath: string, scale?: number
    }) {
        const lora = await this._model._getOrLoadLora(filePath);
        this._ctx.setLora(lora, scale ?? defaultLoraScale);

        if (!this._loraAdapters.has(lora)) {
            this._loraAdapters.add(lora);
            lora.usages++;
        }
    }

    /** @internal */
    private _reserveThreads() {
        clearTimeout(this._freeReservedThreadsTimeout);
        delete this._freeReservedThreadsTimeout;

        if (this._threadSplitterConsumer != null)
            return;

        this._threadSplitterConsumer = this._llama._threadsSplitter.createConsumer(this._idealThreads, this._minThreads);
    }

    /** @internal */
    private _freeReservedThreads() {
        clearTimeout(this._freeReservedThreadsTimeout);
        delete this._freeReservedThreadsTimeout;

        if (this._threadSplitterConsumer == null)
            return;

        this._threadSplitterConsumer.dispose();
        delete this._threadSplitterConsumer;
    }

    /** @internal */
    private _scheduleToFreeReservedThreads() {
        if (this._threadSplitterConsumer == null)
            return;

        clearTimeout(this._freeReservedThreadsTimeout);
        this._freeReservedThreadsTimeout = setTimeout(this._freeReservedThreads, 0);
    }

    /** @internal */
    public static async _create(options: LlamaContextOptions, {_model}: {
        _model: LlamaModel
    }): Promise<LlamaContext> {
        const sequences = options.sequences ?? getDefaultContextSequences();
        const flashAttention = _model.flashAttentionSupported
            ? Boolean(options.flashAttention ?? _model.defaultContextFlashAttention)
            : false;
        const swaFullCache = options.swaFullCache ?? _model.defaultContextSwaFullCache;
        const loraOptions = typeof options.lora === "string"
            ? {adapters: [{filePath: options.lora}]} satisfies LlamaContextOptions["lora"]
            : options.lora satisfies LlamaContextOptions["lora"];
        let failedCreationRetries = options.failedCreationRemedy === false
            ? 0
            : Math.max(0, options.failedCreationRemedy?.retries ?? defaultFailedCreationRemedy.retries);
        const failedCreationAutoContextSizeShrink = options.failedCreationRemedy === false
            ? 0
            : options.failedCreationRemedy?.autoContextSizeShrink ?? defaultFailedCreationRemedy.autoContextSizeShrink;

        let contextSize = await _model.fileInsights.configurationResolver.resolveContextContextSize(options.contextSize, {
            batchSize: options.batchSize,
            sequences: sequences,
            modelGpuLayers: _model.gpuLayers,
            modelTrainContextSize: _model.trainContextSize,
            flashAttention,
            swaFullCache,
            getVramState: () => _model._llama._vramOrchestrator.getMemoryState(),
            llamaGpu: _model._llama.gpu,
            ignoreMemorySafetyChecks: options.ignoreMemorySafetyChecks,
            isEmbeddingContext: options._embeddings
        });
        const minContextSize = options.contextSize === "auto"
            ? shrinkRetriesMinContextSize
            : (typeof options.contextSize === "object" && typeof options.contextSize.min === "number")
                ? options.contextSize.min
                : typeof options.contextSize === "number"
                    ? options.contextSize
                    : shrinkRetriesMinContextSize;
        const {createSignal} = options;

        async function createContext(contextSize: number) {
            const batchSize = options.batchSize ?? getDefaultContextBatchSize({contextSize, sequences});
            const resourceRequirementsEstimation = _model.fileInsights.estimateContextResourceRequirements({
                contextSize,
                sequences,
                isEmbeddingContext: options._embeddings,
                modelGpuLayers: _model.gpuLayers,
                batchSize,
                flashAttention,
                swaFullCache
            });

            const context = new LlamaContext({_model}, {...options, contextSize, batchSize, sequences, flashAttention, swaFullCache});
            const contextCreationVramReservation = options.ignoreMemorySafetyChecks
                ? null
                : _model._llama._vramOrchestrator.reserveMemory(resourceRequirementsEstimation.gpuVram);
            const contextCreationRamReservation = options.ignoreMemorySafetyChecks
                ? null
                : _model._llama._vramOrchestrator.reserveMemory(resourceRequirementsEstimation.cpuRam);

            try {
                if (createSignal?.aborted)
                    throw createSignal.reason;

                const contextLoaded = await context._ctx.init();

                if (createSignal?.aborted) {
                    if (contextLoaded)
                        await context._ctx.dispose();

                    throw createSignal.reason;
                } else if (!contextLoaded)
                    throw new Error("Failed to create context");

                contextCreationVramReservation?.dispose?.();
                contextCreationRamReservation?.dispose?.();

                if (loraOptions != null && loraOptions.adapters.length > 0) {
                    let loadedAdapters = 0;

                    for (const adapter of loraOptions.adapters) {
                        try {
                            await context._setLora({
                                filePath: adapter.filePath,
                                scale: adapter.scale
                            });
                            loadedAdapters++;

                            try {
                                loraOptions.onLoadProgress?.(loadedAdapters / loraOptions.adapters.length);
                            } catch (err) {
                                console.error(err);
                            }
                        } catch (err) {
                            await context.dispose();
                            throw err;
                        }

                        if (createSignal?.aborted) {
                            await context.dispose();
                            throw createSignal.reason;
                        }
                    }
                } else if (loraOptions?.onLoadProgress != null) {
                    try {
                        loraOptions.onLoadProgress(1);
                    } catch (err) {
                        console.error(err);
                    }
                }

                return context;
            } finally {
                contextCreationVramReservation?.dispose?.();
                contextCreationRamReservation?.dispose?.();
            }
        }

        while (failedCreationRetries >= 0) {
            try {
                return await createContext(contextSize);
            } catch (err) {
                if (failedCreationRetries === 0 || (createSignal?.aborted && err === createSignal.reason))
                    throw err;

                failedCreationRetries--;
                let newContextSize = typeof failedCreationAutoContextSizeShrink === "number"
                    ? Math.floor(contextSize * (1 - failedCreationAutoContextSizeShrink))
                    : Math.floor(failedCreationAutoContextSizeShrink(contextSize));

                if (!Number.isFinite(newContextSize))
                    throw err;

                if (newContextSize < minContextSize)
                    newContextSize = minContextSize;

                if (newContextSize >= contextSize)
                    throw err;

                contextSize = newContextSize;
            }
        }

        throw new Error("Failed to create context");
    }
}

export class LlamaContextSequence {
    /** @internal */ private readonly _sequenceId: number;
    /** @internal */ private readonly _gcRegistry: FinalizationRegistry<number>;
    /** @internal */ private readonly _context: LlamaContext;
    /** @internal */ private readonly _contextShift: Required<ContextShiftOptions>;
    /** @internal */ private readonly _tokenPredictor?: TokenPredictor;
    /** @internal */ private readonly _tokenMeter: TokenMeter;
    /** @internal */ private readonly _disposeAggregator = new DisposeAggregator();
    /** @internal */ private readonly _lock = {};
    /** @internal */ private _resetTokenPredictor: boolean = false;
    /** @internal */ private _tokenPredictorOwner: {} = {};
    /** @internal */ public _contextTokens: Token[] = [];
    /** @internal */ private _nextTokenIndex: number = 0;
    /** @internal */ private _loadedTokenPredictions: Array<[
        input: Token,
        output: [token: Token, probabilities: (Token | number)[] | undefined, confidence: number | undefined]
    ]> = [];
    /** @internal */ private _usedTokenPredictions: number = 0;
    /** @internal */ private _unusedTokenPredictions: number = 0;
    /** @internal */ private _validatedTokenPredictions: number = 0;
    /** @internal */ private _refutedTokenPredictions: number = 0;
    /** @internal */ private _disposed = false;

    public readonly onDispose = new EventRelay<void>();

    private constructor({
        sequenceId, context, tokenMeter, contextShift, tokenPredictor
    }: {
        sequenceId: number,
        context: LlamaContext,
        tokenMeter?: TokenMeter,
        contextShift: Required<ContextShiftOptions>,
        tokenPredictor?: TokenPredictor
    }) {
        this._sequenceId = sequenceId;
        this._context = context;
        this._tokenMeter = tokenMeter ?? new TokenMeter();
        this._contextShift = contextShift;
        this._tokenPredictor = tokenPredictor;
        this._gcRegistry = new FinalizationRegistry(this._context._reclaimUnusedSequenceId);

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

        if (this._tokenPredictor != null)
            this._disposeAggregator.add(this._tokenPredictor);
    }

    public dispose() {
        if (this._disposed)
            return;

        this._disposeAggregator.dispose();

        this._contextTokens.length = 0;

        this._disposed = true;
    }

    /** @hidden */
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

    /** The maximum number of tokens that the sequence state can hold */
    public get contextSize() {
        return this._context.contextSize;
    }

    /** The index where the next evaluated token will be placed in the context */
    public get nextTokenIndex() {
        return this._nextTokenIndex - this._loadedTokenPredictions.length;
    }

    /** The current context state tokens */
    public get contextTokens() {
        if (this._loadedTokenPredictions.length === 0)
            return this._contextTokens.slice();

        return this._contextTokens.slice(0, -this._loadedTokenPredictions.length);
    }

    public get tokenMeter() {
        return this._tokenMeter;
    }

    /**
     * The token predictor used when creating this sequence.
     */
    public get tokenPredictor() {
        return this._tokenPredictor;
    }

    /**
     * Get the index of the first token in the KV cache.
     *
     * If you remove any tokens from the state that come before this index,
     * no cached prefix tokens evaluation state will be used for the next evaluation.
     *
     * For example, if `stateCellsStartIndex` is `10` and you remove the range `{start: 11, end: 16}`
     * then the cached state for range `0-10` will be used in the next evaluation,
     * but if you remove the range `{start: 10, end: 16}` (or `{start: 9, end: 16}`) then the cached state will not be used at all
     * and will be re-evaluated in the next evaluation.
     *
     * This index can be greater than `0` only when SWA (Sliding Window Attention) is used (only on supported models).
     *
     * When SWA is used, this index will usually be `Math.max(-1, .nextTokenIndex - .model.fileInsights.swaSize)` or larger.
     *
     * When the KV cache is empty, this index will be `-1`.
     *
     * You can disable SWA by setting the `swaFullCache` option to `true` when creating a context.
     */
    public get stateCellsStartIndex() {
        this._ensureNotDisposed();

        return this._context._ctx.getSequenceKvCacheMinPosition(this._sequenceId);
    }

    /**
     * Statistics of token predictions using the sequence's `tokenPredictor`.
     *
     * The statistics change only when token prediction is used in this sequence.
     *
     * `validated` + `refuted` = total number of evaluated predictions.
     *
     * Prefer using `validated` and `refuted` to evaluate the effectiveness of token prediction.
     */
    public get tokenPredictions(): {
        /** Number of token predictions that were actually used (tokens that were validated and then consumed) */
        used: number,

        /** Number of token predictions that were not used (tokens that were validated and were not consumed) */
        unused: number,

        /** Number of token predictions that were validated successfully */
        validated: number,

        /** Number of token predictions that were refuted */
        refuted: number
    } {
        return {
            used: this._usedTokenPredictions,
            unused: this._unusedTokenPredictions,
            validated: this._validatedTokenPredictions,
            refuted: this._refutedTokenPredictions
        };
    }

    public get isLoadedToMemory() {
        return !this._disposed;
    }

    public compareContextTokens(tokens: Token[]): {
        firstDifferentIndex: number
    } {
        for (let i = 0; i < this._contextTokens.length - this._loadedTokenPredictions.length; i++) {
            if (compareTokens(this._contextTokens[i], tokens[i]))
                continue;

            return {
                firstDifferentIndex: i
            };
        }

        return {
            firstDifferentIndex: this._contextTokens.length - this._loadedTokenPredictions.length
        };
    }

    /**
     * Erase parts of the context state to align it with the given tokens.
     *
     * If the given tokens do not align with the current context state, the context state will be erased to align with the given tokens.
     *
     * To find the first different token index between the context state and the given tokens, access the `nextTokenIndex` property.
     *
     * If `allowShift` is `true` (the default), shifting tokens may happen to align the context state with the given tokens,
     * which incurs token evaluation of the shifted tokens.
     */
    public async adaptStateToTokens(tokens: Token[], allowShift: boolean = true) {
        const modelSupportsShifting = !this.model.fileInsights.isRecurrent &&
            this.model.fileInfo.metadata?.general?.architecture !== GgufArchitectureType.deepseek2;

        if (!modelSupportsShifting || !allowShift) {
            const {firstDifferentIndex} = this.compareContextTokens(tokens);
            if (firstDifferentIndex < this.nextTokenIndex)
                await this._eraseContextTokenRanges([{
                    start: firstDifferentIndex,
                    end: this._nextTokenIndex
                }]);

            return;
        }

        const eraseRanges: ContextTokensDeleteRange[] = [];

        let tokensIndex = 0;
        let differentTokenIndex: number | undefined = undefined;
        for (let i = 0; i < this._contextTokens.length - this._loadedTokenPredictions.length && tokensIndex < tokens.length; i++) {
            if (compareTokens(this._contextTokens[i], tokens[tokensIndex])) {
                if (differentTokenIndex != null) {
                    eraseRanges.push({
                        start: differentTokenIndex,
                        end: i
                    });

                    differentTokenIndex = undefined;
                }

                tokensIndex++;
                continue;
            }

            if (differentTokenIndex == null)
                differentTokenIndex = i;
        }

        if (differentTokenIndex != null)
            eraseRanges.push({
                start: differentTokenIndex,
                end: this._nextTokenIndex
            });

        if (eraseRanges.length > 0)
            await this._eraseContextTokenRanges(eraseRanges);
    }

    /**
     * Clear the history of the sequence.
     */
    public async clearHistory() {
        this._ensureNotDisposed();

        await this._eraseContextTokenRanges([{start: 0, end: this._nextTokenIndex}]);
    }

    /**
     * Erase context tokens in the provided ranges to free up space for new tokens to be generated.
     * The start of each range is inclusive, and the end of each range is exclusive.
     * For example, the range `{start: 0, end: 1}` will remove the token at the `0` index only.
     */
    public eraseContextTokenRanges(ranges: ContextTokensDeleteRange[]) {
        return this._eraseContextTokenRanges(ranges);
    }

    /** @internal */
    private async _eraseContextTokenRanges(
        ranges: ContextTokensDeleteRange[],
        {
            canResetTokenPredictor = true,
            canRemovePredictionTokens = true,
            skipLock = false
        }: {
            canResetTokenPredictor?: boolean,
            canRemovePredictionTokens?: boolean,
            skipLock?: boolean
        } = {}
    ) {
        this._ensureNotDisposed();

        let awaitPromise: Promise<void> | undefined;

        await withLock([this._context, "context"], async () => {
            this._ensureNotDisposed();

            if (ranges.length === 0)
                return;

            // if the deletion fails, we'll have to dispose the sequence and fill it up again
            let deletionSuccessful = true;

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

                    const lastRange = ranges[ranges.length - 1]!;
                    if (lastRange.end >= range.start) {
                        lastRange.end = Math.max(lastRange.end, range.end);
                        return ranges;
                    }

                    ranges.push(range);
                    return ranges;
                }, [] as ContextTokensDeleteRange[]);

            const minKvCachePosition = (this._contextTokens.length === 0 && this._loadedTokenPredictions.length === 0)
                ? 0
                : Math.max(0, this._context._ctx.getSequenceKvCacheMinPosition(this._sequenceId));
            if (resolvedRanges[0] != null && resolvedRanges[0].start <= minKvCachePosition)
                // we have to drop the cache and reevaluate the sequence due to missing KV cache
                deletionSuccessful = false;

            const tokenPredictionsToRemove = (resolvedRanges.length > 0 && canRemovePredictionTokens)
                ? this._loadedTokenPredictions.length
                : 0;
            if (tokenPredictionsToRemove > 0) {
                const startDeleteIndex = this._nextTokenIndex - this._loadedTokenPredictions.length;
                const lastDeleteRange = resolvedRanges[resolvedRanges.length - 1]!;
                if (lastDeleteRange.end >= startDeleteIndex)
                    lastDeleteRange.end = this._nextTokenIndex;
                else
                    resolvedRanges.push({start: startDeleteIndex, end: this._nextTokenIndex});

                if (canResetTokenPredictor)
                    await this._abortTokenPredictor(true);
            }

            let removedTokens = 0;
            let lastDeleteRangeEndPos: number | null = null;
            for (const range of resolvedRanges) {
                this._contextTokens.splice(range.start - removedTokens, range.end - range.start);
                if (deletionSuccessful)
                    deletionSuccessful &&= this._context._ctx.removeTokenCellsFromSequence(this._sequenceId, range.start, range.end);

                if (deletionSuccessful && lastDeleteRangeEndPos != null && removedTokens > 0 && lastDeleteRangeEndPos !== range.start) {
                    this._context._ctx.shiftSequenceTokenCells(this._sequenceId, lastDeleteRangeEndPos, range.start, -removedTokens);
                    const shiftedTokens = range.start - lastDeleteRangeEndPos;
                    this._tokenMeter.useTokens(shiftedTokens, "input");
                }

                removedTokens += range.end - range.start;
                lastDeleteRangeEndPos = range.end;
            }

            if (tokenPredictionsToRemove > 0)
                this._loadedTokenPredictions.splice(0, tokenPredictionsToRemove);

            if (deletionSuccessful && lastDeleteRangeEndPos != null && removedTokens > 0 &&
                lastDeleteRangeEndPos !== this._nextTokenIndex
            ) {
                this._context._ctx.shiftSequenceTokenCells(this._sequenceId, lastDeleteRangeEndPos, this._nextTokenIndex, -removedTokens);
                const shiftedTokens = this._nextTokenIndex - lastDeleteRangeEndPos;
                this._tokenMeter.useTokens(shiftedTokens, "input");
            }

            this._nextTokenIndex -= removedTokens;

            if (canResetTokenPredictor && removedTokens > 0)
                await this._abortTokenPredictor(true);

            if (deletionSuccessful)
                return;

            const newSequenceTokens = this._contextTokens.slice();
            this._nextTokenIndex = 0;
            this._context._ctx.disposeSequence(this._sequenceId);

            // wait for the evaluation outside the "context" lock to avoid deadlocks
            awaitPromise = this.evaluateWithoutGeneratingNewTokens(newSequenceTokens, {_skipLock: skipLock});
        });

        if (awaitPromise != null)
            await awaitPromise;
    }

    /**
     * Evaluate the provided tokens into the context sequence, and continue generating new tokens on iterator iterations.
     *
     * This method uses the token predictor (when provided) to generate new tokens faster.
     */
    public async *evaluate(tokens: Token[], options: SequenceEvaluateOptions = {}): AsyncGenerator<Token, void, void | Token | Token[]> {
        const iterator = this.evaluateWithMetadata(tokens, {}, options);
        let iterateInput: void | Token | Token[] = undefined;

        try {
            while (true) {
                const {value, done} = await iterator.next(iterateInput);
                if (done)
                    return;

                iterateInput = yield value.token;
            }
        } finally {
            await iterator.return();
        }
    }

    /**
     * Like {@link evaluate `.evaluate(...)`}, but with additional metadata for each generated token.
     *
     * Configure the additional metadata options to choose which metadata to include.
     */
    public evaluateWithMetadata<const Metadata extends SequenceEvaluateMetadataOptions>(
        tokens: Token[],
        metadata: Metadata,
        options: SequenceEvaluateOptions = {}
    ): AsyncGenerator<SequenceEvaluateOutput<Metadata>, void, void | Token | Token[]> {
        const {
            temperature = 0,
            minP = 0,
            topK = 40,
            topP = 0.95,
            seed,
            grammarEvaluationState,
            repeatPenalty,
            tokenBias,
            evaluationPriority = defaultEvaluationPriority,
            contextShift: {
                size: contextShiftSize = this._contextShift.size,
                strategy: contextShiftStrategy = this._contextShift.strategy
            } = {},
            yieldEogToken = false,

            _noSampling = false
        } = options;

        if (this._tokenPredictor != null && !_noSampling && tokens.length > 0)
            return this._speculativeEvaluate(tokens, metadata, {
                temperature,
                minP,
                topK,
                topP,
                seed,
                grammarEvaluationState,
                repeatPenalty,
                tokenBias,
                evaluationPriority,
                contextShiftOptions: {
                    size: contextShiftSize,
                    strategy: contextShiftStrategy
                },
                yieldEogToken,
                tokenPredictor: this._tokenPredictor
            });

        return this._evaluate(tokens, metadata, {
            temperature,
            minP,
            topK,
            topP,
            seed,
            grammarEvaluationState,
            repeatPenalty,
            tokenBias,
            evaluationPriority,
            contextShiftOptions: {
                size: contextShiftSize,
                strategy: contextShiftStrategy
            },
            yieldEogToken,

            _noSampling
        });
    }

    /**
     * Evaluate the provided tokens into the context sequence without generating new tokens.
     */
    public async evaluateWithoutGeneratingNewTokens(tokens: Token[], options: {
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

        /** Override the sequence context shift options for this evaluation */
        contextShift?: ContextShiftOptions,

        /** @internal */
        _skipLock?: boolean
    } = {}): Promise<void> {
        const {
            evaluationPriority = defaultEvaluationPriority,
            contextShift: {
                size: contextShiftSize = this._contextShift.size,
                strategy: contextShiftStrategy = this._contextShift.strategy
            } = {},
            _skipLock = false
        } = options;

        const iterator = this._evaluate(tokens, {}, {
            generateNewTokens: false,
            evaluationPriority,
            contextShiftOptions: {
                size: contextShiftSize,
                strategy: contextShiftStrategy
            },
            _skipLock
        });
        const predictorAlignmentPromise = this.tokenPredictor == null
            ? undefined
            : this._tokenPredictor?.reset({
                stateTokens: [...this._contextTokens, ...tokens],
                evaluateOptions: {
                    evaluationPriority,
                    contextShift: {
                        size: contextShiftSize,
                        strategy: contextShiftStrategy
                    }
                },
                targetSequence: this
            });
        if (predictorAlignmentPromise != null) {
            this._tokenPredictorOwner = {};
            this._resetTokenPredictor = false;
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const token of iterator) {
            // Array.from doesn't work with async generators, so we have to iterate over the generator
        }

        await iterator.return();

        if (predictorAlignmentPromise != null)
            await predictorAlignmentPromise;
    }

    /**
     * Evaluate the provided tokens into the context sequence with custom options for each token.
     *
     * This method allows for more precise control of the generation process.
     *
     * A next token will be generated for a given token only if any of the `generateNext` options for it are used.
     *
     * To generate more tokens after this method finishes,
     * use it again with token(s) you selected to add to the context from the previous evaluation.
     *
     * This method doesn't use the token predictor (when provided) since it cannot predict which tokens are actually needed.
     * Use the `evaluate` method when you need to use token prediction.
     * @returns An array where for each token in the input array, there can be an output item at the same index in the output array.
     * For indexes that have no output, there won't be any value at the corresponding index in the output array.
     *
     * It's recommended to iterate from `0` up to the length of the input array to check the results in the output array.
     */
    public async controlledEvaluate(input: ControlledEvaluateInputItem[], options?: {
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

        /** Override the sequence context shift options for this evaluation */
        contextShift?: ContextShiftOptions,

        /** Called on each token result after it's generated */
        onTokenResult?(inputTokenIndex: number, result: ControlledEvaluateIndexOutput): void
    }): Promise<Array<undefined | ControlledEvaluateIndexOutput>> {
        const {
            evaluationPriority = defaultEvaluationPriority,
            contextShift: {
                size: contextShiftSize = this._contextShift.size,
                strategy: contextShiftStrategy = this._contextShift.strategy
            } = {}
        } = options ?? {};
        const contextShiftOptions: Required<ContextShiftOptions> = {
            size: contextShiftSize,
            strategy: contextShiftStrategy
        };

        this._ensureNotDisposed();

        if (input.length === 0)
            return [];

        await this._abortTokenPredictor();

        const sampler = new LlamaSampler(this.model);
        const onTokenResult = safeEventCallback(options?.onTokenResult);

        const logitsArray: (true | undefined)[] = [];
        const resolvedTokens = input.map((item, index) => {
            if (item instanceof Array) {
                const [token, options] = item;
                const generateNext = options?.generateNext ?? {};
                if (generateNext.probabilities === true || generateNext.confidence === true || generateNext.token === true)
                    logitsArray[index] = true;

                return token;
            }

            return item;
        });

        const evaluatorLock = await acquireLock([this._lock, "evaluate"]);
        try {
            return await this._decodeTokens(
                resolvedTokens,
                logitsArray,
                evaluationPriority,
                this._tokenMeter,
                contextShiftOptions,
                async (batchLogitIndex, tokenIndex) => {
                    const inputToken = input[tokenIndex];
                    const inputOptions = inputToken instanceof Array
                        ? (inputToken[1] ?? {})
                        : {};
                    const generateNext = inputOptions.generateNext;

                    if (generateNext == null || (
                        (generateNext.probabilities == null || !generateNext.probabilities) &&
                        (generateNext.token == null || !generateNext.token) &&
                        (generateNext.confidence == null || !generateNext.confidence)
                    ))
                        return undefined;

                    const sampleOptions = generateNext.options ?? {};
                    const samplerConfig = this._resolveSamplerConfig({
                        temperature: sampleOptions.temperature,
                        minP: sampleOptions.minP,
                        topK: sampleOptions.topK,
                        topP: sampleOptions.topP,
                        seed: sampleOptions.seed,
                        repeatPenalty: sampleOptions.repeatPenalty,
                        tokenBias: sampleOptions.tokenBias
                    });

                    return await withLock([sampler, "sample"], async () => {
                        if (sampler.disposed)
                            return undefined;

                        sampler.applyConfig(samplerConfig);
                        const [token, probabilities, confidence] = await this._context._ctx.sampleToken(
                            batchLogitIndex,
                            sampler._sampler,
                            !!generateNext.probabilities,
                            !!generateNext.confidence
                        );

                        const output: ControlledEvaluateIndexOutput = {
                            next: {}
                        };

                        if (generateNext.token)
                            output.next.token = token === -1
                                ? null
                                : (token ?? null);

                        if (confidence != null)
                            output.next.confidence = confidence;

                        if (probabilities != null)
                            output.next.probabilities = reviveTokenProbabilities(probabilities);

                        onTokenResult?.(tokenIndex, output);

                        return output;
                    });
                }
            );
        } finally {
            evaluatorLock.dispose();
            void withLock([sampler, "sample"], sampler.asyncDispose);
        }
    }

    /* eslint-disable @stylistic/max-len */
    /**
     * Save the current context sequence evaluation state to a file.
     * @see [Saving and restoring a context sequence evaluation state](https://node-llama-cpp.withcat.ai/guide/chat-session#save-and-restore-with-context-sequence-state)
     */
    public async saveStateToFile(filePath: string) {
        /* eslint-enable @stylistic/max-len */
        this._ensureNotDisposed();

        const resolvedPath = path.resolve(process.cwd(), filePath);

        const evaluatorLock = await acquireLock([this._lock, "evaluate"]);
        const contextLock = await acquireLock([this._context, "context"]);

        try {
            this._ensureNotDisposed();

            const fileSize = await this._context._ctx.saveSequenceStateToFile(
                resolvedPath,
                this._sequenceId,
                Uint32Array.from(this.contextTokens)
            );
            return {fileSize};
        } finally {
            contextLock.dispose();
            evaluatorLock.dispose();
        }
    }

    /* eslint-disable @stylistic/max-len */
    /**
     * Load a context sequence evaluation state from a file.
     *
     * Trying to load a state file with a longer context size than the current sequence's context size will fail and throw an error.
     *
     * You must ensure that the file was created from the exact same model, otherwise, using this function may crash the process.
     * @see [Saving and restoring a context sequence evaluation state](https://node-llama-cpp.withcat.ai/guide/chat-session#save-and-restore-with-context-sequence-state)
     */
    public async loadStateFromFile(filePath: string, acceptRisk: {
        /**
         * Loading a state file created using a different model may crash the process.
         *
         * You must accept this risk to use this feature.
         */
        acceptRisk: true
    }) {
        /* eslint-enable @stylistic/max-len */
        if (!acceptRisk.acceptRisk)
            throw new Error("The `acceptRisk` option must be set to `true` to use this feature");

        this._ensureNotDisposed();

        const resolvedPath = path.resolve(process.cwd(), filePath);

        const evaluatorLock = await acquireLock([this._lock, "evaluate"]);
        const contextLock = await acquireLock([this._context, "context"]);

        try {
            this._ensureNotDisposed();

            this._tokenPredictorOwner = {};
            await this._abortTokenPredictor(true);
            this._ensureNotDisposed();

            this._loadedTokenPredictions.length = 0;
            this._nextTokenIndex = 0;
            this._contextTokens = [];

            const tokens = Array.from(
                await this._context._ctx.loadSequenceStateFromFile(resolvedPath, this._sequenceId, this.contextSize)
            ) as Token[];

            if (tokens.length > this.contextSize) {
                this._context._ctx.disposeSequence(this._sequenceId);
                throw new Error("The given state file is too large for the current context size");
            }

            this._contextTokens = tokens;
            this._nextTokenIndex = tokens.length;
            this._loadedTokenPredictions.length = 0;
        } finally {
            contextLock.dispose();
            evaluatorLock.dispose();
        }
    }

    /** @internal */
    private async *_evaluate<const Metadata extends SequenceEvaluateMetadataOptions>(tokens: Token[], metadata: Metadata, {
        temperature,
        minP,
        topK,
        topP,
        seed,
        grammarEvaluationState,
        repeatPenalty,
        tokenBias,
        evaluationPriority = defaultEvaluationPriority,
        generateNewTokens = true,
        contextShiftOptions,
        yieldEogToken = false,

        _noSampling = false,
        _skipLock = false
    }: {
        temperature?: number, minP?: number, topK?: number, topP?: number, seed?: number,
        grammarEvaluationState?: LlamaGrammarEvaluationState | (() => LlamaGrammarEvaluationState | undefined),
        repeatPenalty?: LlamaContextSequenceRepeatPenalty, tokenBias?: TokenBias | (() => TokenBias),
        evaluationPriority?: EvaluationPriority, generateNewTokens?: boolean, contextShiftOptions: Required<ContextShiftOptions>,
        yieldEogToken?: boolean,
        _noSampling?: boolean,
        _skipLock?: boolean
    }): AsyncGenerator<SequenceEvaluateOutput<Metadata>, void, void | Token | Token[]> {
        this._ensureNotDisposed();

        let evalTokens = tokens;

        if (evalTokens.length === 0)
            return;

        await this._abortTokenPredictor(false, true);

        const sampleProbabilities = metadata.probabilities === true;
        const sampleConfidence = metadata.confidence === true;

        const sampler = new LlamaSampler(this.model);
        try {
            while (true) {
                this._ensureNotDisposed();
                const evaluatorLock = _skipLock
                    ? undefined
                    : await acquireLock([this._lock, "evaluate"]);
                let nextToken: Token | -1 | null | undefined;
                const yieldRes: Partial<SequenceEvaluateOutput<{probabilities: true, confidence: true}>> = {};

                try {
                    const logitsArray: (true | undefined)[] = [];

                    if (generateNewTokens)
                        logitsArray[evalTokens.length - 1] = true;

                    // Evaluate to get the next token.
                    const decodeResult = await this._decodeTokens(
                        evalTokens,
                        logitsArray,
                        evaluationPriority,
                        this._tokenMeter,
                        contextShiftOptions,
                        (batchLogitIndex) => {
                            if (_noSampling)
                                return null;

                            const samplerConfig = this._resolveSamplerConfig({
                                temperature,
                                minP,
                                topK,
                                topP,
                                seed,
                                grammarEvaluationState,
                                repeatPenalty,
                                tokenBias
                            });

                            return withLock([sampler, "sample"], async () => {
                                if (sampler.disposed)
                                    return null;

                                sampler.applyConfig(samplerConfig);
                                if (sampleProbabilities || sampleConfidence)
                                    return this._context._ctx.sampleToken(
                                        batchLogitIndex,
                                        sampler._sampler,
                                        sampleProbabilities,
                                        sampleConfidence
                                    );
                                else
                                    return this._context._ctx.sampleToken(batchLogitIndex, sampler._sampler);
                            });
                        }
                    );

                    const lastDecodeResult = decodeResult[evalTokens.length - 1];

                    if (lastDecodeResult instanceof Array) {
                        const [token, probabilities, confidence] = lastDecodeResult;
                        nextToken = token;

                        if (probabilities != null)
                            yieldRes.probabilities = reviveTokenProbabilities(probabilities);

                        if (confidence != null)
                            yieldRes.confidence = confidence;
                    } else
                        nextToken = lastDecodeResult;

                    if (nextToken === -1)
                        throw new Error("Failed to sample next token");

                    if (nextToken == null)
                        return;

                    // the model finished generating text
                    if (!yieldEogToken && this._context.model.isEogToken(nextToken))
                        break;
                } finally {
                    evaluatorLock?.dispose();
                }

                yieldRes.token = nextToken;

                const replacementToken = yield yieldRes as SequenceEvaluateOutput<Metadata>;

                // set the tokens for the next evaluation
                if (replacementToken instanceof Array)
                    evalTokens = replacementToken.slice();
                else if (replacementToken != null)
                    evalTokens = [replacementToken];
                else
                    evalTokens = [nextToken];
            }
        } finally {
            void withLock([sampler, "sample"], sampler.asyncDispose);
        }
    }

    /** @internal */
    private async *_speculativeEvaluate<const Metadata extends SequenceEvaluateMetadataOptions>(tokens: Token[], metadata: Metadata, {
        temperature,
        minP,
        topK,
        topP,
        seed,
        grammarEvaluationState,
        repeatPenalty,
        tokenBias,
        evaluationPriority = defaultEvaluationPriority,
        contextShiftOptions,
        yieldEogToken = false,
        tokenPredictor
    }: {
        temperature?: number, minP?: number, topK?: number, topP?: number, seed?: number,
        grammarEvaluationState?: LlamaGrammarEvaluationState | (() => LlamaGrammarEvaluationState | undefined),
        repeatPenalty?: LlamaContextSequenceRepeatPenalty, tokenBias?: TokenBias | (() => TokenBias),
        evaluationPriority?: EvaluationPriority, contextShiftOptions: Required<ContextShiftOptions>,
        yieldEogToken?: boolean, tokenPredictor: TokenPredictor
    }): AsyncGenerator<SequenceEvaluateOutput<Metadata>, void, void | Token | Token[]> {
        this._ensureNotDisposed();

        let evalTokens = tokens.slice();

        if (evalTokens.length === 0)
            return;

        const tokenPredictorOwner: {} = {};
        this._tokenPredictorOwner = tokenPredictorOwner;
        await this._abortTokenPredictor();

        const sampleProbabilities = metadata.probabilities === true;
        const sampleConfidence = metadata.confidence === true;

        let logitsArray: (true | undefined)[] = [];
        let logitsStartIndex = evalTokens.length - 1;
        const validatedTokens: [input: Token, output: Token][] = [];
        logitsArray[logitsStartIndex] = true;

        const sampler = new LlamaSampler(this.model);
        try {
            while (true) {
                this._ensureNotDisposed();
                const evaluatorLock = await acquireLock([this._lock, "evaluate"]);
                let nextToken: Token | undefined;
                const yieldRes: Partial<SequenceEvaluateOutput<{probabilities: true, confidence: true}>> = {};

                try {
                    if (this._tokenPredictorOwner === tokenPredictorOwner &&
                        this._loadedTokenPredictions.length > 0 &&
                        evalTokens.length === 1 &&
                        evalTokens[0] === this._loadedTokenPredictions[0]?.[0]
                    ) {
                        const [token, probabilities, confidence] = this._loadedTokenPredictions.shift()![1];
                        nextToken = token;
                        yieldRes.token = nextToken;

                        if (probabilities != null)
                            yieldRes.probabilities = reviveTokenProbabilities(probabilities);

                        if (confidence != null)
                            yieldRes.confidence = confidence;

                        const resolvedGrammarEvaluationState = grammarEvaluationState instanceof Function
                            ? grammarEvaluationState()
                            : grammarEvaluationState;

                        if (resolvedGrammarEvaluationState != null)
                            LlamaSampler._acceptTokenOnGrammarEvaluationState(
                                this._context._llama,
                                resolvedGrammarEvaluationState,
                                nextToken
                            );

                        this._unusedTokenPredictions--;
                        this._usedTokenPredictions++;
                    } else if (this._tokenPredictorOwner === tokenPredictorOwner && this._loadedTokenPredictions.length > 0) {
                        const deleteStartIndex = Math.max(0, this._nextTokenIndex - this._loadedTokenPredictions.length);
                        await this._eraseContextTokenRanges(
                            [{start: deleteStartIndex, end: this._nextTokenIndex}],
                            {canResetTokenPredictor: true, canRemovePredictionTokens: true, skipLock: true}
                        );
                        this._loadedTokenPredictions.length = 0;
                    }

                    if (this._resetTokenPredictor) {
                        await tokenPredictor.reset({
                            stateTokens: [...this._contextTokens, ...evalTokens],
                            evaluateOptions: {
                                temperature,
                                minP,
                                topK,
                                topP,
                                seed,
                                grammarEvaluationState: grammarEvaluationState instanceof Function
                                    ? grammarEvaluationState()?.clone()
                                    : grammarEvaluationState?.clone(),
                                repeatPenalty,
                                tokenBias,
                                evaluationPriority,
                                contextShift: contextShiftOptions,
                                yieldEogToken: true
                            },
                            targetSequence: this
                        });
                        this._resetTokenPredictor = false;
                        this._tokenPredictorOwner = tokenPredictorOwner;
                    }

                    if (nextToken == null) {
                        if (this._tokenPredictorOwner === tokenPredictorOwner &&

                            // prevent incurring context shifts due to token prediction validations
                            this._nextTokenIndex + evalTokens.length < this._context.contextSize
                        ) {
                            const testGrammarClone = grammarEvaluationState instanceof Function
                                ? grammarEvaluationState()?.clone()
                                : grammarEvaluationState?.clone();
                            for (const token of await tokenPredictor.predictTokens()) {
                                if (testGrammarClone != null) {
                                    const canAddToken = LlamaSampler._canBeNextTokenForGrammarEvaluationState(
                                        this.model._llama,
                                        testGrammarClone,
                                        token
                                    );

                                    if (!canAddToken)
                                        break;
                                }

                                evalTokens.push(token);
                                logitsArray[evalTokens.length - 1] = true;

                                // prevent incurring context shifts due to token prediction validations
                                if (this._nextTokenIndex + evalTokens.length >= this._context.contextSize)
                                    break;
                            }
                        }

                        let resolvedGrammarEvaluationState: LlamaGrammarEvaluationState | undefined = undefined;

                        // Evaluate to get the next token.
                        const decodeResult = await this._decodeTokens(
                            evalTokens,
                            logitsArray,
                            evaluationPriority,
                            this._tokenMeter,
                            contextShiftOptions,
                            (batchLogitIndex, tokenIndex: number) => {
                                if (tokenIndex === logitsStartIndex)
                                    resolvedGrammarEvaluationState = grammarEvaluationState instanceof Function
                                        ? grammarEvaluationState()
                                        : grammarEvaluationState;
                                else if (tokenIndex === logitsStartIndex + 1)
                                    resolvedGrammarEvaluationState = resolvedGrammarEvaluationState?.clone();

                                const samplerConfig = this._resolveSamplerConfig({
                                    temperature,
                                    minP,
                                    topK,
                                    topP,
                                    seed,
                                    grammarEvaluationState: resolvedGrammarEvaluationState,
                                    repeatPenalty,
                                    tokenBias
                                });

                                return withLock([sampler, "sample"], async () => {
                                    if (sampler.disposed)
                                        return null;

                                    sampler.applyConfig(samplerConfig);
                                    if (sampleProbabilities || sampleConfidence)
                                        return this._context._ctx.sampleToken(
                                            batchLogitIndex,
                                            sampler._sampler,
                                            sampleProbabilities,
                                            sampleConfidence
                                        );
                                    else
                                        return this._context._ctx.sampleToken(batchLogitIndex, sampler._sampler);
                                });
                            }
                        );

                        for (let i = logitsStartIndex; i < evalTokens.length; i++) {
                            const item = decodeResult[i];
                            const [resultToken, probabilities, confidence] = item instanceof Array
                                ? item
                                : [item];

                            if (i === logitsStartIndex) {
                                if (resultToken === -1)
                                    throw new Error("Failed to sample next token");

                                if (resultToken == null)
                                    return;

                                nextToken = resultToken;
                                yieldRes.token = nextToken;

                                if (probabilities != null)
                                    yieldRes.probabilities = reviveTokenProbabilities(probabilities);

                                if (confidence != null)
                                    yieldRes.confidence = confidence;
                            } else {
                                if (resultToken === -1 || resultToken == null)
                                    break;

                                const lastValidatedTokenOutput = i === logitsStartIndex + 1
                                    ? nextToken
                                    : validatedTokens.at(-1)?.[1];
                                if (lastValidatedTokenOutput != null && lastValidatedTokenOutput === evalTokens[i]) {
                                    this._loadedTokenPredictions.push([evalTokens[i]!, [resultToken, probabilities, confidence]]);
                                    this._validatedTokenPredictions++;
                                    this._unusedTokenPredictions++;
                                } else {
                                    const deleteSize = Math.min(evalTokens.length - i, this.context.contextSize);
                                    this._refutedTokenPredictions += deleteSize;
                                    const deleteStartIndex = this._nextTokenIndex - deleteSize;
                                    tokenPredictor.stop(true);
                                    await this._eraseContextTokenRanges([{
                                        start: deleteStartIndex,
                                        end: this._nextTokenIndex
                                    }], {canResetTokenPredictor: false, canRemovePredictionTokens: false, skipLock: true});
                                    break; // the assumption that this token will be generated was wrong
                                }
                            }
                        }
                    }

                    if (nextToken == null)
                        throw new Error("Failed to generated next token");

                    // the model finished generating text
                    if (!yieldEogToken && this._context.model.isEogToken(nextToken))
                        break;
                } finally {
                    evaluatorLock.dispose();
                }

                const replacementToken = yield yieldRes as SequenceEvaluateOutput<Metadata>;

                // set the tokens for the next evaluation
                if (replacementToken instanceof Array)
                    evalTokens = replacementToken.slice();
                else if (replacementToken != null)
                    evalTokens = [replacementToken];
                else
                    evalTokens = [nextToken];

                if (this._tokenPredictorOwner === tokenPredictorOwner)
                    tokenPredictor.pushTokens(evalTokens);

                logitsArray = [];
                logitsStartIndex = evalTokens.length - 1;
                logitsArray[logitsStartIndex] = true;
            }
        } finally {
            void withLock([sampler, "sample"], sampler.asyncDispose);

            if (this._tokenPredictorOwner === tokenPredictorOwner)
                tokenPredictor.stop();
        }
    }

    /** @internal */
    private async _abortTokenPredictor(skipClearingPredictionsFromState: boolean = false, skipLock: boolean = false) {
        this._tokenPredictor?.stop();
        this._resetTokenPredictor = true;

        if (skipClearingPredictionsFromState)
            return;

        if (this._loadedTokenPredictions.length > 0)
            await this._eraseContextTokenRanges([{
                start: this._nextTokenIndex - this._loadedTokenPredictions.length,
                end: this._nextTokenIndex
            }], {canResetTokenPredictor: true, canRemovePredictionTokens: true, skipLock});
    }

    /** @internal */
    private _resolveSamplerConfig({
        temperature = 0,
        minP = 0,
        topK = 40,
        topP = 0.95,
        seed,
        grammarEvaluationState,
        repeatPenalty,
        tokenBias
    }: {
        temperature?: number, minP?: number, topK?: number, topP?: number, seed?: number,
        grammarEvaluationState?: LlamaGrammarEvaluationState | (() => LlamaGrammarEvaluationState | undefined),
        repeatPenalty?: LlamaContextSequenceRepeatPenalty, tokenBias?: TokenBias | (() => TokenBias)
    }) {
        const repeatPenaltyTokens = repeatPenalty?.punishTokens instanceof Function
            ? repeatPenalty.punishTokens()
            : repeatPenalty?.punishTokens;

        const maxPunishTokens = Math.max(
            repeatPenalty?.maxPunishTokens ?? defaultMaxPunishTokens,
            repeatPenaltyTokens?.length ?? 0
        );

        const resolvedGrammarEvaluationState = grammarEvaluationState instanceof Function
            ? grammarEvaluationState()
            : grammarEvaluationState;

        if (resolvedGrammarEvaluationState != null && resolvedGrammarEvaluationState._llama !== this.model._llama)
            throw new Error("The LlamaGrammar used by passed to this function was created with a different Llama instance than the one used by this sequence's model. Make sure you use the same Llama instance for both the model and the grammar.");

        const {tokenBiasKeys, tokenBiasValues} = getTokenBiasesForAddon(tokenBias, this.model);

        return removeNullFields<Parameters<typeof LlamaSampler.prototype.applyConfig>[0]>({
            temperature,
            minP,
            topK,
            topP,
            seed: Math.max(
                0,
                Number.isFinite(seed)
                    ? Math.floor(seed ?? (Date.now() / 1000))
                    : Math.floor(Date.now() / 1000)
            ),
            repeatPenalty: repeatPenalty?.penalty,
            repeatPenaltyMaxTokens: maxPunishTokens,
            repeatPenaltyTokens: repeatPenaltyTokens != null
                ? Uint32Array.from(repeatPenaltyTokens)
                : undefined,
            repeatPenaltyPresencePenalty: repeatPenalty?.presencePenalty,
            repeatPenaltyFrequencyPenalty: repeatPenalty?.frequencyPenalty,
            tokenBiasKeys,
            tokenBiasValues,
            grammarEvaluationState: resolvedGrammarEvaluationState?._state
        });
    }

    /**
     * The caller of this function has to wrap it with a lock to ensure this function doesn't run concurrently.
     * @internal
     */
    private async _decodeTokens<T>(
        tokens: Token[],
        logits: (true | undefined)[],
        evaluationPriority: EvaluationPriority,
        tokenMeter: TokenMeter,
        contextShiftOptions: Required<ContextShiftOptions>,
        logitDataMapper: ((batchLogitIndex: BatchLogitIndex, tokenIndex: number) => T | Promise<T>)
    ): Promise<Array<undefined | T>> {
        this._ensureNotDisposed();

        const tokensLeftToDecode = tokens.slice();
        const tokenLogitsLeftToDecode = logits.slice();
        let currentTokenIndex = 0;
        const res: Array<undefined | T> = [];

        const normalizedLogitDataMapper = (batchLogitIndex: BatchLogitIndex, contextStateTokenIndex: number) => {
            return logitDataMapper(batchLogitIndex, currentTokenIndex + (contextStateTokenIndex - this._nextTokenIndex));
        };

        while (tokensLeftToDecode.length > 0) {
            this._ensureNotDisposed();

            let freeSpace = this._context.contextSize - 1 - this._nextTokenIndex;

            if (freeSpace <= 0) {
                await this._freeUpSpaceForTokens(contextShiftOptions);
                freeSpace = this._context.contextSize - 1 - this._nextTokenIndex;

                if (freeSpace <= 0)
                    throw new Error("Failed to free up space for new tokens");
            }

            const tokensToDecode = tokensLeftToDecode.splice(0, freeSpace);
            const tokensLogits = tokenLogitsLeftToDecode.slice(0, tokensToDecode.length);

            const generatedLogits = await this._context._decodeTokens({
                sequenceId: this._sequenceId,
                tokens: tokensToDecode,
                firstTokenSequenceIndex: this._nextTokenIndex,
                logits: tokensLogits,
                evaluationPriority,
                tokenMeter
            }, normalizedLogitDataMapper);

            for (const [index, value] of generatedLogits)
                res[currentTokenIndex + (index - this._nextTokenIndex)] = value;

            this._nextTokenIndex += tokensToDecode.length;
            currentTokenIndex += tokensToDecode.length;
            this._contextTokens = this._contextTokens.concat(tokensToDecode);
        }

        return res;
    }

    /** @internal */
    private async _freeUpSpaceForTokens(contextShiftOptions: Required<ContextShiftOptions>) {
        this._ensureNotDisposed();

        const size = Math.min(
            this._nextTokenIndex,
            Math.max(
                1,
                contextShiftOptions.size instanceof Function
                    ? await contextShiftOptions.size(this)
                    : contextShiftOptions.size
            )
        );

        this._ensureNotDisposed();

        if (contextShiftOptions.strategy === "eraseBeginning") {
            let eraseStartIndex = 0;
            if (this.model.tokens.bos != null && this._contextTokens[0] === this.model.tokens.bos)
                eraseStartIndex = 1;

            await this._eraseContextTokenRanges([{start: eraseStartIndex, end: size + eraseStartIndex}], {skipLock: true});
        } else {
            const ranges = await contextShiftOptions.strategy({
                sequence: this,
                size
            });

            if (ranges == null)
                throw new Error("Invalid delete ranges");

            await this._eraseContextTokenRanges(ranges, {skipLock: true});

            if (this._nextTokenIndex >= this._context.contextSize - 1)
                await this._eraseContextTokenRanges([{start: 0, end: size}], {skipLock: true});
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
        sequenceId, context, tokenMeter,
        contextShift: {
            size: contextShiftSize = Math.min(100, Math.ceil(context.contextSize / 2)),
            strategy: contextShiftStrategy = "eraseBeginning"
        } = {},
        tokenPredictor
    }: {
        sequenceId: number,
        context: LlamaContext,
        tokenMeter?: TokenMeter,
        contextShift?: ContextShiftOptions,
        tokenPredictor?: TokenPredictor
    }): LlamaContextSequence {
        return new LlamaContextSequence({
            sequenceId,
            context,
            tokenMeter,
            contextShift: {
                size: contextShiftSize,
                strategy: contextShiftStrategy
            },
            tokenPredictor
        });
    }
}

type InternalQueuedDecode = {
    sequenceId: number,
    firstTokenSequenceIndex: number,
    tokens: readonly Token[],
    logits: (true | undefined)[],
    evaluationPriority: EvaluationPriority,
    tokenMeter: TokenMeter,
    response: [accept: (res: any) => void, reject: (reason: unknown) => void],
    logitDataMapper: ((batchLogitIndex: BatchLogitIndex, tokenIndex: number) => any | Promise<any>)
};

type CurrentBatchItem = {
    queuedDecode: InternalQueuedDecode,
    processAmount: number
};

function getTokenBiasesForAddon(tokenBias: undefined | TokenBias | (() => TokenBias), currentModel: LlamaModel) {
    if (tokenBias == null)
        return {
            tokenBiasKeys: undefined,
            tokenBiasValues: undefined
        };

    if (tokenBias instanceof Function)
        tokenBias = tokenBias();

    if (tokenBias._tokenizer !== currentModel.tokenizer)
        throw new Error(
            "This TokenBias instance was created with a different model than the one used by this context. " +
            "Make sure you use the model instance of the context sequence for the TokenBias you use it with."
        );

    const tokenBiasKeys: Token[] = [];
    const tokenBiasValues: number[] = [];

    for (const [token, bias] of tokenBias._biases) {
        tokenBiasKeys.push(token);
        tokenBiasValues.push(bias);
    }

    if (tokenBiasKeys.length === 0 || tokenBiasValues.length === 0) {
        return {
            tokenBiasKeys: undefined,
            tokenBiasValues: undefined
        };
    }

    return {
        tokenBiasKeys: Uint32Array.from(tokenBiasKeys),
        tokenBiasValues: Float32Array.from(tokenBiasValues)
    };
}

function reviveTokenProbabilities(probabilities?: (Token | number)[]) {
    if (probabilities == null)
        return undefined;

    const res = new Map<Token, number>();

    for (let i = 1; i < probabilities.length; i += 2) {
        const token = probabilities[i - 1]! as Token;
        const probability = probabilities[i]! as number;

        res.set(token, probability);
    }

    return res;
}

function disposeContextIfReferenced(contextRef: WeakRef<LlamaContext>) {
    const context = contextRef.deref();

    if (context != null)
        void context.dispose();
}

function disposeContextSequenceIfReferenced(contextRef: WeakRef<LlamaContextSequence>) {
    const context = contextRef.deref();

    if (context != null)
        context.dispose();
}

export function getDefaultContextBatchSize({contextSize, sequences}: {contextSize: number, sequences: number}) {
    return Math.min(contextSize * sequences, 512);
}
export function getDefaultContextSequences() {
    return 1;
}

const defaultFallbackContextSize = 4096;
export function getDefaultModelContextSize({trainContextSize}: {trainContextSize?: number}) {
    return trainContextSize ?? defaultFallbackContextSize;
}
