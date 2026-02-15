import {DisposeAggregator, DisposedError, EventRelay, withLock} from "lifecycle-utils";
import {ChatWrapper} from "../../ChatWrapper.js";
import {
    ChatHistoryItem, ChatModelFunctionCall, ChatModelFunctions, ChatModelResponse, ChatSessionModelFunction, ChatSessionModelFunctions,
    Token
} from "../../types.js";
import {appendUserMessageToChatHistory} from "../../utils/appendUserMessageToChatHistory.js";
import {LlamaContextSequence} from "../LlamaContext/LlamaContext.js";
import {LlamaGrammar} from "../LlamaGrammar.js";
import {
    LlamaChat, LLamaChatContextShiftOptions, LlamaChatResponse, LlamaChatResponseChunk, LlamaChatResponseFunctionCall,
    LlamaChatResponseFunctionCallParamsChunk
} from "../LlamaChat/LlamaChat.js";
import {EvaluationPriority} from "../LlamaContext/types.js";
import {TokenBias} from "../TokenBias.js";
import {LlamaText, LlamaTextJSON} from "../../utils/LlamaText.js";
import {wrapAbortSignal} from "../../utils/wrapAbortSignal.js";
import {safeEventCallback} from "../../utils/safeEventCallback.js";
import {GgufArchitectureType} from "../../gguf/types/GgufMetadataTypes.js";
import {
    LLamaChatPromptCompletionEngineOptions, LlamaChatSessionPromptCompletionEngine
} from "./utils/LlamaChatSessionPromptCompletionEngine.js";


export type LlamaChatSessionOptions = {
    contextSequence: LlamaContextSequence,

    /** `"auto"` is used by default */
    chatWrapper?: "auto" | ChatWrapper,

    systemPrompt?: string,

    /**
     * Add the system prompt even on models that don't support a system prompt.
     *
     * Each chat wrapper has its own workaround for adding a system prompt to a model that doesn't support it,
     * but forcing the system prompt on unsupported models may not always work as expected.
     *
     * Use with caution.
     */
    forceAddSystemPrompt?: boolean,

    /**
     * Automatically dispose the sequence when the session is disposed.
     *
     * Defaults to `false`.
     */
    autoDisposeSequence?: boolean,

    contextShift?: LlamaChatSessionContextShiftOptions
};

export type LlamaChatSessionContextShiftOptions = {
    /**
     * The number of tokens to delete from the context window to make space for new ones.
     * Defaults to 10% of the context size.
     */
    size?: LLamaChatContextShiftOptions["size"],

    /**
     * The strategy to use when deleting tokens from the context window.
     *
     * Defaults to `"eraseFirstResponseAndKeepFirstSystem"`.
     */
    strategy?: LLamaChatContextShiftOptions["strategy"]
};

export type LLamaChatPromptOptions<Functions extends ChatSessionModelFunctions | undefined = ChatSessionModelFunctions | undefined> = {
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
     * Disabled by default.
     */
    trimWhitespaceSuffix?: boolean,

    /**
     * Force a given text prefix to be the start of the model response, to make the model follow a certain direction.
     *
     * May cause some models to not use the given functions in some scenarios where they would have been used otherwise,
     * so avoid using it together with function calling if you notice unexpected behavior.
     */
    responsePrefix?: string,

    /**
     * See the parameter `evaluationPriority` on the `LlamaContextSequence.evaluate()` function for more information.
     */
    evaluationPriority?: EvaluationPriority,

    repeatPenalty?: false | LlamaChatSessionRepeatPenalty,

    /**
     * Adjust the probability of tokens being generated.
     * Can be used to bias the model to generate tokens that you want it to lean towards,
     * or to avoid generating tokens that you want it to avoid.
     */
    tokenBias?: TokenBias | (() => TokenBias),

    /**
     * Custom stop triggers to stop the generation of the response when any of the provided triggers are found.
     */
    customStopTriggers?: (LlamaText | string | (string | Token)[])[],

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
     * Set the maximum number of tokens that the model is allowed to spend on various segmented responses.
     */
    budgets?: {
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
    }
} & ({
    grammar?: LlamaGrammar,
    functions?: never,
    documentFunctionParams?: never,
    maxParallelFunctionCalls?: never,
    onFunctionCallParamsChunk?: never
} | {
    grammar?: never,
    functions?: Functions | ChatSessionModelFunctions,
    documentFunctionParams?: boolean,
    maxParallelFunctionCalls?: number,
    onFunctionCallParamsChunk?: (chunk: LlamaChatResponseFunctionCallParamsChunk) => void
});

export type LLamaChatCompletePromptOptions = {
    /**
     * Generate a completion for the given user prompt up to the given number of tokens.
     *
     * Defaults to `256` or half the context size, whichever is smaller.
     */
    maxTokens?: LLamaChatPromptOptions["maxTokens"],

    /**
     * When a completion already started being generated and then the given `signal` is aborted,
     * the generation will stop and the completion will be returned as-is instead of throwing an error.
     *
     * Defaults to `false`.
     */
    stopOnAbortSignal?: LLamaChatPromptOptions["stopOnAbortSignal"],

    /**
     * Called as the model generates a completion with the generated text chunk.
     *
     * Useful for streaming the generated completion as it's being generated.
     */
    onTextChunk?: LLamaChatPromptOptions["onTextChunk"],

    /**
     * Called as the model generates a completion with the generated tokens.
     *
     * Preferably, you'd want to use `onTextChunk` instead of this.
     */
    onToken?: LLamaChatPromptOptions["onToken"],

    signal?: LLamaChatPromptOptions["signal"],
    temperature?: LLamaChatPromptOptions["temperature"],
    minP?: LLamaChatPromptOptions["minP"],
    topK?: LLamaChatPromptOptions["topK"],
    topP?: LLamaChatPromptOptions["topP"],
    seed?: LLamaChatPromptOptions["seed"],
    xtc?: LLamaChatPromptOptions["xtc"],
    trimWhitespaceSuffix?: LLamaChatPromptOptions["trimWhitespaceSuffix"],
    evaluationPriority?: LLamaChatPromptOptions["evaluationPriority"],
    repeatPenalty?: LLamaChatPromptOptions["repeatPenalty"],
    tokenBias?: LLamaChatPromptOptions["tokenBias"],
    customStopTriggers?: LLamaChatPromptOptions["customStopTriggers"],

    grammar?: LlamaGrammar,

    /**
     * Functions are not used by the model here,
     * but are used for keeping the instructions given to the model about the functions in the current context state,
     * to avoid context shifts.
     *
     * It's best to provide the same functions that were used for the previous prompt here.
     */
    functions?: ChatSessionModelFunctions,

    /**
     * Functions are not used by the model here,
     * but are used for keeping the instructions given to the model about the functions in the current context state,
     * to avoid context shifts.
     *
     * It's best to provide the same value that was used for the previous prompt here.
     */
    documentFunctionParams?: boolean,

    /**
     * Whether to complete the prompt as a model response.
     *
     * - **`"auto"`**: Automatically determine whether to complete as a model response based on the model used.
     *   This is a good option to workaround some models that don't support used prompt completions.
     * - **`true`**: Always complete as a model response
     * - **`false`**: Never complete as a model response
     *
     * Defaults to `"auto"`.
     */
    completeAsModel?: "auto" | boolean | {
        /**
         * Whether to complete the prompt as a model response.
         *
         * - **`"auto"`**: Automatically determine whether to complete as a model response based on the model used.
         *   This is a good option to workaround some models that don't support used prompt completions.
         * - **`true`**: Always complete as a model response
         * - **`false`**: Never complete as a model response
         *
         * Defaults to `"auto"`.
         */
        enabled?: "auto" | boolean,

        /**
         * The messages to append to the chat history to generate a completion as a model response.
         *
         * If the last message is a model message, the prompt will be pushed to it for the completion,
         * otherwise a new model message will be added with the prompt.
         *
         * It must contain a user message or a system message before the model message.
         *
         * Default to:
         * ```ts
         * [
         *     {
         *         type: "system",
         *         text: "For your next response predict what the user may send next. " +
         *             "No yapping, no whitespace. Match the user's language and tone."
         *     },
         *     {type: "user", text: ""},
         *     {type: "model", response: [""]}
         * ]
         * ```
         */
        appendedMessages?: ChatHistoryItem[]
    }
};

export type LLamaChatPreloadPromptOptions = {
    signal?: LLamaChatCompletePromptOptions["signal"],
    evaluationPriority?: LLamaChatCompletePromptOptions["evaluationPriority"],
    functions?: LLamaChatCompletePromptOptions["functions"],
    documentFunctionParams?: LLamaChatCompletePromptOptions["documentFunctionParams"]
};

export type LlamaChatSessionRepeatPenalty = {
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

const defaultCompleteAsModel = {
    enabled: "auto",
    appendedMessages: [
        {
            type: "system",
            text: "For your next response predict what the user may send next. No yapping, no whitespace. Match the user's language and tone."
        },
        {type: "user", text: ""},
        {type: "model", response: [""]}
    ]
} as const satisfies LLamaChatCompletePromptOptions["completeAsModel"];

/**
 * @see [Using `LlamaChatSession`](https://node-llama-cpp.withcat.ai/guide/chat-session) tutorial
 */
export class LlamaChatSession {
    /** @internal */ private readonly _disposeAggregator = new DisposeAggregator();
    /** @internal */ private readonly _autoDisposeSequence: boolean;
    /** @internal */ private readonly _contextShift?: LlamaChatSessionContextShiftOptions;
    /** @internal */ private readonly _forceAddSystemPrompt: boolean;
    /** @internal */ private readonly _systemPrompt?: string;
    /** @internal */ private readonly _chatLock = {};
    /** @internal */ private _chatHistory: ChatHistoryItem[];
    /** @internal */ private _lastEvaluation?: LlamaChatResponse["lastEvaluation"];
    /** @internal */ private _canUseContextWindowForCompletion: boolean = true;
    /** @internal */ private _chat: LlamaChat | null;
    /** @internal */ public _chatHistoryStateRef = {};
    /** @internal */ public readonly _preloadAndCompleteAbortControllers = new Set<AbortController>();

    public readonly onDispose = new EventRelay<void>();

    public constructor(options: LlamaChatSessionOptions) {
        const {
            contextSequence,
            chatWrapper = "auto",
            systemPrompt,
            forceAddSystemPrompt = false,
            autoDisposeSequence = false,
            contextShift
        } = options;

        if (contextSequence == null)
            throw new Error("contextSequence cannot be null");

        if (contextSequence.disposed)
            throw new DisposedError();

        this._contextShift = contextShift;
        this._forceAddSystemPrompt = forceAddSystemPrompt;
        this._systemPrompt = systemPrompt;

        this._chat = new LlamaChat({
            autoDisposeSequence,
            chatWrapper,
            contextSequence
        });

        const chatWrapperSupportsSystemMessages = this._chat.chatWrapper.settings.supportsSystemMessages;
        if (chatWrapperSupportsSystemMessages == null || chatWrapperSupportsSystemMessages || this._forceAddSystemPrompt)
            this._chatHistory = this._chat.chatWrapper.generateInitialChatHistory({systemPrompt: this._systemPrompt});
        else
            this._chatHistory = [];

        this._autoDisposeSequence = autoDisposeSequence;

        this._disposeAggregator.add(
            this._chat.onDispose.createListener(() => {
                this.dispose();
            })
        );
        this._disposeAggregator.add(this.onDispose.dispatchEvent);
    }

    public dispose({disposeSequence = this._autoDisposeSequence}: {disposeSequence?: boolean} = {}) {
        if (this._chat == null)
            return;

        this._chat.dispose({disposeSequence});
        this._chat = null;

        this._disposeAggregator.dispose();
    }

    /** @hidden */
    public [Symbol.dispose]() {
        return this.dispose();
    }

    public get disposed() {
        return this._chat == null || this._chat.disposed;
    }

    public get chatWrapper() {
        if (this._chat == null)
            throw new DisposedError();

        return this._chat.chatWrapper;
    }

    public get sequence() {
        if (this._chat == null)
            throw new DisposedError();

        return this._chat.sequence;
    }

    public get context() {
        return this.sequence.context;
    }

    public get model() {
        return this.sequence.model;
    }

    public async prompt<const Functions extends ChatSessionModelFunctions | undefined = undefined>(
        prompt: string,
        options: LLamaChatPromptOptions<Functions> = {}
    ) {
        const {
            functions,
            documentFunctionParams,
            maxParallelFunctionCalls,
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
            trimWhitespaceSuffix = false,
            responsePrefix,
            repeatPenalty,
            tokenBias,
            customStopTriggers
        } = options;

        const {responseText} = await this.promptWithMeta<Functions>(prompt, {
            // this is a workaround to allow passing both `functions` and `grammar`
            functions: functions as undefined,
            grammar: grammar as undefined,
            documentFunctionParams: documentFunctionParams as undefined,
            maxParallelFunctionCalls: maxParallelFunctionCalls as undefined,
            onFunctionCallParamsChunk: onFunctionCallParamsChunk as undefined,

            onTextChunk, onToken, onResponseChunk, budgets, signal, stopOnAbortSignal, maxTokens,
            temperature, minP, topK, topP, seed, xtc,
            trimWhitespaceSuffix, responsePrefix, repeatPenalty, tokenBias, customStopTriggers
        });

        return responseText;
    }

    /**
     * @param prompt
     * @param [options]
     */
    public async promptWithMeta<const Functions extends ChatSessionModelFunctions | undefined = undefined>(prompt: string, {
        functions,
        documentFunctionParams,
        maxParallelFunctionCalls,
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
        trimWhitespaceSuffix = false,
        responsePrefix,
        repeatPenalty,
        tokenBias,
        customStopTriggers,
        evaluationPriority
    }: LLamaChatPromptOptions<Functions> = {}) {
        this._ensureNotDisposed();

        if (grammar != null && grammar._llama !== this.model._llama)
            throw new Error("The LlamaGrammar used by passed to this function was created with a different Llama instance than the one used by this sequence's model. Make sure you use the same Llama instance for both the model and the grammar.");

        this._stopAllPreloadAndPromptCompletions();
        return await withLock([this._chatLock, "evaluation"], signal, async () => {
            this._ensureNotDisposed();
            this._stopAllPreloadAndPromptCompletions();

            if (this._chat == null)
                throw new DisposedError();

            const supportsParallelFunctionCalling = this._chat.chatWrapper.settings.functions.parallelism != null;
            const [abortController, disposeAbortController] = wrapAbortSignal(signal);
            let lastEvaluation = this._canUseContextWindowForCompletion
                ? this._lastEvaluation
                : undefined;
            let newChatHistory = appendUserMessageToChatHistory(this._chatHistory, prompt);
            let newContextWindowChatHistory = lastEvaluation?.contextWindow == null
                ? undefined
                : appendUserMessageToChatHistory(lastEvaluation?.contextWindow, prompt);
            let previousFunctionCalls: number = 0;

            const resolvedResponsePrefix = (responsePrefix != null && responsePrefix !== "")
                ? responsePrefix
                : undefined;

            newChatHistory.push({
                type: "model",
                response: resolvedResponsePrefix != null
                    ? [resolvedResponsePrefix]
                    : []
            });

            if (newContextWindowChatHistory != null)
                newContextWindowChatHistory.push({
                    type: "model",
                    response: resolvedResponsePrefix != null
                        ? [resolvedResponsePrefix]
                        : []
                });

            if (resolvedResponsePrefix != null) {
                safeEventCallback(onToken)?.(this.model.tokenize(resolvedResponsePrefix));
                safeEventCallback(onTextChunk)?.(resolvedResponsePrefix);
                safeEventCallback(onResponseChunk)?.({
                    type: undefined,
                    segmentType: undefined,
                    text: resolvedResponsePrefix,
                    tokens: this.model.tokenize(resolvedResponsePrefix)
                });
            }

            try {
                while (true) {
                    const functionCallsAndResults: Array<Promise<null | {
                        functionCall: LlamaChatResponseFunctionCall<Functions extends ChatModelFunctions ? Functions : ChatModelFunctions>,
                        functionDefinition: ChatSessionModelFunction<any>,
                        functionCallResult: any
                    }>> = [];
                    let canThrowFunctionCallingErrors = false;
                    let abortedOnFunctionCallError = false;

                    const initialOutputTokens = this._chat.sequence.tokenMeter.usedOutputTokens;
                    const {
                        lastEvaluation: currentLastEvaluation,
                        metadata
                    } = await this._chat.generateResponse<Functions>(newChatHistory, {
                        functions,
                        documentFunctionParams,
                        maxParallelFunctionCalls,
                        grammar: grammar as undefined, // this is a workaround to allow passing both `functions` and `grammar`
                        onTextChunk: safeEventCallback(onTextChunk),
                        onToken: safeEventCallback(onToken),
                        onResponseChunk: safeEventCallback(onResponseChunk),
                        onFunctionCallParamsChunk: onFunctionCallParamsChunk == null
                            ? undefined
                            : safeEventCallback((chunk) => onFunctionCallParamsChunk?.({
                                callIndex: previousFunctionCalls + chunk.callIndex,
                                functionName: chunk.functionName,
                                paramsChunk: chunk.paramsChunk,
                                done: chunk.done
                            })),
                        budgets: {
                            includeCurrentResponse: true,
                            thoughtTokens: budgets?.thoughtTokens,
                            commentTokens: budgets?.commentTokens
                        },
                        signal: abortController.signal,
                        stopOnAbortSignal,
                        repeatPenalty,
                        minP,
                        topK,
                        topP,
                        seed,
                        xtc,
                        tokenBias,
                        customStopTriggers,
                        maxTokens,
                        temperature,
                        trimWhitespaceSuffix,
                        contextShift: {
                            ...this._contextShift,
                            lastEvaluationMetadata: lastEvaluation?.contextShiftMetadata
                        },
                        evaluationPriority,
                        lastEvaluationContextWindow: {
                            history: newContextWindowChatHistory,
                            minimumOverlapPercentageToPreventContextShift: 0.5
                        },
                        onFunctionCall: async (functionCall) => {
                            functionCallsAndResults.push(
                                (async () => {
                                    try {
                                        const functionDefinition = functions?.[functionCall.functionName];

                                        if (functionDefinition == null)
                                            throw new Error(
                                                `The model tried to call function "${functionCall.functionName}" which is not defined`
                                            );

                                        const functionCallResult = await functionDefinition.handler(functionCall.params as any);

                                        return {
                                            functionCall,
                                            functionDefinition,
                                            functionCallResult
                                        };
                                    } catch (err) {
                                        if (!abortController.signal.aborted) {
                                            abortedOnFunctionCallError = true;
                                            abortController.abort(err);
                                        }

                                        if (canThrowFunctionCallingErrors)
                                            throw err;

                                        return null;
                                    }
                                })()
                            );
                        }
                    });
                    this._ensureNotDisposed();
                    if (abortController.signal.aborted && (abortedOnFunctionCallError || !stopOnAbortSignal))
                        throw abortController.signal.reason;

                    if (maxTokens != null)
                        maxTokens = Math.max(0, maxTokens - (this._chat.sequence.tokenMeter.usedOutputTokens - initialOutputTokens));

                    lastEvaluation = currentLastEvaluation;
                    newChatHistory = lastEvaluation.cleanHistory;

                    if (functionCallsAndResults.length > 0) {
                        canThrowFunctionCallingErrors = true;
                        const functionCallResultsPromise = Promise.all(functionCallsAndResults);
                        const raceEventAbortController = new AbortController();
                        await Promise.race([
                            functionCallResultsPromise,
                            new Promise<void>((accept, reject) => {
                                abortController.signal.addEventListener("abort", () => {
                                    if (abortedOnFunctionCallError || !stopOnAbortSignal)
                                        reject(abortController.signal.reason);
                                    else
                                        accept();
                                }, {signal: raceEventAbortController.signal});

                                if (abortController.signal.aborted) {
                                    if (abortedOnFunctionCallError || !stopOnAbortSignal)
                                        reject(abortController.signal.reason);
                                    else
                                        accept();
                                }
                            })
                        ]);
                        raceEventAbortController.abort();
                        this._ensureNotDisposed();

                        if (!abortController.signal.aborted) {
                            const functionCallResults = (await functionCallResultsPromise)
                                .filter((result): result is Exclude<typeof result, null> => result != null);
                            this._ensureNotDisposed();

                            if (abortController.signal.aborted && (abortedOnFunctionCallError || !stopOnAbortSignal))
                                throw abortController.signal.reason;

                            newContextWindowChatHistory = lastEvaluation.contextWindow;

                            let startNewChunk = supportsParallelFunctionCalling;
                            for (const {functionCall, functionDefinition, functionCallResult} of functionCallResults) {
                                newChatHistory = addFunctionCallToChatHistory({
                                    chatHistory: newChatHistory,
                                    functionName: functionCall.functionName,
                                    functionDescription: functionDefinition.description,
                                    callParams: functionCall.params,
                                    callResult: functionCallResult,
                                    rawCall: functionCall.raw,
                                    startsNewChunk: startNewChunk
                                });

                                newContextWindowChatHistory = addFunctionCallToChatHistory({
                                    chatHistory: newContextWindowChatHistory,
                                    functionName: functionCall.functionName,
                                    functionDescription: functionDefinition.description,
                                    callParams: functionCall.params,
                                    callResult: functionCallResult,
                                    rawCall: functionCall.raw,
                                    startsNewChunk: startNewChunk
                                });

                                startNewChunk = false;
                                previousFunctionCalls++;
                            }

                            lastEvaluation.cleanHistory = newChatHistory;
                            lastEvaluation.contextWindow = newContextWindowChatHistory;

                            if (abortController.signal.aborted && !abortedOnFunctionCallError && stopOnAbortSignal) {
                                metadata.stopReason = "abort";
                                metadata.remainingGenerationAfterStop = undefined;
                            } else
                                continue;
                        }
                    }

                    this._lastEvaluation = lastEvaluation;
                    this._canUseContextWindowForCompletion = true;
                    this._chatHistory = newChatHistory;
                    this._chatHistoryStateRef = {};

                    const lastModelResponseItem = getLastModelResponseItem(newChatHistory);
                    const responseText = lastModelResponseItem.response
                        .filter((item): item is string => typeof item === "string")
                        .join("");

                    if (metadata.stopReason === "customStopTrigger")
                        return {
                            response: lastModelResponseItem.response,
                            responseText,
                            stopReason: metadata.stopReason,
                            customStopTrigger: metadata.customStopTrigger,
                            remainingGenerationAfterStop: metadata.remainingGenerationAfterStop
                        };

                    return {
                        response: lastModelResponseItem.response,
                        responseText,
                        stopReason: metadata.stopReason,
                        remainingGenerationAfterStop: metadata.remainingGenerationAfterStop
                    };
                }
            } finally {
                disposeAbortController();
            }
        });
    }

    /**
     * Preload a user prompt into the current context sequence state to make later inference of the model response begin sooner
     * and feel faster.
     *
     * > **Note:** Preloading a long user prompt can incur context shifts, so consider limiting the length of prompts you preload
     * @param prompt - the prompt to preload
     * @param [options]
     */
    public async preloadPrompt(prompt: string, options: LLamaChatPreloadPromptOptions = {}): Promise<void> {
        await this.completePromptWithMeta(prompt, {
            ...options,
            completeAsModel: false,
            maxTokens: 0
        });
    }

    /**
     * Preload a user prompt into the current context sequence state and generate a completion for it.
     *
     * > **Note:** Preloading a long user prompt and completing a user prompt with a high number of `maxTokens` can incur context shifts,
     * > so consider limiting the length of prompts you preload.
     * >
     * > Also, it's recommended to limit the number of tokens generated to a reasonable amount by configuring `maxTokens`.
     * @param prompt - the prompt to preload
     * @param [options]
     */
    public async completePrompt(prompt: string, options: LLamaChatCompletePromptOptions = {}): Promise<string> {
        const {completion} = await this.completePromptWithMeta(prompt, options);

        return completion;
    }

    /**
     * Create a smart completion engine that caches the prompt completions
     * and reuses them when the user prompt matches the beginning of the cached prompt or completion.
     *
     * All completions are made and cache is used only for the current chat session state.
     * You can create a single completion engine for an entire chat session.
     */
    public createPromptCompletionEngine(options?: LLamaChatPromptCompletionEngineOptions) {
        return LlamaChatSessionPromptCompletionEngine._create(this, options);
    }

    /**
     * See `completePrompt` for more information.
     * @param prompt
     * @param [options]
     */
    public async completePromptWithMeta(prompt: string, {
        maxTokens,
        stopOnAbortSignal = false,

        functions,
        documentFunctionParams,
        onTextChunk,
        onToken,
        signal,
        temperature,
        minP,
        topK,
        topP,
        seed,
        xtc,
        grammar,
        trimWhitespaceSuffix = false,
        repeatPenalty,
        tokenBias,
        customStopTriggers,
        evaluationPriority,
        completeAsModel
    }: LLamaChatCompletePromptOptions = {}) {
        this._ensureNotDisposed();

        if (grammar != null) {
            if (grammar._llama == null)
                throw new Error("The grammar passed to this function is not a LlamaGrammar instance.");
            else if (grammar._llama !== this.model._llama)
                throw new Error("The LlamaGrammar used by passed to this function was created with a different Llama instance than the one used by this sequence's model. Make sure you use the same Llama instance for both the model and the grammar.");
        }

        const [abortController, disposeAbortController] = wrapAbortSignal(signal);
        this._preloadAndCompleteAbortControllers.add(abortController);

        const completeAsModelEnabled = typeof completeAsModel == "boolean"
            ? completeAsModel
            : completeAsModel === "auto"
                ? "auto"
                : completeAsModel?.enabled ?? defaultCompleteAsModel.enabled;

        const modelArchitecture = this.model.fileInfo.metadata?.general?.architecture;
        const shouldCompleteAsModel = completeAsModelEnabled === "auto"
            ? modelArchitecture === GgufArchitectureType.gptOss
            : completeAsModelEnabled;

        try {
            return await withLock([this._chatLock, "evaluation"], abortController.signal, async () => {
                this._ensureNotDisposed();

                if (this._chat == null)
                    throw new DisposedError();

                if (shouldCompleteAsModel) {
                    const messagesToAppendOption = (typeof completeAsModel == "boolean" || completeAsModel === "auto")
                        ? defaultCompleteAsModel.appendedMessages
                        : completeAsModel?.appendedMessages ?? defaultCompleteAsModel.appendedMessages;

                    const messagesToAppend = messagesToAppendOption.length === 0
                        ? defaultCompleteAsModel.appendedMessages
                        : messagesToAppendOption;

                    const addMessageToChatHistory = (chatHistory: ChatHistoryItem[]): {
                        history: ChatHistoryItem[],
                        addedCount: number
                    } => {
                        const newHistory = chatHistory.slice();
                        if (messagesToAppend.at(0)?.type === "model")
                            newHistory.push({type: "user", text: ""});

                        for (let i = 0; i < messagesToAppend.length; i++) {
                            const item = messagesToAppend[i];
                            const isLastItem = i === messagesToAppend.length - 1;

                            if (item == null)
                                continue;

                            if (isLastItem && item.type === "model") {
                                const newResponse = item.response.slice();
                                if (typeof newResponse.at(-1) === "string")
                                    newResponse.push((newResponse.pop()! as string) + prompt);
                                else
                                    newResponse.push(prompt);

                                newHistory.push({
                                    type: "model",
                                    response: newResponse
                                });
                            } else
                                newHistory.push(item);
                        }

                        if (messagesToAppend.at(-1)?.type !== "model")
                            newHistory.push({type: "model", response: [prompt]});

                        return {
                            history: newHistory,
                            addedCount: newHistory.length - chatHistory.length
                        };
                    };

                    const {history: messagesWithPrompt, addedCount} = addMessageToChatHistory(this._chatHistory);
                    const {response, lastEvaluation, metadata} = await this._chat.generateResponse(
                        messagesWithPrompt,
                        {
                            abortOnNonText: true,
                            functions,
                            documentFunctionParams,
                            grammar: grammar as undefined, // this is allowed only because `abortOnNonText` is enabled
                            onTextChunk,
                            onToken,
                            signal: abortController.signal,
                            stopOnAbortSignal: true,
                            repeatPenalty,
                            minP,
                            topK,
                            topP,
                            seed,
                            xtc,
                            tokenBias,
                            customStopTriggers,
                            maxTokens: maxTokens == null
                                ? undefined
                                : Math.min(1, maxTokens), // regular prompting ignores `maxTokens: 0`
                            temperature,
                            trimWhitespaceSuffix,
                            contextShift: {
                                ...this._contextShift,
                                lastEvaluationMetadata: this._lastEvaluation?.contextShiftMetadata
                            },
                            evaluationPriority,
                            lastEvaluationContextWindow: {
                                history: this._lastEvaluation?.contextWindow == null
                                    ? undefined
                                    : addMessageToChatHistory(this._lastEvaluation?.contextWindow).history,
                                minimumOverlapPercentageToPreventContextShift: 0.8
                            }
                        }
                    );
                    this._ensureNotDisposed();

                    this._lastEvaluation = {
                        cleanHistory: this._chatHistory,
                        contextWindow: lastEvaluation.contextWindow.slice(0, -addedCount),
                        contextShiftMetadata: lastEvaluation.contextShiftMetadata
                    };
                    this._canUseContextWindowForCompletion = this._chatHistory.at(-1)?.type === "user";

                    if (!stopOnAbortSignal && metadata.stopReason === "abort" && abortController.signal?.aborted)
                        throw abortController.signal.reason;

                    if (metadata.stopReason === "customStopTrigger")
                        return {
                            completion: response,
                            stopReason: metadata.stopReason,
                            customStopTrigger: metadata.customStopTrigger,
                            remainingGenerationAfterStop: metadata.remainingGenerationAfterStop
                        };

                    return {
                        completion: response,
                        stopReason: metadata.stopReason,
                        remainingGenerationAfterStop: metadata.remainingGenerationAfterStop
                    };
                } else {
                    const {completion, lastEvaluation, metadata} = await this._chat.loadChatAndCompleteUserMessage(
                        asWithLastUserMessageRemoved(this._chatHistory),
                        {
                            initialUserPrompt: prompt,
                            functions,
                            documentFunctionParams,
                            grammar,
                            onTextChunk,
                            onToken,
                            signal: abortController.signal,
                            stopOnAbortSignal: true,
                            repeatPenalty,
                            minP,
                            topK,
                            topP,
                            seed,
                            xtc,
                            tokenBias,
                            customStopTriggers,
                            maxTokens,
                            temperature,
                            trimWhitespaceSuffix,
                            contextShift: {
                                ...this._contextShift,
                                lastEvaluationMetadata: this._lastEvaluation?.contextShiftMetadata
                            },
                            evaluationPriority,
                            lastEvaluationContextWindow: {
                                history: asWithLastUserMessageRemoved(this._lastEvaluation?.contextWindow),
                                minimumOverlapPercentageToPreventContextShift: 0.8
                            }
                        }
                    );
                    this._ensureNotDisposed();

                    this._lastEvaluation = {
                        cleanHistory: this._chatHistory,
                        contextWindow: asWithLastUserMessageRemoved(lastEvaluation.contextWindow),
                        contextShiftMetadata: lastEvaluation.contextShiftMetadata
                    };
                    this._canUseContextWindowForCompletion = this._chatHistory.at(-1)?.type === "user";

                    if (!stopOnAbortSignal && metadata.stopReason === "abort" && abortController.signal?.aborted)
                        throw abortController.signal.reason;

                    if (metadata.stopReason === "customStopTrigger")
                        return {
                            completion: completion,
                            stopReason: metadata.stopReason,
                            customStopTrigger: metadata.customStopTrigger,
                            remainingGenerationAfterStop: metadata.remainingGenerationAfterStop
                        };

                    return {
                        completion: completion,
                        stopReason: metadata.stopReason,
                        remainingGenerationAfterStop: metadata.remainingGenerationAfterStop
                    };
                }
            });
        } finally {
            this._preloadAndCompleteAbortControllers.delete(abortController);
            disposeAbortController();
        }
    }

    public getChatHistory() {
        return structuredClone(this._chatHistory);
    }

    public getLastEvaluationContextWindow() {
        if (this._lastEvaluation == null)
            return null;

        return structuredClone(this._lastEvaluation?.contextWindow);
    }

    public setChatHistory(chatHistory: ChatHistoryItem[]) {
        this._chatHistory = structuredClone(chatHistory);
        this._chatHistoryStateRef = {};
        this._lastEvaluation = undefined;
        this._canUseContextWindowForCompletion = false;
    }

    /** Clear the chat history and reset it to the initial state. */
    public resetChatHistory() {
        if (this._chat == null || this.disposed)
            throw new DisposedError();

        const chatWrapperSupportsSystemMessages = this._chat.chatWrapper.settings.supportsSystemMessages;
        if (chatWrapperSupportsSystemMessages == null || chatWrapperSupportsSystemMessages || this._forceAddSystemPrompt)
            this.setChatHistory(
                this._chat.chatWrapper.generateInitialChatHistory({systemPrompt: this._systemPrompt})
            );
        else
            this.setChatHistory([]);
    }

    /** @internal */
    private _stopAllPreloadAndPromptCompletions() {
        for (const abortController of this._preloadAndCompleteAbortControllers)
            abortController.abort();

        this._preloadAndCompleteAbortControllers.clear();
    }

    /** @internal */
    private _ensureNotDisposed() {
        if (this.disposed)
            throw new DisposedError();
    }
}

function addFunctionCallToChatHistory({
    chatHistory,
    functionName,
    functionDescription,
    callParams,
    callResult,
    rawCall,
    startsNewChunk
}: {
    chatHistory: ChatHistoryItem[],
    functionName: string,
    functionDescription?: string,
    callParams: any,
    callResult: any,
    rawCall?: LlamaTextJSON,
    startsNewChunk?: boolean
}) {
    const newChatHistory = chatHistory.slice();
    if (newChatHistory.length === 0 || newChatHistory[newChatHistory.length - 1]!.type !== "model")
        newChatHistory.push({
            type: "model",
            response: []
        });

    const lastModelResponseItem = newChatHistory[newChatHistory.length - 1] as ChatModelResponse;
    const newLastModelResponseItem = {...lastModelResponseItem};
    newChatHistory[newChatHistory.length - 1] = newLastModelResponseItem;

    const modelResponse = newLastModelResponseItem.response.slice();
    newLastModelResponseItem.response = modelResponse;

    const functionCall: ChatModelFunctionCall = {
        type: "functionCall",
        name: functionName,
        description: functionDescription,
        params: callParams,
        result: callResult,
        rawCall
    };

    if (startsNewChunk)
        functionCall.startsNewChunk = true;

    modelResponse.push(functionCall);

    return newChatHistory;
}

function getLastModelResponseItem(chatHistory: ChatHistoryItem[]) {
    if (chatHistory.length === 0 || chatHistory[chatHistory.length - 1]!.type !== "model")
        throw new Error("Expected chat history to end with a model response");

    return chatHistory[chatHistory.length - 1] as ChatModelResponse;
}

function asWithLastUserMessageRemoved(chatHistory: ChatHistoryItem[]): ChatHistoryItem[];
function asWithLastUserMessageRemoved(chatHistory: ChatHistoryItem[] | undefined): ChatHistoryItem[] | undefined;
function asWithLastUserMessageRemoved(chatHistory?: ChatHistoryItem[]) {
    if (chatHistory == null)
        return chatHistory;

    const newChatHistory = chatHistory.slice();

    while (newChatHistory.at(-1)?.type === "user")
        newChatHistory.pop();

    return newChatHistory;
}
