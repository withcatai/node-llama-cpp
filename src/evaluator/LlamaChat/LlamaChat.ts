import {DisposeAggregator, DisposedError, EventRelay} from "lifecycle-utils";
import {ChatWrapper} from "../../ChatWrapper.js";
import {resolveChatWrapper} from "../../utils/resolveChatWrapper.js";
import {LlamaContextSequence} from "../LlamaContext/LlamaContext.js";
import {ChatHistoryItem, ChatModelFunctions, ChatModelResponse, Token, Tokenizer} from "../../types.js";
import {GbnfJsonSchemaToType} from "../../utils/gbnfJson/types.js";
import {LlamaGrammar} from "../LlamaGrammar.js";
import {removeNullFields} from "../../utils/removeNullFields.js";
import {LlamaGrammarEvaluationState} from "../LlamaGrammarEvaluationState.js";
import {AbortError} from "../../AbortError.js";
import {LlamaText} from "../../utils/LlamaText.js";
import {StopGenerationDetector} from "../../utils/StopGenerationDetector.js";
import {QueuedTokenReleaseLock, TokenStreamRegulator} from "../../utils/TokenStreamRegulator.js";
import {EvaluationPriority} from "../LlamaContext/types.js";
import {
    eraseFirstResponseAndKeepFirstSystemChatContextShiftStrategy
} from "./utils/contextShiftStrategies/eraseFirstResponseAndKeepFirstSystemChatContextShiftStrategy.js";
import {FunctionCallGrammar, LlamaFunctionCallValidationError} from "./utils/FunctionCallGrammar.js";

export type LlamaChatOptions = {
    contextSequence: LlamaContextSequence,

    /** `"auto"` is used by default */
    chatWrapper?: "auto" | ChatWrapper,

    /** Automatically dispose the sequence when the session is disposed */
    autoDisposeSequence?: boolean
};

export type LLamaChatGenerateResponseOptions<Functions extends ChatModelFunctions | undefined = undefined> = {
    onToken?: (tokens: Token[]) => void,
    signal?: AbortSignal,
    maxTokens?: number,

    /**
     * Temperature is a hyperparameter that controls the randomness of the generated text.
     * It affects the probability distribution of the model's output tokens.
     * A higher temperature (e.g., 1.5) makes the output more random and creative,
     * while a lower temperature (e.g., 0.5) makes the output more focused, deterministic, and conservative.
     * The suggested temperature is 0.8, which provides a balance between randomness and determinism.
     * At the extreme, a temperature of 0 will always pick the most likely next token, leading to identical outputs in each run.
     *
     * Set to `0` to disable.
     * Disabled by default (set to `0`).
     */
    temperature?: number,

    /**
     * From the next token candidates, discard the percentage of tokens with the lowest probability.
     * For example, if set to `0.05`, 5% of the lowest probability tokens will be discarded.
     * This is useful for generating more high-quality results when using a high temperature.
     * Set to a value between `0` and `1` to enable.
     *
     * Only relevant when `temperature` is set to a value greater than `0`.
     * Disabled by default.
     */
    minP?: number,

    /**
     * Limits the model to consider only the K most likely next tokens for sampling at each step of sequence generation.
     * An integer number between `1` and the size of the vocabulary.
     * Set to `0` to disable (which uses the full vocabulary).
     *
     * Only relevant when `temperature` is set to a value greater than 0.
     */
    topK?: number,

    /**
     * Dynamically selects the smallest set of tokens whose cumulative probability exceeds the threshold P,
     * and samples the next token only from this set.
     * A float number between `0` and `1`.
     * Set to `1` to disable.
     *
     * Only relevant when `temperature` is set to a value greater than `0`.
     */
    topP?: number,

    /**
     * Trim whitespace from the end of the generated text
     * Disabled by default.
     */
    trimWhitespaceSuffix?: boolean,

    repeatPenalty?: false | LLamaChatRepeatPenalty,

    /**
     * See the parameter `evaluationPriority` on the `LlamaContextSequence.evaluate()` function for more information.
     */
    evaluationPriority?: EvaluationPriority,

    contextShift?: LLamaChatContextShiftOptions,

    /**
     * The evaluation context window returned from the last evaluation.
     * This is an optimization to utilize existing context sequence state better when possible.
     */
    lastEvaluationContextWindow?: {
        /** The history of the last evaluation. */
        history?: ChatHistoryItem[],

        /**
         * Minimum overlap percentage with existing context sequence state to use the last evaluation context window.
         * If the last evaluation context window is not used, a new context will be generated based on the full history,
         * which will decrease the likelihood of another context shift happening so soon.
         */
        minimumOverlapPercentageToPreventContextShift?: number
    }
} & ({
    grammar?: LlamaGrammar,
    functions?: never,
    documentFunctionParams?: never
} | {
    grammar?: never,
    functions?: Functions | ChatModelFunctions,
    documentFunctionParams?: boolean
});

export type LLamaChatContextShiftOptions = {
    /**
     * The number of tokens to delete from the context window to make space for new ones.
     * Defaults to 10% of the context size.
     */
    size?: number | ((sequence: LlamaContextSequence) => number | Promise<number>),

    /**
     * The strategy to use when deleting tokens from the context window.
     * Defaults to `"eraseFirstResponseAndKeepFirstSystem"`.
     */
    strategy?: "eraseFirstResponseAndKeepFirstSystem" | (
        (options: {
            chatHistory: ChatHistoryItem[],
            maxTokensCount: number,
            tokenizer(text: string, specialTokens?: boolean): Token[],
            chatWrapper: ChatWrapper,
            lastShiftMetadata?: object | null
        }) => {chatHistory: ChatHistoryItem[], metadata?: object | null} |
            Promise<{chatHistory: ChatHistoryItem[], metadata?: object | null}>
    ),

    /**
     * The `contextShiftMetadata` returned from the last evaluation.
     * This is an optimization to utilize the existing context state better when possible.
     */
    lastEvaluationMetadata?: object | undefined | null
};

const defaultContextShiftOptions: Required<LLamaChatContextShiftOptions> = {
    size: (sequence) => Math.max(1, Math.floor(sequence.context.contextSize / 10)),
    strategy: "eraseFirstResponseAndKeepFirstSystem",
    lastEvaluationMetadata: null
};

export type LLamaChatRepeatPenalty = {
    /**
     * Number of recent tokens generated by the model to apply penalties to repetition of.
     * Defaults to `64`.
     */
    lastTokens?: number,

    punishTokensFilter?: (tokens: Token[]) => Token[],

    /**
     * Penalize new line tokens.
     * Enabled by default.
     */
    penalizeNewLine?: boolean,

    /**
     * The relative amount to lower the probability of the tokens in `punishTokens` by
     * Defaults to `1.1`.
     * Set to `1` to disable.
     */
    penalty?: number,

    /**
     * For n time a token is in the `punishTokens` array, lower its probability by `n * frequencyPenalty`
     * Disabled by default (`0`).
     * Set to a value between `0` and `1` to enable.
     */
    frequencyPenalty?: number,

    /**
     * Lower the probability of all the tokens in the `punishTokens` array by `presencePenalty`
     * Disabled by default (`0`).
     * Set to a value between `0` and `1` to enable.
     */
    presencePenalty?: number
};

const UNKNOWN_UNICODE_CHAR = "\ufffd";


export class LlamaChat {
    /** @internal */ private readonly _chatWrapper: ChatWrapper;
    /** @internal */ private readonly _disposeAggregator = new DisposeAggregator();
    /** @internal */ private readonly _autoDisposeSequence: boolean;
    /** @internal */ private _sequence: LlamaContextSequence | null;
    public readonly onDispose = new EventRelay<void>();

    public constructor({
        contextSequence,
        chatWrapper = "auto",
        autoDisposeSequence = true
    }: LlamaChatOptions) {
        if (contextSequence == null)
            throw new Error("contextSequence cannot be null");

        if (contextSequence.disposed)
            throw new DisposedError();

        this._sequence = contextSequence;
        this._autoDisposeSequence = autoDisposeSequence;

        this._disposeAggregator.add(
            this._sequence.onDispose.createListener(() => {
                this.dispose();
            })
        );
        this._disposeAggregator.add(this.onDispose.dispatchEvent);

        this._chatWrapper = resolveChatWrapper(chatWrapper, contextSequence.model);
    }

    public dispose({disposeSequence = this._autoDisposeSequence}: {disposeSequence?: boolean} = {}) {
        if (this._sequence == null)
            return;

        if (disposeSequence)
            this._sequence.dispose();

        this._sequence = null;

        this._disposeAggregator.dispose();
    }

    /** @hidden */
    public [Symbol.dispose]() {
        return this.dispose();
    }

    public get disposed() {
        return this._sequence == null;
    }

    public get chatWrapper() {
        if (this._sequence == null)
            throw new DisposedError();

        return this._chatWrapper;
    }

    public get sequence() {
        if (this._sequence == null)
            throw new DisposedError();

        return this._sequence;
    }

    public get context() {
        return this.sequence.context;
    }

    public get model() {
        return this.sequence.model;
    }

    public async generateResponse<const Functions extends ChatModelFunctions | undefined = undefined>(
        history: ChatHistoryItem[],
        {
            onToken,
            signal,
            maxTokens,
            temperature,
            minP,
            topK,
            topP,
            grammar,
            trimWhitespaceSuffix = false,
            repeatPenalty = {},
            evaluationPriority = 5,
            functions,
            documentFunctionParams,
            contextShift = defaultContextShiftOptions,
            lastEvaluationContextWindow: {
                history: lastEvaluationContextWindowHistory,
                minimumOverlapPercentageToPreventContextShift = 0.5
            } = {}
        }: LLamaChatGenerateResponseOptions<Functions> = {}
    ): Promise<LlamaChatResponse<Functions>> {
        const functionsEnabled = (functions != null && Object.keys(functions).length > 0);

        if (grammar != null && functionsEnabled)
            throw new Error("Using both grammar and functions is not supported yet");

        if (signal?.aborted)
            throw new AbortError();

        if (this._sequence == null)
            throw new DisposedError();

        let resolvedHistory = this._sequence.isLoadedToMemory
            ? history.slice()
            : history.map(removeRawFromHistoryItem);

        if (resolvedHistory.length === 0 || resolvedHistory[resolvedHistory.length - 1].type !== "model")
            resolvedHistory.push({
                type: "model",
                response: []
            });

        const model = this._sequence.model;
        const context = this._sequence.context;
        const eosToken = model.tokens.eos;
        const resolvedContextShift = {
            ...defaultContextShiftOptions,
            ...removeNullFields(contextShift)
        };
        const {
            lastTokens: repeatPenaltyLastTokens = 64,
            punishTokensFilter,
            penalizeNewLine,
            penalty,
            frequencyPenalty,
            presencePenalty
        }: LLamaChatRepeatPenalty = repeatPenalty === false
            ? {lastTokens: 0}
            : repeatPenalty;
        const lastModelResponse = getLastTextModelResponseFromChatHistory(resolvedHistory);

        const res: Token[] = [];
        const pendingTokens: Token[] = [];
        let ignoredStartTextTokens: Token[] = [];
        const functionCallTokens: Token[] = [];
        const repeatPenaltyEnabled = repeatPenaltyLastTokens > 0;
        const grammarEvaluationState = grammar != null
            ? new LlamaGrammarEvaluationState({grammar})
            : undefined;
        let functionsGrammar = functionsEnabled
            ? new FunctionCallGrammar(model._llama, functions as NonNullable<Functions>, this._chatWrapper, false)
            : undefined;
        let functionsEvaluationState = (functionsEnabled && functionsGrammar != null)
            ? new LlamaGrammarEvaluationState({
                grammar: functionsGrammar
            })
            : undefined;
        const streamRegulator = new TokenStreamRegulator();
        const stopGenerationDetector = new StopGenerationDetector();
        const functionSyntaxStartDetector = new StopGenerationDetector();
        const functionSyntaxEndDetector = new StopGenerationDetector();
        const disengageInitiallyEngagedFunctionMode = new StopGenerationDetector();
        const ignoreStartTextDetector = new StopGenerationDetector();
        const locksToReleaseOnValidGeneration: QueuedTokenReleaseLock[] = [];
        const functionCallTokenSyntaxLocks: QueuedTokenReleaseLock[] = [];

        let generatedTokens = 0;
        let isFirstEvaluation = true;
        let inFunctionEvaluationMode = false;
        let initiallyEngagedFunctionMode = false;
        let lastContextWindowHistory: ChatHistoryItem[] = resolvedHistory;
        let lastHistoryCompressionMetadata: object | null | undefined = resolvedContextShift.lastEvaluationMetadata;

        const ensureNotAborted = () => {
            if (signal?.aborted)
                throw new AbortError();

            if (this._sequence == null)
                throw new DisposedError();
        };

        const getPenaltyTokens = () => {
            if (this._sequence == null)
                throw new DisposedError();

            let punishTokens = res.slice(-repeatPenaltyLastTokens);

            if (punishTokensFilter != null)
                punishTokens = punishTokensFilter(punishTokens);

            if (!penalizeNewLine) {
                const nlToken = model.tokens.nl;

                if (nlToken != null)
                    punishTokens = punishTokens.filter(token => token !== nlToken);
            }

            return punishTokens;
        };

        const getResolvedHistoryWithCurrentModelResponse = () => {
            if (res.length === 0)
                return resolvedHistory;

            let modelResponse = model.detokenize(res);

            if (grammar?.trimWhitespaceSuffix || trimWhitespaceSuffix)
                modelResponse = modelResponse.trimEnd();

            if (modelResponse === "")
                return resolvedHistory;

            return setLastModelTextResponseInChatHistory(
                resolvedHistory,
                lastModelResponse + modelResponse
            );
        };

        const removeFoundStartIgnoreTextsFromPendingTokens = () => {
            if (res.length === 0 && pendingTokens.length > 0) {
                ignoreStartTextDetector.clearInProgressStops();
                ignoreStartTextDetector.clearTriggeredStops();

                let mostExhaustiveTriggeredStops: ReturnType<typeof ignoreStartTextDetector.getTriggeredStops> | null = null;

                for (let i = 0; i < pendingTokens.length; i++) {
                    ignoreStartTextDetector.recordGeneration({
                        text: model.detokenize([pendingTokens[i]]),
                        tokens: [pendingTokens[i]],
                        startNewChecks: i === 0
                    });

                    if (ignoreStartTextDetector.hasTriggeredStops) {
                        mostExhaustiveTriggeredStops = ignoreStartTextDetector.getTriggeredStops();
                        ignoreStartTextDetector.clearTriggeredStops();
                    } else if (!ignoreStartTextDetector.hasInProgressStops)
                        break;
                }

                if (mostExhaustiveTriggeredStops != null) {
                    const [mostExhaustiveTriggeredStop] = mostExhaustiveTriggeredStops;

                    if (mostExhaustiveTriggeredStop != null) {
                        ignoredStartTextTokens = mostExhaustiveTriggeredStop.stopTrigger
                            .map((stopTrigger) => {
                                if (typeof stopTrigger === "string")
                                    return model.tokenize(stopTrigger);
                                else
                                    return [stopTrigger];
                            })
                            .flat(1);

                        const newPendingTokens = mostExhaustiveTriggeredStop.remainingGenerations
                            .map((generation) => {
                                if (typeof generation === "string")
                                    return model.tokenize(generation);
                                else
                                    return generation;
                            })
                            .flat(1);
                        pendingTokens.length = 0;
                        pendingTokens.push(...newPendingTokens);
                    }
                }
            }
        };

        if (grammar != null)
            StopGenerationDetector.resolveStopTriggers(grammar.stopGenerationTriggers, model.tokenize)
                .map((stopTrigger) => stopGenerationDetector.addStopTrigger(stopTrigger));

        if (functions != null && Object.keys(functions).length > 0)
            functionSyntaxStartDetector.addStopTrigger([this._chatWrapper.settings.functions.call.prefix]);

        // eslint-disable-next-line no-constant-condition
        while (true) {
            ensureNotAborted();

            let shouldContextShift = false;
            const queuedChunkTokens = streamRegulator.getAllQueuedChunkTokens();
            const {
                history: contextWindowHistory,
                stopGenerationTriggers,
                tokens: contextWindowTokens,
                newResolvedHistory,
                newHistoryCompressionMetadata,
                ignoreStartText,
                functionCallInitiallyEngaged,
                disengageInitiallyEngagedFunctionCall
            } = await getContextWindow({
                resolvedHistory: getResolvedHistoryWithCurrentModelResponse(),
                resolvedContextShift,
                lastHistoryCompressionMetadata,
                pendingTokensCount: pendingTokens.length + queuedChunkTokens.length,
                isFirstEvaluation,
                chatWrapper: this._chatWrapper,
                lastEvaluationContextWindowHistory,
                minimumOverlapPercentageToPreventContextShift,
                sequence: this._sequence,
                minFreeContextTokens: 1,
                functions: functionsEnabled ? functions : undefined,
                documentFunctionParams
            });
            ensureNotAborted();

            if (generatedTokens === 0) {
                StopGenerationDetector.resolveStopTriggers(ignoreStartText, model.tokenize)
                    .map((stopTrigger) => ignoreStartTextDetector.addStopTrigger(stopTrigger));

                if (functionsEnabled) {
                    initiallyEngagedFunctionMode = functionCallInitiallyEngaged;
                    StopGenerationDetector.resolveStopTriggers(disengageInitiallyEngagedFunctionCall, model.tokenize)
                        .map((stopTrigger) => disengageInitiallyEngagedFunctionMode.addStopTrigger(stopTrigger));

                    if (initiallyEngagedFunctionMode) {
                        inFunctionEvaluationMode = true;
                        functionsGrammar = new FunctionCallGrammar(
                            model._llama,
                            functions as NonNullable<Functions>,
                            this._chatWrapper,
                            true
                        );
                        functionsEvaluationState = new LlamaGrammarEvaluationState({
                            grammar: functionsGrammar
                        });
                    }
                }
            }

            const tokens = [...contextWindowTokens, ...ignoredStartTextTokens, ...pendingTokens, ...queuedChunkTokens];
            resolvedHistory = newResolvedHistory;
            lastHistoryCompressionMetadata = newHistoryCompressionMetadata;
            lastContextWindowHistory = contextWindowHistory;
            const contextWindowLastModelResponse = getLastTextModelResponseFromChatHistory(contextWindowHistory);
            const contextWindowsRes: Token[] = [];

            StopGenerationDetector.resolveStopTriggers(stopGenerationTriggers, model.tokenize)
                .map((stopTrigger) => stopGenerationDetector.addStopTrigger(stopTrigger));

            if (functionsGrammar != null)
                StopGenerationDetector.resolveStopTriggers(functionsGrammar.stopGenerationTriggers, model.tokenize)
                    .map((stopTrigger) => functionSyntaxEndDetector.addStopTrigger(stopTrigger));

            let {firstDifferentIndex} = this._sequence.compareContextTokens(tokens);

            // we need to decode at least one token to generate a response
            if (firstDifferentIndex === tokens.length && firstDifferentIndex > 0)
                firstDifferentIndex -= 1;

            tokens.splice(0, firstDifferentIndex);

            if (firstDifferentIndex < this._sequence.nextTokenIndex) {
                await this._sequence.eraseContextTokenRanges([{
                    start: firstDifferentIndex,
                    end: this._sequence.nextTokenIndex
                }]);
                ensureNotAborted();
            }


            const evaluationIterator = this._sequence.evaluate(tokens, removeNullFields({
                temperature, minP, topK, topP,
                grammarEvaluationState: () => {
                    if (inFunctionEvaluationMode)
                        return functionsEvaluationState;

                    return grammarEvaluationState;
                },
                repeatPenalty: !repeatPenaltyEnabled ? undefined : {
                    punishTokens: getPenaltyTokens,
                    penalty,
                    frequencyPenalty,
                    presencePenalty
                },
                evaluationPriority,
                yieldEosToken: true
            }));

            for await (const token of evaluationIterator) {
                ensureNotAborted();
                generatedTokens++;

                const tokens = [token];
                const text = model.detokenize([token]);
                const queuedTokenRelease = streamRegulator.addChunk({tokens, text});

                if (initiallyEngagedFunctionMode)
                    disengageInitiallyEngagedFunctionMode.recordGeneration({text, tokens, startNewChecks: generatedTokens === 1});

                if (text === UNKNOWN_UNICODE_CHAR || (
                    (grammar?.trimWhitespaceSuffix || trimWhitespaceSuffix) && text.trim() === ""
                )) {
                    locksToReleaseOnValidGeneration.push(queuedTokenRelease.createTextIndexLock(0));
                } else {
                    while (locksToReleaseOnValidGeneration.length > 0)
                        locksToReleaseOnValidGeneration.shift()!.dispose();
                }

                functionSyntaxStartDetector.recordGeneration({text, tokens, queuedTokenRelease});

                if (initiallyEngagedFunctionMode && disengageInitiallyEngagedFunctionMode.hasTriggeredStops) {
                    initiallyEngagedFunctionMode = false;

                    let shouldStopFunctionEvaluationMode = !functionSyntaxStartDetector.hasTriggeredStops;

                    if (!shouldStopFunctionEvaluationMode && functionsEnabled && functionsGrammar != null) {
                        const functionCallText = model.detokenize([...functionCallTokens, ...tokens]);

                        try {
                            const functionName = functionsGrammar.parseFunctionNameFromPartialCall(functionCallText, {
                                enableInternalBuiltinFunctions: true,
                                initialFunctionCallEngaged: true
                            });

                            const internalBuiltinFunctions =
                                this._chatWrapper.getInternalBuiltinFunctions({initialFunctionCallEngaged: true});
                            if (internalBuiltinFunctions[functionName] != null) {
                                shouldStopFunctionEvaluationMode = true;
                            }
                        } catch (err) {
                            if (!(err instanceof LlamaFunctionCallValidationError))
                                throw err;
                        }
                    }

                    if (shouldStopFunctionEvaluationMode) {
                        inFunctionEvaluationMode = false;
                        functionsGrammar = new FunctionCallGrammar(
                            model._llama,
                            functions as NonNullable<Functions>,
                            this._chatWrapper, false
                        );
                        functionsEvaluationState = new LlamaGrammarEvaluationState({
                            grammar: functionsGrammar
                        });

                        functionCallTokens.length = 0;

                        while (functionCallTokenSyntaxLocks.length > 0)
                            functionCallTokenSyntaxLocks.shift()!.dispose();

                        functionSyntaxStartDetector.clearInProgressStops();
                        functionSyntaxStartDetector.clearTriggeredStops();

                        functionSyntaxEndDetector.clearInProgressStops();
                        functionSyntaxEndDetector.clearTriggeredStops();
                    }
                }

                if (!inFunctionEvaluationMode && functionsEnabled && functionsGrammar != null &&
                    functionSyntaxStartDetector.hasTriggeredStops && functionsEvaluationState != null
                ) {
                    inFunctionEvaluationMode = true;
                    functionCallTokenSyntaxLocks.push(queuedTokenRelease.createTextIndexLock(0));

                    stopGenerationDetector.clearTriggeredStops();
                    stopGenerationDetector.clearInProgressStops();

                    pendingTokens.push(...streamRegulator.popFreeChunkTokens());

                    const triggeredStops  = functionSyntaxStartDetector.getTriggeredStops();
                    const partiallyFreeTokens = streamRegulator.getPartiallyFreeChunk();

                    const queuedTokensBeforeStopTrigger = getQueuedTokensBeforeStopTrigger(
                        triggeredStops,
                        partiallyFreeTokens,
                        model.tokenize
                    );
                    pendingTokens.push(...queuedTokensBeforeStopTrigger);

                    const [firstRemainingGenerationAfterStop] = triggeredStops
                        .map((stopTrigger) => stopTrigger.remainingGenerations)
                        .filter((remainingGenerations) => remainingGenerations.length > 0)
                        .flat(1);

                    const remainingTextAfterStop =
                        (firstRemainingGenerationAfterStop == null || firstRemainingGenerationAfterStop.length === 0)
                            ? ""
                            : typeof firstRemainingGenerationAfterStop === "string"
                                ? firstRemainingGenerationAfterStop
                                : model.detokenize(firstRemainingGenerationAfterStop);

                    functionCallTokens.push(...model.tokenize(this._chatWrapper.settings.functions.call.prefix + remainingTextAfterStop));

                    for (const functionCallToken of functionCallTokens)
                        context._acceptTokenOnGrammarEvaluationState(functionsEvaluationState, functionCallToken);
                } else if (inFunctionEvaluationMode) {
                    functionCallTokens.push(...tokens);
                    functionCallTokenSyntaxLocks.push(queuedTokenRelease.createTextIndexLock(0));
                    functionSyntaxEndDetector.recordGeneration({text, tokens, queuedTokenRelease});
                }

                if (inFunctionEvaluationMode && functionSyntaxEndDetector.hasTriggeredStops && functionsGrammar != null) {
                    const functionCallText = model.detokenize(functionCallTokens);
                    const functionCall = functionsGrammar.parseFunctionCall(functionCallText);

                    let modelResponse = model.detokenize(res);
                    let contextWindowModelResponse = model.detokenize(contextWindowsRes);

                    if (grammar?.trimWhitespaceSuffix || trimWhitespaceSuffix) {
                        modelResponse = modelResponse.trimEnd();
                        contextWindowModelResponse = contextWindowModelResponse.trimEnd();
                    }

                    return {
                        response: modelResponse,
                        lastEvaluation: {
                            contextWindow: setLastModelTextResponseInChatHistory(
                                lastContextWindowHistory,
                                contextWindowLastModelResponse + contextWindowModelResponse
                            ),
                            cleanHistory: setLastModelTextResponseInChatHistory(
                                resolvedHistory,
                                lastModelResponse + modelResponse
                            ),
                            contextShiftMetadata: lastHistoryCompressionMetadata
                        },

                        // prevent infinite TS type instantiation
                        functionCall: functionCall satisfies LlamaChatResponseFunctionCall<NonNullable<Functions>> as any,

                        metadata: {
                            stopReason: "functionCall"
                        }
                    };
                }

                if (!inFunctionEvaluationMode)
                    stopGenerationDetector.recordGeneration({text, tokens, queuedTokenRelease});

                pendingTokens.push(...streamRegulator.popFreeChunkTokens());

                removeFoundStartIgnoreTextsFromPendingTokens();

                if (stopGenerationDetector.hasTriggeredStops || token === eosToken) {
                    const triggeredStops  = stopGenerationDetector.getTriggeredStops();
                    const partiallyFreeTokens = streamRegulator.getPartiallyFreeChunk();

                    const queuedTokensBeforeStopTrigger = getQueuedTokensBeforeStopTrigger(
                        triggeredStops,
                        partiallyFreeTokens,
                        model.tokenize
                    );
                    pendingTokens.push(...queuedTokensBeforeStopTrigger);

                    const [firstRemainingGenerationAfterStop] = triggeredStops
                        .map((stopTrigger) => stopTrigger.remainingGenerations)
                        .filter((remainingGenerations) => remainingGenerations.length > 0)
                        .flat(1);

                    removeFoundStartIgnoreTextsFromPendingTokens();

                    if (pendingTokens.length > 0)
                        onToken?.(pendingTokens.slice());

                    res.push(...pendingTokens);
                    contextWindowsRes.push(...pendingTokens);
                    pendingTokens.length = 0;

                    let modelResponse = model.detokenize(res);
                    let contextWindowModelResponse = model.detokenize(contextWindowsRes);

                    if (grammar?.trimWhitespaceSuffix || trimWhitespaceSuffix) {
                        modelResponse = modelResponse.trimEnd();
                        contextWindowModelResponse = contextWindowModelResponse.trimEnd();
                    }

                    return {
                        response: modelResponse,
                        lastEvaluation: {
                            contextWindow: setLastModelTextResponseInChatHistory(
                                lastContextWindowHistory,
                                contextWindowLastModelResponse + contextWindowModelResponse
                            ),
                            cleanHistory: setLastModelTextResponseInChatHistory(
                                resolvedHistory,
                                lastModelResponse + modelResponse
                            ),
                            contextShiftMetadata: lastHistoryCompressionMetadata
                        },
                        metadata: {
                            remainingGenerationAfterStop: firstRemainingGenerationAfterStop,
                            stopReason: token === eosToken
                                ? "eosToken"
                                : "stopGenerationTrigger"
                        }
                    };
                }

                const maxTokensTriggered = maxTokens != null && maxTokens > 0 && generatedTokens >= maxTokens;

                if (res.length === 0) {
                    ignoreStartTextDetector.clearInProgressStops();
                    ignoreStartTextDetector.clearTriggeredStops();

                    ignoreStartTextDetector.recordGeneration({
                        text: model.detokenize(pendingTokens),
                        tokens: pendingTokens
                    });
                }

                if (pendingTokens.length > 0 && (maxTokensTriggered || !ignoreStartTextDetector.hasInProgressStops)) {
                    removeFoundStartIgnoreTextsFromPendingTokens();

                    if (pendingTokens.length > 0) {
                        onToken?.(pendingTokens.slice());
                        res.push(...pendingTokens);
                        contextWindowsRes.push(...pendingTokens);
                        pendingTokens.length = 0;
                    }
                }

                if (maxTokensTriggered) {
                    let modelResponse = model.detokenize(res);
                    let contextWindowModelResponse = model.detokenize(contextWindowsRes);

                    if (grammar?.trimWhitespaceSuffix || trimWhitespaceSuffix) {
                        modelResponse = modelResponse.trimEnd();
                        contextWindowModelResponse = contextWindowModelResponse.trimEnd();
                    }

                    return {
                        response: modelResponse,
                        lastEvaluation: {
                            contextWindow: setLastModelTextResponseInChatHistory(
                                lastContextWindowHistory,
                                contextWindowLastModelResponse + contextWindowModelResponse
                            ),
                            cleanHistory: setLastModelTextResponseInChatHistory(
                                resolvedHistory,
                                lastModelResponse + modelResponse
                            ),
                            contextShiftMetadata: lastHistoryCompressionMetadata
                        },
                        metadata: {
                            stopReason: "maxTokens"
                        }
                    };
                }

                if (this._sequence.nextTokenIndex >= context.contextSize) {
                    shouldContextShift = true;
                    break;
                }
            }

            isFirstEvaluation = false;

            if (shouldContextShift)
                continue;

            break;
        }

        throw new Error("The context size is too small to generate a response");
    }
}

export type LlamaChatResponse<Functions extends ChatModelFunctions | undefined = undefined> = {
    response: string,
    functionCall?: Functions extends ChatModelFunctions
        ? LlamaChatResponseFunctionCall<Functions>
        : never,
    lastEvaluation: {
        cleanHistory: ChatHistoryItem[],
        contextWindow: ChatHistoryItem[],
        contextShiftMetadata: any
    },
    metadata: {
        remainingGenerationAfterStop?: string | Token[],
        stopReason: "eosToken" | "stopGenerationTrigger" | "functionCall" | "maxTokens"
    }
};

export type LlamaChatResponseFunctionCall<
    Functions extends ChatModelFunctions,
    FunctionCallName extends keyof Functions & string = string & keyof Functions,
    Params = Functions[FunctionCallName]["params"] extends undefined | null | void
        ? undefined
        : GbnfJsonSchemaToType<Functions[FunctionCallName]["params"]>
> = {
    functionName: FunctionCallName,
    params: Params,
    raw: string
};

function removeRawFromHistoryItem<Item extends ChatHistoryItem>(historyItem: Item): Item {
    if (historyItem.type === "model") {
        const newHistoryItem: ChatModelResponse = {...historyItem};
        newHistoryItem.response = newHistoryItem.response.map((item) => {
            if (typeof item === "string")
                return item;
            else
                return {
                    ...item,
                    raw: undefined
                };
        });

        return newHistoryItem as Item;
    }

    return historyItem;
}

async function compressHistoryToFitContextSize({
    history,
    contextShiftSize,
    contextShiftStrategy,
    contextShiftLastEvaluationMetadata,
    contextSize,
    tokenizer,
    chatWrapper,
    functions,
    documentFunctionParams
}: {
    history: ChatHistoryItem[],
    contextShiftSize: number,
    contextShiftStrategy: LLamaChatContextShiftOptions["strategy"]
    contextShiftLastEvaluationMetadata: LLamaChatContextShiftOptions["lastEvaluationMetadata"]
    contextSize: number,
    tokenizer: Tokenizer,
    chatWrapper: ChatWrapper,
    functions?: ChatModelFunctions,
    documentFunctionParams?: boolean
}): Promise<{
    compressedHistory: ChatHistoryItem[],
    metadata: LLamaChatContextShiftOptions["lastEvaluationMetadata"]
}> {
    function checkIfHistoryFitsContext(history: ChatHistoryItem[]) {
        const {contextText} = chatWrapper.generateContextText(history, {
            availableFunctions: functions,
            documentFunctionParams
        });
        const tokens = contextText.tokenize(tokenizer);

        return tokens.length <= contextSize - contextShiftSize;
    }

    if (contextSize - contextShiftSize <= 0)
        throw new Error(
            `The context size (${contextSize}) is too small to fit the context shift size (${contextShiftSize})`
        );

    if (checkIfHistoryFitsContext(history))
        return {
            compressedHistory: history,
            metadata: null
        };

    if (contextShiftStrategy instanceof Function) {
        try {
            const {chatHistory, metadata} = await contextShiftStrategy({
                chatHistory: history,
                maxTokensCount: contextSize - contextShiftSize,
                tokenizer,
                chatWrapper,
                lastShiftMetadata: contextShiftLastEvaluationMetadata
            });

            if (checkIfHistoryFitsContext(chatHistory))
                return {
                    compressedHistory: chatHistory,
                    metadata
                };

            console.warn(
                "The provided context shift strategy did not return a history that fits the context size. " +
                "Using the default strategy instead."
            );
        } catch (err) {
            console.error(
                "The provided context shift strategy threw an error. " +
                "Using the default strategy instead.",
                err
            );
        }
    } else if (contextShiftStrategy !== "eraseFirstResponseAndKeepFirstSystem")
        console.warn(
            `Unknown context shift strategy "${contextShiftStrategy}". ` +
            "Using the default strategy instead."
        );

    const {chatHistory, metadata} = await eraseFirstResponseAndKeepFirstSystemChatContextShiftStrategy({
        chatHistory: history,
        maxTokensCount: contextSize - contextShiftSize,
        tokenizer,
        chatWrapper,
        lastShiftMetadata: contextShiftLastEvaluationMetadata
    });

    if (!checkIfHistoryFitsContext(chatHistory))
        throw new Error(
            "The default context shift strategy did not return a history that fits the context size. " +
            "This may happen due to the system prompt being too long"
        );

    return {
        compressedHistory: chatHistory,
        metadata
    };
}

function getQueuedTokensBeforeStopTrigger(
    triggeredStops: ReturnType<typeof StopGenerationDetector["prototype"]["getTriggeredStops"]>,
    partiallyFreeTokens: {
        tokens: Token[],
        text: string
    },
    tokenizer: Tokenizer
) {
    if (partiallyFreeTokens.tokens.length === 0 && partiallyFreeTokens.text.length === 0)
        return [];
    else if (partiallyFreeTokens.tokens.length !== 0 && partiallyFreeTokens.text.length === 0)
        return partiallyFreeTokens.tokens;
    else if (partiallyFreeTokens.tokens.length === 0 && partiallyFreeTokens.text.length !== 0)
        return tokenizer(partiallyFreeTokens.text);

    const triggerThatStartsWithStringIndex = triggeredStops.findIndex(
        (trigger) => trigger.stopTrigger.length > 0 && typeof trigger.stopTrigger[0] === "string"
    );
    const triggerThatStartsWithTokenIndex = triggeredStops.findIndex(
        (trigger) => trigger.stopTrigger.length > 0 && typeof trigger.stopTrigger[0] !== "string"
    );

    if (triggerThatStartsWithTokenIndex > 0 && triggerThatStartsWithStringIndex < 0)
        return partiallyFreeTokens.tokens;
    else if (triggerThatStartsWithStringIndex > 0 && triggerThatStartsWithTokenIndex < 0)
        return tokenizer(partiallyFreeTokens.text);

    const stringTokens = tokenizer(partiallyFreeTokens.text);
    if (stringTokens.length === partiallyFreeTokens.tokens.length &&
        stringTokens.every((value, index) => value === partiallyFreeTokens.tokens[index])
    )
        return stringTokens;
    else if (triggerThatStartsWithStringIndex < triggerThatStartsWithTokenIndex)
        return stringTokens;

    return partiallyFreeTokens.tokens;
}

function getLastTextModelResponseFromChatHistory(chatHistory: ChatHistoryItem[]) {
    if (chatHistory.length === 0 || chatHistory[chatHistory.length - 1].type !== "model")
        return "";

    const lastModelResponseItem = chatHistory[chatHistory.length - 1] as ChatModelResponse;
    const modelResponse = lastModelResponseItem.response;

    if (modelResponse.length > 0 && typeof modelResponse[modelResponse.length - 1] === "string")
        return modelResponse[modelResponse.length - 1] as string;

    return "";
}

function setLastModelTextResponseInChatHistory(chatHistory: ChatHistoryItem[], textResponse: string) {
    const newChatHistory = chatHistory.slice();
    if (newChatHistory.length === 0 || newChatHistory[newChatHistory.length - 1].type !== "model")
        newChatHistory.push({
            type: "model",
            response: []
        });

    const lastModelResponseItem = newChatHistory[newChatHistory.length - 1] as ChatModelResponse;
    const newLastModelResponseItem = {...lastModelResponseItem};
    newChatHistory[newChatHistory.length - 1] = newLastModelResponseItem;

    const modelResponse = newLastModelResponseItem.response.slice();
    newLastModelResponseItem.response = modelResponse;

    if (modelResponse.length > 0 && typeof modelResponse[modelResponse.length - 1] === "string") {
        if (textResponse === "")
            modelResponse.pop();
        else
            modelResponse[modelResponse.length - 1] = textResponse;
    } else if (textResponse !== "")
        modelResponse.push(textResponse);

    return newChatHistory;
}

async function getContextWindow({
    resolvedHistory, resolvedContextShift,
    lastHistoryCompressionMetadata, pendingTokensCount = 0, isFirstEvaluation,
    chatWrapper, lastEvaluationContextWindowHistory, minimumOverlapPercentageToPreventContextShift,
    sequence, minFreeContextTokens = 1, functions, documentFunctionParams
}: {
    resolvedHistory: ChatHistoryItem[], resolvedContextShift: Required<LLamaChatContextShiftOptions>,
    lastHistoryCompressionMetadata: object | null | undefined, pendingTokensCount: number, isFirstEvaluation: boolean,
    chatWrapper: ChatWrapper, lastEvaluationContextWindowHistory?: ChatHistoryItem[], minimumOverlapPercentageToPreventContextShift: number,
    sequence?: LlamaContextSequence, minFreeContextTokens?: number, functions?: ChatModelFunctions,
    documentFunctionParams?: boolean
}): Promise<{
    history: ChatHistoryItem[], stopGenerationTriggers: LlamaText[], tokens: Token[],
    newResolvedHistory: ChatHistoryItem[], newHistoryCompressionMetadata: object | null | undefined,
    ignoreStartText: LlamaText[], functionCallInitiallyEngaged: boolean,
    disengageInitiallyEngagedFunctionCall: LlamaText[]
}> {
    if (sequence == null)
        throw new DisposedError();

    const model = sequence.model;
    const context = sequence.context;

    if (isFirstEvaluation && lastEvaluationContextWindowHistory != null && sequence.isLoadedToMemory) {
        const newContextWindow = lastEvaluationContextWindowHistory.slice();

        if (newContextWindow.length === 0 || newContextWindow[newContextWindow.length - 1].type !== "model")
            newContextWindow.push({
                type: "model",
                response: []
            });

        const {contextText, stopGenerationTriggers, ignoreStartText, functionCall} = chatWrapper.generateContextText(newContextWindow, {
            availableFunctions: functions,
            documentFunctionParams
        });
        const tokens = contextText.tokenize(model.tokenize);
        if (tokens.length + pendingTokensCount + minFreeContextTokens < context.contextSize) {
            const {firstDifferentIndex} = sequence.compareContextTokens(tokens);

            const existingEvaluationPercentage = firstDifferentIndex / tokens.length;

            if (existingEvaluationPercentage >= minimumOverlapPercentageToPreventContextShift)
                return {
                    history: newContextWindow,
                    stopGenerationTriggers,
                    tokens,
                    newResolvedHistory: resolvedHistory,
                    newHistoryCompressionMetadata: lastHistoryCompressionMetadata,
                    ignoreStartText: ignoreStartText ?? [],
                    functionCallInitiallyEngaged: functionCall?.initiallyEngaged ?? false,
                    disengageInitiallyEngagedFunctionCall: functionCall?.disengageInitiallyEngaged ?? []
                };
        }
    }

    resolvedHistory = sequence.isLoadedToMemory
        ? resolvedHistory.slice()
        : resolvedHistory.map(removeRawFromHistoryItem);

    if (resolvedContextShift.lastEvaluationMetadata != null) {
        const contextShiftSize = resolvedContextShift.size instanceof Function
            ? await resolvedContextShift.size(sequence)
            : resolvedContextShift.size;

        const {compressedHistory, metadata} = await compressHistoryToFitContextSize({
            history: resolvedHistory,
            contextShiftSize: Math.max(contextShiftSize, minFreeContextTokens) + pendingTokensCount,
            contextShiftStrategy: resolvedContextShift.strategy,
            contextShiftLastEvaluationMetadata: resolvedContextShift.lastEvaluationMetadata,
            contextSize: context.contextSize,
            tokenizer: model.tokenize,
            chatWrapper: chatWrapper,
            functions,
            documentFunctionParams
        });

        const {contextText, stopGenerationTriggers, ignoreStartText, functionCall} = chatWrapper.generateContextText(compressedHistory, {
            availableFunctions: functions,
            documentFunctionParams
        });

        return {
            history: compressedHistory,
            stopGenerationTriggers,
            tokens: contextText.tokenize(model.tokenize),
            newResolvedHistory: resolvedHistory,
            newHistoryCompressionMetadata: metadata,
            ignoreStartText: ignoreStartText ?? [],
            functionCallInitiallyEngaged: functionCall?.initiallyEngaged ?? false,
            disengageInitiallyEngagedFunctionCall: functionCall?.disengageInitiallyEngaged ?? []
        };
    }

    {
        const {contextText, stopGenerationTriggers, ignoreStartText, functionCall} = chatWrapper.generateContextText(resolvedHistory, {
            availableFunctions: functions,
            documentFunctionParams
        });
        const tokens = contextText.tokenize(model.tokenize);

        if (tokens.length + pendingTokensCount + minFreeContextTokens < context.contextSize)
            return {
                history: resolvedHistory,
                stopGenerationTriggers,
                tokens,
                newResolvedHistory: resolvedHistory,
                newHistoryCompressionMetadata: lastHistoryCompressionMetadata,
                ignoreStartText: ignoreStartText ?? [],
                functionCallInitiallyEngaged: functionCall?.initiallyEngaged ?? false,
                disengageInitiallyEngagedFunctionCall: functionCall?.disengageInitiallyEngaged ?? []
            };
    }

    const contextShiftSize = resolvedContextShift.size instanceof Function
        ? await resolvedContextShift.size(sequence)
        : resolvedContextShift.size;

    const {compressedHistory, metadata} = await compressHistoryToFitContextSize({
        history: resolvedHistory,
        contextShiftSize: Math.max(contextShiftSize, minFreeContextTokens) + pendingTokensCount,
        contextShiftStrategy: resolvedContextShift.strategy,
        contextShiftLastEvaluationMetadata: resolvedContextShift.lastEvaluationMetadata,
        contextSize: context.contextSize,
        tokenizer: model.tokenize,
        chatWrapper: chatWrapper,
        functions,
        documentFunctionParams
    });

    const {contextText, stopGenerationTriggers, ignoreStartText, functionCall} = chatWrapper.generateContextText(compressedHistory, {
        availableFunctions: functions,
        documentFunctionParams
    });

    return {
        history: compressedHistory,
        stopGenerationTriggers,
        tokens: contextText .tokenize(model.tokenize),
        newResolvedHistory: resolvedHistory,
        newHistoryCompressionMetadata: metadata,
        ignoreStartText: ignoreStartText ?? [],
        functionCallInitiallyEngaged: functionCall?.initiallyEngaged ?? false,
        disengageInitiallyEngagedFunctionCall: functionCall?.disengageInitiallyEngaged ?? []
    };
}
