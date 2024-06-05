import {DisposeAggregator, DisposedError, EventRelay, withLock} from "lifecycle-utils";
import {defaultChatSystemPrompt} from "../../config.js";
import {ChatWrapper} from "../../ChatWrapper.js";
import {
    ChatHistoryItem, ChatModelFunctions, ChatModelResponse, ChatSessionModelFunction, ChatSessionModelFunctions, Token
} from "../../types.js";
import {appendUserMessageToChatHistory} from "../../utils/appendUserMessageToChatHistory.js";
import {LlamaContextSequence} from "../LlamaContext/LlamaContext.js";
import {LlamaGrammar} from "../LlamaGrammar.js";
import {LlamaChat, LLamaChatContextShiftOptions, LlamaChatResponse, LlamaChatResponseFunctionCall} from "../LlamaChat/LlamaChat.js";
import {EvaluationPriority} from "../LlamaContext/types.js";
import {TokenBias} from "../TokenBias.js";
import {LlamaText, LlamaTextJSON} from "../../utils/LlamaText.js";
import {wrapAbortSignal} from "../../utils/wrapAbortSignal.js";
import {safeEventCallback} from "../../utils/safeEventCallback.js";
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

    /** Automatically dispose the sequence when the session is disposed */
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
     * Defaults to `"eraseFirstResponseAndKeepFirstSystem"`.
     */
    strategy?: LLamaChatContextShiftOptions["strategy"]
};

export type LLamaChatPromptOptions<Functions extends ChatSessionModelFunctions | undefined = ChatSessionModelFunctions | undefined> = {
    onToken?: (tokens: Token[]) => void,
    signal?: AbortSignal,

    /**
     * When a response already started being generated and then the signal is aborted,
     * the generation will stop and the response will be returned as is instead of throwing an error.
     *
     * Defaults to `false`.
     */
    stopOnAbortSignal?: boolean,

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
    customStopTriggers?: (LlamaText | string | (string | Token)[])[]
} & ({
    grammar?: LlamaGrammar,
    functions?: never,
    documentFunctionParams?: never,
    maxParallelFunctionCalls?: never
} | {
    grammar?: never,
    functions?: Functions | ChatSessionModelFunctions,
    documentFunctionParams?: boolean,
    maxParallelFunctionCalls?: number
});

export type LLamaChatCompletePromptOptions = {
    /**
     * Generate a completion for the given user prompt up to the given number of tokens.
     *
     * Defaults to `256` or half the context size, whichever is smaller.
     */
    maxTokens?: LLamaChatPromptOptions["maxTokens"],

    /**
     * When a completion already started being generated and then the signal is aborted,
     * the generation will stop and the completion will be returned as is instead of throwing an error.
     *
     * Defaults to `false`.
     */
    stopOnAbortSignal?: LLamaChatPromptOptions["stopOnAbortSignal"],

    onToken?: LLamaChatPromptOptions["onToken"],
    signal?: LLamaChatPromptOptions["signal"],
    temperature?: LLamaChatPromptOptions["temperature"],
    minP?: LLamaChatPromptOptions["minP"],
    topK?: LLamaChatPromptOptions["topK"],
    topP?: LLamaChatPromptOptions["topP"],
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
    documentFunctionParams?: boolean
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

export class LlamaChatSession {
    /** @internal */ private readonly _disposeAggregator = new DisposeAggregator();
    /** @internal */ private readonly _autoDisposeSequence: boolean;
    /** @internal */ private readonly _contextShift?: LlamaChatSessionContextShiftOptions;
    /** @internal */ private readonly _chatLock = {};
    /** @internal */ private _chatHistory: ChatHistoryItem[];
    /** @internal */ private _lastEvaluation?: LlamaChatResponse["lastEvaluation"];
    /** @internal */ private _chat: LlamaChat | null;
    /** @internal */ public _chatHistoryStateRef = {};
    /** @internal */ public readonly _preloadAndCompleteAbortControllers = new Set<AbortController>();

    public readonly onDispose = new EventRelay<void>();

    /**
     * @param options
     */
    public constructor({
        contextSequence,
        chatWrapper = "auto",
        systemPrompt = defaultChatSystemPrompt,
        forceAddSystemPrompt = false,
        autoDisposeSequence = true,
        contextShift
    }: LlamaChatSessionOptions) {
        if (contextSequence == null)
            throw new Error("contextSequence cannot be null");

        if (contextSequence.disposed)
            throw new DisposedError();

        this._contextShift = contextShift;

        this._chat = new LlamaChat({
            autoDisposeSequence,
            chatWrapper,
            contextSequence
        });

        const chatWrapperSupportsSystemMessages = this._chat.chatWrapper.settings.supportsSystemMessages;
        if (chatWrapperSupportsSystemMessages == null || chatWrapperSupportsSystemMessages || forceAddSystemPrompt)
            this._chatHistory = [{
                type: "system",
                text: systemPrompt
            }];
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

    /**
     * @param prompt
     * @param [options]
     */
    public async prompt<const Functions extends ChatSessionModelFunctions | undefined = undefined>(prompt: string, {
        functions,
        documentFunctionParams,
        maxParallelFunctionCalls,
        onToken,
        signal,
        stopOnAbortSignal = false,
        maxTokens,
        temperature,
        minP,
        topK,
        topP,
        grammar,
        trimWhitespaceSuffix = false,
        repeatPenalty,
        tokenBias,
        customStopTriggers
    }: LLamaChatPromptOptions<Functions> = {}) {
        const {responseText} = await this.promptWithMeta<Functions>(prompt, {
            // this is a workaround to allow passing both `functions` and `grammar`
            functions: functions as undefined,
            documentFunctionParams: documentFunctionParams as undefined,
            maxParallelFunctionCalls: maxParallelFunctionCalls as undefined,

            onToken, signal, stopOnAbortSignal, maxTokens, temperature, minP, topK, topP, grammar, trimWhitespaceSuffix, repeatPenalty,
            tokenBias, customStopTriggers
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
        onToken,
        signal,
        stopOnAbortSignal = false,
        maxTokens,
        temperature,
        minP,
        topK,
        topP,
        grammar,
        trimWhitespaceSuffix = false,
        repeatPenalty,
        tokenBias,
        customStopTriggers,
        evaluationPriority
    }: LLamaChatPromptOptions<Functions> = {}) {
        this._ensureNotDisposed();

        if (grammar != null && grammar._llama !== this.model._llama)
            throw new Error("The LlamaGrammar used by passed to this function was created with a different Llama instance than the one used by this sequence's model. Make sure you use the same Llama instance for both the model and the grammar.");

        this._stopAllPreloadAndPromptCompletions();
        return await withLock(this._chatLock, "evaluation", signal, async () => {
            this._ensureNotDisposed();
            this._stopAllPreloadAndPromptCompletions();

            if (this._chat == null)
                throw new DisposedError();

            const abortController = wrapAbortSignal(signal);
            let lastEvaluation = this._lastEvaluation;
            let newChatHistory = appendUserMessageToChatHistory(this._chatHistory, prompt);
            let newContextWindowChatHistory = lastEvaluation?.contextWindow == null
                ? undefined
                : appendUserMessageToChatHistory(lastEvaluation?.contextWindow, prompt);

            newChatHistory.push({
                type: "model",
                response: []
            });

            if (newContextWindowChatHistory != null)
                newContextWindowChatHistory.push({
                    type: "model",
                    response: []
                });

            // eslint-disable-next-line no-constant-condition
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
                    onToken: safeEventCallback(onToken),
                    signal: abortController.signal,
                    stopOnAbortSignal,
                    repeatPenalty,
                    minP,
                    topK,
                    topP,
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
                    onFunctionCall: async(functionCall) => {
                        functionCallsAndResults.push(
                            (async () => {
                                try {
                                    const functionDefinition = functions?.[functionCall.functionName];

                                    if (functionDefinition == null)
                                        throw new Error(
                                            `The model tried to call function "${functionCall.functionName}" which is not defined`
                                        );

                                    const functionCallResult = await functionDefinition.handler(functionCall.params);

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
                    await Promise.race([
                        functionCallResultsPromise,
                        new Promise<void>((accept, reject) => {
                            abortController.signal.addEventListener("abort", () => {
                                if (abortedOnFunctionCallError || !stopOnAbortSignal)
                                    reject(abortController.signal.reason);
                                else
                                    accept();
                            });

                            if (abortController.signal.aborted) {
                                if (abortedOnFunctionCallError || !stopOnAbortSignal)
                                    reject(abortController.signal.reason);
                                else
                                    accept();
                            }
                        })
                    ]);
                    this._ensureNotDisposed();

                    if (!abortController.signal.aborted) {
                        const functionCallResults = (await functionCallResultsPromise)
                            .filter((result): result is Exclude<typeof result, null> => result != null);
                        this._ensureNotDisposed();

                        if (abortController.signal.aborted)
                            throw abortController.signal.reason;

                        newContextWindowChatHistory = lastEvaluation.contextWindow;

                        for (const {functionCall, functionDefinition, functionCallResult} of functionCallResults) {
                            newChatHistory = addFunctionCallToChatHistory({
                                chatHistory: newChatHistory,
                                functionName: functionCall.functionName,
                                functionDescription: functionDefinition.description,
                                callParams: functionCall.params,
                                callResult: functionCallResult,
                                rawCall: functionCall.raw
                            });

                            newContextWindowChatHistory = addFunctionCallToChatHistory({
                                chatHistory: newContextWindowChatHistory,
                                functionName: functionCall.functionName,
                                functionDescription: functionDefinition.description,
                                callParams: functionCall.params,
                                callResult: functionCallResult,
                                rawCall: functionCall.raw
                            });
                        }

                        lastEvaluation.cleanHistory = newChatHistory;
                        lastEvaluation.contextWindow = newContextWindowChatHistory;

                        continue;
                    }
                }

                this._lastEvaluation = lastEvaluation;
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
        onToken,
        signal,
        temperature,
        minP,
        topK,
        topP,
        grammar,
        trimWhitespaceSuffix = false,
        repeatPenalty,
        tokenBias,
        customStopTriggers,
        evaluationPriority
    }: LLamaChatCompletePromptOptions = {}) {
        this._ensureNotDisposed();

        if (grammar != null && grammar._llama !== this.model._llama)
            throw new Error("The LlamaGrammar used by passed to this function was created with a different Llama instance than the one used by this sequence's model. Make sure you use the same Llama instance for both the model and the grammar.");

        const abortController = wrapAbortSignal(signal);
        this._preloadAndCompleteAbortControllers.add(abortController);

        try {
            return await withLock(this._chatLock, "evaluation", abortController.signal, async () => {
                this._ensureNotDisposed();

                if (this._chat == null)
                    throw new DisposedError();

                const {completion, lastEvaluation, metadata} = await this._chat.loadChatAndCompleteUserMessage(this._chatHistory, {
                    initialUserPrompt: prompt,
                    functions,
                    documentFunctionParams,
                    grammar,
                    onToken,
                    signal: abortController.signal,
                    stopOnAbortSignal: true,
                    repeatPenalty,
                    minP,
                    topK,
                    topP,
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
                        history: this._lastEvaluation?.contextWindow,
                        minimumOverlapPercentageToPreventContextShift: 0.8
                    }
                });
                this._ensureNotDisposed();

                this._lastEvaluation = {
                    cleanHistory: this._chatHistory,
                    contextWindow: lastEvaluation.contextWindow,
                    contextShiftMetadata: lastEvaluation.contextShiftMetadata
                };

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
            });
        } finally {
            this._preloadAndCompleteAbortControllers.delete(abortController);
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
    rawCall
}: {
    chatHistory: ChatHistoryItem[],
    functionName: string,
    functionDescription?: string,
    callParams: any,
    callResult: any,
    rawCall?: LlamaTextJSON
}) {
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

    modelResponse.push({
        type: "functionCall",
        name: functionName,
        description: functionDescription,
        params: callParams,
        result: callResult,
        rawCall
    });

    return newChatHistory;
}

function getLastModelResponseItem(chatHistory: ChatHistoryItem[]) {
    if (chatHistory.length === 0 || chatHistory[chatHistory.length - 1].type !== "model")
        throw new Error("Expected chat history to end with a model response");

    return chatHistory[chatHistory.length - 1] as ChatModelResponse;
}
