import {AsyncDisposeAggregator, DisposeAggregator, DisposedError, EventRelay, withLock} from "lifecycle-utils";
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
import {
    BatchingOptions, BatchItem, ContextShiftOptions, ContextTokensDeleteRange, EvaluationPriority, LlamaContextOptions,
    LlamaContextSequenceRepeatPenalty, PrioritizedBatchItem
} from "./types.js";
import {resolveBatchItemsPrioritizationStrategy} from "./utils/resolveBatchItemsPrioritizationStrategy.js";
import {LlamaSampler} from "./LlamaSampler.js";
import type {Llama} from "../../bindings/Llama.js";

const defaultLoraScale = 1;
const shrinkRetriesMinContextSize = 4096;
const defaultMaxPunishTokens = 64;
const defaultFailedCreationRemedy = {
    retries: 6,
    autoContextSizeShrink: 0.16
} as const satisfies Required<LlamaContextOptions["failedCreationRemedy"]>;

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
            dispatchSchedule: batchingDispatchSchedule = "nextTick",
            itemPrioritizationStrategy: batchingItemsPrioritizationStrategy = "maximumParallelism"
        } = {},
        performanceTracking = false,
        _embeddings
    }: LlamaContextOptions & {
        sequences: number,
        contextSize: number,
        batchSize: number,
        flashAttention: boolean
    }) {
        if (_model.disposed)
            throw new DisposedError();

        this._llama = _model._llama;
        this._model = _model;
        this._backendContextDisposeGuard = new DisposeGuard([this._model._backendModelDisposeGuard]);
        this._modelPreventDisposalHandle = this._model._backendModelDisposeGuard.createPreventDisposalHandle();
        this._totalSequences = Math.max(1, Math.floor(sequences));
        this._contextSize = Math.max(2, contextSize);
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
        this._ctx = new this._llama._bindings.AddonContext(this._model._model, removeNullFields({
            contextSize: this._contextSize * this._totalSequences, // each sequence needs its own <contextSize> of cells
            batchSize: this._batchSize,
            sequences: this._totalSequences,
            flashAttention: this._flashAttention,
            threads: this._idealThreads,
            embeddings: _embeddings,
            performanceTracking: this._performanceTracking
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

        /** @internal */
        _tokenMeter?: TokenMeter
    } = {}): LlamaContextSequence {
        const {
            contextShift: {
                size: contextShiftSize = Math.min(100, Math.ceil(this.contextSize / 2)),
                strategy: contextShiftStrategy = "eraseBeginning"
            } = {},

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

            let shouldHaveAnotherLoop = this._queuedDecodes.length > 0;

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
                    batchLogitIndex: BatchLogitIndex | undefined,
                    response: [accept: (res: any) => void, reject: (reason: unknown) => void],
                    onDone?: (batchLogitIndex: BatchLogitIndex) => any
                }> = [];
                const queuedDecodesToDelete = new Set<InternalQueuedDecode>();
                const currentQueuedDecodeItems = new Set<InternalQueuedDecode>();

                if (currentBatchSize !== 0)
                    this._ctx.initBatch(currentBatchSize);

                for (const {queuedDecode, processAmount} of batchItems) {
                    let batchLogitIndex: ReturnType<typeof this._ctx.addToBatch>;
                    try {
                        const shouldGenerateLogitAtTheEnd = queuedDecode.generateLogitAtTheEnd &&
                            processAmount === queuedDecode.tokens.length;

                        const tokensToProcess = queuedDecode.tokens.slice(0, processAmount);

                        const numberOfOutputTokens = shouldGenerateLogitAtTheEnd ? 1 : 0;
                        TokenMeter.useTokens(queuedDecode.tokenMeter, Math.max(0, tokensToProcess.length - numberOfOutputTokens), "input");
                        TokenMeter.useTokens(queuedDecode.tokenMeter, numberOfOutputTokens, "output");

                        batchLogitIndex = this._ctx.addToBatch(
                            queuedDecode.sequenceId,
                            queuedDecode.firstTokenSequenceIndex,
                            Uint32Array.from(tokensToProcess),
                            shouldGenerateLogitAtTheEnd
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

                    try {
                        await decodeTokenBatchItems(currentBatchItems, currentBatchSize);

                        shouldHaveAnotherLoop = this._queuedDecodes.length > 0;
                    } finally {
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
        sequenceId, firstTokenSequenceIndex, tokens, generateLogitAtTheEnd = false, evaluationPriority = 5, tokenMeter
    }: {
        sequenceId: number, firstTokenSequenceIndex: number, tokens: Token[], generateLogitAtTheEnd?: boolean,
        evaluationPriority?: EvaluationPriority, tokenMeter: TokenMeter
    }, onDone?: ((batchLogitIndex: BatchLogitIndex) => (T | Promise<T>))): Promise<T> {
        return await new Promise((accept, reject) => {
            this._queuedDecodes.push({
                sequenceId,
                tokens,
                firstTokenSequenceIndex,
                generateLogitAtTheEnd,
                evaluationPriority,
                tokenMeter,
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
                flashAttention
            });

            const context = new LlamaContext({_model}, {...options, contextSize, batchSize, sequences, flashAttention});
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
    /** @internal */ private readonly _tokenMeter: TokenMeter;
    /** @internal */ private readonly _disposeAggregator = new DisposeAggregator();
    /** @internal */ private _contextTokens: Token[] = [];
    /** @internal */ private _nextTokenIndex: number = 0;
    /** @internal */ private _disposed = false;

    public readonly onDispose = new EventRelay<void>();

    private constructor({
        sequenceId, context, tokenMeter, contextShift
    }: {
        sequenceId: number,
        context: LlamaContext,
        tokenMeter?: TokenMeter,
        contextShift: Required<ContextShiftOptions>
    }) {
        this._sequenceId = sequenceId;
        this._context = context;
        this._tokenMeter = tokenMeter ?? new TokenMeter();
        this._contextShift = contextShift;
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

    public get nextTokenIndex() {
        return this._nextTokenIndex;
    }

    public get contextTokens() {
        return this._contextTokens.slice();
    }

    public get tokenMeter() {
        return this._tokenMeter;
    }

    public get isLoadedToMemory() {
        return !this._disposed;
    }

    public compareContextTokens(tokens: Token[]): {
        firstDifferentIndex: number
    } {
        for (let i = 0; i < this._contextTokens.length; i++) {
            if (compareTokens(this._contextTokens[i], tokens[i]))
                continue;

            return {
                firstDifferentIndex: i
            };
        }

        return {
            firstDifferentIndex: this._contextTokens.length
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
        if (this.model.fileInsights.isRecurrent || !allowShift) {
            const {firstDifferentIndex} = this.compareContextTokens(tokens);
            if (firstDifferentIndex < this._nextTokenIndex)
                await this.eraseContextTokenRanges([{
                    start: firstDifferentIndex,
                    end: this._nextTokenIndex
                }]);

            return;
        }

        const eraseRanges: ContextTokensDeleteRange[] = [];

        let tokensIndex = 0;
        let differentTokenIndex: number | undefined = undefined;
        for (let i = 0; i < this._contextTokens.length && tokensIndex < tokens.length; i++) {
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
            await this.eraseContextTokenRanges(eraseRanges);
    }

    /**
     * Clear the history of the sequence.
     * If `prependBos` was enabled, the BOS token will be prepended to the sequence again.
     */
    public async clearHistory() {
        this._ensureNotDisposed();

        await this.eraseContextTokenRanges([{start: 0, end: this._nextTokenIndex}]);
    }

    /**
     * Erase context tokens in the provided ranges to free up space for new tokens to be generated.
     * The start of each range is inclusive, and the end of each range is exclusive.
     * For example, the range `{start: 0, end: 1}` will remove the token at the `0` index only.
     */
    public async eraseContextTokenRanges(ranges: ContextTokensDeleteRange[]) {
        this._ensureNotDisposed();

        await withLock(this._context, "context", async () => {
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

            if (deletionSuccessful && lastDeleteRangeEndPos != null && removedTokens > 0 &&
                lastDeleteRangeEndPos !== this._nextTokenIndex
            ) {
                this._context._ctx.shiftSequenceTokenCells(this._sequenceId, lastDeleteRangeEndPos, this._nextTokenIndex, -removedTokens);
                const shiftedTokens = this._nextTokenIndex - lastDeleteRangeEndPos;
                this._tokenMeter.useTokens(shiftedTokens, "input");
            }

            this._nextTokenIndex -= removedTokens;

            if (deletionSuccessful)
                return;

            const newSequenceTokens = this._contextTokens.slice();
            this._nextTokenIndex = 0;
            this._context._ctx.disposeSequence(this._sequenceId);

            await this.evaluateWithoutGeneratingNewTokens(newSequenceTokens);
        });
    }

    public evaluate(tokens: Token[], options: {
        temperature?: number, minP?: number, topK?: number, topP?: number,

        /**
         * Used to control the randomness of the generated text.
         *
         * Change the seed to get different results.
         *
         * Defaults to the current epoch time.
         *
         * Only relevant when using `temperature`.
         */
        seed?: number,
        grammarEvaluationState?: LlamaGrammarEvaluationState | (() => LlamaGrammarEvaluationState | undefined),
        repeatPenalty?: LlamaContextSequenceRepeatPenalty,

        /**
         * Adjust the probability of tokens being generated.
         * Can be used to bias the model to generate tokens that you want it to lean towards,
         * or to avoid generating tokens that you want it to avoid.
         */
        tokenBias?: TokenBias | (() => TokenBias),

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

        /**
         * Yield an EOG (End Of Generation) token (like EOS and EOT) when it's generated.
         * When `false` the generation will stop when an EOG token is generated and the token won't be yielded.
         * Defaults to `false`.
         */
        yieldEogToken?: boolean,

        /** @internal */
        _noSampling?: boolean
    } = {}): AsyncGenerator<Token, void | Token> {
        const {
            temperature = 0,
            minP = 0,
            topK = 40,
            topP = 0.95,
            seed,
            grammarEvaluationState,
            repeatPenalty,
            tokenBias,
            evaluationPriority = 5,
            contextShift: {
                size: contextShiftSize = this._contextShift.size,
                strategy: contextShiftStrategy = this._contextShift.strategy
            } = {},
            yieldEogToken = false,

            _noSampling = false
        } = options;

        return this._evaluate(tokens, {
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
     * @param tokens
     * @param [options]
     */
    public async evaluateWithoutGeneratingNewTokens(tokens: Token[], {
        evaluationPriority = 5,
        contextShift: {
            size: contextShiftSize = this._contextShift.size,
            strategy: contextShiftStrategy = this._contextShift.strategy
        } = {}
    }: {
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
        contextShift?: ContextShiftOptions
    } = {}): Promise<void> {
        const iterator = this._evaluate(tokens, {
            generateNewTokens: false,
            evaluationPriority,
            contextShiftOptions: {
                size: contextShiftSize,
                strategy: contextShiftStrategy
            }
        });

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const token of iterator) {
            // Array.from doesn't work with async generators, so we have to iterate over the generator
        }
    }

    /** @internal */
    private async *_evaluate(tokens: Token[], {
        temperature = 0,
        minP = 0,
        topK = 40,
        topP = 0.95,
        seed,
        grammarEvaluationState,
        repeatPenalty,
        tokenBias,
        evaluationPriority = 5,
        generateNewTokens = true,
        contextShiftOptions,
        yieldEogToken = false,

        _noSampling = false
    }: {
        temperature?: number, minP?: number, topK?: number, topP?: number, seed?: number,
        grammarEvaluationState?: LlamaGrammarEvaluationState | (() => LlamaGrammarEvaluationState | undefined),
        repeatPenalty?: LlamaContextSequenceRepeatPenalty, tokenBias?: TokenBias | (() => TokenBias),
        evaluationPriority?: EvaluationPriority, generateNewTokens?: boolean, contextShiftOptions: Required<ContextShiftOptions>,
        yieldEogToken?: boolean,
        _noSampling?: boolean
    }): AsyncGenerator<Token, void | Token> {
        this._ensureNotDisposed();

        let evalTokens = tokens;

        if (evalTokens.length === 0)
            return;

        const sampler = new LlamaSampler(this.model);
        try {
            while (true) {
                this._ensureNotDisposed();

                // Evaluate to get the next token.
                const nextToken: Token | null = await this._decodeTokens(
                    evalTokens,
                    generateNewTokens,
                    evaluationPriority,
                    this._tokenMeter,
                    contextShiftOptions,
                    (batchLogitIndex) => {
                        if (_noSampling)
                            return null;

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

                        sampler.applyConfig(removeNullFields({
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
                        }));

                        return withLock(sampler, "sample", async () => {
                            if (sampler.disposed)
                                return null;

                            return this._context._ctx.sampleToken(batchLogitIndex, sampler._sampler);
                        });
                    }
                );

                if (nextToken === -1)
                    throw new Error("Failed to sample next token");

                if (nextToken == null)
                    return;

                // the model finished generating text
                if (!yieldEogToken && this._context.model.isEogToken(nextToken))
                    break;

                const replacementToken = (yield nextToken) as undefined | Token;

                // set the tokens for the next evaluation
                if (replacementToken != null)
                    evalTokens = [replacementToken];
                else
                    evalTokens = [nextToken];
            }
        } finally {
            void withLock(sampler, "sample", sampler.asyncDispose);
        }
    }

    /** @internal */
    private async _decodeTokens<T>(
        tokens: Token[],
        generateLogit: boolean,
        evaluationPriority: EvaluationPriority,
        tokenMeter: TokenMeter,
        contextShiftOptions: Required<ContextShiftOptions>,
        onDecodeDone: ((batchLogitIndex: BatchLogitIndex) => T | Promise<T>)
    ): Promise<T | null> {
        this._ensureNotDisposed();

        const tokensLeftToDecode = tokens.slice();

        return await withLock(this, "evaluate", async (): Promise<T | null> => {
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
                const generateLogitAtTheEnd = generateLogit && tokensLeftToDecode.length === 0;

                const nextToken = await this._context._decodeTokens({
                    sequenceId: this._sequenceId,
                    tokens: tokensToDecode,
                    firstTokenSequenceIndex: this._nextTokenIndex,
                    generateLogitAtTheEnd,
                    evaluationPriority,
                    tokenMeter
                }, !generateLogitAtTheEnd
                    ? undefined
                    : onDecodeDone
                );
                this._nextTokenIndex += tokensToDecode.length;
                this._contextTokens = this._contextTokens.concat(tokensToDecode);

                if (generateLogitAtTheEnd && nextToken != null)
                    return nextToken;
            }

            return null;
        });
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

            await this.eraseContextTokenRanges([{start: eraseStartIndex, end: size + eraseStartIndex}]);
        } else {
            const ranges = await contextShiftOptions.strategy({
                sequence: this,
                size
            });

            if (ranges == null)
                throw new Error("Invalid delete ranges");

            await this.eraseContextTokenRanges(ranges);

            if (this.nextTokenIndex >= this._context.contextSize - 1)
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
        sequenceId, context, tokenMeter,
        contextShift: {
            size: contextShiftSize = Math.min(100, Math.ceil(context.contextSize / 2)),
            strategy: contextShiftStrategy = "eraseBeginning"
        } = {}
    }: {
        sequenceId: number,
        context: LlamaContext,
        tokenMeter?: TokenMeter,
        contextShift?: ContextShiftOptions
    }): LlamaContextSequence {
        return new LlamaContextSequence({
            sequenceId,
            context,
            tokenMeter,
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
    tokenMeter: TokenMeter,
    response: [accept: (res: any) => void, reject: (reason: unknown) => void],
    onDone?: (batchLogitIndex: BatchLogitIndex) => any
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
