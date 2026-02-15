import {DisposeAggregator, DisposedError, EventRelay, withLock} from "lifecycle-utils";
import {ChatWrapper} from "../../ChatWrapper.js";
import {LlamaContextSequence} from "../LlamaContext/LlamaContext.js";
import {
    ChatHistoryItem, ChatModelFunctions, ChatModelResponse, ChatModelSegmentType, ChatUserMessage, isChatModelResponseFunctionCall,
    isChatModelResponseSegment, LLamaContextualRepeatPenalty, Token, Tokenizer, allSegmentTypes, ChatWrapperGeneratedContextState
} from "../../types.js";
import {GbnfJsonSchemaToType} from "../../utils/gbnfJson/types.js";
import {LlamaGrammar} from "../LlamaGrammar.js";
import {removeNullFields} from "../../utils/removeNullFields.js";
import {LlamaGrammarEvaluationState} from "../LlamaGrammarEvaluationState.js";
import {LlamaText, LlamaTextJSON, SpecialToken} from "../../utils/LlamaText.js";
import {StopGenerationDetector} from "../../utils/StopGenerationDetector.js";
import {QueuedTokenRelease, QueuedTokenReleaseLock, TokenStreamRegulator} from "../../utils/TokenStreamRegulator.js";
import {EvaluationPriority} from "../LlamaContext/types.js";
import {maxRecentDetokenizerTokens, UNKNOWN_UNICODE_CHAR} from "../../consts.js";
import {getQueuedTokensBeforeStopTrigger} from "../../utils/getQueuedTokensBeforeStopTrigger.js";
import {resolveChatWrapper} from "../../chatWrappers/utils/resolveChatWrapper.js";
import {TokenBias} from "../TokenBias.js";
import {safeEventCallback} from "../../utils/safeEventCallback.js";
import {pushAll} from "../../utils/pushAll.js";
import {resolveLastTokens} from "../../utils/resolveLastTokens.js";
import {LlamaSampler} from "../LlamaContext/LlamaSampler.js";
import {LlamaModel} from "../LlamaModel/LlamaModel.js";
import {getChatWrapperSegmentDefinition} from "../../utils/getChatWrapperSegmentDefinition.js";
import {jsonDumps} from "../../chatWrappers/utils/jsonDumps.js";
import {defaultMaxPreloadTokens} from "../LlamaChatSession/utils/LlamaChatSessionPromptCompletionEngine.js";
import {
    eraseFirstResponseAndKeepFirstSystemChatContextShiftStrategy
} from "./utils/contextShiftStrategies/eraseFirstResponseAndKeepFirstSystemChatContextShiftStrategy.js";
import {FunctionCallNameGrammar} from "./utils/FunctionCallNameGrammar.js";
import {FunctionCallParamsGrammar} from "./utils/FunctionCallParamsGrammar.js";

export type LlamaChatOptions = {
    contextSequence: LlamaContextSequence,

    /** `"auto"` is used by default */
    chatWrapper?: "auto" | ChatWrapper,

    /**
     * Automatically dispose the sequence when the session is disposed
     *
     * Defaults to `false`.
     */
    autoDisposeSequence?: boolean
};

export type LlamaChatResponseChunk = LlamaChatResponseTextChunk | LlamaChatResponseSegmentChunk;

export type LlamaChatResponseTextChunk = {
    /** When `type` is `undefined`, the chunk is part of the main response and is not a segment */
    type: undefined,

    /**
     * `segmentType` has no purpose when `type` is `undefined` (meaning that this chunk is part of the main response and is not a segment).
     */
    segmentType: undefined,

    /**
     * The generated text chunk.
     *
     * Detokenized from the `tokens` property,
     * but with the context of the previous generation (for better spacing of the text with some models).
     *
     * Prefer using this property over `tokens` when streaming the generated response as text.
     */
    text: string,

    /** The generated tokens */
    tokens: Token[]
};

export type LlamaChatResponseSegmentChunk = {
    type: "segment",

    /** Segment type */
    segmentType: ChatModelSegmentType,

    /**
     * The generated text chunk.
     *
     * Detokenized from the `tokens` property,
     * but with the context of the previous generation (for better spacing of the text with some models).
     *
     * Prefer using this property over `tokens` when streaming the generated response as text.
     */
    text: string,

    /** The generated tokens */
    tokens: Token[],

    /**
     * When the current chunk is the start of a segment, this field will be set.
     *
     * It's possible that a chunk with no tokens and empty text will be emitted just to set this field
     * to signify that the segment has started.
     */
    segmentStartTime?: Date,

    /**
     * When the current chunk is the last one of a segment (meaning the current segment has ended), this field will be set.
     *
     * It's possible that a chunk with no tokens and empty text will be emitted just to set this field
     * to signify that the segment has ended.
     */
    segmentEndTime?: Date
};

export type LlamaChatResponseFunctionCallParamsChunk = {
    /**
     * Each different function call has a different `callIndex`.
     *
     * When the previous function call has finished being generated, the `callIndex` of the next one will increment.
     *
     * Use this value to distinguish between different function calls.
     */
    callIndex: number,

    /**
     * The name of the function being called
     */
    functionName: string,

    /**
     * A chunk of the generated text used for the function call parameters.
     *
     * Collect all the chunks together to construct the full function call parameters.
     *
     * After the function call is finished, the entire constructed params text can be parsed as a JSON object,
     * according to the function parameters schema.
     */
    paramsChunk: string,

    /**
     * When this is `true`, the current chunk is the last chunk in the generation of the current function call parameters.
     */
    done: boolean
};

export type LLamaChatGenerateResponseOptions<Functions extends ChatModelFunctions | undefined = undefined> = {
    /**
     * Called as the model generates the main response with the generated text chunk.
     *
     * Useful for streaming the generated response as it's being generated.
     *
     * Includes only the main response without any text segments (like thoughts).
     * For streaming the response with segments, use {@link onResponseChunk `onResponseChunk`}.
     */
    onTextChunk?: (text: string) => void,

    /**
     * Called as the model generates the main response with the generated tokens.
     *
     * Preferably, you'd want to use {@link onTextChunk `onTextChunk`} instead of this.
     *
     * Includes only the main response without any segments (like thoughts).
     * For streaming the response with segments, use {@link onResponseChunk `onResponseChunk`}.
     */
    onToken?: (tokens: Token[]) => void,

    /**
     * Called as the model generates a response with the generated text and tokens,
     * including segment information (when the generated output is part of a segment).
     *
     * Useful for streaming the generated response as it's being generated, including the main response and all segments.
     *
     * Only use this function when you need the segmented texts, like thought segments (chain of thought text).
     */
    onResponseChunk?: (chunk: LlamaChatResponseChunk) => void,

    /**
     * An AbortSignal to later abort the generation.
     *
     * When the signal is aborted, the generation will stop and throw `signal.reason` as the error.
     *
     * > To stop an ongoing generation without throwing an error, also set `stopOnAbortSignal` to `true`.
     */
    signal?: AbortSignal,

    /**
     * When a response already started being generated and then the signal is aborted,
     * the generation will stop and the response will be returned as is instead of throwing an error.
     *
     * Defaults to `false`.
     */
    stopOnAbortSignal?: boolean,

    /** Maximum number of tokens to generate */
    maxTokens?: number,

    /**
     * Temperature is a hyperparameter that controls the randomness of the generated text.
     * It affects the probability distribution of the model's output tokens.
     *
     * A higher temperature (e.g., 1.5) makes the output more random and creative,
     * while a lower temperature (e.g., 0.5) makes the output more focused, deterministic, and conservative.
     *
     * The suggested temperature is 0.8, which provides a balance between randomness and determinism.
     *
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
     * Used to control the randomness of the generated text.
     *
     * Change the seed to get different results.
     *
     * Only relevant when using `temperature`.
     */
    seed?: number,

    /**
     * Exclude Top Choices (XTC) removes the top tokens from consideration and avoids more obvious and repetitive generations.
     * Using it leads to more creative responses, but also to increased hallucinations.
     *
     * The `probability` value controls the chance that the top tokens will be removed in the next token generation step.
     * The `threshold` value control the minimum probability of a token for it to be removed.
     *
     * It's recommended to use it alongside `minP` for better results.
     * Start with `{minP: 0.02, xtc: {probability: 0.5, threshold: 0.1}}` and adjust from there
     */
    xtc?: {
        /**
         * A number between `0` and `1` representing the probability of applying Exclude Top Choices (XTC) at each token generation step.
         */
        probability: number,

        /**
         * A number between `0` and `1` representing the minimum probability
         * of a token for it to be removed when applying Exclude Top Choices (XTC).
         */
        threshold: number
    },

    /**
     * Trim whitespace from the end of the generated text
     *
     * Defaults to `false`.
     */
    trimWhitespaceSuffix?: boolean,

    repeatPenalty?: false | LLamaContextualRepeatPenalty,

    /**
     * Adjust the probability of tokens being generated.
     * Can be used to bias the model to generate tokens that you want it to lean towards,
     * or to avoid generating tokens that you want it to avoid.
     */
    tokenBias?: TokenBias | (() => TokenBias),

    /**
     * See the parameter `evaluationPriority` on the `LlamaContextSequence.evaluate()` function for more information.
     */
    evaluationPriority?: EvaluationPriority,

    contextShift?: LLamaChatContextShiftOptions,

    /**
     * Custom stop triggers to stop the generation of the response when any of the provided triggers are found.
     */
    customStopTriggers?: readonly (LlamaText | string | readonly (string | Token)[])[],

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
         *
         * A number between `0` (exclusive) and `1` (inclusive).
         */
        minimumOverlapPercentageToPreventContextShift?: number
    },

    /**
     * Called as the model generates function calls with the generated parameters chunk for each function call.
     *
     * Useful for streaming the generated function call parameters as they're being generated.
     * Only useful in specific use cases,
     * such as showing the generated textual file content as it's being generated (note that doing this requires parsing incomplete JSON).
     *
     * The constructed text from all the params chunks of a given function call can be parsed as a JSON object,
     * according to the function parameters schema.
     *
     * Each function call has its own `callIndex` you can use to distinguish between them.
     *
     * Only relevant when using function calling (via passing the `functions` option).
     */
    onFunctionCallParamsChunk?: (chunk: LlamaChatResponseFunctionCallParamsChunk) => void,

    /**
     * Set the maximum number of tokens the model is allowed to spend on various segmented responses.
     */
    budgets?: {
        /**
         * Whether to include the tokens already consumed by the current model response being completed in the budget.
         *
         * Defaults to `true`.
         */
        includeCurrentResponse?: boolean,

        /**
         * Budget for thought tokens.
         *
         * Defaults to `Infinity`.
         */
        thoughtTokens?: number,

        /**
         * Budget for comment tokens.
         *
         * Defaults to `Infinity`.
         */
        commentTokens?: number
    },

    /**
     * Stop the generation when the model tries to generate a non-textual segment or call a function.
     *
     * Useful for generating completions in a form of a model response.
     *
     * Defaults to `false`.
     */
    abortOnNonText?: boolean
} & ({
    grammar?: LlamaGrammar,
    functions?: never,
    documentFunctionParams?: never,
    maxParallelFunctionCalls?: never,
    onFunctionCall?: never,
    onFunctionCallParamsChunk?: never
} | {
    grammar?: never,
    functions?: Functions | ChatModelFunctions,
    documentFunctionParams?: boolean,
    maxParallelFunctionCalls?: number,
    onFunctionCall?: (
        functionCall: LlamaChatResponseFunctionCall<Functions extends ChatModelFunctions ? Functions : ChatModelFunctions>
    ) => void,
    onFunctionCallParamsChunk?: (chunk: LlamaChatResponseFunctionCallParamsChunk) => void
});

export type LLamaChatLoadAndCompleteUserMessageOptions<Functions extends ChatModelFunctions | undefined = undefined> = {
    /**
     * Complete the given user prompt without adding it or the completion to the returned context window.
     */
    initialUserPrompt?: string,

    /**
     * When a completion already started being generated and then the signal is aborted,
     * the generation will stop and the completion will be returned as is instead of throwing an error.
     *
     * Defaults to `false`.
     */
    stopOnAbortSignal?: boolean,

    /**
     * Called as the model generates a completion with the generated text chunk.
     *
     * Useful for streaming the generated completion as it's being generated.
     */
    onTextChunk?: LLamaChatGenerateResponseOptions<Functions>["onTextChunk"],

    /**
     * Called as the model generates a completion with the generated tokens.
     *
     * Preferably, you'd want to use `onTextChunk` instead of this.
     */
    onToken?: LLamaChatGenerateResponseOptions<Functions>["onToken"],

    signal?: LLamaChatGenerateResponseOptions<Functions>["signal"],
    maxTokens?: LLamaChatGenerateResponseOptions<Functions>["maxTokens"],
    temperature?: LLamaChatGenerateResponseOptions<Functions>["temperature"],
    minP?: LLamaChatGenerateResponseOptions<Functions>["minP"],
    topK?: LLamaChatGenerateResponseOptions<Functions>["topK"],
    topP?: LLamaChatGenerateResponseOptions<Functions>["topP"],
    seed?: LLamaChatGenerateResponseOptions<Functions>["seed"],
    xtc?: LLamaChatGenerateResponseOptions<Functions>["xtc"],
    trimWhitespaceSuffix?: LLamaChatGenerateResponseOptions<Functions>["trimWhitespaceSuffix"],
    repeatPenalty?: LLamaChatGenerateResponseOptions<Functions>["repeatPenalty"],
    tokenBias?: LLamaChatGenerateResponseOptions<Functions>["tokenBias"],
    evaluationPriority?: LLamaChatGenerateResponseOptions<Functions>["evaluationPriority"],
    contextShift?: LLamaChatGenerateResponseOptions<Functions>["contextShift"],
    customStopTriggers?: LLamaChatGenerateResponseOptions<Functions>["customStopTriggers"],
    lastEvaluationContextWindow?: LLamaChatGenerateResponseOptions<Functions>["lastEvaluationContextWindow"],

    grammar?: LlamaGrammar,

    /**
     * Functions are not used by the model here,
     * but are used for keeping the instructions given to the model about the functions in the current context state,
     * to avoid context shifts.
     *
     * It's best to provide the same functions that were used for the previous prompt here.
     */
    functions?: Functions | ChatModelFunctions,

    /**
     * Functions are not used by the model here,
     * but are used for keeping the instructions given to the model about the functions in the current context state,
     * to avoid context shifts.
     *
     * It's best to provide the same value that was used for the previous prompt here.
     */
    documentFunctionParams?: boolean
};

export type LLamaChatContextShiftOptions = {
    /**
     * The number of tokens to delete from the context window to make space for new ones.
     * Defaults to 10% of the context size.
     */
    size?: number | ((sequence: LlamaContextSequence) => number | Promise<number>),

    /**
     * The strategy to use when deleting tokens from the context window.
     *
     * Defaults to `"eraseFirstResponseAndKeepFirstSystem"`.
     */
    strategy?: "eraseFirstResponseAndKeepFirstSystem" | (
        (options: {
            /** Full chat history */
            chatHistory: readonly ChatHistoryItem[],

            /** Maximum number of tokens that the new chat history should fit under when tokenized */
            maxTokensCount: number,

            /** Tokenizer used to tokenize the chat history */
            tokenizer: Tokenizer,

            /** Chat wrapper used to generate the context state */
            chatWrapper: ChatWrapper,

            /**
             * The metadata returned from the last context shift strategy call.
             * Will be `null` on the first call.
             */
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
const defaultRepeatPenaltyLastTokens = 64;
const defaultTrimWhitespaceSuffix = false;
const defaultEvaluationPriority: EvaluationPriority = 5;


export class LlamaChat {
    /** @internal */ private readonly _chatWrapper: ChatWrapper;
    /** @internal */ private readonly _disposeAggregator = new DisposeAggregator();
    /** @internal */ private readonly _autoDisposeSequence: boolean;
    /** @internal */ private readonly _chatLock = {};
    /** @internal */ private _sequence: LlamaContextSequence | null;
    public readonly onDispose = new EventRelay<void>();

    public constructor({
        contextSequence,
        chatWrapper = "auto",
        autoDisposeSequence = false
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

        this._chatWrapper = chatWrapper === "auto"
            ? resolveChatWrapper(contextSequence.model)
            : chatWrapper;
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
        options: LLamaChatGenerateResponseOptions<Functions> = {}
    ): Promise<LlamaChatResponse<Functions>> {
        const {
            onTextChunk,
            onToken,
            onResponseChunk,
            onFunctionCallParamsChunk,
            budgets,
            signal,
            stopOnAbortSignal = false,
            maxTokens,
            temperature,
            minP,
            topK,
            topP,
            seed,
            xtc,
            grammar,
            trimWhitespaceSuffix = defaultTrimWhitespaceSuffix,
            repeatPenalty = {},
            tokenBias,
            evaluationPriority = defaultEvaluationPriority,
            functions,
            onFunctionCall,
            documentFunctionParams,
            maxParallelFunctionCalls,
            contextShift = defaultContextShiftOptions,
            customStopTriggers,
            abortOnNonText = false,
            lastEvaluationContextWindow: {
                history: lastEvaluationContextWindowHistory,
                minimumOverlapPercentageToPreventContextShift = 0.5
            } = {}
        } = options;

        this.sequence.tokenPredictor?.updateInputTokens?.(
            this.model.tokenize(findLastUserMessageInChatHistory(history)?.text ?? "")
        );
        const generateResponseState = new GenerateResponseState<Functions>(
            this,
            this._chatWrapper,
            history,
            {
                onTextChunk,
                onToken,
                onResponseChunk,
                onFunctionCallParamsChunk,
                budgets,
                signal,
                stopOnAbortSignal,
                maxTokens,
                temperature,
                minP,
                topK,
                topP,
                seed,
                xtc,
                grammar: grammar as undefined, // this is a workaround to allow passing both `functions` and `grammar`
                trimWhitespaceSuffix,
                repeatPenalty,
                tokenBias,
                evaluationPriority,
                functions,
                onFunctionCall,
                documentFunctionParams,
                maxParallelFunctionCalls,
                contextShift,
                customStopTriggers,
                abortOnNonText,
                lastEvaluationContextWindow: {
                    history: lastEvaluationContextWindowHistory,
                    minimumOverlapPercentageToPreventContextShift
                }
            }
        );

        if (generateResponseState.grammar != null && generateResponseState.functionsEnabled && !abortOnNonText)
            throw new Error("Using both grammar and functions is not supported yet");

        return await withLock([this._chatLock, "evaluate"], signal, async (): Promise<LlamaChatResponse<Functions>> => {
            try {
                generateResponseState.ensureLastHistoryItemIsModel();
                generateResponseState.ensureReopenedThoughtSegmentAfterFunctionCallsIfNeeded();

                const loadContextWindow = async (avoidReloadingHistory: boolean = false) => {
                    await generateResponseState.loadContextWindow(
                        generateResponseState.getResolvedHistoryWithCurrentModelResponse(),
                        generateResponseState.getContextWindowsHistoryWithCurrentModelResponse(),
                        false,
                        avoidReloadingHistory
                    );
                };
                const loadContextWindowForFunctionCallingLoop = async () => loadContextWindow(true);

                while (true) {
                    generateResponseState.startTokenLoop();
                    generateResponseState.handleRerender();
                    const shouldHandlePrefixTriggers = generateResponseState.isRerender;

                    generateResponseState.canAvoidReloadingHistory = false;
                    await loadContextWindow();
                    generateResponseState.isRerender = false;

                    generateResponseState.addStopGenerationTriggersFromChatWrapper();

                    if (generateResponseState.generatedTokens === 0) {
                        generateResponseState.addIgnoreStartTextTriggersFromChatWrapper();

                        if (generateResponseState.functionsEnabled) {
                            generateResponseState.initFunctions();
                        }
                    }

                    const abortRes = generateResponseState.handleAbortTrigger("model");
                    if (abortRes != null)
                        return abortRes;

                    if (shouldHandlePrefixTriggers) {
                        const handlePrefixTriggersRes = await generateResponseState.handlePrefixTriggers(
                            loadContextWindowForFunctionCallingLoop
                        );
                        if (handlePrefixTriggersRes != null)
                            return handlePrefixTriggersRes;
                    }

                    if (generateResponseState.functionEvaluationMode !== false && !generateResponseState.abortOnNonText) {
                        const functionsCallsRes = await generateResponseState.enterFunctionCallingLoop(
                            loadContextWindowForFunctionCallingLoop
                        );
                        if (functionsCallsRes != null)
                            return functionsCallsRes;

                        await loadContextWindowForFunctionCallingLoop();
                    }

                    await generateResponseState.alignCurrentSequenceStateWithCurrentTokens();
                    await generateResponseState.createNewEvaluationIterator();

                    while (await generateResponseState.iterateEvaluation()) {
                        if (!generateResponseState.holdPartialTokensForNextEvaluation()) {
                            generateResponseState.waitOnPartialCharactersOrWhiteSpaceTokens();

                            generateResponseState.detectAndHandleFunctionStartSyntax();
                            if (generateResponseState.functionEvaluationMode !== false) {
                                generateResponseState.canAvoidReloadingHistory = false;
                                generateResponseState.releasePartiallyFreeTokensBeforeFunctionCallStart();
                                const functionsCallsRes = await generateResponseState.enterFunctionCallingLoop(
                                    loadContextWindowForFunctionCallingLoop
                                );
                                if (functionsCallsRes != null)
                                    return functionsCallsRes;
                            }

                            generateResponseState.recordStopGenerationEvaluation();

                            generateResponseState.popStreamRegulatorFreeTokens();
                            generateResponseState.removeFoundStartIgnoreTextsFromPendingTokens();

                            const stopGenerationTriggerRes = generateResponseState.handleStopGenerationTrigger("model");
                            if (stopGenerationTriggerRes != null)
                                return stopGenerationTriggerRes;

                            generateResponseState.spliceIgnoreStartTextDetectedTokens();

                            generateResponseState.moveFreePendingTokensToRes();
                        }

                        const maxTokensTriggerRes = generateResponseState.handleMaxTokensTrigger("model");
                        if (maxTokensTriggerRes != null)
                            return maxTokensTriggerRes;

                        if (generateResponseState.handleShouldRerender() || generateResponseState.updateShouldContextShift())
                            break;

                        if (await generateResponseState.handleBudgetTriggers()) {
                            generateResponseState.shouldRerender = true;
                            generateResponseState.skipClosingResponseItemOnRerender = true;
                            break;
                        }

                        if (generateResponseState.handleShouldRerender() || generateResponseState.updateShouldContextShift())
                            break;

                        const abortRes = generateResponseState.handleAbortTrigger("model");
                        if (abortRes != null)
                            return abortRes;
                    }

                    generateResponseState.isFirstEvaluation = false;

                    if (generateResponseState.shouldRerender || generateResponseState.shouldContextShift)
                        continue;

                    break;
                }

                throw new Error("The context size is too small to generate a response");
            } finally {
                await generateResponseState.dispose();
            }
        });
    }

    public async loadChatAndCompleteUserMessage<const Functions extends ChatModelFunctions | undefined = undefined>(
        history: ChatHistoryItem[],
        options: LLamaChatLoadAndCompleteUserMessageOptions<Functions> = {}
    ): Promise<LlamaChatLoadAndCompleteUserResponse> {
        const {
            initialUserPrompt = "",
            stopOnAbortSignal = false,
            onTextChunk,
            onToken,
            signal,
            maxTokens = defaultMaxPreloadTokens(this.sequence),
            temperature,
            minP,
            topK,
            topP,
            seed,
            xtc,
            grammar,
            trimWhitespaceSuffix = defaultTrimWhitespaceSuffix,
            repeatPenalty = {},
            tokenBias,
            evaluationPriority = defaultEvaluationPriority,
            functions,
            documentFunctionParams,
            contextShift = defaultContextShiftOptions,
            customStopTriggers,
            lastEvaluationContextWindow: {
                history: lastEvaluationContextWindowHistory,
                minimumOverlapPercentageToPreventContextShift = 0.8
            } = {}
        } = options;

        this.sequence.tokenPredictor?.updateInputTokens?.(
            this.model.tokenize(
                (findLastModelMessageInChatHistory(history)?.response ?? [])
                    .map((item) => {
                        if (typeof item === "string")
                            return item;
                        else if (isChatModelResponseFunctionCall(item))
                            return null;
                        else if (isChatModelResponseSegment(item))
                            return item.text;

                        void (item satisfies never);
                        return null;
                    })
                    .filter((item) => item != null)
                    .join(" ")
            )
        );

        const generateResponseState = new GenerateResponseState<Functions>(
            this,
            this._chatWrapper,
            mergeGeneratedResultWithChatHistory(
                "user",
                history,
                [initialUserPrompt]
            ),
            {
                onTextChunk,
                onToken,
                signal,
                stopOnAbortSignal,
                maxTokens,
                temperature,
                minP,
                topK,
                topP,
                seed,
                xtc,
                grammar: grammar as undefined, // this is a workaround to allow passing both `functions` and `grammar`
                trimWhitespaceSuffix,
                repeatPenalty,
                tokenBias,
                evaluationPriority,
                functions,
                documentFunctionParams,
                contextShift,
                customStopTriggers,
                lastEvaluationContextWindow: {
                    history: mergeGeneratedResultWithChatHistory(
                        "user",
                        lastEvaluationContextWindowHistory ?? history,
                        [initialUserPrompt]
                    ),
                    minimumOverlapPercentageToPreventContextShift
                }
            }
        );

        return await withLock([this._chatLock, "evaluate"], signal, async (): Promise<LlamaChatLoadAndCompleteUserResponse> => {
            try {
                generateResponseState.ensureLastHistoryItemIsUser();

                while (true) {
                    generateResponseState.startTokenLoop();
                    const {userTextSuffix} = await generateResponseState.loadContextWindow(
                        mergeGeneratedResultWithChatHistory(
                            "user",
                            generateResponseState.resolvedHistory,
                            generateResponseState.segmentHandler.getModelResponseSegments()
                        ),
                        mergeGeneratedResultWithChatHistory(
                            "user",
                            generateResponseState.lastContextWindowHistory,
                            generateResponseState.segmentHandler.getContextWindowModelResponseSegments()
                        ),
                        true
                    );
                    generateResponseState.isRerender = false;
                    generateResponseState.functionEvaluationMode = false;

                    generateResponseState.addStopGenerationTriggersFromChatWrapper();

                    if (userTextSuffix != null && userTextSuffix.values.length > 0)
                        generateResponseState.stopGenerationDetector.addStopTrigger(
                            StopGenerationDetector.resolveLlamaTextTrigger(userTextSuffix, this.model.tokenizer)
                        );

                    generateResponseState.rerenderTriggers.forEach((trigger) => (
                        generateResponseState.stopGenerationDetector.addStopTrigger(
                            StopGenerationDetector.resolveLlamaTextTrigger(trigger, this.model.tokenizer)
                        )
                    ));

                    allSegmentTypes
                        .map((segmentType) => getChatWrapperSegmentDefinition(this._chatWrapper.settings, segmentType))
                        .filter((segmentDefinition) => segmentDefinition != null)
                        .flatMap((segmentDefinition) => [segmentDefinition?.prefix, segmentDefinition?.suffix])
                        .filter((trigger) => trigger != null)
                        .forEach((trigger) => (
                            generateResponseState.stopGenerationDetector.addStopTrigger(
                                StopGenerationDetector.resolveLlamaTextTrigger(LlamaText(trigger), this.model.tokenizer)
                            )
                        ));

                    await generateResponseState.alignCurrentSequenceStateWithCurrentTokens();

                    if (generateResponseState.maxTokens === 0) {
                        await generateResponseState.evaluateWithoutGeneratingNewTokens();

                        return {
                            completion: "",
                            lastEvaluation: {
                                contextWindow: mergeGeneratedResultWithChatHistory(
                                    "user",
                                    generateResponseState.lastContextWindowHistory,
                                    generateResponseState.segmentHandler.getContextWindowModelResponseSegments()
                                ),
                                contextShiftMetadata: generateResponseState.lastHistoryCompressionMetadata
                            },
                            metadata: {
                                stopReason: "maxTokens"
                            }
                        };
                    }

                    await generateResponseState.createNewEvaluationIterator();
                    while (await generateResponseState.iterateEvaluation()) {
                        if (!generateResponseState.holdPartialTokensForNextEvaluation()) {
                            generateResponseState.waitOnPartialCharactersOrWhiteSpaceTokens();

                            generateResponseState.recordStopGenerationEvaluation();

                            generateResponseState.popStreamRegulatorFreeTokens();

                            const someOfCurrentTokensAreSpecial = generateResponseState.currentTokens.some((token) => (
                                this.model.isSpecialToken(token)
                            ));
                            const stopGenerationTriggerRes = generateResponseState.handleStopGenerationTrigger(
                                "user",
                                someOfCurrentTokensAreSpecial
                                    ? "eogToken"
                                    : undefined
                            );
                            if (stopGenerationTriggerRes != null)
                                return {
                                    completion: stopGenerationTriggerRes.response,
                                    lastEvaluation: {
                                        contextWindow: mergeGeneratedResultWithChatHistory(
                                            "user",
                                            generateResponseState.lastContextWindowHistory,
                                            generateResponseState.segmentHandler.getContextWindowModelResponseSegments()
                                        ),
                                        contextShiftMetadata: stopGenerationTriggerRes.lastEvaluation.contextShiftMetadata
                                    },
                                    metadata: stopGenerationTriggerRes.metadata.stopReason === "customStopTrigger"
                                        ? stopGenerationTriggerRes.metadata
                                        : stopGenerationTriggerRes.metadata
                                };

                            generateResponseState.moveFreePendingTokensToRes(false);
                        }

                        const maxTokensTriggerRes = generateResponseState.handleMaxTokensTrigger("user");
                        if (maxTokensTriggerRes != null)
                            return {
                                completion: maxTokensTriggerRes.response,
                                lastEvaluation: {
                                    contextWindow: mergeGeneratedResultWithChatHistory(
                                        "user",
                                        generateResponseState.lastContextWindowHistory,
                                        generateResponseState.segmentHandler.getContextWindowModelResponseSegments()
                                    ),
                                    contextShiftMetadata: maxTokensTriggerRes.lastEvaluation.contextShiftMetadata
                                },
                                metadata: maxTokensTriggerRes.metadata
                            };

                        if (generateResponseState.updateShouldContextShift())
                            break;

                        const abortRes = generateResponseState.handleAbortTrigger("user");
                        if (abortRes != null)
                            return {
                                completion: abortRes.response,
                                lastEvaluation: {
                                    contextWindow: mergeGeneratedResultWithChatHistory(
                                        "user",
                                        generateResponseState.lastContextWindowHistory,
                                        generateResponseState.segmentHandler.getContextWindowModelResponseSegments()
                                    ),
                                    contextShiftMetadata: abortRes.lastEvaluation.contextShiftMetadata
                                },
                                metadata: abortRes.metadata
                            };
                    }

                    generateResponseState.isFirstEvaluation = false;

                    if (generateResponseState.shouldContextShift)
                        continue;

                    break;
                }

                throw new Error("The context size is too small to generate a completion");
            } finally {
                await generateResponseState.dispose();
            }
        });
    }
}

export type LlamaChatResponse<Functions extends ChatModelFunctions | undefined = undefined> = {
    /**
     * The response text only, _without_ any text segments (like thoughts).
     */
    response: string,

    /**
     * The full response, including all text and text segments (like thoughts).
     */
    fullResponse: Array<string | LlamaChatResponseSegment>,
    functionCalls?: Functions extends ChatModelFunctions
        ? LlamaChatResponseFunctionCall<Functions>[]
        : never,
    lastEvaluation: {
        cleanHistory: ChatHistoryItem[],
        contextWindow: ChatHistoryItem[],
        contextShiftMetadata: any
    },
    metadata: {
        remainingGenerationAfterStop?: string | Token[],
        stopReason: "eogToken" | "stopGenerationTrigger" | "functionCalls" | "maxTokens" | "abort"
    } | {
        remainingGenerationAfterStop?: string | Token[],
        stopReason: "customStopTrigger",
        customStopTrigger: (string | Token)[]
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
    raw: LlamaTextJSON
};

export type LlamaChatResponseSegment = {
    type: "segment",
    segmentType: ChatModelSegmentType,
    text: string,
    ended: boolean,
    raw: LlamaTextJSON,
    startTime?: string,
    endTime?: string
};

export type LlamaChatLoadAndCompleteUserResponse = {
    completion: string,
    lastEvaluation: {
        /**
         * The completion and initial user prompt are not added to this context window result,
         * but are loaded to the current context sequence state as tokens
         */
        contextWindow: ChatHistoryItem[],
        contextShiftMetadata: any
    },
    metadata: {
        remainingGenerationAfterStop?: string | Token[],
        stopReason: "eogToken" | "stopGenerationTrigger" | "maxTokens" | "abort"
    } | {
        remainingGenerationAfterStop?: string | Token[],
        stopReason: "customStopTrigger",
        customStopTrigger: (string | Token)[]
    }
};

function removeRawFromHistoryItem<Item extends ChatHistoryItem>(historyItem: Item): Item {
    if (historyItem.type === "model") {
        const newHistoryItem: ChatModelResponse = {...historyItem};
        newHistoryItem.response = newHistoryItem.response.map((item) => {
            if (typeof item === "string")
                return item;
            else if (isChatModelResponseFunctionCall(item))
                return {
                    ...item,
                    rawCall: undefined
                };
            else if (isChatModelResponseSegment(item))
                return {
                    ...item,
                    raw: undefined
                };

            void (item satisfies never);
            return item;
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
    contextShiftStrategy: LLamaChatContextShiftOptions["strategy"],
    contextShiftLastEvaluationMetadata: LLamaChatContextShiftOptions["lastEvaluationMetadata"],
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
        const {contextText} = chatWrapper.generateContextState({
            chatHistory: history,
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

function getLastModelMessageFullResponseFromChatHistory(chatHistory: ChatHistoryItem[]) {
    const lastModelResponseItem = chatHistory.at(-1);
    if (lastModelResponseItem == null || lastModelResponseItem.type !== "model")
        return [];

    return lastModelResponseItem.response;
}

function getLastUserTextFromChatHistory(chatHistory: readonly ChatHistoryItem[]) {
    if (chatHistory.length === 0 || chatHistory[chatHistory.length - 1]!.type !== "user")
        return "";

    return (chatHistory[chatHistory.length - 1] as ChatUserMessage).text;
}

function setLastUserTextInChatHistory(chatHistory: readonly ChatHistoryItem[], userText: string) {
    const newChatHistory = chatHistory.slice();
    if (newChatHistory.length === 0 || newChatHistory[newChatHistory.length - 1]!.type !== "user")
        newChatHistory.push({
            type: "user",
            text: ""
        });

    const lastUserItem = newChatHistory[newChatHistory.length - 1] as ChatUserMessage;
    const newLastUserItem = {...lastUserItem};
    newChatHistory[newChatHistory.length - 1] = newLastUserItem;

    newLastUserItem.text = userText;

    return newChatHistory;
}

function mergeGeneratedResultWithChatHistory(
    itemType: "user" | "model", chatHistory: ChatHistoryItem[], generatedResult: ChatSegments | string[]
) {
    if (generatedResult.length === 0 || (generatedResult.length === 1 && generatedResult[0] === ""))
        return chatHistory;

    const newChatHistory = chatHistory.slice();

    if (itemType === "user") {
        let lastUserItem = newChatHistory.at(-1);
        if (lastUserItem?.type !== "user") {
            lastUserItem = {
                type: "user",
                text: ""
            };
            newChatHistory.push(lastUserItem);
        }

        const newLastUserItem = {...lastUserItem};
        newChatHistory[newChatHistory.length - 1] = newLastUserItem;

        newLastUserItem.text += generatedResult
            .map((item) => {
                if (typeof item === "string")
                    return item;

                return item.text;
            })
            .join("");

        return newChatHistory;
    } else {
        let lastModelItem = newChatHistory.at(-1);
        if (lastModelItem?.type !== "model") {
            lastModelItem = {
                type: "model",
                response: []
            };
            newChatHistory.push(lastModelItem);
        }

        const newLastModelItem = {...lastModelItem};
        newChatHistory[newChatHistory.length - 1] = newLastModelItem;

        const modelResponse = newLastModelItem.response.slice();
        newLastModelItem.response = modelResponse;

        const firstGeneratedResultItem = generatedResult[0];
        if (firstGeneratedResultItem == null)
            return newChatHistory;

        const lastModelResponseItem = modelResponse.at(-1);
        if (typeof firstGeneratedResultItem === "string" && typeof lastModelResponseItem === "string") {
            modelResponse[modelResponse.length - 1] = lastModelResponseItem + firstGeneratedResultItem;
        } else if (
            typeof firstGeneratedResultItem !== "string" && isChatModelResponseSegment(firstGeneratedResultItem) &&
            typeof lastModelResponseItem !== "string" && isChatModelResponseSegment(lastModelResponseItem) &&
            !lastModelResponseItem.ended && lastModelResponseItem.segmentType === firstGeneratedResultItem.segmentType
        ) {
            modelResponse[modelResponse.length - 1] = {
                ...lastModelResponseItem,
                ...firstGeneratedResultItem,
                text: lastModelResponseItem.text + firstGeneratedResultItem.text,
                ended: firstGeneratedResultItem.ended,
                raw: (lastModelResponseItem.raw != null && firstGeneratedResultItem.raw != null)
                    ? LlamaText([
                        LlamaText.fromJSON(lastModelResponseItem.raw),
                        LlamaText.fromJSON(firstGeneratedResultItem.raw)
                    ]).toJSON()
                    : undefined,
                startTime: lastModelResponseItem.startTime,
                endTime: firstGeneratedResultItem.endTime
            };
        } else
            modelResponse.push(firstGeneratedResultItem);

        pushAll(modelResponse, generatedResult.slice(1));

        return newChatHistory;
    }
}

function findLastUserMessageInChatHistory(chatHistory: readonly ChatHistoryItem[]) {
    for (let i = chatHistory.length - 1; i >= 0; i--) {
        const item = chatHistory[i]!;
        if (item.type === "user")
            return item;
    }

    return undefined;
}

function findLastModelMessageInChatHistory(chatHistory: readonly ChatHistoryItem[]) {
    for (let i = chatHistory.length - 1; i >= 0; i--) {
        const item = chatHistory[i]!;
        if (item.type === "model")
            return item;
    }

    return undefined;
}

function generateContextText(
    endWithUserText: boolean,
    chatWrapper: ChatWrapper,
    options: Parameters<typeof chatWrapper.generateContextState>[0]
): ReturnType<typeof generateContextTextThatEndsWithUserText> {
    if (endWithUserText)
        return generateContextTextThatEndsWithUserText(chatWrapper, options);

    return chatWrapper.generateContextState(options);
}

function generateContextTextThatEndsWithUserText(
    chatWrapper: ChatWrapper, options: Parameters<typeof chatWrapper.generateContextState>[0]
): ReturnType<typeof chatWrapper.generateContextState> & {
    userTextSuffix?: LlamaText
} {
    const lastUserText = getLastUserTextFromChatHistory(options.chatHistory);
    const randomId = "W" + (Math.random()
        .toString(36)
        .slice(2)) + "W";
    const {contextText, ...rest} = chatWrapper.generateContextState({
        ...options,
        chatHistory: setLastUserTextInChatHistory(options.chatHistory, lastUserText + randomId)
    });

    for (let i = 0; i < contextText.values.length; i++) {
        const item = contextText.values[i];
        if (typeof item !== "string")
            continue;

        const randomTextIndex = item.indexOf(randomId);
        if (randomTextIndex < 0)
            continue;

        const newValue = item.slice(0, randomTextIndex);
        return {
            contextText: LlamaText([
                ...contextText.values.slice(0, i),
                newValue
            ]),
            userTextSuffix: LlamaText([
                item.slice(randomTextIndex + randomId.length),
                ...contextText.values.slice(i + 1)
            ]),
            ...rest
        };
    }

    throw new Error("The random ID was not found in the context text. " +
        `There might be an issue with the chat wrapper "${chatWrapper.wrapperName}" ` +
        "where not all user messages are properly added to the the result LlamaText"
    );
}

async function getContextWindow({
    resolvedHistory, resolvedContextShift,
    lastHistoryCompressionMetadata, pendingTokensCount = 0, isFirstEvaluation, isRerender,
    chatWrapper, lastEvaluationContextWindowHistory, minimumOverlapPercentageToPreventContextShift,
    sequence, minFreeContextTokens = 1, functions, documentFunctionParams, endWithUserText
}: {
    resolvedHistory: ChatHistoryItem[], resolvedContextShift: Required<LLamaChatContextShiftOptions>,
    lastHistoryCompressionMetadata: object | null | undefined, pendingTokensCount: number, isFirstEvaluation: boolean, isRerender: boolean,
    chatWrapper: ChatWrapper, lastEvaluationContextWindowHistory?: ChatHistoryItem[], minimumOverlapPercentageToPreventContextShift: number,
    sequence?: LlamaContextSequence, minFreeContextTokens?: number, functions?: ChatModelFunctions,
    documentFunctionParams?: boolean, endWithUserText: boolean
}): Promise<{
    history: ChatHistoryItem[], stopGenerationTriggers: LlamaText[], tokens: Token[],
    removeRawFromHistory: boolean, newHistoryCompressionMetadata: object | null | undefined,
    ignoreStartText: LlamaText[], functionCallInitiallyEngaged: boolean,
    disengageInitiallyEngagedFunctionCall: LlamaText[], userTextSuffix?: LlamaText,
    prefixTriggers: ChatWrapperGeneratedContextState["prefixTriggers"],
    noPrefixTrigger: ChatWrapperGeneratedContextState["noPrefixTrigger"],
    rerender: ChatWrapperGeneratedContextState["rerender"],
    detectFunctionCalls: ChatWrapperGeneratedContextState["detectFunctionCalls"]
}> {
    if (sequence == null)
        throw new DisposedError();

    const model = sequence.model;
    const context = sequence.context;
    let removeRawFromHistory = false;

    if ((isFirstEvaluation || isRerender) && lastEvaluationContextWindowHistory != null && sequence.isLoadedToMemory) {
        const newContextWindow = lastEvaluationContextWindowHistory.slice();

        if (endWithUserText) {
            if (newContextWindow.length === 0 || newContextWindow[newContextWindow.length - 1]!.type !== "user")
                newContextWindow.push({
                    type: "user",
                    text: ""
                });
        } else if (newContextWindow.length === 0 || newContextWindow[newContextWindow.length - 1]!.type !== "model")
            newContextWindow.push({
                type: "model",
                response: []
            });

        const {
            contextText, stopGenerationTriggers, ignoreStartText, functionCall, userTextSuffix,
            prefixTriggers, noPrefixTrigger, rerender, detectFunctionCalls
        } = generateContextText(
            endWithUserText,
            chatWrapper,
            {
                chatHistory: newContextWindow,
                availableFunctions: functions,
                documentFunctionParams
            }
        );
        const tokens = contextText.tokenize(model.tokenizer);
        if (tokens.length + pendingTokensCount + minFreeContextTokens < context.contextSize) {
            const {firstDifferentIndex} = sequence.compareContextTokens(tokens);

            const existingEvaluationPercentage = firstDifferentIndex / tokens.length;

            if (isRerender || existingEvaluationPercentage >= minimumOverlapPercentageToPreventContextShift)
                return {
                    history: newContextWindow,
                    stopGenerationTriggers,
                    tokens,
                    removeRawFromHistory,
                    newHistoryCompressionMetadata: lastHistoryCompressionMetadata,
                    ignoreStartText: ignoreStartText ?? [],
                    functionCallInitiallyEngaged: functionCall?.initiallyEngaged ?? false,
                    disengageInitiallyEngagedFunctionCall: functionCall?.disengageInitiallyEngaged ?? [],
                    userTextSuffix,
                    prefixTriggers,
                    noPrefixTrigger,
                    rerender,
                    detectFunctionCalls
                };
        }
    }

    removeRawFromHistory = !sequence.isLoadedToMemory;
    resolvedHistory = removeRawFromHistory
        ? resolvedHistory.map(removeRawFromHistoryItem)
        : resolvedHistory.slice();

    if (resolvedContextShift.lastEvaluationMetadata != null) {
        const contextShiftSize = resolvedContextShift.size instanceof Function
            ? await resolvedContextShift.size(sequence)
            : resolvedContextShift.size;

        const {compressedHistory, metadata} = await compressHistoryToFitContextSize({
            history: resolvedHistory,
            contextShiftSize: Math.max(
                minFreeContextTokens,
                Math.min(contextShiftSize, context.contextSize - pendingTokensCount)
            ) + pendingTokensCount,
            contextShiftStrategy: resolvedContextShift.strategy,
            contextShiftLastEvaluationMetadata: resolvedContextShift.lastEvaluationMetadata,
            contextSize: context.contextSize,
            tokenizer: model.tokenizer,
            chatWrapper: chatWrapper,
            functions,
            documentFunctionParams
        });

        const {
            contextText, stopGenerationTriggers, ignoreStartText, functionCall, userTextSuffix,
            prefixTriggers, noPrefixTrigger, rerender, detectFunctionCalls
        } = generateContextText(
            endWithUserText,
            chatWrapper,
            {
                chatHistory: compressedHistory,
                availableFunctions: functions,
                documentFunctionParams
            }
        );

        return {
            history: compressedHistory,
            stopGenerationTriggers,
            tokens: contextText.tokenize(model.tokenizer),
            removeRawFromHistory,
            newHistoryCompressionMetadata: metadata,
            ignoreStartText: ignoreStartText ?? [],
            functionCallInitiallyEngaged: functionCall?.initiallyEngaged ?? false,
            disengageInitiallyEngagedFunctionCall: functionCall?.disengageInitiallyEngaged ?? [],
            userTextSuffix,
            prefixTriggers,
            noPrefixTrigger,
            rerender,
            detectFunctionCalls
        };
    }

    {
        const {
            contextText, stopGenerationTriggers, ignoreStartText, functionCall, userTextSuffix,
            prefixTriggers, noPrefixTrigger, rerender, detectFunctionCalls
        } = generateContextText(
            endWithUserText,
            chatWrapper,
            {
                chatHistory: resolvedHistory,
                availableFunctions: functions,
                documentFunctionParams
            }
        );
        const tokens = contextText.tokenize(model.tokenizer);

        if (tokens.length + pendingTokensCount + minFreeContextTokens < context.contextSize)
            return {
                history: resolvedHistory,
                stopGenerationTriggers,
                tokens,
                removeRawFromHistory,
                newHistoryCompressionMetadata: lastHistoryCompressionMetadata,
                ignoreStartText: ignoreStartText ?? [],
                functionCallInitiallyEngaged: functionCall?.initiallyEngaged ?? false,
                disengageInitiallyEngagedFunctionCall: functionCall?.disengageInitiallyEngaged ?? [],
                userTextSuffix,
                prefixTriggers,
                noPrefixTrigger,
                rerender,
                detectFunctionCalls
            };
    }

    const contextShiftSize = Math.min(
        context.contextSize,
        Math.max(
            1,
            Math.floor(
                resolvedContextShift.size instanceof Function
                    ? await resolvedContextShift.size(sequence)
                    : resolvedContextShift.size
            )
        )
    );

    const {compressedHistory, metadata} = await compressHistoryToFitContextSize({
        history: resolvedHistory,
        contextShiftSize: Math.max(
            minFreeContextTokens,
            Math.min(contextShiftSize, context.contextSize - pendingTokensCount)
        ) + pendingTokensCount,
        contextShiftStrategy: resolvedContextShift.strategy,
        contextShiftLastEvaluationMetadata: resolvedContextShift.lastEvaluationMetadata,
        contextSize: context.contextSize,
        tokenizer: model.tokenizer,
        chatWrapper: chatWrapper,
        functions,
        documentFunctionParams
    });

    const {
        contextText, stopGenerationTriggers, ignoreStartText, functionCall, userTextSuffix,
        prefixTriggers, noPrefixTrigger, rerender, detectFunctionCalls
    } = generateContextText(
        endWithUserText,
        chatWrapper,
        {
            chatHistory: compressedHistory,
            availableFunctions: functions,
            documentFunctionParams
        }
    );

    return {
        history: compressedHistory,
        stopGenerationTriggers,
        tokens: contextText.tokenize(model.tokenizer),
        removeRawFromHistory,
        newHistoryCompressionMetadata: metadata,
        ignoreStartText: ignoreStartText ?? [],
        functionCallInitiallyEngaged: functionCall?.initiallyEngaged ?? false,
        disengageInitiallyEngagedFunctionCall: functionCall?.disengageInitiallyEngaged ?? [],
        userTextSuffix,
        prefixTriggers,
        noPrefixTrigger,
        rerender,
        detectFunctionCalls
    };
}

class GenerateResponseState<const Functions extends ChatModelFunctions | undefined = undefined> {
    private readonly llamaChat: LlamaChat;
    private readonly chatWrapper: ChatWrapper;

    private readonly history: ChatHistoryItem[];
    private readonly onTextChunk: LLamaChatGenerateResponseOptions<Functions>["onTextChunk"];
    private readonly onToken: LLamaChatGenerateResponseOptions<Functions>["onToken"];
    private readonly onResponseChunk: LLamaChatGenerateResponseOptions<Functions>["onResponseChunk"];
    private readonly onFunctionCallParamsChunk: LLamaChatGenerateResponseOptions<Functions>["onFunctionCallParamsChunk"];
    private readonly budgets: LLamaChatGenerateResponseOptions<Functions>["budgets"];
    private readonly signal: LLamaChatGenerateResponseOptions<Functions>["signal"];
    private readonly stopOnAbortSignal: LLamaChatGenerateResponseOptions<Functions>["stopOnAbortSignal"];
    public readonly maxTokens: LLamaChatGenerateResponseOptions<Functions>["maxTokens"];
    private readonly temperature: LLamaChatGenerateResponseOptions<Functions>["temperature"];
    private readonly minP: LLamaChatGenerateResponseOptions<Functions>["minP"];
    private readonly topK: LLamaChatGenerateResponseOptions<Functions>["topK"];
    private readonly topP: LLamaChatGenerateResponseOptions<Functions>["topP"];
    private readonly seed: LLamaChatGenerateResponseOptions<Functions>["seed"];
    private readonly xtc: LLamaChatGenerateResponseOptions<Functions>["xtc"];
    public readonly grammar: LLamaChatGenerateResponseOptions<Functions>["grammar"];
    private readonly trimWhitespaceSuffix: LLamaChatGenerateResponseOptions<Functions>["trimWhitespaceSuffix"];
    private readonly tokenBias: LLamaChatGenerateResponseOptions<Functions>["tokenBias"];
    private readonly evaluationPriority: LLamaChatGenerateResponseOptions<Functions>["evaluationPriority"];
    private readonly functions: LLamaChatGenerateResponseOptions<Functions>["functions"];
    private readonly onFunctionCall: LLamaChatGenerateResponseOptions<Functions>["onFunctionCall"];
    private readonly documentFunctionParams: LLamaChatGenerateResponseOptions<Functions>["documentFunctionParams"];
    private readonly maxParallelFunctionCalls: LLamaChatGenerateResponseOptions<Functions>["maxParallelFunctionCalls"];
    private readonly contextShift: LLamaChatGenerateResponseOptions<Functions>["contextShift"];
    private readonly customStopTriggers: LLamaChatGenerateResponseOptions<Functions>["customStopTriggers"];
    public readonly abortOnNonText: boolean;
    private readonly minimumOverlapPercentageToPreventContextShift: Exclude<Exclude<LLamaChatGenerateResponseOptions<Functions>["lastEvaluationContextWindow"], undefined>["minimumOverlapPercentageToPreventContextShift"], undefined>;

    public readonly functionsEnabled: boolean;
    private readonly repeatPenaltyEnabled: boolean;
    private readonly resolvedContextShift: Required<LLamaChatContextShiftOptions>;
    private readonly resolvedRepeatPenalty: LLamaContextualRepeatPenalty & {
        lastTokens: number
    };
    private readonly grammarEvaluationState: LlamaGrammarEvaluationState | undefined;
    private readonly functionNameGrammar?: FunctionCallNameGrammar<NonNullable<Functions>>;
    private functionsGrammar?: FunctionCallNameGrammar<NonNullable<Functions>> | FunctionCallParamsGrammar<NonNullable<Functions>>;
    private functionsEvaluationState: LlamaGrammarEvaluationState | undefined;
    public functionSyntaxStartDetectorEnabled: boolean = true;

    private readonly streamRegulator = new TokenStreamRegulator();
    public readonly stopGenerationDetector = new StopGenerationDetector();
    private readonly customStopGenerationTriggersDetector = new StopGenerationDetector();
    private readonly functionSyntaxStartDetector = new StopGenerationDetector();
    private readonly disengageInitiallyEngagedFunctionMode = new StopGenerationDetector();
    private readonly ignoreStartTextDetector = new StopGenerationDetector();
    private readonly locksToReleaseOnValidGeneration: QueuedTokenReleaseLock[] = [];

    public resolvedHistory: ChatHistoryItem[];
    private noRawInResolvedHistory: boolean;

    public readonly res: Token[] = [];
    public readonly pendingTokens: Token[] = [];
    public ignoredStartTextTokens: Token[] = [];
    public prefixTriggerTokens: Token[] = [];
    public readonly resFunctionCalls: Array<{
        functionName: string,
        params: any,
        raw: LlamaText
    }> = [];
    public readonly segmentHandler: SegmentHandler;
    public readonly pendingPartialTokens: Token[] = [];

    public functionEvaluationMode: false | "prefixOrDisengage" | "functionName" | "params" | "sectionSuffixOrBetweenCalls" = false;
    private currentFunctionCallPreviousText: LlamaText = LlamaText([]);
    private readonly currentFunctionCallCurrentPartTokens: Token[] = [];
    private functionEvaluationFunctionName: string = "";
    private currentFunctionCallPreviousPartLeftoverText: string = "";
    private removedStartTextToIgnore: boolean = false;
    private releasedPartiallyFreeTokensBeforeFunctionCallStartSyntax: boolean = false;

    public generatedTokens = 0;
    public isFirstEvaluation = true;
    public isRerender = true; // first render is a rerender
    public initiallyEngagedFunctionMode = false;
    public lastContextWindowHistory: ChatHistoryItem[];
    public lastHistoryCompressionMetadata: object | null | undefined;
    private restartEvaluationIterator = false;

    // context shift loop
    public shouldContextShift = false;
    public shouldRerender = false;
    public skipClosingResponseItemOnRerender = false;
    public shouldAbortBecauseOfNonText: boolean = false;

    public canAvoidReloadingHistory: boolean = false;
    public contextWindowTokens: Token[] = [];
    public stopGenerationTriggers: LlamaText[] = [];
    public ignoreStartText: LlamaText[] = [];
    public functionCallInitiallyEngaged: boolean = false;
    public disengageInitiallyEngagedFunctionCall: LlamaText[] = [];
    public userTextSuffix?: LlamaText = undefined;

    public prefixTriggerDetectors: Map<StopGenerationDetector, {
        inject?: LlamaText,
        trigger: Exclude<ChatWrapperGeneratedContextState["prefixTriggers"], undefined>[number]
    }> = new Map();
    public noPrefixTrigger: ChatWrapperGeneratedContextState["noPrefixTrigger"] = undefined;
    public rerenderTriggers: LlamaText[] = [];
    public rerenderTriggerDetector: StopGenerationDetector = new StopGenerationDetector();
    public rerenderActions: Exclude<ChatWrapperGeneratedContextState["rerender"], undefined>["action"] = undefined;

    public tokens: Token[] = [];

    // token evaluation loop
    public evaluationIterator?: AsyncGenerator<Token, void | Token>;
    public currentIteration?: IteratorResult<Token, void | Token>;
    public currentIterationReplacementToken?: Token;
    public currentToken?: Token;
    public currentTokens: Token[] = [];
    public currentText: string = "";
    public currentQueuedTokenRelease?: QueuedTokenRelease;

    public constructor(
        llamaChat: LlamaChat,
        chatWrapper: ChatWrapper,
        history: ChatHistoryItem[],
        {
            onTextChunk,
            onToken,
            onResponseChunk,
            onFunctionCallParamsChunk,
            budgets,
            signal,
            stopOnAbortSignal = false,
            maxTokens,
            temperature,
            minP,
            topK,
            topP,
            seed,
            xtc,
            grammar,
            trimWhitespaceSuffix = defaultTrimWhitespaceSuffix,
            repeatPenalty = {},
            tokenBias,
            evaluationPriority = defaultEvaluationPriority,
            functions,
            onFunctionCall,
            documentFunctionParams,
            maxParallelFunctionCalls,
            contextShift = defaultContextShiftOptions,
            customStopTriggers,
            abortOnNonText,
            lastEvaluationContextWindow: {
                history: lastEvaluationContextWindowHistory,
                minimumOverlapPercentageToPreventContextShift = 0.5
            } = {}
        }: LLamaChatGenerateResponseOptions<Functions> = {}
    ) {
        this.llamaChat = llamaChat;
        this.chatWrapper = chatWrapper;

        this.history = history;
        this.onTextChunk = safeEventCallback(onTextChunk);
        this.onToken = safeEventCallback(onToken);
        this.onResponseChunk = safeEventCallback(onResponseChunk);
        this.onFunctionCallParamsChunk = safeEventCallback(onFunctionCallParamsChunk);
        this.budgets = budgets;
        this.signal = signal;
        this.stopOnAbortSignal = stopOnAbortSignal;
        this.maxTokens = maxTokens;
        this.temperature = temperature;
        this.minP = minP;
        this.topK = topK;
        this.topP = topP;
        this.seed = seed;
        this.xtc = xtc;
        this.grammar = grammar;
        this.trimWhitespaceSuffix = trimWhitespaceSuffix;
        this.tokenBias = tokenBias;
        this.evaluationPriority = evaluationPriority;
        this.functions = functions;
        this.onFunctionCall = safeEventCallback(onFunctionCall);
        this.documentFunctionParams = documentFunctionParams;
        this.maxParallelFunctionCalls = maxParallelFunctionCalls;
        this.contextShift = contextShift;
        this.customStopTriggers = customStopTriggers;
        this.abortOnNonText = abortOnNonText ?? false;
        this.minimumOverlapPercentageToPreventContextShift = minimumOverlapPercentageToPreventContextShift;

        this.functionsEnabled = (this.functions != null && Object.keys(this.functions).length > 0);

        if (this.signal?.aborted)
            throw this.signal.reason;

        if (this.llamaChat.disposed)
            throw new DisposedError();

        this.noRawInResolvedHistory = !this.llamaChat.sequence.isLoadedToMemory;
        this.resolvedHistory = this.noRawInResolvedHistory
            ? this.history.map(removeRawFromHistoryItem)
            : this.history.slice();
        this.resolvedContextShift = {
            ...defaultContextShiftOptions,
            ...removeNullFields(this.contextShift)
        };
        this.resolvedRepeatPenalty = repeatPenalty === false
            ? {lastTokens: 0}
            : {
                ...(repeatPenalty ?? {}),
                lastTokens: repeatPenalty?.lastTokens ?? defaultRepeatPenaltyLastTokens
            };
        this.repeatPenaltyEnabled = this.resolvedRepeatPenalty.lastTokens > 0;
        this.grammarEvaluationState = this.grammar != null
            ? new LlamaGrammarEvaluationState({model: this.llamaChat.model, grammar: this.grammar})
            : undefined;
        this.functionNameGrammar = this.functionsEnabled
            ? new FunctionCallNameGrammar(this.llamaChat.model._llama, this.functions as NonNullable<Functions>, this.chatWrapper)
            : undefined;
        this.functionsGrammar = undefined;
        this.functionsEvaluationState = undefined;

        this.lastContextWindowHistory = lastEvaluationContextWindowHistory ?? this.resolvedHistory;
        this.lastHistoryCompressionMetadata = this.resolvedContextShift.lastEvaluationMetadata;

        if (this.customStopTriggers != null)
            StopGenerationDetector.resolveStopTriggers(this.customStopTriggers, this.llamaChat.model.tokenizer)
                .map((stopTrigger) => this.customStopGenerationTriggersDetector.addStopTrigger(stopTrigger));

        if (this.grammar != null)
            StopGenerationDetector.resolveStopTriggers(this.grammar.stopGenerationTriggers, this.llamaChat.model.tokenizer)
                .map((stopTrigger) => this.stopGenerationDetector.addStopTrigger(stopTrigger));

        if (this.functions != null && Object.keys(this.functions).length > 0 && !this.abortOnNonText)
            this.functionSyntaxStartDetector.addStopTrigger(
                StopGenerationDetector.resolveLlamaTextTrigger(
                    LlamaText([
                        this.chatWrapper.settings.functions?.parallelism?.call?.sectionPrefix ?? "",
                        this.chatWrapper.settings.functions.call.prefix
                    ]),
                    this.llamaChat.model.tokenizer
                )
            );

        const segmentDefinitions: ConstructorParameters<typeof SegmentHandler>[0]["segmentDefinitions"] = new Map();
        for (const segmentType of allSegmentTypes) {
            const segmentDefinition = getChatWrapperSegmentDefinition(this.chatWrapper.settings, segmentType);
            if (segmentDefinition != null)
                segmentDefinitions.set(segmentType, segmentDefinition);
        }

        const lastModelMessageFullResponse = getLastModelMessageFullResponseFromChatHistory(this.resolvedHistory);
        this.segmentHandler = new SegmentHandler({
            model: this.llamaChat.model,
            onTextChunk: this.onTextChunk,
            onToken: this.onToken,
            onResponseChunk: this.onResponseChunk,
            previousTokens: this.getLastTokens(),
            closeAllSegments: this.chatWrapper.settings.segments?.closeAllSegments,
            segmentDefinitions,
            initialSegmentStack: SegmentHandler.getStackFromModelResponse(lastModelMessageFullResponse),
            initialTokenCounts: this.budgets?.includeCurrentResponse === false
                ? new Map()
                : SegmentHandler.getSegmentTokenCounts(lastModelMessageFullResponse, this.llamaChat.model.tokenizer)
        });

        if (this.abortOnNonText) {
            this.stopGenerationDetector.addStopTrigger(
                StopGenerationDetector.resolveLlamaTextTrigger(
                    LlamaText([
                        this.chatWrapper.settings.functions?.parallelism?.call?.sectionPrefix ?? "",
                        this.chatWrapper.settings.functions.call.prefix
                    ]),
                    this.llamaChat.model.tokenizer
                )
            );

            for (const segmentType of allSegmentTypes) {
                const segmentDefinition = getChatWrapperSegmentDefinition(this.chatWrapper.settings, segmentType);
                if (segmentDefinition != null)
                    this.stopGenerationDetector.addStopTrigger(
                        StopGenerationDetector.resolveLlamaTextTrigger(
                            LlamaText(segmentDefinition.prefix),
                            this.llamaChat.model.tokenizer
                        )
                    );
            }
        }

        this.getPenaltyTokens = this.getPenaltyTokens.bind(this);
    }

    public async dispose() {
        await this.evaluationIterator?.return();
    }

    public async [Symbol.asyncDispose]() {
        await this.dispose();
    }

    public ensureLastHistoryItemIsModel() {
        if (this.resolvedHistory.at(-1)?.type !== "model")
            this.resolvedHistory.push({
                type: "model",
                response: []
            });
    }

    public ensureLastHistoryItemIsUser() {
        if (this.resolvedHistory.at(-1)?.type !== "user")
            this.resolvedHistory.push({
                type: "user",
                text: ""
            });
    }

    public ensureReopenedThoughtSegmentAfterFunctionCallsIfNeeded() {
        if (this.chatWrapper.settings.segments?.thought?.reopenAfterFunctionCalls !== true)
            return;

        const lastModelResponseItem = this.resolvedHistory.at(-1);
        if (lastModelResponseItem == null || lastModelResponseItem.type !== "model")
            return;

        const lastResponse = lastModelResponseItem.response.at(-1);
        if (lastResponse == null)
            return;

        const lastResponseIsFunctionCall = typeof lastResponse !== "string" && lastResponse.type === "functionCall";
        if (!lastResponseIsFunctionCall)
            return;

        const currentResponseSegmentsStack = SegmentHandler.getStackFromModelResponse(lastModelResponseItem.response);
        if (currentResponseSegmentsStack.includes("thought"))
            return;

        const hadThoughtSegments = this.resolvedHistory.some((chatItem) => {
            if (chatItem.type !== "model")
                return false;

            return chatItem.response.some((responseItem) => {
                if (typeof responseItem === "string")
                    return false;

                return responseItem.type === "segment" && responseItem.segmentType === "thought";
            });
        });
        if (!hadThoughtSegments)
            return;

        if (this.abortOnNonText)
            this.shouldAbortBecauseOfNonText = true;
        else
            this.segmentHandler.openSegment("thought");
    }

    public ensureNotAborted() {
        if (this.signal?.aborted && (!this.stopOnAbortSignal || this.res.length === 0))
            throw this.signal.reason;

        if (this.llamaChat.disposed)
            throw new DisposedError();
    }

    public getPenaltyTokens() {
        if (this.llamaChat.disposed)
            return [];

        let punishTokens = this.res.slice(-this.resolvedRepeatPenalty.lastTokens);

        if (this.resolvedRepeatPenalty.punishTokensFilter != null)
            punishTokens = this.resolvedRepeatPenalty.punishTokensFilter(punishTokens);

        if (this.resolvedRepeatPenalty.penalizeNewLine == null || !this.resolvedRepeatPenalty.penalizeNewLine) {
            const nlToken = this.llamaChat.model.tokens.nl;

            if (nlToken != null)
                punishTokens = punishTokens.filter((token) => token !== nlToken);
        }

        return punishTokens;
    }

    public getResolvedHistoryWithCurrentModelResponse() {
        return mergeGeneratedResultWithChatHistory("model", this.resolvedHistory, this.segmentHandler.getModelResponseSegments());
    }

    public getContextWindowsHistoryWithCurrentModelResponse() {
        return mergeGeneratedResultWithChatHistory(
            "model",
            this.lastContextWindowHistory,
            this.segmentHandler.getContextWindowModelResponseSegments()
        );
    }

    public removeFoundStartIgnoreTextsFromPendingTokens(forceRemove: boolean = false) {
        if (!this.removedStartTextToIgnore && this.res.length === 0 && this.pendingTokens.length > 0 &&
            this.ignoreStartTextDetector.hasTriggeredStops && (forceRemove || !this.ignoreStartTextDetector.hasInProgressStops)
        ) {
            this.ignoreStartTextDetector.clearInProgressStops();
            this.ignoreStartTextDetector.clearTriggeredStops();

            let mostExhaustiveTriggeredStops: ReturnType<typeof this.ignoreStartTextDetector.getTriggeredStops> | null = null;
            let mostExhaustiveTriggeredStopsLeftoverTokens: Token[] = [];

            const lastTokensForDetokenizer = resolveLastTokens([
                this.contextWindowTokens,
                this.ignoredStartTextTokens,
                this.prefixTriggerTokens
            ]);

            const pendingPartialTokens: Token[] = [];
            for (let i = 0; i < this.pendingTokens.length; i++) {
                const currentToken = this.pendingTokens[i]!;
                const tokens = [...pendingPartialTokens, currentToken];
                const text = this.llamaChat.model.detokenize(tokens, false, lastTokensForDetokenizer);

                if (pendingPartialTokens.length === 0 &&
                    text.endsWith(UNKNOWN_UNICODE_CHAR) &&
                    !this.llamaChat.model.isSpecialToken(currentToken) &&
                    !this.llamaChat.model.isEogToken(currentToken)
                ) {
                    pendingPartialTokens.length = 0;
                    pushAll(pendingPartialTokens, tokens);
                    continue;
                }

                this.ignoreStartTextDetector.recordGeneration({
                    text: this.llamaChat.model.detokenize(tokens, false, lastTokensForDetokenizer),
                    tokens,
                    startNewChecks: i === 0,
                    triggerMustStartWithGeneration: true
                });
                pushAll(lastTokensForDetokenizer, tokens);

                if (this.ignoreStartTextDetector.hasTriggeredStops) {
                    mostExhaustiveTriggeredStops = this.ignoreStartTextDetector.getTriggeredStops();
                    this.ignoreStartTextDetector.clearTriggeredStops();
                    mostExhaustiveTriggeredStopsLeftoverTokens = this.pendingTokens.slice(i + 1);
                } else if (!this.ignoreStartTextDetector.hasInProgressStops)
                    break;
            }

            if (mostExhaustiveTriggeredStops != null) {
                const [mostExhaustiveTriggeredStop] = mostExhaustiveTriggeredStops;

                if (mostExhaustiveTriggeredStop != null) {
                    this.ignoredStartTextTokens = mostExhaustiveTriggeredStop.stopTrigger
                        .map((stopTrigger) => {
                            if (typeof stopTrigger === "string")
                                return this.llamaChat.model.tokenize(stopTrigger, false, "trimLeadingSpace");
                            else
                                return [stopTrigger];
                        })
                        .flat(1);

                    const newPendingTokens = [
                        ...mostExhaustiveTriggeredStop.remainingGeneration,
                        mostExhaustiveTriggeredStopsLeftoverTokens
                    ]
                        .map((generation) => {
                            if (typeof generation === "string")
                                return this.llamaChat.model.tokenize(generation, false, "trimLeadingSpace");
                            else
                                return generation;
                        })
                        .flat(1);
                    this.pendingTokens.length = 0;
                    pushAll(this.pendingTokens, newPendingTokens);
                    this.removedStartTextToIgnore = true;
                }
            }
        }
    }

    public startTokenLoop() {
        this.ensureNotAborted();
        this.shouldContextShift = false;
    }

    public handleRerender() {
        if (this.shouldRerender) {
            this.isRerender = true;
            this.streamRegulator.reset();

            if (this.rerenderActions === "closeResponseItem" && this.segmentHandler.topOpenSegmentType != null &&
                !this.skipClosingResponseItemOnRerender
            ) {
                this.segmentHandler.closeSegment(this.segmentHandler.topOpenSegmentType);
                this.shouldRerender = false;
            }
            this.skipClosingResponseItemOnRerender = false;
        }
    }

    private getContextWindowFunctionCallsTokens() {
        if (this.functionEvaluationMode === false)
            return [];
        else if (this.functionEvaluationMode === "prefixOrDisengage")
            return [
                ...LlamaText(this.currentFunctionCallPreviousText).tokenize(this.llamaChat.model.tokenizer, "trimLeadingSpace"),
                ...this.currentFunctionCallCurrentPartTokens
            ];

        const text: (LlamaText | string)[] = [];
        if (this.chatWrapper.settings.functions?.parallelism?.call?.sectionPrefix != null)
            text.push(this.chatWrapper.settings.functions.parallelism.call.sectionPrefix);

        for (let i = 0; i < this.resFunctionCalls.length; i++) {
            const call = this.resFunctionCalls[i]!;

            if (i > 0)
                text.push(this.chatWrapper.settings.functions?.parallelism?.call?.betweenCalls ?? "");

            text.push(call.raw);
        }

        text.push(this.currentFunctionCallPreviousText);

        return [
            ...LlamaText(text).tokenize(this.llamaChat.model.tokenizer, "trimLeadingSpace"),
            ...this.currentFunctionCallCurrentPartTokens
        ];
    }

    public async loadContextWindow(
        resolvedHistory: ChatHistoryItem[],
        resolvedContextWindowsHistory: ChatHistoryItem[],
        endWithUserText: boolean = false,
        avoidReloadingHistory: boolean = false
    ): Promise<{userTextSuffix?: LlamaText}> {
        const queuedChunkTokens = this.streamRegulator.getAllQueuedChunkTokens();
        const functionCallsTokens = this.getContextWindowFunctionCallsTokens();

        if (!avoidReloadingHistory || !this.canAvoidReloadingHistory || this.isRerender || !this.llamaChat.sequence.isLoadedToMemory) {
            const {
                history: contextWindowHistory,
                stopGenerationTriggers,
                tokens: contextWindowTokens,
                removeRawFromHistory,
                newHistoryCompressionMetadata,
                ignoreStartText,
                functionCallInitiallyEngaged,
                disengageInitiallyEngagedFunctionCall,
                userTextSuffix,
                prefixTriggers,
                noPrefixTrigger,
                rerender,
                detectFunctionCalls
            } = await getContextWindow({
                resolvedHistory: resolvedHistory,
                resolvedContextShift: this.resolvedContextShift,
                lastHistoryCompressionMetadata: this.lastHistoryCompressionMetadata,
                pendingTokensCount: this.prefixTriggerTokens.length + this.pendingTokens.length + queuedChunkTokens.length +
                    functionCallsTokens.length + this.pendingPartialTokens.length,
                isFirstEvaluation: this.isFirstEvaluation,
                isRerender: this.isRerender,
                chatWrapper: this.chatWrapper,
                lastEvaluationContextWindowHistory: resolvedContextWindowsHistory,
                minimumOverlapPercentageToPreventContextShift: this.minimumOverlapPercentageToPreventContextShift,
                sequence: this.llamaChat.sequence,
                minFreeContextTokens: 1,
                functions: this.functionsEnabled ? this.functions : undefined,
                documentFunctionParams: this.documentFunctionParams,
                endWithUserText
            });

            this.ensureNotAborted();

            this.contextWindowTokens = contextWindowTokens;
            this.stopGenerationTriggers = stopGenerationTriggers;
            this.ignoreStartText = ignoreStartText;
            this.functionCallInitiallyEngaged = functionCallInitiallyEngaged;
            this.disengageInitiallyEngagedFunctionCall = disengageInitiallyEngagedFunctionCall;
            this.userTextSuffix = userTextSuffix;

            if (this.isRerender) {
                this.prefixTriggerTokens.length = 0;

                for (const prefixDetector of this.prefixTriggerDetectors.keys()) {
                    prefixDetector.clearInProgressStops();
                    prefixDetector.clearTriggeredStops();
                }
                this.prefixTriggerDetectors.clear();

                for (const trigger of prefixTriggers ?? []) {
                    const segmentBudget = trigger.type === "segment"
                        ? this.getSegmentBudget(trigger.segmentType)
                        : null;

                    if (trigger.type === "functionCall" && !this.functionsEnabled)
                        continue;
                    else if (trigger.type === "segment" &&
                        segmentBudget != null &&
                        !this.segmentHandler.isSegmentTypeOpen(trigger.segmentType) &&
                        this.segmentHandler.getSegmentTokensCount(trigger.segmentType) >= segmentBudget
                    )
                        continue;

                    const prefixDetector = new StopGenerationDetector();
                    StopGenerationDetector.resolveStopTriggers(trigger.triggers, this.llamaChat.model.tokenizer)
                        .forEach((stopTrigger) => prefixDetector.addStopTrigger(stopTrigger));

                    this.prefixTriggerDetectors.set(prefixDetector, {inject: trigger.inject, trigger});

                    const inject = trigger.inject;
                    if (inject != null && inject.values.length > 0) {
                        const fullPrefixDetector = new StopGenerationDetector();
                        StopGenerationDetector
                            .resolveStopTriggers(
                                trigger.triggers.map((trigger) => LlamaText([trigger, inject])),
                                this.llamaChat.model.tokenizer
                            )
                            .forEach((stopTrigger) => fullPrefixDetector.addStopTrigger(stopTrigger));

                        this.prefixTriggerDetectors.set(fullPrefixDetector, {trigger});
                    }
                }

                this.noPrefixTrigger = noPrefixTrigger;

                const noPrefixTriggerSegmentBudget = noPrefixTrigger?.type === "segment"
                    ? this.getSegmentBudget(noPrefixTrigger.segmentType)
                    : null;
                if (this.noPrefixTrigger?.type === "functionCall" && !this.functionsEnabled)
                    this.noPrefixTrigger = undefined;
                else if (noPrefixTrigger?.type === "segment" &&
                    noPrefixTriggerSegmentBudget != null &&
                    !this.segmentHandler.isSegmentTypeOpen(noPrefixTrigger.segmentType) &&
                    this.segmentHandler.getSegmentTokensCount(noPrefixTrigger.segmentType) >= noPrefixTriggerSegmentBudget
                )
                    this.noPrefixTrigger = undefined;

                this.rerenderTriggers = rerender?.triggers ?? [];
                this.rerenderTriggerDetector.clearInProgressStops();
                this.rerenderTriggerDetector.clearTriggeredStops();
                this.rerenderTriggerDetector = new StopGenerationDetector();
                this.rerenderActions = rerender?.action;

                this.functionSyntaxStartDetectorEnabled = detectFunctionCalls ?? true;
                if (!this.functionSyntaxStartDetectorEnabled)
                    this.functionSyntaxStartDetector.clearInProgressStops();

                if (rerender?.triggers != null) {
                    StopGenerationDetector.resolveStopTriggers(rerender.triggers, this.llamaChat.model.tokenizer)
                        .map((stopTrigger) => this.rerenderTriggerDetector.addStopTrigger(stopTrigger));
                }
            }

            this.lastHistoryCompressionMetadata = newHistoryCompressionMetadata;
            this.lastContextWindowHistory = contextWindowHistory;
            this.segmentHandler.resetContextWindow();

            this.canAvoidReloadingHistory = true;

            if (removeRawFromHistory && !this.noRawInResolvedHistory) {
                this.noRawInResolvedHistory = true;
                this.resolvedHistory = this.resolvedHistory.map(removeRawFromHistoryItem);
            }
        }

        this.tokens = [
            ...this.contextWindowTokens,
            ...this.ignoredStartTextTokens,
            ...this.prefixTriggerTokens,
            ...this.pendingTokens,
            ...queuedChunkTokens,
            ...functionCallsTokens,
            ...this.pendingPartialTokens
        ];

        if (avoidReloadingHistory && this.tokens.length >= this.llamaChat.sequence.context.contextSize - 1)
            return await this.loadContextWindow(resolvedHistory, resolvedContextWindowsHistory, endWithUserText, false);

        return {
            userTextSuffix: this.userTextSuffix
        };
    }

    public addIgnoreStartTextTriggersFromChatWrapper() {
        StopGenerationDetector.resolveStopTriggers(this.ignoreStartText, this.llamaChat.model.tokenizer)
            .map((stopTrigger) => this.ignoreStartTextDetector.addStopTrigger(stopTrigger));
    }

    public addStopGenerationTriggersFromChatWrapper() {
        StopGenerationDetector.resolveStopTriggers(this.stopGenerationTriggers, this.llamaChat.model.tokenizer)
            .map((stopTrigger) => this.stopGenerationDetector.addStopTrigger(stopTrigger));
    }

    public initFunctions() {
        this.initiallyEngagedFunctionMode = this.functionCallInitiallyEngaged;

        if (this.initiallyEngagedFunctionMode && this.abortOnNonText) {
            this.shouldAbortBecauseOfNonText = true;
            return;
        }

        if (this.initiallyEngagedFunctionMode) {
            StopGenerationDetector.resolveStopTriggers(this.disengageInitiallyEngagedFunctionCall, this.llamaChat.model.tokenizer)
                .map((stopTrigger) => this.disengageInitiallyEngagedFunctionMode.addStopTrigger(stopTrigger));

            if (this.disengageInitiallyEngagedFunctionMode.hasTriggers) {
                this.functionEvaluationMode = "prefixOrDisengage";
                this.functionsGrammar = undefined;
                this.functionsEvaluationState = undefined;
            } else {
                this.functionEvaluationMode = "functionName";
            }

            this.restartEvaluationIterator = true;
        }
    }

    public async handlePrefixTriggers(loadContextWindow: () => Promise<void>) {
        const reloadTokens = async () => {
            this.startTokenLoop();
            await loadContextWindow();
        };
        const injectTokens = async (text?: LlamaText, alignStateTokens: boolean = false) => {
            if (text == null)
                return;

            const tokens = text.tokenize(this.llamaChat.model.tokenizer, "trimLeadingSpace");
            if (tokens.length === 0)
                return;

            pushAll(this.prefixTriggerTokens, tokens);

            if (alignStateTokens)
                await reloadTokens();
        };

        if (this.prefixTriggerDetectors.size === 0) {
            if (this.abortOnNonText && this.noPrefixTrigger != null && this.noPrefixTrigger.type !== "response") {
                this.shouldAbortBecauseOfNonText = true;

                const stopRes = this.handleAbortTrigger("model");
                if (stopRes != null)
                    return stopRes;

                return undefined;
            }

            if (this.noPrefixTrigger?.type === "functionCall" && this.chatWrapper.settings.functions != null) {
                await injectTokens(this.noPrefixTrigger.inject, true);

                this.functionEvaluationMode = "functionName";
            } else if (this.noPrefixTrigger?.type === "segment") {
                await injectTokens(this.noPrefixTrigger.inject, true);

                this.segmentHandler.openSegment(this.noPrefixTrigger.segmentType);
            } else if (this.noPrefixTrigger?.type === "response")
                await injectTokens(this.noPrefixTrigger.inject, true);

            return undefined;
        }

        const generatedTokens: Token[] = [];
        let isFirstToken = true;
        let continueGeneration = true;

        for await (const tokens of this.evaluateWithContextShift(loadContextWindow)) {
            pushAll(generatedTokens, tokens);

            for (const [triggerDetector, {trigger, inject}] of [...this.prefixTriggerDetectors.entries()]) {
                triggerDetector.recordGeneration({
                    text: this.currentText,
                    tokens: this.currentTokens,
                    startNewChecks: isFirstToken,
                    triggerMustStartWithGeneration: true
                });

                if (triggerDetector.hasTriggeredStops) {
                    const {
                        firstRemainingGenerationAfterStop,
                        stopTrigger
                    } = StopGenerationDetector.getFirstRemainingGenerationAfterStop(triggerDetector.getTriggeredStops());
                    const remainingTokens = typeof firstRemainingGenerationAfterStop === "string"
                        ? firstRemainingGenerationAfterStop === ""
                            ? []
                            : this.llamaChat.model.tokenize(firstRemainingGenerationAfterStop, false, "trimLeadingSpace")
                        : (firstRemainingGenerationAfterStop ?? []);
                    const triggerTokens = (stopTrigger == null || remainingTokens.length === 0)
                        ? generatedTokens
                        : stopTrigger.flatMap((item) => {
                            if (typeof item === "string")
                                return this.llamaChat.model.tokenize(item, false, "trimLeadingSpace");

                            return [item];
                        });

                    if (this.abortOnNonText && trigger.type !== "response") {
                        this.shouldAbortBecauseOfNonText = true;

                        const stopRes = this.handleAbortTrigger("model");
                        if (stopRes != null)
                            return stopRes;

                        return undefined;
                    }

                    this.streamRegulator.reset();

                    if (trigger.type === "segment") {
                        pushAll(this.prefixTriggerTokens, triggerTokens);
                        if (inject != null)
                            await injectTokens(inject);

                        await reloadTokens();
                        this.segmentHandler.openSegment(trigger.segmentType);
                    } else if (trigger.type === "response") {
                        pushAll(this.prefixTriggerTokens, triggerTokens);

                        if (inject != null)
                            await injectTokens(inject);

                        await reloadTokens();
                    } else if (trigger.type === "functionCall") {
                        if (trigger.replaceTrigger === false)
                            pushAll(this.prefixTriggerTokens, triggerTokens);

                        if (inject != null)
                            await injectTokens(inject);

                        await reloadTokens();
                        this.functionEvaluationMode = "functionName";
                    } else
                        void (trigger satisfies never);

                    this.prefixTriggerDetectors.clear();
                    continueGeneration = false;
                    break;
                } else if (!triggerDetector.hasInProgressStops)
                    this.prefixTriggerDetectors.delete(triggerDetector);
            }

            if (this.prefixTriggerDetectors.size === 0 && continueGeneration) {
                if (this.abortOnNonText && this.noPrefixTrigger != null && this.noPrefixTrigger.type !== "response") {
                    this.shouldAbortBecauseOfNonText = true;

                    const stopRes = this.handleAbortTrigger("model");
                    if (stopRes != null)
                        return stopRes;

                    return undefined;
                }

                this.streamRegulator.reset();
                continueGeneration = false;

                if (this.noPrefixTrigger?.type === "functionCall" && this.chatWrapper.settings.functions != null) {
                    await injectTokens(this.noPrefixTrigger.inject, true);

                    this.functionEvaluationMode = "functionName";
                } else if (this.noPrefixTrigger?.type === "segment") {
                    await injectTokens(this.noPrefixTrigger.inject, true);

                    this.segmentHandler.openSegment(this.noPrefixTrigger.segmentType);
                } else if (this.noPrefixTrigger?.type === "response")
                    await injectTokens(this.noPrefixTrigger.inject, true);
                else
                    this.streamRegulator.addChunk({
                        tokens: generatedTokens,
                        text: this.llamaChat.model.detokenize(generatedTokens, false, this.getLastTokens())
                    });
            }


            isFirstToken = false;

            if (!continueGeneration)
                break;

            const stopRes = this.handleAbortTrigger("model") ?? this.handleMaxTokensTrigger("model");
            if (stopRes != null)
                return stopRes;
        }

        return undefined;
    }

    public async enterFunctionCallingLoop(loadContextWindow: () => Promise<void>) {
        if (!this.functionsEnabled) {
            this.functionEvaluationMode = false;
            return undefined;
        }

        while (true) {
            if (this.functionEvaluationMode === "prefixOrDisengage") {
                this.functionsGrammar = undefined;
                this.functionsEvaluationState = undefined;
                this.currentFunctionCallPreviousText = LlamaText([]);
                this.currentFunctionCallCurrentPartTokens.length = 0;

                const prefixTokens = LlamaText(this.chatWrapper.settings.functions.call.prefix)
                    .tokenize(this.llamaChat.model.tokenizer, "trimLeadingSpace");
                const prefixDetector = new StopGenerationDetector();
                const prefixDetectorRecordedTokens: Token[] = [];
                const afterPrefixLeftoverTokens: Token[] = [];
                prefixDetector.addStopTrigger(
                    StopGenerationDetector.resolveLlamaTextTrigger(
                        LlamaText(this.chatWrapper.settings.functions.call.prefix),
                        this.llamaChat.model.tokenizer
                    )
                );

                const lastTokensForDetokenizer = this.streamRegulator.getLastQueuedChunkTokens();
                for (const prefixToken of prefixTokens) {
                    const tokens = [prefixToken];
                    const text = this.llamaChat.model.detokenize(tokens, false, lastTokensForDetokenizer);
                    pushAll(lastTokensForDetokenizer, tokens);
                    const disregardedPossibilities = this.disengageInitiallyEngagedFunctionMode
                        .getDisregardedPossibilitiesCountForAGeneration({
                            text,
                            tokens,
                            startNewChecks: this.currentFunctionCallCurrentPartTokens.length === 0
                        });

                    if (disregardedPossibilities > 0)
                        break;

                    this.currentFunctionCallCurrentPartTokens.push(prefixToken);

                    this.disengageInitiallyEngagedFunctionMode.recordGeneration({
                        text: text,
                        tokens: tokens,
                        startNewChecks: this.currentFunctionCallCurrentPartTokens.length === 1,
                        triggerMustStartWithGeneration: true
                    });

                    if (prefixDetector.hasTriggeredStops)
                        afterPrefixLeftoverTokens.push(prefixToken);
                    else {
                        prefixDetector.recordGeneration({
                            text: text,
                            tokens: tokens,
                            startNewChecks: this.currentFunctionCallCurrentPartTokens.length === 1,
                            triggerMustStartWithGeneration: true
                        });
                        pushAll(prefixDetectorRecordedTokens, tokens);
                    }
                }

                for await (const tokens of this.evaluateWithContextShift(loadContextWindow)) {
                    const stopGenerationTriggerRes = this.handleStopGenerationTrigger("model");
                    if (stopGenerationTriggerRes != null)
                        return stopGenerationTriggerRes;

                    pushAll(this.currentFunctionCallCurrentPartTokens, tokens);

                    this.disengageInitiallyEngagedFunctionMode.recordGeneration({
                        text: this.currentText,
                        tokens: this.currentTokens,
                        startNewChecks: this.currentFunctionCallCurrentPartTokens.length === tokens.length,
                        triggerMustStartWithGeneration: true
                    });

                    if (prefixDetector.hasTriggeredStops)
                        pushAll(afterPrefixLeftoverTokens, tokens);
                    else {
                        prefixDetector.recordGeneration({
                            text: this.currentText,
                            tokens: this.currentTokens,
                            startNewChecks: this.currentFunctionCallCurrentPartTokens.length === tokens.length,
                            triggerMustStartWithGeneration: true
                        });
                        pushAll(prefixDetectorRecordedTokens, this.currentTokens);
                    }

                    if (this.disengageInitiallyEngagedFunctionMode.hasTriggeredStops ||
                        !this.disengageInitiallyEngagedFunctionMode.hasInProgressStops
                    )
                        break;

                    const stopRes = this.handleAbortTrigger("model") ?? this.handleMaxTokensTrigger("model");
                    if (stopRes != null)
                        return stopRes;
                }

                const stopRes = this.handleAbortTrigger("model") ?? this.handleMaxTokensTrigger("model");
                if (stopRes != null)
                    return stopRes;

                if (this.disengageInitiallyEngagedFunctionMode.hasTriggeredStops) {
                    const lastTokensForDetokenizer = this.streamRegulator.getLastQueuedChunkTokens();
                    for (const token of this.currentFunctionCallCurrentPartTokens) {
                        this.currentToken = token;
                        this.currentTokens = [this.currentToken];
                        this.currentText = this.llamaChat.model.detokenize(this.currentTokens, false, lastTokensForDetokenizer);
                        pushAll(lastTokensForDetokenizer, this.currentTokens);

                        this.currentQueuedTokenRelease = this.streamRegulator.addChunk({
                            tokens: this.currentTokens,
                            text: this.currentText
                        });
                        this.recordStopGenerationEvaluation();
                    }

                    this.currentFunctionCallCurrentPartTokens.length = 0;
                    this.functionEvaluationMode = false;
                    return undefined;
                }

                if (prefixDetector.hasTriggeredStops) {
                    const triggeredStops = prefixDetector.getTriggeredStops();
                    const {
                        firstRemainingGenerationAfterStop,
                        stopTrigger
                    } = StopGenerationDetector.getFirstRemainingGenerationAfterStop(triggeredStops);
                    this.currentFunctionCallPreviousPartLeftoverText = StopGenerationDetector.detokenizeRemainingGeneration(
                        firstRemainingGenerationAfterStop,
                        stopTrigger,
                        this.llamaChat.model.tokenizer
                    ) + this.llamaChat.model.detokenize(afterPrefixLeftoverTokens, false, prefixDetectorRecordedTokens);
                } else
                    this.currentFunctionCallPreviousPartLeftoverText = "";

                this.functionEvaluationMode = "functionName";
                this.currentFunctionCallCurrentPartTokens.length = 0;

                continue;
            } else if (this.functionEvaluationMode === "functionName") {
                const functionNameGenerationDoneDetector = new StopGenerationDetector();

                this.stopGenerationDetector.clearInProgressStops();
                this.customStopGenerationTriggersDetector.clearInProgressStops();
                this.currentFunctionCallPreviousText = LlamaText(this.chatWrapper.settings.functions.call.prefix);
                this.currentFunctionCallCurrentPartTokens.length = 0;
                const functionNameGrammar = this.functionNameGrammar ?? new FunctionCallNameGrammar(
                    this.llamaChat.model._llama,
                    this.functions as NonNullable<Functions>,
                    this.chatWrapper
                );
                this.functionsGrammar = functionNameGrammar;
                this.functionsEvaluationState = new LlamaGrammarEvaluationState({
                    model: this.llamaChat.model,
                    grammar: this.functionsGrammar
                });

                StopGenerationDetector.resolveStopTriggers(this.functionsGrammar.stopGenerationTriggers, this.llamaChat.model.tokenizer)
                    .map((stopTrigger) => functionNameGenerationDoneDetector.addStopTrigger(stopTrigger));

                if (this.currentFunctionCallPreviousPartLeftoverText !== "") {
                    const validFunctionNames = Object.keys(this.functions as NonNullable<Functions>);
                    const hasAnyFunctionStartWithLeftover = validFunctionNames.some(
                        (functionName) => functionName.startsWith(this.currentFunctionCallPreviousPartLeftoverText)
                    );

                    if (hasAnyFunctionStartWithLeftover) {
                        const leftoverTokens = this.llamaChat.model.tokenize(this.currentFunctionCallPreviousPartLeftoverText, false, "trimLeadingSpace");
                        this.currentFunctionCallPreviousPartLeftoverText = "";

                        const lastTokens: Token[] = [];
                        for (const leftoverToken of leftoverTokens) {
                            const canBeNextToken =
                                LlamaSampler._canBeNextTokenForGrammarEvaluationState(
                                    this.llamaChat.model._llama,
                                    this.functionsEvaluationState,
                                    leftoverToken
                                );

                            if (!canBeNextToken)
                                break;

                            LlamaSampler._acceptTokenOnGrammarEvaluationState(
                                this.llamaChat.model._llama,
                                this.functionsEvaluationState,
                                leftoverToken
                            );
                            this.currentFunctionCallCurrentPartTokens.push(leftoverToken);
                            functionNameGenerationDoneDetector.recordGeneration({
                                text: this.llamaChat.model.detokenize([leftoverToken], false, lastTokens),
                                tokens: [leftoverToken]
                            });
                            lastTokens.push(leftoverToken);
                        }
                    }
                }

                for await (const tokens of this.evaluateWithContextShift(loadContextWindow)) {
                    pushAll(this.currentFunctionCallCurrentPartTokens, tokens);

                    functionNameGenerationDoneDetector.recordGeneration({
                        text: this.currentText,
                        tokens: this.currentTokens
                    });

                    if (functionNameGenerationDoneDetector.hasTriggeredStops)
                        break;

                    const stopRes = this.handleAbortTrigger("model") ?? this.handleMaxTokensTrigger("model");
                    if (stopRes != null)
                        return stopRes;
                }

                const stopRes = this.handleAbortTrigger("model") ?? this.handleMaxTokensTrigger("model");
                if (stopRes != null)
                    return stopRes;

                const functionCallNameText = this.llamaChat.model.detokenize(this.currentFunctionCallCurrentPartTokens);
                const functionName = functionNameGrammar.parseFunctionName(functionCallNameText);

                this.functionEvaluationFunctionName = functionName;
                this.functionEvaluationMode = "params";
                continue;
            } else if (this.functionEvaluationMode === "params") {
                this.currentFunctionCallPreviousText = LlamaText([
                    this.chatWrapper.settings.functions.call.prefix,
                    this.functionEvaluationFunctionName,
                    this.chatWrapper.settings.functions.call.paramsPrefix
                ]);
                const lastPartTokens = resolveLastTokens([this.currentFunctionCallCurrentPartTokens]);
                this.currentFunctionCallCurrentPartTokens.length = 0;

                let params: any = undefined;
                let paramsText: string = "";

                const functionDefinition = (this.functions as NonNullable<Functions>)[this.functionEvaluationFunctionName];
                if (functionDefinition == null)
                    throw new Error(`Function "${this.functionEvaluationFunctionName}" is not provided in the functions object`);
                else if (functionDefinition.params == null) {
                    const emptyCallParamsPlaceholder = this.chatWrapper.settings?.functions?.call?.emptyCallParamsPlaceholder;
                    if (emptyCallParamsPlaceholder !== undefined && emptyCallParamsPlaceholder !== "") {
                        params = structuredClone(emptyCallParamsPlaceholder);
                        paramsText = jsonDumps(params);
                        pushAll(this.currentFunctionCallCurrentPartTokens, this.llamaChat.model.tokenize(paramsText));
                    } else {
                        params = undefined;
                        paramsText = "";
                    }
                } else {
                    const functionParamsGenerationDoneDetector = new StopGenerationDetector();

                    const functionParamsGrammar = new FunctionCallParamsGrammar(
                        this.llamaChat.model._llama,
                        this.functions as NonNullable<Functions>,
                        this.chatWrapper,
                        this.functionEvaluationFunctionName,
                        functionDefinition.params
                    );
                    this.functionsGrammar = functionParamsGrammar;
                    this.functionsEvaluationState = new LlamaGrammarEvaluationState({
                        model: this.llamaChat.model,
                        grammar: this.functionsGrammar
                    });

                    StopGenerationDetector.resolveStopTriggers(this.functionsGrammar.stopGenerationTriggers, this.llamaChat.model.tokenizer)
                        .map((stopTrigger) => functionParamsGenerationDoneDetector.addStopTrigger(stopTrigger));

                    if (this.currentFunctionCallCurrentPartTokens.length > 0)
                        this.onFunctionCallParamsChunk?.({
                            callIndex: this.resFunctionCalls.length,
                            functionName: this.functionEvaluationFunctionName,
                            paramsChunk: this.llamaChat.model.detokenize(this.currentFunctionCallCurrentPartTokens, false, lastPartTokens),
                            done: false
                        });

                    for await (const tokens of this.evaluateWithContextShift(loadContextWindow)) {
                        functionParamsGenerationDoneDetector.recordGeneration({
                            text: this.currentText,
                            tokens: this.currentTokens
                        });

                        this.onFunctionCallParamsChunk?.({
                            callIndex: this.resFunctionCalls.length,
                            functionName: this.functionEvaluationFunctionName,
                            paramsChunk: this.llamaChat.model.detokenize(
                                tokens,
                                false,
                                resolveLastTokens([lastPartTokens, this.currentFunctionCallCurrentPartTokens])
                            ),
                            done: functionParamsGenerationDoneDetector.hasTriggeredStops
                        });

                        pushAll(this.currentFunctionCallCurrentPartTokens, tokens);

                        if (functionParamsGenerationDoneDetector.hasTriggeredStops)
                            break;

                        const stopRes = this.handleAbortTrigger("model") ?? this.handleMaxTokensTrigger("model");
                        if (stopRes != null)
                            return stopRes;
                    }

                    const stopRes = this.handleAbortTrigger("model") ?? this.handleMaxTokensTrigger("model");
                    if (stopRes != null)
                        return stopRes;

                    const functionCallParamsText =
                        this.llamaChat.model.detokenize(this.currentFunctionCallCurrentPartTokens, false, lastPartTokens);
                    const parsedFunctionParams = functionParamsGrammar.parseParams(functionCallParamsText);
                    params = parsedFunctionParams.params;
                    paramsText = parsedFunctionParams.raw;
                }

                const functionCallText = LlamaText([
                    this.chatWrapper.settings.functions.call.prefix,
                    this.functionEvaluationFunctionName,
                    this.chatWrapper.settings.functions.call.paramsPrefix,
                    paramsText,
                    this.chatWrapper.settings.functions.call.suffix
                ]);
                this.resFunctionCalls.push({
                    functionName: this.functionEvaluationFunctionName,
                    params,
                    raw: functionCallText
                });
                this.onFunctionCall?.({
                    functionName: this.functionEvaluationFunctionName,
                    params: structuredClone(params),
                    raw: functionCallText.toJSON()
                });
                this.currentFunctionCallPreviousText = LlamaText([]);
                this.currentFunctionCallCurrentPartTokens.length = 0;
                this.functionEvaluationFunctionName = "";

                if (this.chatWrapper.settings.functions.parallelism == null || (
                    this.maxParallelFunctionCalls != null && this.maxParallelFunctionCalls <= this.resFunctionCalls.length
                )) {
                    this.functionEvaluationMode = false;
                    return this.returnFunctionCallResults();
                }

                this.functionEvaluationMode = "sectionSuffixOrBetweenCalls";
                continue;
            } else if (this.functionEvaluationMode === "sectionSuffixOrBetweenCalls") {
                const sectionSuffixDetector = new StopGenerationDetector();
                let isFirstToken = true;

                this.functionsGrammar = undefined;
                this.functionsEvaluationState = undefined;
                this.currentFunctionCallPreviousText = LlamaText([]);
                this.currentFunctionCallCurrentPartTokens.length = 0;

                StopGenerationDetector.resolveStopTriggers([
                    ...(
                        this.chatWrapper.settings.functions.parallelism?.call?.sectionSuffix != null
                            ? [this.chatWrapper.settings.functions.parallelism?.call?.sectionSuffix]
                            : []
                    ),
                    LlamaText(new SpecialToken("EOS")),
                    LlamaText(new SpecialToken("EOT"))
                ], this.llamaChat.model.tokenizer)
                    .map((stopTrigger) => sectionSuffixDetector.addStopTrigger(stopTrigger));

                for await (const tokens of this.evaluateWithContextShift(loadContextWindow)) {
                    pushAll(this.currentFunctionCallCurrentPartTokens, tokens);

                    sectionSuffixDetector.recordGeneration({
                        text: this.currentText,
                        tokens: this.currentTokens,
                        startNewChecks: isFirstToken,
                        triggerMustStartWithGeneration: true
                    });

                    isFirstToken = false;

                    if (sectionSuffixDetector.hasTriggeredStops || !sectionSuffixDetector.hasInProgressStops)
                        break;

                    const stopRes = this.handleAbortTrigger("model") ?? this.handleMaxTokensTrigger("model");
                    if (stopRes != null)
                        return stopRes;
                }

                const stopRes = this.handleAbortTrigger("model") ?? this.handleMaxTokensTrigger("model");
                if (stopRes != null)
                    return stopRes;

                if (sectionSuffixDetector.hasTriggeredStops) {
                    this.functionEvaluationMode = false;
                    return this.returnFunctionCallResults();
                }

                this.functionEvaluationMode = "functionName";
                this.initiallyEngagedFunctionMode = false;
                continue;
            }

            break;
        }

        return undefined;
    }

    public releasePartiallyFreeTokensBeforeFunctionCallStart() {
        if (this.releasedPartiallyFreeTokensBeforeFunctionCallStartSyntax)
            return;

        this.stopGenerationDetector.clearInProgressStops();
        this.customStopGenerationTriggersDetector.clearInProgressStops();
        pushAll(this.pendingTokens, this.streamRegulator.popFreeChunkTokens());

        const triggeredStops = this.functionSyntaxStartDetector.getTriggeredStops();
        const partiallyFreeTokens = this.streamRegulator.getPartiallyFreeChunk(this.llamaChat.model.tokenizer);
        const queuedTokensBeforeStopTrigger = getQueuedTokensBeforeStopTrigger(
            triggeredStops,
            partiallyFreeTokens,
            this.llamaChat.model.tokenizer
        );
        pushAll(this.pendingTokens, queuedTokensBeforeStopTrigger);

        this.removeFoundStartIgnoreTextsFromPendingTokens(true);

        this.pushPendingTokensAndCallOnToken();

        this.streamRegulator.clearQueue();

        this.releasedPartiallyFreeTokensBeforeFunctionCallStartSyntax = true;
    }

    public returnFunctionCallResults(): LlamaChatResponse<Functions> | undefined {
        if (this.resFunctionCalls.length > 0) {
            this.releasePartiallyFreeTokensBeforeFunctionCallStart();

            this.segmentHandler.onFinishedGeneration();
            const trimWhitespaceSuffix = this.grammar?.trimWhitespaceSuffix || this.trimWhitespaceSuffix;
            const responseSegments = this.segmentHandler.getModelResponseSegments(trimWhitespaceSuffix);

            return {
                response: responseSegments
                    .filter((segment) => typeof segment === "string")
                    .join(""),
                fullResponse: responseSegments,
                lastEvaluation: {
                    contextWindow: mergeGeneratedResultWithChatHistory(
                        "model",
                        this.lastContextWindowHistory,
                        this.segmentHandler.getContextWindowModelResponseSegments(trimWhitespaceSuffix)
                    ),
                    cleanHistory: mergeGeneratedResultWithChatHistory(
                        "model",
                        this.resolvedHistory,
                        responseSegments
                    ),
                    contextShiftMetadata: this.lastHistoryCompressionMetadata
                },

                functionCalls: this.resFunctionCalls.map((functionCall) => {
                    return {
                        functionName: functionCall.functionName,
                        params: functionCall.params,
                        raw: functionCall.raw.toJSON()
                    } satisfies LlamaChatResponseFunctionCall<NonNullable<Functions>>;
                }) satisfies LlamaChatResponseFunctionCall<NonNullable<Functions>>[] as any, // prevent infinite TS type instantiation

                metadata: {
                    stopReason: "functionCalls"
                }
            };
        }

        return undefined;
    }

    public async *evaluateWithContextShift(loadContextWindow: () => Promise<void>): AsyncGenerator<Token[], void> {
        while (true) {
            this.startTokenLoop();
            await loadContextWindow();
            await this.alignCurrentSequenceStateWithCurrentTokens();

            await this.createNewEvaluationIterator();
            while (await this.iterateEvaluation()) {
                if (this.currentTokens.length === 0)
                    break;

                if (!this.holdPartialTokensForNextEvaluation())
                    yield this.currentTokens;

                if (this.shouldAbort)
                    return;

                if (this.updateShouldContextShift())
                    break;

                if (this.restartEvaluationIterator) {
                    await this.createNewEvaluationIterator();
                }
            }

            this.isFirstEvaluation = false;

            if (this.shouldContextShift)
                continue;

            break;
        }

        throw new Error("The context size is too small to generate a response");
    }

    public async alignCurrentSequenceStateWithCurrentTokens() {
        if (this.tokens.length === 1 && this.llamaChat.sequence.nextTokenIndex !== 0) {
            await this.llamaChat.sequence.eraseContextTokenRanges([{
                start: 0,
                end: this.llamaChat.sequence.nextTokenIndex
            }]);
            return;
        }

        const lastToken = this.tokens[this.tokens.length - 1]!;

        // we need to decode at least one token to generate a response
        this.tokens.pop();
        await this.llamaChat.sequence.adaptStateToTokens(this.tokens, false);
        this.tokens.push(lastToken);
        this.ensureNotAborted();

        const firstDifferentIndex = this.llamaChat.sequence.nextTokenIndex;
        this.tokens.splice(0, firstDifferentIndex);
    }

    public async evaluateWithoutGeneratingNewTokens() {
        if (this.evaluationIterator != null)
            await this.evaluationIterator.return();

        await this.llamaChat.sequence.evaluateWithoutGeneratingNewTokens(this.tokens, removeNullFields({
            evaluationPriority: this.evaluationPriority
        }));
    }

    public async createNewEvaluationIterator() {
        if (this.evaluationIterator != null)
            await this.evaluationIterator.return();

        this.currentIterationReplacementToken = undefined;
        this.restartEvaluationIterator = false;
        this.evaluationIterator = this.llamaChat.sequence.evaluate(this.tokens, removeNullFields({
            temperature: this.temperature,
            minP: this.minP,
            topK: this.topK,
            topP: this.topP,
            seed: this.seed,
            xtc: this.xtc,
            grammarEvaluationState: () => {
                if (this.functionEvaluationMode !== false)
                    return this.functionsEvaluationState;

                return this.grammarEvaluationState;
            },
            repeatPenalty: !this.repeatPenaltyEnabled ? undefined : {
                punishTokens: this.getPenaltyTokens,
                maxPunishTokens: this.resolvedRepeatPenalty.lastTokens,
                penalty: this.resolvedRepeatPenalty.penalty,
                frequencyPenalty: this.resolvedRepeatPenalty.frequencyPenalty,
                presencePenalty: this.resolvedRepeatPenalty.presencePenalty
            },
            tokenBias: this.tokenBias,
            evaluationPriority: this.evaluationPriority,
            yieldEogToken: true
        }));
    }

    public async iterateEvaluation() {
        this.currentIteration = await this.evaluationIterator?.next(this.currentIterationReplacementToken);
        this.currentIterationReplacementToken = undefined;

        this.ensureNotAborted();
        this.generatedTokens++;

        if ((this.currentIteration != null && this.currentIteration?.done !== true) || this.pendingPartialTokens.length !== 0) {
            this.currentToken = this.currentIteration?.value ?? undefined;
            this.currentTokens = this.currentToken != null
                ? this.pendingPartialTokens.length === 0
                    ? [this.currentToken]
                    : [...this.pendingPartialTokens, this.currentToken]
                : [...this.pendingPartialTokens];
            this.pendingPartialTokens.length = 0;

            this.currentText = this.llamaChat.model.detokenize(this.currentTokens, false, this.getLastTokens());

            if (this.functionEvaluationMode === false)
                this.currentQueuedTokenRelease = this.streamRegulator.addChunk({
                    tokens: this.currentTokens,
                    text: this.currentText
                });
            else
                this.currentQueuedTokenRelease = undefined;

            return true;
        }

        return false;
    }

    public holdPartialTokensForNextEvaluation() {
        if (this.pendingPartialTokens.length === 0 &&
            this.currentText.endsWith(UNKNOWN_UNICODE_CHAR) &&
            this.currentToken != null &&
            !this.llamaChat.model.isSpecialToken(this.currentToken) &&
            !this.llamaChat.model.isEogToken(this.currentToken)
        ) {
            this.pendingPartialTokens.length = 0;
            pushAll(this.pendingPartialTokens, this.currentTokens);
            this.streamRegulator.removeChunkIfLast(this.currentQueuedTokenRelease);
            return true;
        }

        return false;
    }

    public waitOnPartialCharactersOrWhiteSpaceTokens() {
        if (this.currentText.endsWith(UNKNOWN_UNICODE_CHAR) || (
            (this.grammar?.trimWhitespaceSuffix || this.trimWhitespaceSuffix) && this.currentText?.trim() === ""
        ) || (
            this.currentText === "" && this.locksToReleaseOnValidGeneration.length > 0 &&
            !this.llamaChat.model.isSpecialToken(this.currentToken)
        )) {
            if (this.currentQueuedTokenRelease != null)
                this.locksToReleaseOnValidGeneration.push(this.currentQueuedTokenRelease.createTextIndexLock(0));
        } else {
            while (this.locksToReleaseOnValidGeneration.length > 0)
                this.locksToReleaseOnValidGeneration.shift()!.dispose();
        }
    }

    public detectAndHandleFunctionStartSyntax() {
        if (!this.functionSyntaxStartDetectorEnabled)
            return;

        this.functionSyntaxStartDetector.recordGeneration({
            text: this.currentText,
            tokens: this.currentTokens,
            queuedTokenRelease: this.currentQueuedTokenRelease
        });

        if (this.currentQueuedTokenRelease != null && this.functionEvaluationMode === false && this.functionsEnabled &&
            this.functionSyntaxStartDetector.hasTriggeredStops
        ) {
            if (this.abortOnNonText) {
                this.shouldAbortBecauseOfNonText = true;
                return;
            }

            this.functionEvaluationMode = "functionName";
            this.currentQueuedTokenRelease.createTextIndexLock(0);

            this.stopGenerationDetector.clearTriggeredStops();
            this.stopGenerationDetector.clearInProgressStops();
            this.customStopGenerationTriggersDetector.clearTriggeredStops();
            this.customStopGenerationTriggersDetector.clearInProgressStops();

            pushAll(this.pendingTokens, this.streamRegulator.popFreeChunkTokens());

            const triggeredStops = this.functionSyntaxStartDetector.getTriggeredStops();
            const partiallyFreeTokens = this.streamRegulator.getPartiallyFreeChunk(this.llamaChat.model.tokenizer);

            const queuedTokensBeforeStopTrigger = getQueuedTokensBeforeStopTrigger(
                triggeredStops,
                partiallyFreeTokens,
                this.llamaChat.model.tokenizer
            );
            pushAll(this.pendingTokens, queuedTokensBeforeStopTrigger);

            const {
                firstRemainingGenerationAfterStop,
                stopTrigger
            } = StopGenerationDetector.getFirstRemainingGenerationAfterStop(triggeredStops);
            const remainingTextAfterStop = StopGenerationDetector.detokenizeRemainingGeneration(
                firstRemainingGenerationAfterStop,
                stopTrigger,
                this.llamaChat.model.tokenizer
            );

            this.currentFunctionCallPreviousPartLeftoverText = remainingTextAfterStop;
        }
    }

    public recordStopGenerationEvaluation() {
        this.rerenderTriggerDetector.recordGeneration({
            text: this.currentText,
            tokens: this.currentTokens,
            queuedTokenRelease: this.currentQueuedTokenRelease
        });
        this.stopGenerationDetector.recordGeneration({
            text: this.currentText,
            tokens: this.currentTokens,
            queuedTokenRelease: this.currentQueuedTokenRelease
        });
        this.customStopGenerationTriggersDetector.recordGeneration({
            text: this.currentText,
            tokens: this.currentTokens,
            queuedTokenRelease: this.currentQueuedTokenRelease
        });

        if (this.llamaChat.model.isEogToken(this.currentToken))
            this.currentQueuedTokenRelease?.createTokenIndexLock(0);
    }

    public popStreamRegulatorFreeTokens() {
        pushAll(this.pendingTokens, this.streamRegulator.popFreeChunkTokens());
    }

    public handleStopGenerationTrigger(lastHistoryItemType: "user" | "model", forceStopReason?: "eogToken") {
        const detectedStopGenerationTrigger = this.stopGenerationDetector.hasTriggeredStops ||
            this.customStopGenerationTriggersDetector.hasTriggeredStops ||
            this.llamaChat.model.isEogToken(this.currentToken);

        if ((detectedStopGenerationTrigger && !this.rerenderTriggerDetector.hasTriggeredStops) || forceStopReason != null) {
            this.stopGenerationDetector.clearInProgressStops();
            this.customStopGenerationTriggersDetector.clearInProgressStops();
            pushAll(this.pendingTokens, this.streamRegulator.popFreeChunkTokens());

            const triggeredStops = this.stopGenerationDetector.hasTriggeredStops
                ? this.stopGenerationDetector.getTriggeredStops()
                : this.customStopGenerationTriggersDetector.getTriggeredStops();

            const partiallyFreeTokens = this.streamRegulator.getPartiallyFreeChunk(this.llamaChat.model.tokenizer);

            const queuedTokensBeforeStopTrigger = getQueuedTokensBeforeStopTrigger(
                triggeredStops,
                partiallyFreeTokens,
                this.llamaChat.model.tokenizer
            );
            pushAll(this.pendingTokens, queuedTokensBeforeStopTrigger);

            const {firstRemainingGenerationAfterStop} = StopGenerationDetector.getFirstRemainingGenerationAfterStop(triggeredStops);

            this.removeFoundStartIgnoreTextsFromPendingTokens(true);

            this.pushPendingTokensAndCallOnToken();

            this.segmentHandler.onFinishedGeneration();
            const trimWhitespaceSuffix = this.grammar?.trimWhitespaceSuffix || this.trimWhitespaceSuffix;
            const responseSegments = this.segmentHandler.getModelResponseSegments(trimWhitespaceSuffix);
            const response = responseSegments
                .filter((segment) => typeof segment === "string")
                .join("");

            const lastEvaluation = {
                contextWindow: mergeGeneratedResultWithChatHistory(
                    lastHistoryItemType,
                    this.lastContextWindowHistory,
                    this.segmentHandler.getContextWindowModelResponseSegments(trimWhitespaceSuffix)
                ),
                cleanHistory: mergeGeneratedResultWithChatHistory(
                    lastHistoryItemType,
                    this.resolvedHistory,
                    responseSegments
                ),
                contextShiftMetadata: this.lastHistoryCompressionMetadata
            };
            const isEogToken = this.llamaChat.model.isEogToken(this.currentToken) || forceStopReason === "eogToken";

            if (isEogToken || this.stopGenerationDetector.hasTriggeredStops) {
                return {
                    response,
                    fullResponse: responseSegments,
                    lastEvaluation,
                    metadata: {
                        remainingGenerationAfterStop: firstRemainingGenerationAfterStop,
                        stopReason: isEogToken
                            ? "eogToken"
                            : "stopGenerationTrigger"
                    }
                } satisfies LlamaChatResponse<Functions>;
            }

            return {
                response,
                fullResponse: responseSegments,
                lastEvaluation,
                metadata: {
                    remainingGenerationAfterStop: firstRemainingGenerationAfterStop,
                    stopReason: "customStopTrigger",
                    customStopTrigger: triggeredStops[0]!.stopTrigger
                }
            } satisfies LlamaChatResponse<Functions>;
        }

        return undefined;
    }

    public spliceIgnoreStartTextDetectedTokens() {
        if (this.res.length === 0) {
            this.ignoreStartTextDetector.clearInProgressStops();
            this.ignoreStartTextDetector.clearTriggeredStops();

            const lastTokensForDetokenizer = resolveLastTokens([
                this.contextWindowTokens,
                this.ignoredStartTextTokens
            ]);
            this.ignoreStartTextDetector.recordGeneration({
                text: this.llamaChat.model.detokenize(this.pendingTokens, false, lastTokensForDetokenizer),
                tokens: this.pendingTokens
            });
        }
    }

    public isMaxTokensTriggered() {
        return this.maxTokens != null && this.maxTokens > 0 && this.generatedTokens >= this.maxTokens;
    }

    public moveFreePendingTokensToRes(removeFoundStartIgnoreTextsFromPendingTokens: boolean = true) {
        if (this.pendingTokens.length > 0 && (this.isMaxTokensTriggered() || !this.ignoreStartTextDetector.hasInProgressStops)) {
            if (removeFoundStartIgnoreTextsFromPendingTokens)
                this.removeFoundStartIgnoreTextsFromPendingTokens();

            this.pushPendingTokensAndCallOnToken();
        }
    }

    public handleMaxTokensTrigger(lastHistoryItemType: "user" | "model") {
        if (this.isMaxTokensTriggered()) {
            this.segmentHandler.onFinishedGeneration();
            const trimWhitespaceSuffix = this.grammar?.trimWhitespaceSuffix || this.trimWhitespaceSuffix;
            const responseSegments = this.segmentHandler.getModelResponseSegments(trimWhitespaceSuffix);

            return {
                response: responseSegments
                    .filter((segment) => typeof segment === "string")
                    .join(""),
                fullResponse: responseSegments,
                lastEvaluation: {
                    contextWindow: mergeGeneratedResultWithChatHistory(
                        lastHistoryItemType,
                        this.lastContextWindowHistory,
                        this.segmentHandler.getContextWindowModelResponseSegments(trimWhitespaceSuffix)
                    ),
                    cleanHistory: mergeGeneratedResultWithChatHistory(
                        lastHistoryItemType,
                        this.resolvedHistory,
                        responseSegments
                    ),
                    contextShiftMetadata: this.lastHistoryCompressionMetadata
                },
                metadata: {
                    stopReason: "maxTokens"
                }
            } satisfies LlamaChatResponse<Functions>;
        }

        return undefined;
    }

    public async handleBudgetTriggers() {
        let shouldReloadEvaluationState = false;

        if (this.budgets == null)
            return shouldReloadEvaluationState;

        for (const segmentType of this.segmentHandler.getOpenSegmentStack().reverse()) {
            const budget = this.getSegmentBudget(segmentType);
            if (budget == null)
                continue;

            const usedSegmentTokens = this.segmentHandler.getSegmentTokensCount(segmentType);
            if (usedSegmentTokens >= budget) {
                this.segmentHandler.closeSegment(segmentType);
                shouldReloadEvaluationState = true;
            }
        }

        return shouldReloadEvaluationState;
    }

    public getSegmentBudget(segmentType: ChatModelSegmentType) {
        const getBudget = (budget: number | undefined) => (
            (budget == null || budget === Infinity)
                ? null
                : budget
        );

        if (this.budgets == null)
            return null;

        if (segmentType === "thought")
            return getBudget(this.budgets.thoughtTokens);
        else if (segmentType === "comment")
            return getBudget(this.budgets.commentTokens);

        void (segmentType satisfies never);
        return null;
    }

    public handleShouldRerender() {
        this.shouldRerender = this.rerenderTriggerDetector.hasTriggeredStops;

        if (this.abortOnNonText && this.shouldRerender)
            this.shouldAbortBecauseOfNonText = true;

        return this.shouldRerender;
    }

    public updateShouldContextShift() {
        this.shouldContextShift = this.llamaChat.sequence.nextTokenIndex >= this.llamaChat.context.contextSize - 1;
        return this.shouldContextShift;
    }

    public get shouldAbort() {
        return !!(this.signal?.aborted && this.stopOnAbortSignal) || this.shouldAbortBecauseOfNonText;
    }

    public handleAbortTrigger(lastHistoryItemType: "user" | "model") {
        if (this.shouldAbort && this.signal?.aborted && this.stopOnAbortSignal) {
            if (this.res.length === 0)
                throw this.signal.reason;

            this.segmentHandler.onFinishedGeneration();
            const trimWhitespaceSuffix = this.grammar?.trimWhitespaceSuffix || this.trimWhitespaceSuffix;
            const responseSegments = this.segmentHandler.getModelResponseSegments(trimWhitespaceSuffix);

            return {
                response: responseSegments
                    .filter((segment) => typeof segment === "string")
                    .join(""),
                fullResponse: responseSegments,
                lastEvaluation: {
                    contextWindow: mergeGeneratedResultWithChatHistory(
                        lastHistoryItemType,
                        this.lastContextWindowHistory,
                        this.segmentHandler.getContextWindowModelResponseSegments(trimWhitespaceSuffix)
                    ),
                    cleanHistory: mergeGeneratedResultWithChatHistory(
                        lastHistoryItemType,
                        this.resolvedHistory,
                        responseSegments
                    ),
                    contextShiftMetadata: this.lastHistoryCompressionMetadata
                },
                metadata: {
                    stopReason: this.shouldAbortBecauseOfNonText
                        ? "eogToken"
                        : "abort"
                }
            } satisfies LlamaChatResponse<Functions>;
        }

        return undefined;
    }

    private pushPendingTokensAndCallOnToken() {
        if (this.pendingTokens.length === 0)
            return;

        this.segmentHandler.processTokens(this.pendingTokens);
        pushAll(this.res, this.pendingTokens);
        this.pendingTokens.length = 0;
    }

    private getLastTokens(maxTokens: number = maxRecentDetokenizerTokens): Token[] {
        return resolveLastTokens([
            this.contextWindowTokens,
            this.ignoredStartTextTokens,
            this.pendingTokens,
            this.streamRegulator.getLastQueuedChunkTokens(maxTokens),
            this.getContextWindowFunctionCallsTokens(),
            this.pendingPartialTokens
        ], maxTokens);
    }
}

type RawSegment<S extends ChatModelSegmentType = ChatModelSegmentType> = Token[] | {
    type: S,
    tokens: Token[],
    start: boolean,
    ended: boolean,
    startTime?: number,
    endTime?: number
};
type ChatSegments = Array<string | LlamaChatResponseSegment>;
class SegmentHandler<const S extends ChatModelSegmentType = ChatModelSegmentType> {
    public readonly model: LlamaModel;

    private readonly onToken?: LLamaChatGenerateResponseOptions["onToken"];
    private readonly onTextChunk?: LLamaChatGenerateResponseOptions["onTextChunk"];
    private readonly onResponseChunk?: LLamaChatGenerateResponseOptions["onResponseChunk"];

    private readonly _closeAllSegmentsDetector?: StopGenerationDetector;
    private readonly _segmentDetectors: Map<S, {
        prefix: StopGenerationDetector,
        suffix?: StopGenerationDetector
    }>;
    private readonly _segmentsStack: S[] = [];
    private readonly _segmentsStackSet: Set<S> = new Set<S>();
    private _ownedSegmentsStackLength: number = 0;
    private readonly _segments: RawSegment<S>[] = [];
    private readonly _segmentsStartTokenTrail: Token[] = [];
    private readonly _segmentTokenCounts: Map<S | undefined, number>;
    private readonly _contextWindowSegments: RawSegment<S>[] = [];
    private readonly _contextWindowStartTokenTrail: Token[] = [];
    private readonly _initialTokensTrail: Token[];
    private readonly _tokensTrail: Token[];
    private readonly _streamRegulator = new TokenStreamRegulator();
    private readonly _segmentDefinitions: Map<S, {
        prefix: string | LlamaText,
        suffix?: string | LlamaText
    }>;

    public constructor({
        model, onTextChunk, onToken, onResponseChunk,
        segmentDefinitions, closeAllSegments, initialSegmentStack, initialTokenCounts,
        previousTokens
    }: {
        model: LlamaModel,
        onToken?: LLamaChatGenerateResponseOptions["onToken"],
        onTextChunk?: LLamaChatGenerateResponseOptions["onTextChunk"],
        onResponseChunk?: LLamaChatGenerateResponseOptions["onResponseChunk"],
        segmentDefinitions: Map<S, {
            prefix: string | LlamaText,
            suffix?: string | LlamaText
        }>,
        closeAllSegments?: string | LlamaText,
        initialSegmentStack: S[],
        initialTokenCounts: Map<S | undefined, number>,
        previousTokens: Token[]
    }) {
        this.model = model;
        this.onTextChunk = onTextChunk;
        this.onToken = onToken;
        this.onResponseChunk = onResponseChunk;
        this._initialTokensTrail = previousTokens.slice(-maxRecentDetokenizerTokens);
        this._segmentsStartTokenTrail = previousTokens.slice(-maxRecentDetokenizerTokens);
        this._tokensTrail = previousTokens.slice(-maxRecentDetokenizerTokens);

        this._closeAllSegmentsDetector = closeAllSegments != null
            ? new StopGenerationDetector()
                .addStopTrigger(StopGenerationDetector.resolveLlamaTextTrigger(LlamaText(closeAllSegments), this.model.tokenizer))
            : undefined;
        this._segmentDetectors = new Map();
        this._segmentsStack = initialSegmentStack;
        this._segmentsStackSet = new Set(initialSegmentStack);
        this._ownedSegmentsStackLength = initialSegmentStack.length;
        this._segmentDefinitions = segmentDefinitions;
        this._segmentTokenCounts = new Map(initialTokenCounts);

        for (const [segment, {prefix, suffix}] of segmentDefinitions.entries()) {
            this._segmentDetectors.set(segment, {
                prefix: new StopGenerationDetector()
                    .addStopTrigger(StopGenerationDetector.resolveLlamaTextTrigger(LlamaText(prefix), this.model.tokenizer)),
                suffix: suffix != null
                    ? new StopGenerationDetector()
                        .addStopTrigger(StopGenerationDetector.resolveLlamaTextTrigger(LlamaText(suffix), this.model.tokenizer))
                    : undefined
            });
        }
    }

    public processTokens(tokens: Token[]) {
        if (tokens.length === 0)
            return;

        let pendingTokens: Token[] = [];
        for (const token of tokens) {
            pendingTokens.push(token);
            const currentText = this.model.detokenize(pendingTokens, false, this._tokensTrail);

            if (currentText.endsWith(UNKNOWN_UNICODE_CHAR))
                continue;

            pushAll(this._tokensTrail, pendingTokens);

            this._processTokens(pendingTokens, currentText);

            pendingTokens = [];
        }
    }

    public onFinishedGeneration() {
        this._clearDetectors();
        this._pushCurrentTokens(this._streamRegulator.popFreeChunkTokens());
    }

    public resetContextWindow() {
        this._contextWindowSegments.length = 0;

        this._contextWindowStartTokenTrail.length = 0;
        pushAll(this._contextWindowStartTokenTrail, this._getTokenTrailFromResult());
    }

    public openSegment(type: S) {
        const now = Date.now();

        this._segmentsStack.push(type);
        this._segmentsStackSet.add(type);
        this._segments.push({type, tokens: [], ended: false, start: true, startTime: now});
        this._contextWindowSegments.push({type, tokens: [], ended: false, start: true, startTime: now});
        this.onResponseChunk?.({
            type: "segment",
            segmentType: type,
            tokens: [],
            text: "",
            segmentStartTime: new Date(now)
        });
    }

    public closeSegment(type: S) {
        if (!this.isSegmentTypeOpen(type))
            return;

        this._closeSegment(type);
    }

    public getSegmentTokensCount(type: S | undefined): number {
        return this._segmentTokenCounts.get(type) ?? 0;
    }

    public isSegmentTypeOpen(type: S): boolean {
        return this._segmentsStackSet.has(type);
    }

    public get topOpenSegmentType(): S | undefined {
        return this._segmentsStack.at(-1);
    }

    /**
     * First segment in the stack is the top most that'll close last.
     * ```
     * <segment1>
     *     some text here
     *     <segment2>
     *        some text here
     *         <segment3>
     *             some text here
     *         </segment3>
     * ```
     * In that example, the top most segment is `segment1`, and the last open segment is `segment2` (which is the next one to close).
     * So in that example, this function will return:
     * ```
     * ["segment1", "segment2"]
     * ```
     */
    public getOpenSegmentStack(): S[] {
        return this._segmentsStack.slice(this._ownedSegmentsStackLength);
    }

    private _processTokens(tokens: Token[], text: string) {
        const queuedTokenRelease = this._streamRegulator.addChunk({
            tokens,
            text
        });

        const currentType = this._segmentsStack.at(-1);

        const handleDetector = (stopDetector: StopGenerationDetector | undefined, action: "pop" | "push" | "reset", type: S) => {
            if (stopDetector == null)
                return false;

            stopDetector.recordGeneration({
                text,
                tokens,
                queuedTokenRelease
            });

            if (stopDetector.hasTriggeredStops) {
                const [leftTokens, leftText] = this._handleTriggeredStopDetector(stopDetector);

                if (action === "pop")
                    this._closeSegment(type);
                else if (action === "push") {
                    this.openSegment(type);
                } else if (action === "reset") {
                    const now = Date.now();

                    while (this._segmentsStack.length > 0) {
                        const segmentType = this._segmentsStack.pop()!;
                        this._segmentsStackSet.delete(segmentType);

                        const lastSegment = this._segments.at(-1);
                        if (lastSegment != null && !(lastSegment instanceof Array) && lastSegment.type === segmentType) {
                            lastSegment.ended = true;
                            lastSegment.endTime = now;
                            this.onResponseChunk?.({
                                type: "segment",
                                segmentType: segmentType,
                                tokens: [],
                                text: "",
                                segmentStartTime: undefined,
                                segmentEndTime: new Date(now)
                            });
                        } else {
                            this._segments.push({type: segmentType, tokens: [], ended: true, start: false, endTime: now});
                            this.onResponseChunk?.({
                                type: "segment",
                                segmentType: segmentType,
                                tokens: [],
                                text: "",
                                segmentStartTime: undefined,
                                segmentEndTime: new Date(now)
                            });
                        }

                        const lastContextWindowSegment = this._contextWindowSegments.at(-1);
                        if (lastContextWindowSegment != null && !(lastContextWindowSegment instanceof Array) &&
                            lastContextWindowSegment.type === segmentType
                        )
                            lastContextWindowSegment.ended = true;
                        else
                            this._contextWindowSegments.push({type: segmentType, tokens: [], ended: true, start: false, endTime: now});
                    }

                    this._ownedSegmentsStackLength = 0;
                }

                if (leftTokens.length > 0)
                    this._processTokens(leftTokens, leftText);

                return true;
            }

            return false;
        };

        if (currentType != null) {
            if (handleDetector(this._closeAllSegmentsDetector, "reset", currentType))
                return;

            if (handleDetector(this._segmentDetectors.get(currentType)?.suffix, "pop", currentType))
                return;
        } else
            this._closeAllSegmentsDetector?.clearInProgressStops();

        for (const [type, {prefix, suffix}] of this._segmentDetectors.entries()) {
            if (!this._segmentsStackSet.has(type)) {
                if (handleDetector(prefix, "push", type))
                    return;
            } else
                prefix.clearInProgressStops();

            if (this._segmentsStackSet.has(type)) {
                // `currentType` suffix is already handled above
                if (type !== currentType && handleDetector(suffix, "pop", type))
                    return;
            } else
                suffix?.clearInProgressStops();
        }

        this._pushCurrentTokens(this._streamRegulator.popFreeChunkTokens());
    }

    private _handleTriggeredStopDetector(stopDetector: StopGenerationDetector): [remainingTokens: Token[], reamingText: string] {
        this._clearDetectors(stopDetector);
        stopDetector.clearInProgressStops();
        const triggeredStops = stopDetector.getTriggeredStops();
        const freeTokens = this._streamRegulator.popFreeChunkTokens();
        const partiallyFreeTokens = this._streamRegulator.getPartiallyFreeChunk(this.model.tokenizer);
        const queuedTokensBeforeStopTrigger = getQueuedTokensBeforeStopTrigger(
            triggeredStops,
            partiallyFreeTokens,
            this.model.tokenizer
        );

        const {firstRemainingGenerationAfterStop} = StopGenerationDetector.getFirstRemainingGenerationAfterStop(triggeredStops);
        const remainingTokens = typeof firstRemainingGenerationAfterStop === "string"
            ? firstRemainingGenerationAfterStop === ""
                ? []
                : this.model.tokenize(firstRemainingGenerationAfterStop, false)
            : (firstRemainingGenerationAfterStop ?? []);
        const remainingText = typeof firstRemainingGenerationAfterStop === "string"
            ? firstRemainingGenerationAfterStop
            : this.model.detokenize(
                remainingTokens,
                false,
                queuedTokensBeforeStopTrigger.length === 0
                    ? this._getTokenTrailFromResult()
                    : queuedTokensBeforeStopTrigger
            );

        this._pushCurrentTokens([...freeTokens, ...queuedTokensBeforeStopTrigger]);

        stopDetector.clearTriggeredStops();
        this._streamRegulator.reset();

        return [remainingTokens, remainingText];
    }

    private _closeSegment(type?: S) {
        if (type == null)
            return;

        const lastSegment = this._segments.at(-1);
        const now = Date.now();
        if (lastSegment != null && !(lastSegment instanceof Array) && lastSegment.type === type && this._segmentsStack.at(-1) === type) {
            if (lastSegment.ended !== true) {
                lastSegment.ended = true;
                lastSegment.endTime = now;

                this.onResponseChunk?.({
                    type: "segment",
                    segmentType: type,
                    tokens: [],
                    text: "",
                    segmentStartTime: undefined,
                    segmentEndTime: new Date(now)
                });
            }

            const lastContextWindowSegment = this._contextWindowSegments.at(-1);
            if (lastContextWindowSegment != null && !(lastContextWindowSegment instanceof Array) &&
                lastContextWindowSegment.type === type && this._segmentsStack.at(-1) === type
            ) {
                if (lastContextWindowSegment.ended !== true) {
                    lastContextWindowSegment.ended = true;
                    lastContextWindowSegment.endTime = now;
                }
            } else
                this._contextWindowSegments.push({type, tokens: [], ended: true, start: false, endTime: now});

            this._segmentsStackSet.delete(this._segmentsStack.pop()!);

            if (this._segmentsStack.length < this._ownedSegmentsStackLength)
                this._ownedSegmentsStackLength = this._segmentsStack.length;

            return;
        }

        const typeIndex = this._segmentsStack.lastIndexOf(type);
        if (typeIndex < 0)
            return;

        for (let i = this._segmentsStack.length - 1; i >= typeIndex; i--) {
            const segmentType = this._segmentsStack.pop()!;
            this._segmentsStackSet.delete(segmentType);

            if (this._segmentsStack.length < this._ownedSegmentsStackLength)
                this._ownedSegmentsStackLength = this._segmentsStack.length;

            this._segments.push({type: segmentType, tokens: [], ended: true, start: false, endTime: now});
            this._contextWindowSegments.push({type: segmentType, tokens: [], ended: true, start: false, endTime: now});

            this.onResponseChunk?.({
                type: "segment",
                segmentType: segmentType,
                tokens: [],
                text: "",
                segmentStartTime: undefined,
                segmentEndTime: new Date(now)
            });
        }
    }

    private _clearDetectors(skipDetector?: StopGenerationDetector) {
        if (this._closeAllSegmentsDetector !== skipDetector) {
            this._closeAllSegmentsDetector?.clearInProgressStops();
            this._closeAllSegmentsDetector?.clearTriggeredStops();
        }

        for (const {prefix, suffix} of this._segmentDetectors.values()) {
            if (prefix !== skipDetector) {
                prefix.clearInProgressStops();
                prefix.clearTriggeredStops();
            }

            if (suffix !== skipDetector) {
                suffix?.clearInProgressStops();
                suffix?.clearTriggeredStops();
            }
        }
    }

    private _pushCurrentTokens(tokens: Token[]) {
        const lastSegment = this._segments.at(-1);
        const lastContextWindowSegment = this._contextWindowSegments.at(-1);
        const type = this._segmentsStack.at(-1);

        this._segmentTokenCounts.set(type, (this._segmentTokenCounts.get(type) ?? 0) + tokens.length);

        if (type == null) {
            if (lastSegment == null) {
                const text = (this.onResponseChunk != null || this.onTextChunk != null)
                    ? this.model.detokenize(tokens, false, this._getTokenTrailFromResult())
                    : "";

                this._segments.push(tokens);

                this.onToken?.(tokens.slice());
                this.onTextChunk?.(text);
                this.onResponseChunk?.({type: undefined, segmentType: undefined, tokens: tokens.slice(), text});
            } else {
                const text = (this.onResponseChunk != null || this.onTextChunk != null)
                    ? this.model.detokenize(tokens, false, this._getTokenTrailFromResult())
                    : "";

                if (lastSegment instanceof Array)
                    pushAll(lastSegment, tokens);
                else
                    this._segments.push(tokens);

                this.onToken?.(tokens.slice());
                this.onTextChunk?.(text);
                this.onResponseChunk?.({type: undefined, segmentType: undefined, tokens: tokens.slice(), text});
            }

            if (lastContextWindowSegment == null)
                this._contextWindowSegments.push(tokens.slice());
            else {
                if (lastContextWindowSegment instanceof Array)
                    pushAll(lastContextWindowSegment, tokens);
                else
                    this._contextWindowSegments.push(tokens.slice());
            }
        } else {
            const now = Date.now();
            if (lastSegment == null) {
                const text = this.onResponseChunk != null
                    ? this.model.detokenize(tokens, false, this._getTokenTrailFromResult())
                    : "";

                this._segments.push({
                    type,
                    tokens,
                    ended: false,
                    start: this._segmentsStack.length > this._ownedSegmentsStackLength,
                    startTime: now
                });

                this.onResponseChunk?.({
                    type: "segment",
                    segmentType: type,
                    tokens: tokens.slice(),
                    text,
                    segmentStartTime: new Date(now)
                });
            } else {
                const text = this.onResponseChunk != null
                    ? this.model.detokenize(tokens, false, this._getTokenTrailFromResult())
                    : "";

                if (lastSegment instanceof Array || lastSegment.type !== type) {
                    this._segments.push({
                        type,
                        tokens,
                        ended: false,
                        start: this._segmentsStack.length > this._ownedSegmentsStackLength,
                        startTime: now
                    });
                    this.onResponseChunk?.({
                        type: "segment",
                        segmentType: type,
                        tokens: tokens.slice(),
                        text,
                        segmentStartTime: new Date(now)
                    });
                } else {
                    pushAll(lastSegment.tokens, tokens);
                    this.onResponseChunk?.({
                        type: "segment",
                        segmentType: type,
                        tokens: tokens.slice(),
                        text,
                        segmentStartTime: undefined
                    });
                }
            }

            if (lastContextWindowSegment == null)
                this._contextWindowSegments.push({
                    type,
                    tokens: tokens.slice(),
                    ended: false,
                    start: this._segmentsStack.length > this._ownedSegmentsStackLength,
                    startTime: now
                });
            else {
                if (lastContextWindowSegment instanceof Array || lastContextWindowSegment.type !== type)
                    this._contextWindowSegments.push({
                        type,
                        tokens: tokens.slice(),
                        ended: false,
                        start: this._segmentsStack.length > this._ownedSegmentsStackLength,
                        startTime: now
                    });
                else
                    pushAll(lastContextWindowSegment.tokens, tokens);
            }
        }
    }

    private _getTokenTrailFromResult(): Token[] {
        const res: Token[] = [];

        for (let i = this._segments.length - 1; i >= 0; i--) {
            const segment = this._segments[i]!;
            const segmentTokens = segment instanceof Array
                ? segment
                : segment.tokens;

            for (let j = segmentTokens.length - 1; j >= 0; j--) {
                res.unshift(segmentTokens[j]!);

                if (res.length >= maxRecentDetokenizerTokens)
                    return res;
            }
        }

        for (let i = this._initialTokensTrail.length - 1; i >= 0; i--) {
            res.unshift(this._initialTokensTrail[i]!);

            if (res.length >= maxRecentDetokenizerTokens)
                return res;
        }

        return res;
    }

    public getModelResponseSegments(trimWhitespaceSuffix: boolean = false) {
        return this._getModelResponseForSegments(this._segments, this._segmentsStartTokenTrail, trimWhitespaceSuffix);
    }

    public getContextWindowModelResponseSegments(trimWhitespaceSuffix: boolean = false) {
        return this._getModelResponseForSegments(this._contextWindowSegments, this._contextWindowStartTokenTrail, trimWhitespaceSuffix);
    }

    private _getModelResponseForSegments(
        rawSegments: RawSegment<S>[], recentTokens: Token[], trimWhitespaceSuffix: boolean
    ): ChatSegments {
        let tokenTrail = resolveLastTokens([recentTokens]);

        return rawSegments.map((rawSegment, index): ChatSegments[number] => {
            const isLast = index === rawSegments.length - 1;

            if (rawSegment instanceof Array) {
                let text = this.model.detokenize(rawSegment, false, tokenTrail);
                if (isLast && trimWhitespaceSuffix)
                    text = text.trimEnd();

                tokenTrail = resolveLastTokens([tokenTrail, rawSegment]);
                return text;
            }

            let text = this.model.detokenize(rawSegment.tokens, false, tokenTrail);
            if (isLast && rawSegment.ended && trimWhitespaceSuffix)
                text = text.trimEnd();

            tokenTrail = resolveLastTokens([tokenTrail, rawSegment.tokens]);

            const segmentDefinition = this._segmentDefinitions.get(rawSegment.type);

            return {
                type: "segment",
                segmentType: rawSegment.type,
                text,
                ended: rawSegment.ended,
                raw: segmentDefinition == null
                    ? LlamaText([text]).toJSON()
                    : LlamaText([
                        rawSegment.start
                            ? segmentDefinition.prefix
                            : "",
                        text,
                        rawSegment.ended
                            ? (segmentDefinition.suffix ?? "")
                            : ""
                    ]).toJSON(),
                startTime: rawSegment.startTime != null
                    ? new Date(rawSegment.startTime).toISOString()
                    : undefined,
                endTime: rawSegment.endTime != null
                    ? new Date(rawSegment.endTime).toISOString()
                    : undefined
            };
        });
    }

    public static getStackFromModelResponse(modelResponse: ChatModelResponse["response"]) {
        const stack: ChatModelSegmentType[] = [];
        const stackSet: Set<ChatModelSegmentType> = new Set();

        for (const item of modelResponse) {
            if (typeof item === "string" || isChatModelResponseFunctionCall(item))
                continue;

            void (item.type satisfies "segment");
            if (item.ended && stack.at(-1) === item.segmentType) {
                stack.pop();
                stackSet.delete(item.segmentType);
            } else if (!item.ended && !stackSet.has(item.segmentType)) {
                stack.push(item.segmentType);
                stackSet.add(item.segmentType);
            }
        }

        return stack;
    }

    public static getSegmentTokenCounts(
        modelResponse: ChatModelResponse["response"],
        tokenizer: Tokenizer
    ) {
        const segmentTokenCounts = new Map<ChatModelSegmentType | undefined, number>();

        for (const item of modelResponse) {
            if (typeof item === "string") {
                segmentTokenCounts.set(
                    undefined,
                    (segmentTokenCounts.get(undefined) ?? 0) + tokenizer(item, false, "trimLeadingSpace").length
                );
                continue;
            } else if (isChatModelResponseFunctionCall(item))
                continue;

            void (item.type satisfies "segment");

            segmentTokenCounts.set(
                item.segmentType,
                (segmentTokenCounts.get(item.segmentType) ?? 0) + tokenizer(item.text, false, "trimLeadingSpace").length
            );
        }

        return segmentTokenCounts;
    }
}
