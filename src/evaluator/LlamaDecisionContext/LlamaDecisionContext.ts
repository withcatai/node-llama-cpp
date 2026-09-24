import {
    AbortablePromise, AsyncDisposeAggregator, AsyncQueue, DisposeAggregator, DisposedError, EventRelay, Retainer, scopeExit
} from "lifecycle-utils";
import {internalCheckpoints, LlamaContext, LlamaContextSequence} from "../LlamaContext/LlamaContext.js";
import {ControlledEvaluateInputItem, EvaluationPriority} from "../LlamaContext/types.js";
import {prepareDecisionContextWindow} from "../LlamaChat/utils/prepareDecisionContextWindow.js";
import {ChatWrapper} from "../../ChatWrapper.js";
import {resolveChatWrapper} from "../../chatWrappers/utils/resolveChatWrapper.js";
import {TokenMeter} from "../TokenMeter.js";
import {createQuestionInputs} from "./utils/createQuestionInputs.js";
import {createDecisionAnswer, decisionAnswerMinimumTopLogits} from "./utils/createDecisionAnswer.js";
import type {DecisionAnswer, DecisionAnswers, DecisionQuestions} from "./types.js";
import type {LlamaModel} from "../LlamaModel/LlamaModel.js";
import type {ChatHistoryItem, Token, Tokenizer} from "../../types.js";

export type LlamaDecisionContextOptions = {
    /** `"auto"` is used by default */
    chatWrapper?: "auto" | ChatWrapper,

    /**
     * The number of tokens the model can see at once.
     * - **`"auto"`** - adapt to the current VRAM state and attempt to set the context size as high as possible up to the size
     * the model was trained on.
     * - **`number`** - set the context size to a specific number of tokens.
     * If there's not enough VRAM, an error will be thrown.
     * Use with caution.
     * - **`{min?: number, max?: number}`** - adapt to the current VRAM state and attempt to set the context size as high as possible
     * up to the size the model was trained on, but at least `min` and at most `max`.
     *
     * Defaults to `{max: 4096}`.
     */
    contextSize?: "auto" | number | {
        min?: number,
        max?: number
    },

    /** prompt processing batch size */
    batchSize?: number,

    /**
     * The number of questions to support evaluating in parallel.
     *
     * Defaults to `4`.
     */
    parallelQuestions?: number,

    /**
     * number of threads to use to evaluate tokens.
     * set to 0 to use the maximum threads supported by the current machine hardware
     */
    threads?: number,

    /** An abort signal to abort the context creation */
    createSignal?: AbortSignal,

    /**
     * Ignore insufficient memory errors and continue with the context creation.
     * Can cause the process to crash if there's not enough VRAM for the new context.
     *
     * Defaults to `false`.
     */
    ignoreMemorySafetyChecks?: boolean
};

export type LlamaDecisionContextDecideOptions = {
    signal?: AbortSignal,

    /**
     * See the parameter `evaluationPriority` on the `LlamaContextSequence.evaluate()` function for more information.
     */
    evaluationPriority?: EvaluationPriority,

    /**
     * What to do when the room left for the document with the provided questions is insufficient in the context window.
     *
     * - **`"throw"`** - throw an error when there is not enough room for the document.
     * - **`"truncateDocument"`** - truncate the end of the document to fit within the available context window.
     * - **`{type: "compressDocument", compressDocument: ...}`** - compress the document using the provided compression function.
     *
     * Defaults to `"throw"`.
     */
    onOverflow?: "throw" | "truncateDocument" | {
        type: "compressDocument",

        /**
         * Compress the document to fit within the given `maxTokensCount`.
         *
         * You can use the provided `tokenizer` to determine the token count of the document before returning it.
         */
        compressDocument(options: {
            /** The document to compress */
            document: string,

            /** Maximum number of tokens that the document should fit under when tokenized */
            maxTokensCount: number,

            /** Tokenizer used to tokenize the document */
            tokenizer: Tokenizer
        }): string | Promise<string>
    }
};

export type LlamaDecisionContextDecideResponse<Questions extends DecisionQuestions> = {
    answers: DecisionAnswers<Questions>,
    tokenUsage: {
        input: number,
        output: number
    }
};

/**
 * @see [Using Structured Decisions](https://node-llama-cpp.withcat.ai/guide/structured-decisions) tutorial
 */
export class LlamaDecisionContext {
    /** @internal */ private readonly _llamaContext: LlamaContext;
    /** @internal */ private readonly _chatWrapper: ChatWrapper;
    /** @internal */ private readonly _disposeAggregator = new AsyncDisposeAggregator();
    /** @internal */ private readonly _seqQueue = new AsyncQueue<LlamaContextSequence>();
    /** @internal */ private readonly _retainer = new Retainer();
    /** @internal */ private _disposed: boolean = false;

    public readonly onDispose = new EventRelay<void>();

    private constructor({
        _llamaContext,
        _chatWrapper
    }: {
        _llamaContext: LlamaContext,
        _chatWrapper: ChatWrapper
    }) {
        this._llamaContext = _llamaContext;
        this._chatWrapper = _chatWrapper;

        this._disposeAggregator.add(() => {
            this._disposed = true;
        });
        this._disposeAggregator.add(
            this._llamaContext.onDispose.createListener(() => {
                void this._disposeAggregator.dispose();
            })
        );
        this._disposeAggregator.add(this.onDispose.dispatchEvent);
        this._disposeAggregator.add(async () => {
            await this._retainer.acquireDrain();
            await this._llamaContext.dispose();
        });

        while (_llamaContext.sequencesLeft > 0)
            this._seqQueue.push(_llamaContext.getSequence());
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
        return this._llamaContext.model;
    }

    public get contextSize(): number {
        return this._llamaContext.contextSize;
    }

    public get batchSize(): number {
        return this._llamaContext.batchSize;
    }

    public get flashAttention() {
        return this._llamaContext.flashAttention;
    }

    /** Assumed memory footprint of the context in bytes */
    public get memoryUsage() {
        return this._llamaContext.memoryUsage;
    }

    /** Warmup the model, so that the next evaluation is faster */
    public async warmup({signal}: {signal?: AbortSignal} = {}) {
        using retain = this._retainer.tryRetain(() => new DisposedError());
        using seq = await this._seqQueue.acquire(signal);

        const preparedContextWindow = await prepareDecisionContextWindow({
            fullHistory: [{
                type: "user",
                text: ""
            }],
            resolvedContextShift: false,
            fitInContextSize: this.contextSize,
            chatWrapper: this._chatWrapper,
            sequence: seq.item
        });
        const prefixTokens = preparedContextWindow.prefix.tokenize(this.model.tokenizer, "trimLeadingSpace");
        await seq.item.evaluateWithoutGeneratingNewTokens(prefixTokens);
    }

    public async decide<const Questions extends DecisionQuestions>(
        document: string,
        questions: Questions,
        options: LlamaDecisionContextDecideOptions = {}
    ): Promise<DecisionAnswers<Questions>> {
        return (await this.decideWithMeta(document, questions, options)).answers;
    }

    public async decideWithMeta<const Questions extends DecisionQuestions>(
        document: string,
        questions: Questions,
        options: LlamaDecisionContextDecideOptions = {}
    ): Promise<LlamaDecisionContextDecideResponse<Questions>> {
        using retain = this._retainer.tryRetain(() => new DisposedError());
        using disposeAggregator = new DisposeAggregator();

        const {signal, evaluationPriority, onOverflow} = options;
        if (signal != null) {
            signal.addEventListener("abort", disposeAggregator.dispose);
            disposeAggregator.add(() => signal.removeEventListener("abort", disposeAggregator.dispose));
        }

        const inputs = createQuestionInputs(questions, this.model);
        const maxInputLength = Object.values(inputs).reduce((max, item) => Math.max(max, item.input.length), 0);
        if (maxInputLength > this.contextSize)
            throw new Error(
                "The context size is too small to fit the provided questions and/or criteria. " +
                "Increase the context size or reduce the length of the longest questions or criteria"
            );
        else if (maxInputLength === 0)
            return {
                answers: {} as DecisionAnswers<Questions>,
                tokenUsage: {
                    input: 0,
                    output: 0
                }
            };

        const localQueue = new AsyncQueue([], {parent: this._seqQueue});
        const localSeqs = new Set<LlamaContextSequence>();
        using localQueueScopeHandle = scopeExit(() => {
            localQueue.forwardPushesToParent = true;
            localQueue.drainToParent();
        });

        using mainSeqLease = await localQueue.acquire(signal);
        const preparedContextWindow = await prepareDecisionContextWindow({
            fullHistory: [{
                type: "user",
                text: document
            }],
            fallbackToDefaultContextShiftStrategy: false,
            resolvedContextShift: (onOverflow == null || onOverflow === "throw")
                ? false
                : onOverflow === "truncateDocument"
                    ? {
                        lastEvaluationMetadata: null,
                        size: (sequence) => sequence.contextSize - 1,
                        strategy({maxTokensCount, tokenizer, chatWrapper}) {
                            const fullDocumentTokenLength = tokenizer(document, false, "trimLeadingSpace").length;
                            const testTokenLength = chatWrapper.generateContextState({
                                chatHistory: [{
                                    type: "user",
                                    text: document
                                }]
                            }).contextText.tokenize(tokenizer, "trimLeadingSpace").length;

                            const maxDocumentTokenCount = Math.max(0, fullDocumentTokenLength - (testTokenLength - maxTokensCount) - 1);
                            if (maxDocumentTokenCount <= 1)
                                throw new Error(
                                    "The given questions and/or criteria don't leave enough room in the context for the document. " +
                                    "Increase the context size or reduce the length of the longest questions or criteria"
                                );

                            const tokens = tokenizer(document, false, "trimLeadingSpace");
                            const slicedTokens = tokens.slice(0, maxDocumentTokenCount);

                            return {
                                chatHistory: [{
                                    type: "user",
                                    text: tokenizer.detokenize(slicedTokens, false)
                                }]
                            };
                        }
                    }
                    : onOverflow?.type === "compressDocument"
                        ? {
                            lastEvaluationMetadata: null,
                            size: (sequence) => sequence.contextSize - 1,
                            strategy({maxTokensCount, tokenizer, chatWrapper}) {
                                const fullDocumentTokenLength = tokenizer(document, false, "trimLeadingSpace").length;
                                const testTokenLength = chatWrapper.generateContextState({
                                    chatHistory: [{
                                        type: "user",
                                        text: document
                                    }]
                                }).contextText.tokenize(tokenizer, "trimLeadingSpace").length;

                                const maxDocumentTokenCount = Math.max(0, fullDocumentTokenLength - (testTokenLength - maxTokensCount) - 1);
                                if (maxDocumentTokenCount === 0)
                                    throw new Error(
                                        "The given questions and/or criteria don't leave enough room in the context for the document. " +
                                        "Increase the context size or reduce the length of the longest questions or criteria"
                                    );

                                const compressAttempt = onOverflow.compressDocument({
                                    document,
                                    maxTokensCount: maxDocumentTokenCount,
                                    tokenizer
                                });
                                if (compressAttempt instanceof Promise)
                                    return compressAttempt
                                        .then((compressed) => ({
                                            chatHistory: [{
                                                type: "user",
                                                text: compressed
                                            }] as ChatHistoryItem[]
                                        }));

                                return {
                                    chatHistory: [{
                                        type: "user",
                                        text: compressAttempt
                                    }]
                                };
                            }
                        }
                        : false,
            fitInContextSize: this.contextSize - maxInputLength - 1,
            chatWrapper: this._chatWrapper,
            sequence: mainSeqLease.item
        });

        const answers: {[key: string]: DecisionAnswer<any>} = {} as DecisionAnswers<Questions>;
        const prefixTokens = preparedContextWindow.prefix.tokenize(this.model.tokenizer, "trimLeadingSpace");
        const afterQuestionTokens = preparedContextWindow.afterQuestion.tokenize(this.model.tokenizer, "trimLeadingSpace");

        const mainSeqMeterInitialSnapshot = mainSeqLease.item.tokenMeter.getState();

        const entries = Object.entries(inputs);
        if (entries.length === 1) {
            const [questionId, input] = entries[0]!;
            const fullInput = [...prefixTokens, ...input.input, ...afterQuestionTokens];
            const lastToken = fullInput.pop();
            if (lastToken == null)
                throw new Error("Not enough tokens to generate a response");

            await mainSeqLease.item.adaptStateToTokens(fullInput, false);
            await mainSeqLease.item.evaluateWithoutGeneratingNewTokens(fullInput.slice(mainSeqLease.item.nextTokenIndex));
            signal?.throwIfAborted();

            const controlledEvaluateInput: ControlledEvaluateInputItem[] = [[lastToken, {
                generateNext: {
                    logits: {
                        filter: {
                            tokens: input.tokens,
                            includeTop: Math.max(input.tokens.length * 2, decisionAnswerMinimumTopLogits)
                        }
                    }
                }
            }]];
            const res = await mainSeqLease.item.controlledEvaluate(controlledEvaluateInput, {evaluationPriority});
            const lastTokenResult = res[res.length - 1];
            if (lastTokenResult == null || lastTokenResult.next?.logits == null)
                throw new Error("Failed to generate decisions");

            answers[questionId] = createDecisionAnswer(input, lastTokenResult.next.logits, mainSeqLease.item.model.tokenizer);
            const tokenUsageDiff = TokenMeter.diff(mainSeqLease.item.tokenMeter.getState(), mainSeqMeterInitialSnapshot);
            return {
                answers: answers as DecisionAnswers<Questions>,
                tokenUsage: {
                    input: tokenUsageDiff.usedInputTokens,
                    output: tokenUsageDiff.usedOutputTokens
                }
            };
        }

        await mainSeqLease.item.adaptStateToTokens(prefixTokens, false);
        await mainSeqLease.item.evaluateWithoutGeneratingNewTokens(prefixTokens.slice(mainSeqLease.item.nextTokenIndex));
        signal?.throwIfAborted();

        await mainSeqLease.item._takeNamedCheckpoint(
            internalCheckpoints.decisions.name,
            internalCheckpoints.decisions.maxCheckpoints
        );

        const mainSeqLeaseTokenUsageDiff = TokenMeter.diff(mainSeqLease.item.tokenMeter.getState(), mainSeqMeterInitialSnapshot);
        let inputTokens: number = mainSeqLeaseTokenUsageDiff.usedInputTokens;
        let outputTokens: number = mainSeqLeaseTokenUsageDiff.usedOutputTokens;

        localSeqs.add(mainSeqLease.item);

        const needPrefixSeqs = new Map<LlamaContextSequence, [accept: (value?: Promise<void>) => void, reject: (reason?: any) => void]>();
        disposeAggregator.add(() => {
            for (const [, [, reject]] of needPrefixSeqs) {
                reject(new Error("Disposed"));
            }
            needPrefixSeqs.clear();
        });

        async function fixPendingSeqs(seq: LlamaContextSequence) {
            if (needPrefixSeqs.size === 0)
                return;

            const entriesNeedFixing = [...needPrefixSeqs.entries()];
            needPrefixSeqs.clear();
            await Promise.all(
                entriesNeedFixing
                    .map(async ([otherSeq, [accept, reject]]) => {
                        try {
                            const copied = await otherSeq._copyStateFromOtherSequence(seq, prefixTokens.length);
                            if (!copied)
                                accept(
                                    otherSeq.adaptStateToTokens(prefixTokens, false)
                                        .then(() => (
                                            otherSeq.evaluateWithoutGeneratingNewTokens(prefixTokens.slice(otherSeq.nextTokenIndex))
                                        ))
                                        .then(() => void 0)
                                );
                            else
                                accept();
                        } catch (err) {
                            reject(err);
                        }
                    })
            );
        }

        {
            const seqsToPreload: LlamaContextSequence[] = [];
            for (let i = entries.length - 1; i >= 0; i--) {
                let seq: LlamaContextSequence | undefined;
                if (!localQueue.isEmpty)
                    seq = localQueue.tryShift();
                else if (localQueue.parent?.isEmpty === false) {
                    seq = localQueue.parent.last;
                    if (seq != null && localQueue.parent.delete(-1) === 0)
                        seq = undefined;
                }

                if (seq == null)
                    seq = localQueue.tryShift();

                if (seq == null)
                    break;

                seqsToPreload.push(seq);
            }
            using putBackInQueueHandle = scopeExit(() => {
                for (const seq of seqsToPreload)
                    localQueue.push(seq);

                seqsToPreload.length = 0;
            });

            if (seqsToPreload.length > 0) {
                const preloadResults = await Promise.allSettled(
                    seqsToPreload.map(async (seq) => {
                        const initialMeterSnapshot = seq.tokenMeter.getState();
                        using updateTokenUsageExitHandle = scopeExit(() => {
                            const diff = TokenMeter.diff(seq.tokenMeter.getState(), initialMeterSnapshot);
                            inputTokens += diff.usedInputTokens;
                            outputTokens += diff.usedOutputTokens;
                        });

                        const copied = await seq._copyStateFromOtherSequence(mainSeqLease.item, prefixTokens.length);
                        if (!copied) {
                            signal?.throwIfAborted();
                            await seq.adaptStateToTokens(prefixTokens, false);
                            await seq.evaluateWithoutGeneratingNewTokens(prefixTokens.slice(seq.nextTokenIndex));
                        }

                        localSeqs.add(seq);
                    })
                );
                signal?.throwIfAborted();

                for (const result of preloadResults) {
                    if (result.status === "rejected")
                        throw result.reason;
                }
            }
        }

        mainSeqLease.dispose();
        let evaluationsLeft = entries.length;
        const allSettledResults = await Promise.allSettled(
            entries.map(async ([questionId, input]) => {
                using seqLease = await localQueue.acquire(signal);
                const seq = seqLease.item;

                evaluationsLeft--;
                using drainToParentOnFinishHandle = scopeExit(() => {
                    if (evaluationsLeft > 0)
                        return;

                    localQueue.forwardPushesToParent = true;
                    localQueue.drainToParent();
                });

                const initialMeterSnapshot = seq.tokenMeter.getState();
                using updateTokenUsageExitHandle = scopeExit(() => {
                    const diff = TokenMeter.diff(seq.tokenMeter.getState(), initialMeterSnapshot);
                    inputTokens += diff.usedInputTokens;
                    outputTokens += diff.usedOutputTokens;
                });

                if (!localSeqs.has(seq)) {
                    await new AbortablePromise<void>(signal, (accept, reject) => {
                        needPrefixSeqs.set(seq, [accept, reject]);

                        return () => {
                            needPrefixSeqs.delete(seq);
                        };
                    });
                    localSeqs.add(seq);
                }

                await using exitHandle = scopeExit(() => fixPendingSeqs(seq));
                if (needPrefixSeqs.size != 0) {
                    await fixPendingSeqs(seq);
                    signal?.throwIfAborted();
                }

                let evaluateInput: Token[] = [...input.input, ...afterQuestionTokens];
                if (evaluateInput.length === 0)
                    throw new Error("Evaluate input is empty");

                if (seq.nextTokenIndex > prefixTokens.length) {
                    evaluateInput = [...prefixTokens, ...evaluateInput];
                    const lastToken = evaluateInput.pop();

                    await seq.adaptStateToTokens(evaluateInput, false);
                    evaluateInput = evaluateInput.slice(seq.nextTokenIndex);

                    if (lastToken != null)
                        evaluateInput.push(lastToken);

                    signal?.throwIfAborted();
                }

                const controlledEvaluateInput: ControlledEvaluateInputItem[] = evaluateInput;
                controlledEvaluateInput[controlledEvaluateInput.length - 1] = [
                    controlledEvaluateInput[controlledEvaluateInput.length - 1] as Token,
                    {
                        generateNext: {
                            logits: {
                                filter: {
                                    tokens: input.tokens,
                                    includeTop: Math.max(input.tokens.length * 2, decisionAnswerMinimumTopLogits)
                                }
                            }
                        }
                    }
                ];
                const res = await seq.controlledEvaluate(controlledEvaluateInput, {evaluationPriority});
                const lastTokenResult = res[res.length - 1];
                if (lastTokenResult == null || lastTokenResult.next?.logits == null)
                    throw new Error("Failed to generate decisions");

                answers[questionId] = createDecisionAnswer(input, lastTokenResult.next.logits, seq.model.tokenizer);
            })
        );

        for (const result of allSettledResults) {
            if (result.status === "rejected")
                throw result.reason;
        }

        // order the answers according to the original entries
        const resultAnswers: {[key: string]: DecisionAnswer<any>} = {};
        for (const [questionId] of entries)
            resultAnswers[questionId] = answers[questionId] as DecisionAnswer<any>;

        return {
            answers: resultAnswers as DecisionAnswers<Questions>,
            tokenUsage: {
                input: inputTokens,
                output: outputTokens
            }
        };
    }

    /** @internal */
    public static async _create({
        _model
    }: {
        _model: LlamaModel
    }, {
        chatWrapper = "auto",
        contextSize = {max: 4096},
        batchSize,
        parallelQuestions = 4,
        threads,
        createSignal,
        ignoreMemorySafetyChecks
    }: LlamaDecisionContextOptions) {
        const llamaContext = await _model.createContext({
            contextSize,
            batchSize,
            threads,
            createSignal,
            sequences: parallelQuestions,
            ignoreMemorySafetyChecks
        });
        const resolvedChatWrapper = chatWrapper === "auto"
            ? resolveChatWrapper(_model)
            : chatWrapper;

        return new LlamaDecisionContext({
            _llamaContext: llamaContext,
            _chatWrapper: resolvedChatWrapper
        });
    }
}
