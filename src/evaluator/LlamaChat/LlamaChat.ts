import {DisposeAggregator, DisposedError, EventRelay, withLock} from "lifecycle-utils";
import {ChatWrapper} from "../../ChatWrapper.js";
import {LlamaContextSequence} from "../LlamaContext/LlamaContext.js";
import {
    ChatHistoryItem, ChatModelFunctions, ChatModelResponse, ChatUserMessage, LLamaContextualRepeatPenalty, Token, Tokenizer
} from "../../types.js";
import {GbnfJsonSchemaToType} from "../../utils/gbnfJson/types.js";
import {LlamaGrammar} from "../LlamaGrammar.js";
import {removeNullFields} from "../../utils/removeNullFields.js";
import {LlamaGrammarEvaluationState} from "../LlamaGrammarEvaluationState.js";
import {LlamaText, LlamaTextJSON, SpecialToken} from "../../utils/LlamaText.js";
import {StopGenerationDetector} from "../../utils/StopGenerationDetector.js";
import {QueuedTokenRelease, QueuedTokenReleaseLock, TokenStreamRegulator} from "../../utils/TokenStreamRegulator.js";
import {EvaluationPriority} from "../LlamaContext/types.js";
import {UNKNOWN_UNICODE_CHAR} from "../../consts.js";
import {getQueuedTokensBeforeStopTrigger} from "../../utils/getQueuedTokensBeforeStopTrigger.js";
import {resolveChatWrapper} from "../../chatWrappers/utils/resolveChatWrapper.js";
import {GeneralChatWrapper} from "../../chatWrappers/GeneralChatWrapper.js";
import {TokenBias} from "../TokenBias.js";
import {safeEventCallback} from "../../utils/safeEventCallback.js";
import {pushAll} from "../../utils/pushAll.js";
import {
    eraseFirstResponseAndKeepFirstSystemChatContextShiftStrategy
} from "./utils/contextShiftStrategies/eraseFirstResponseAndKeepFirstSystemChatContextShiftStrategy.js";
import {FunctionCallNameGrammar} from "./utils/FunctionCallNameGrammar.js";
import {FunctionCallParamsGrammar} from "./utils/FunctionCallParamsGrammar.js";

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
    }
} & ({
    grammar?: LlamaGrammar,
    functions?: never,
    documentFunctionParams?: never,
    maxParallelFunctionCalls?: never,
    onFunctionCall?: never
} | {
    grammar?: never,
    functions?: Functions | ChatModelFunctions,
    documentFunctionParams?: boolean,
    maxParallelFunctionCalls?: number,
    onFunctionCall?: (
        functionCall: LlamaChatResponseFunctionCall<Functions extends ChatModelFunctions ? Functions : ChatModelFunctions>
    ) => void
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

    onToken?: LLamaChatGenerateResponseOptions<Functions>["onToken"],
    signal?: LLamaChatGenerateResponseOptions<Functions>["signal"],
    maxTokens?: LLamaChatGenerateResponseOptions<Functions>["maxTokens"],
    temperature?: LLamaChatGenerateResponseOptions<Functions>["temperature"],
    minP?: LLamaChatGenerateResponseOptions<Functions>["minP"],
    topK?: LLamaChatGenerateResponseOptions<Functions>["topK"],
    topP?: LLamaChatGenerateResponseOptions<Functions>["topP"],
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

        this._chatWrapper = chatWrapper === "auto"
            ? (
                resolveChatWrapper({
                    bosString: contextSequence.model.tokens.bosString,
                    filename: contextSequence.model.filename,
                    fileInfo: contextSequence.model.fileInfo,
                    tokenizer: contextSequence.model.tokenizer
                }) ?? new GeneralChatWrapper()
            )
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
            onToken,
            signal,
            stopOnAbortSignal = false,
            maxTokens,
            temperature,
            minP,
            topK,
            topP,
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
            lastEvaluationContextWindow: {
                history: lastEvaluationContextWindowHistory,
                minimumOverlapPercentageToPreventContextShift = 0.5
            } = {}
        } = options;

        const generateResponseState = new GenerateResponseState<Functions>(
            this,
            this._chatWrapper,
            history,
            {
                onToken,
                signal,
                stopOnAbortSignal,
                maxTokens,
                temperature,
                minP,
                topK,
                topP,
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
                lastEvaluationContextWindow: {
                    history: lastEvaluationContextWindowHistory,
                    minimumOverlapPercentageToPreventContextShift
                }
            }
        );

        if (generateResponseState.grammar != null && generateResponseState.functionsEnabled)
            throw new Error("Using both grammar and functions is not supported yet");

        return await withLock(this._chatLock, "evaluate", signal, async (): Promise<LlamaChatResponse<Functions>> => {
            try {
                generateResponseState.ensureLastHistoryItemIsModel();

                const loadContextWindow = async (avoidReloadingHistory: boolean = false) => {
                    await generateResponseState.loadContextWindow(
                        generateResponseState.getResolvedHistoryWithCurrentModelResponse(),
                        false,
                        avoidReloadingHistory
                    );
                };
                const loadContextWindowForFunctionCallingLoop = async () => loadContextWindow(true);

                // eslint-disable-next-line no-constant-condition
                while (true) {
                    generateResponseState.startTokenLoop();
                    generateResponseState.canAvoidReloadingHistory = false;
                    await loadContextWindow();

                    generateResponseState.addStopGenerationTriggersFromChatWrapper();

                    if (generateResponseState.generatedTokens === 0) {
                        generateResponseState.addIgnoreStartTextTriggersFromChatWrapper();

                        if (generateResponseState.functionsEnabled) {
                            generateResponseState.initFunctions();
                        }
                    }

                    if (generateResponseState.functionEvaluationMode !== false) {
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

                        const maxTokensTriggerRes = generateResponseState.handleMaxTokensTrigger("model");
                        if (maxTokensTriggerRes != null)
                            return maxTokensTriggerRes;

                        if (generateResponseState.updateShouldContextShift())
                            break;

                        const abortRes = generateResponseState.handleAbortTrigger("model");
                        if (abortRes != null)
                            return abortRes;
                    }

                    generateResponseState.isFirstEvaluation = false;

                    if (generateResponseState.shouldContextShift)
                        continue;

                    break;
                }

                throw new Error("The context size is too small to generate a response");
            } finally {
                generateResponseState.dispose();
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
            onToken,
            signal,
            maxTokens = Math.min(256, Math.ceil(this.context.contextSize / 2)),
            temperature,
            minP,
            topK,
            topP,
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

        const lastEvaluationContextWindowHistoryItem = lastEvaluationContextWindowHistory == null
            ? null
            : lastEvaluationContextWindowHistory[lastEvaluationContextWindowHistory.length - 1];
        const lastEvaluationContextWindowUserMessage = lastEvaluationContextWindowHistoryItem?.type === "user"
            ? lastEvaluationContextWindowHistoryItem.text
            : "";

        const generateResponseState = new GenerateResponseState<Functions>(
            this,
            this._chatWrapper,
            history,
            {
                onToken,
                signal,
                stopOnAbortSignal,
                maxTokens,
                temperature,
                minP,
                topK,
                topP,
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
                    history: lastEvaluationContextWindowHistory == null
                        ? undefined
                        : setLastUserTextInChatHistory(
                            lastEvaluationContextWindowHistory,
                            lastEvaluationContextWindowUserMessage + initialUserPrompt
                        ),
                    minimumOverlapPercentageToPreventContextShift
                }
            }
        );

        return await withLock(this._chatLock, "evaluate", signal, async (): Promise<LlamaChatLoadAndCompleteUserResponse> => {
            try {
                generateResponseState.ensureLastHistoryItemIsUser();
                const lastResolvedHistoryItem = generateResponseState.resolvedHistory[generateResponseState.resolvedHistory.length - 1];
                const initialUserMessage = lastResolvedHistoryItem?.type === "user"
                    ? lastResolvedHistoryItem.text
                    : "";

                // eslint-disable-next-line no-constant-condition
                while (true) {
                    generateResponseState.startTokenLoop();
                    const {userTextSuffix} = await generateResponseState.loadContextWindow(
                        setLastUserTextInChatHistory(
                            generateResponseState.resolvedHistory,
                            initialUserMessage + initialUserPrompt + this.model.detokenize(generateResponseState.res)
                        ),
                        true
                    );
                    generateResponseState.functionEvaluationMode = false;

                    generateResponseState.addStopGenerationTriggersFromChatWrapper();

                    if (userTextSuffix != null && userTextSuffix.values.length > 0)
                        generateResponseState.stopGenerationDetector.addStopTrigger(
                            StopGenerationDetector.resolveLlamaTextTrigger(userTextSuffix, this.model.tokenizer)
                        );

                    await generateResponseState.alignCurrentSequenceStateWithCurrentTokens();

                    if (generateResponseState.maxTokens === 0) {
                        await generateResponseState.evaluateWithoutGeneratingNewTokens();

                        return {
                            completion: "",
                            lastEvaluation: {
                                contextWindow: setLastUserTextInChatHistory(
                                    generateResponseState.lastContextWindowHistory,
                                    initialUserMessage
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
                        generateResponseState.waitOnPartialCharactersOrWhiteSpaceTokens();

                        generateResponseState.recordStopGenerationEvaluation();

                        generateResponseState.popStreamRegulatorFreeTokens();

                        const stopGenerationTriggerRes = generateResponseState.handleStopGenerationTrigger("user");
                        if (stopGenerationTriggerRes != null)
                            return {
                                completion: stopGenerationTriggerRes.response,
                                lastEvaluation: {
                                    contextWindow: setLastUserTextInChatHistory(
                                        generateResponseState.lastContextWindowHistory,
                                        initialUserMessage
                                    ),
                                    contextShiftMetadata: stopGenerationTriggerRes.lastEvaluation.contextShiftMetadata
                                },
                                metadata: stopGenerationTriggerRes.metadata.stopReason === "customStopTrigger"
                                    ? stopGenerationTriggerRes.metadata
                                    : stopGenerationTriggerRes.metadata
                            };

                        generateResponseState.moveFreePendingTokensToRes(false);

                        const maxTokensTriggerRes = generateResponseState.handleMaxTokensTrigger("user");
                        if (maxTokensTriggerRes != null)
                            return {
                                completion: maxTokensTriggerRes.response,
                                lastEvaluation: {
                                    contextWindow: setLastUserTextInChatHistory(
                                        generateResponseState.lastContextWindowHistory,
                                        initialUserMessage
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
                                    contextWindow: setLastUserTextInChatHistory(
                                        generateResponseState.lastContextWindowHistory,
                                        initialUserMessage
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
                generateResponseState.dispose();
            }
        });
    }
}

export type LlamaChatResponse<Functions extends ChatModelFunctions | undefined = undefined> = {
    response: string,
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
            else
                return {
                    ...item,
                    rawCall: undefined
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

function getLastTextModelResponseFromChatHistory(chatHistory: ChatHistoryItem[]) {
    if (chatHistory.length === 0 || chatHistory[chatHistory.length - 1].type !== "model")
        return "";

    const lastModelResponseItem = chatHistory[chatHistory.length - 1] as ChatModelResponse;
    const modelResponse = lastModelResponseItem.response;

    if (modelResponse.length > 0 && typeof modelResponse[modelResponse.length - 1] === "string")
        return modelResponse[modelResponse.length - 1] as string;

    return "";
}

function getLastUserTextFromChatHistory(chatHistory: readonly ChatHistoryItem[]) {
    if (chatHistory.length === 0 || chatHistory[chatHistory.length - 1].type !== "user")
        return "";

    return (chatHistory[chatHistory.length - 1] as ChatUserMessage).text;
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

function setLastUserTextInChatHistory(chatHistory: readonly ChatHistoryItem[], userText: string) {
    const newChatHistory = chatHistory.slice();
    if (newChatHistory.length === 0 || newChatHistory[newChatHistory.length - 1].type !== "user")
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

function setLastTextInChatHistory(itemType: "user" | "model", chatHistory: ChatHistoryItem[], text: string) {
    if (itemType === "user")
        return setLastUserTextInChatHistory(chatHistory, text);
    else
        return setLastModelTextResponseInChatHistory(chatHistory, text);
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
    let newContextText = contextText;

    for (let i = 0; i < newContextText.values.length; i++) {
        const item = newContextText.values[i];
        if (typeof item !== "string")
            continue;

        const randomTextIndex = item.indexOf(randomId);
        if (randomTextIndex < 0)
            continue;

        const newValue = item.slice(0, randomTextIndex);
        newContextText = LlamaText([
            ...newContextText.values.slice(0, i),
            newValue
        ]);
        return {
            contextText: newContextText,
            userTextSuffix: LlamaText([
                item.slice(randomTextIndex + randomId.length),
                ...newContextText.values.slice(i + 1)
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
    lastHistoryCompressionMetadata, pendingTokensCount = 0, isFirstEvaluation,
    chatWrapper, lastEvaluationContextWindowHistory, minimumOverlapPercentageToPreventContextShift,
    sequence, minFreeContextTokens = 1, functions, documentFunctionParams, endWithUserText
}: {
    resolvedHistory: ChatHistoryItem[], resolvedContextShift: Required<LLamaChatContextShiftOptions>,
    lastHistoryCompressionMetadata: object | null | undefined, pendingTokensCount: number, isFirstEvaluation: boolean,
    chatWrapper: ChatWrapper, lastEvaluationContextWindowHistory?: ChatHistoryItem[], minimumOverlapPercentageToPreventContextShift: number,
    sequence?: LlamaContextSequence, minFreeContextTokens?: number, functions?: ChatModelFunctions,
    documentFunctionParams?: boolean, endWithUserText: boolean
}): Promise<{
    history: ChatHistoryItem[], stopGenerationTriggers: LlamaText[], tokens: Token[],
    newResolvedHistory: ChatHistoryItem[], newHistoryCompressionMetadata: object | null | undefined,
    ignoreStartText: LlamaText[], functionCallInitiallyEngaged: boolean,
    disengageInitiallyEngagedFunctionCall: LlamaText[], userTextSuffix?: LlamaText
}> {
    if (sequence == null)
        throw new DisposedError();

    const model = sequence.model;
    const context = sequence.context;

    if (isFirstEvaluation && lastEvaluationContextWindowHistory != null && sequence.isLoadedToMemory) {
        const newContextWindow = lastEvaluationContextWindowHistory.slice();

        if (endWithUserText) {
            if (newContextWindow.length === 0 || newContextWindow[newContextWindow.length - 1].type !== "user")
                newContextWindow.push({
                    type: "user",
                    text: ""
                });
        } else if (newContextWindow.length === 0 || newContextWindow[newContextWindow.length - 1].type !== "model")
            newContextWindow.push({
                type: "model",
                response: []
            });

        const {contextText, stopGenerationTriggers, ignoreStartText, functionCall, userTextSuffix} = generateContextText(
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

            if (existingEvaluationPercentage >= minimumOverlapPercentageToPreventContextShift)
                return {
                    history: newContextWindow,
                    stopGenerationTriggers,
                    tokens,
                    newResolvedHistory: resolvedHistory,
                    newHistoryCompressionMetadata: lastHistoryCompressionMetadata,
                    ignoreStartText: ignoreStartText ?? [],
                    functionCallInitiallyEngaged: functionCall?.initiallyEngaged ?? false,
                    disengageInitiallyEngagedFunctionCall: functionCall?.disengageInitiallyEngaged ?? [],
                    userTextSuffix
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

        const {contextText, stopGenerationTriggers, ignoreStartText, functionCall, userTextSuffix} = generateContextText(
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
            newResolvedHistory: resolvedHistory,
            newHistoryCompressionMetadata: metadata,
            ignoreStartText: ignoreStartText ?? [],
            functionCallInitiallyEngaged: functionCall?.initiallyEngaged ?? false,
            disengageInitiallyEngagedFunctionCall: functionCall?.disengageInitiallyEngaged ?? [],
            userTextSuffix
        };
    }

    {
        const {contextText, stopGenerationTriggers, ignoreStartText, functionCall, userTextSuffix} = generateContextText(
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
                newResolvedHistory: resolvedHistory,
                newHistoryCompressionMetadata: lastHistoryCompressionMetadata,
                ignoreStartText: ignoreStartText ?? [],
                functionCallInitiallyEngaged: functionCall?.initiallyEngaged ?? false,
                disengageInitiallyEngagedFunctionCall: functionCall?.disengageInitiallyEngaged ?? [],
                userTextSuffix
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

    const {contextText, stopGenerationTriggers, ignoreStartText, functionCall, userTextSuffix} = generateContextText(
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
        newResolvedHistory: resolvedHistory,
        newHistoryCompressionMetadata: metadata,
        ignoreStartText: ignoreStartText ?? [],
        functionCallInitiallyEngaged: functionCall?.initiallyEngaged ?? false,
        disengageInitiallyEngagedFunctionCall: functionCall?.disengageInitiallyEngaged ?? [],
        userTextSuffix
    };
}

class GenerateResponseState<const Functions extends ChatModelFunctions | undefined = undefined> {
    private readonly llamaChat: LlamaChat;
    private readonly chatWrapper: ChatWrapper;

    private readonly history: ChatHistoryItem[];
    private readonly onToken: LLamaChatGenerateResponseOptions<Functions>["onToken"];
    private readonly signal: LLamaChatGenerateResponseOptions<Functions>["signal"];
    private readonly stopOnAbortSignal: LLamaChatGenerateResponseOptions<Functions>["stopOnAbortSignal"];
    public readonly maxTokens: LLamaChatGenerateResponseOptions<Functions>["maxTokens"];
    private readonly temperature: LLamaChatGenerateResponseOptions<Functions>["temperature"];
    private readonly minP: LLamaChatGenerateResponseOptions<Functions>["minP"];
    private readonly topK: LLamaChatGenerateResponseOptions<Functions>["topK"];
    private readonly topP: LLamaChatGenerateResponseOptions<Functions>["topP"];
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
    private readonly lastEvaluationContextWindowHistory: Exclude<LLamaChatGenerateResponseOptions<Functions>["lastEvaluationContextWindow"], undefined>["history"];
    private readonly minimumOverlapPercentageToPreventContextShift: Exclude<Exclude<LLamaChatGenerateResponseOptions<Functions>["lastEvaluationContextWindow"], undefined>["minimumOverlapPercentageToPreventContextShift"], undefined>;

    public readonly functionsEnabled: boolean;
    private readonly repeatPenaltyEnabled: boolean;
    private readonly resolvedContextShift: Required<LLamaChatContextShiftOptions>;
    private readonly resolvedRepeatPenalty: LLamaContextualRepeatPenalty & {
        lastTokens: number
    };
    private readonly lastModelResponse: string;
    private readonly grammarEvaluationState: LlamaGrammarEvaluationState | undefined;
    private readonly functionNameGrammar?: FunctionCallNameGrammar<NonNullable<Functions>>;
    private functionsGrammar?: FunctionCallNameGrammar<NonNullable<Functions>> | FunctionCallParamsGrammar<NonNullable<Functions>>;
    private functionsEvaluationState: LlamaGrammarEvaluationState | undefined;

    private readonly streamRegulator = new TokenStreamRegulator();
    public readonly stopGenerationDetector = new StopGenerationDetector();
    private readonly customStopGenerationTriggersDetector = new StopGenerationDetector();
    private readonly functionSyntaxStartDetector = new StopGenerationDetector();
    private readonly disengageInitiallyEngagedFunctionMode = new StopGenerationDetector();
    private readonly ignoreStartTextDetector = new StopGenerationDetector();
    private readonly locksToReleaseOnValidGeneration: QueuedTokenReleaseLock[] = [];

    public resolvedHistory: ChatHistoryItem[];

    public readonly res: Token[] = [];
    public readonly pendingTokens: Token[] = [];
    public ignoredStartTextTokens: Token[] = [];
    public readonly resFunctionCalls: Array<{
        functionName: string,
        params: any,
        raw: LlamaText
    }> = [];

    public functionEvaluationMode: false | "prefixOrDisengage" | "functionName" | "params" | "sectionSuffixOrBetweenCalls" = false;
    private currentFunctionCallPreviousText: LlamaText = LlamaText([]);
    private readonly currentFunctionCallCurrentPartTokens: Token[] = [];
    private functionEvaluationFunctionName: string = "";
    private currentFunctionCallPreviousPartLeftoverText: string = "";
    private removedStartTextToIgnore: boolean = false;
    private releasedPartiallyFreeTokensBeforeFunctionCallStartSyntax: boolean = false;

    public generatedTokens = 0;
    public isFirstEvaluation = true;
    public initiallyEngagedFunctionMode = false;
    public lastContextWindowHistory: ChatHistoryItem[];
    public lastHistoryCompressionMetadata: object | null | undefined;
    private restartEvaluationIterator = false;

    // context shift loop
    public shouldContextShift = false;

    public canAvoidReloadingHistory: boolean = false;
    public contextWindowTokens: Token[] = [];
    public stopGenerationTriggers: LlamaText[] = [];
    public ignoreStartText: LlamaText[] = [];
    public functionCallInitiallyEngaged: boolean = false;
    public disengageInitiallyEngagedFunctionCall: LlamaText[] = [];
    public userTextSuffix?: LlamaText = undefined;

    public tokens: Token[] = [];
    public contextWindowLastModelResponse: string = "";
    public contextWindowsRes: Token[] = [];

    // token evaluation loop
    public evaluationIterator?: AsyncGenerator<Token, void | Token>;
    public currentIteration?:  IteratorResult<Token, void | Token>;
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
            onToken,
            signal,
            stopOnAbortSignal = false,
            maxTokens,
            temperature,
            minP,
            topK,
            topP,
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
            lastEvaluationContextWindow: {
                history: lastEvaluationContextWindowHistory,
                minimumOverlapPercentageToPreventContextShift = 0.5
            } = {}
        }: LLamaChatGenerateResponseOptions<Functions> = {}
    ) {
        this.llamaChat = llamaChat;
        this.chatWrapper = chatWrapper;

        this.history = history;
        this.onToken = safeEventCallback(onToken);
        this.signal = signal;
        this.stopOnAbortSignal = stopOnAbortSignal;
        this.maxTokens = maxTokens;
        this.temperature = temperature;
        this.minP = minP;
        this.topK = topK;
        this.topP = topP;
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
        this.lastEvaluationContextWindowHistory = lastEvaluationContextWindowHistory;
        this.minimumOverlapPercentageToPreventContextShift = minimumOverlapPercentageToPreventContextShift;

        this.functionsEnabled = (this.functions != null && Object.keys(this.functions).length > 0);

        if (this.signal?.aborted)
            throw this.signal.reason;

        if (this.llamaChat.disposed)
            throw new DisposedError();

        this.resolvedHistory = this.llamaChat.sequence.isLoadedToMemory
            ? this.history.slice()
            : this.history.map(removeRawFromHistoryItem);
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
        this.lastModelResponse = getLastTextModelResponseFromChatHistory(this.resolvedHistory);
        this.repeatPenaltyEnabled = this.resolvedRepeatPenalty.lastTokens > 0;
        this.grammarEvaluationState = this.grammar != null
            ? new LlamaGrammarEvaluationState({grammar: this.grammar})
            : undefined;
        this.functionNameGrammar = this.functionsEnabled
            ? new FunctionCallNameGrammar(this.llamaChat.model._llama, this.functions as NonNullable<Functions>, this.chatWrapper)
            : undefined;
        this.functionsGrammar = undefined;
        this.functionsEvaluationState = undefined;

        this.lastContextWindowHistory = this.resolvedHistory;
        this.lastHistoryCompressionMetadata = this.resolvedContextShift;

        if (this.customStopTriggers != null)
            StopGenerationDetector.resolveStopTriggers(this.customStopTriggers, this.llamaChat.model.tokenizer)
                .map((stopTrigger) => this.customStopGenerationTriggersDetector.addStopTrigger(stopTrigger));

        if (this.grammar != null)
            StopGenerationDetector.resolveStopTriggers(this.grammar.stopGenerationTriggers, this.llamaChat.model.tokenizer)
                .map((stopTrigger) => this.stopGenerationDetector.addStopTrigger(stopTrigger));

        if (this.functions != null && Object.keys(this.functions).length > 0)
            this.functionSyntaxStartDetector.addStopTrigger(
                StopGenerationDetector.resolveLlamaTextTrigger(
                    LlamaText([
                        this.chatWrapper.settings.functions?.parallelism?.call?.sectionPrefix ?? "",
                        this.chatWrapper.settings.functions.call.prefix
                    ]),
                    this.llamaChat.model.tokenizer
                )
            );

        this.getPenaltyTokens = this.getPenaltyTokens.bind(this);
    }

    public dispose() {

    }

    public [Symbol.dispose]() {
        this.dispose();
    }

    public ensureLastHistoryItemIsModel() {
        if (this.resolvedHistory.length === 0 || this.resolvedHistory[this.resolvedHistory.length - 1].type !== "model")
            this.resolvedHistory.push({
                type: "model",
                response: []
            });
    }

    public ensureLastHistoryItemIsUser() {
        if (this.resolvedHistory.length === 0 || this.resolvedHistory[this.resolvedHistory.length - 1].type !== "user")
            this.resolvedHistory.push({
                type: "user",
                text: ""
            });
    }

    public ensureNotAborted() {
        if (this.signal?.aborted && (!this.stopOnAbortSignal || this.res.length === 0))
            throw this.signal.reason;

        if (this.llamaChat.disposed)
            throw new DisposedError();
    }

    public getPenaltyTokens() {
        if (this.llamaChat.disposed)
            throw new DisposedError();

        let punishTokens = this.res.slice(-this.resolvedRepeatPenalty.lastTokens);

        if (this.resolvedRepeatPenalty.punishTokensFilter != null)
            punishTokens = this.resolvedRepeatPenalty.punishTokensFilter(punishTokens);

        if (this.resolvedRepeatPenalty.penalizeNewLine == null || !this.resolvedRepeatPenalty.penalizeNewLine) {
            const nlToken = this.llamaChat.model.tokens.nl;

            if (nlToken != null)
                punishTokens = punishTokens.filter(token => token !== nlToken);
        }

        return punishTokens;
    }

    public getResolvedHistoryWithCurrentModelResponse() {
        if (this.res.length === 0)
            return this.resolvedHistory;

        let modelResponse = this.llamaChat.model.detokenize(this.res);

        if (this.grammar?.trimWhitespaceSuffix || this.trimWhitespaceSuffix)
            modelResponse = modelResponse.trimEnd();

        if (modelResponse === "")
            return this.resolvedHistory;

        return setLastModelTextResponseInChatHistory(
            this.resolvedHistory,
            this.lastModelResponse + modelResponse
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

            for (let i = 0; i < this.pendingTokens.length; i++) {
                this.ignoreStartTextDetector.recordGeneration({
                    text: this.llamaChat.model.detokenize([this.pendingTokens[i]]),
                    tokens: [this.pendingTokens[i]],
                    startNewChecks: i === 0,
                    triggerMustStartWithGeneration: true
                });

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
            const call = this.resFunctionCalls[i];

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
        endWithUserText: boolean = false,
        avoidReloadingHistory: boolean = false
    ): Promise<{userTextSuffix?: LlamaText}> {
        const queuedChunkTokens = this.streamRegulator.getAllQueuedChunkTokens();
        const functionCallsTokens = this.getContextWindowFunctionCallsTokens();

        if (!avoidReloadingHistory || !this.canAvoidReloadingHistory || !this.llamaChat.sequence.isLoadedToMemory) {
            const {
                history: contextWindowHistory,
                stopGenerationTriggers,
                tokens: contextWindowTokens,
                newResolvedHistory,
                newHistoryCompressionMetadata,
                ignoreStartText,
                functionCallInitiallyEngaged,
                disengageInitiallyEngagedFunctionCall,
                userTextSuffix
            } = await getContextWindow({
                resolvedHistory: resolvedHistory,
                resolvedContextShift: this.resolvedContextShift,
                lastHistoryCompressionMetadata: this.lastHistoryCompressionMetadata,
                pendingTokensCount: this.pendingTokens.length + queuedChunkTokens.length + functionCallsTokens.length,
                isFirstEvaluation: this.isFirstEvaluation,
                chatWrapper: this.chatWrapper,
                lastEvaluationContextWindowHistory: this.lastEvaluationContextWindowHistory,
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

            this.resolvedHistory = newResolvedHistory;
            this.lastHistoryCompressionMetadata = newHistoryCompressionMetadata;
            this.lastContextWindowHistory = contextWindowHistory;
            this.contextWindowLastModelResponse = getLastTextModelResponseFromChatHistory(contextWindowHistory);
            this.contextWindowsRes = [];

            this.canAvoidReloadingHistory = true;
        }

        this.tokens = [
            ...this.contextWindowTokens,
            ...this.ignoredStartTextTokens,
            ...this.pendingTokens,
            ...queuedChunkTokens,
            ...functionCallsTokens
        ];

        if (avoidReloadingHistory && this.tokens.length >= this.llamaChat.sequence.context.contextSize - 1)
            return await this.loadContextWindow(resolvedHistory, endWithUserText, false);

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

    public async enterFunctionCallingLoop(loadContextWindow: () => Promise<void>) {
        if (!this.functionsEnabled) {
            this.functionEvaluationMode = false;
            return undefined;
        }

        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (this.functionEvaluationMode === "prefixOrDisengage") {
                this.functionsGrammar = undefined;
                this.functionsEvaluationState = undefined;
                this.currentFunctionCallPreviousText = LlamaText([]);
                this.currentFunctionCallCurrentPartTokens.length = 0;

                const prefixTokens = LlamaText(this.chatWrapper.settings.functions.call.prefix)
                    .tokenize(this.llamaChat.model.tokenizer, "trimLeadingSpace");
                const prefixDetector = new StopGenerationDetector();
                const afterPrefixLeftoverTokens: Token[] = [];
                prefixDetector.addStopTrigger(
                    StopGenerationDetector.resolveLlamaTextTrigger(
                        LlamaText(this.chatWrapper.settings.functions.call.prefix),
                        this.llamaChat.model.tokenizer
                    )
                );

                for (const prefixToken of prefixTokens) {
                    const tokens = [prefixToken];
                    const text = this.llamaChat.model.detokenize(tokens);
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
                    else
                        prefixDetector.recordGeneration({
                            text: text,
                            tokens: tokens,
                            startNewChecks: this.currentFunctionCallCurrentPartTokens.length === 1,
                            triggerMustStartWithGeneration: true
                        });
                }

                for await (const token of this.evaluateWithContextShift(loadContextWindow)) {
                    const stopGenerationTriggerRes = this.handleStopGenerationTrigger("model");
                    if (stopGenerationTriggerRes != null)
                        return stopGenerationTriggerRes;

                    this.currentFunctionCallCurrentPartTokens.push(token);

                    this.disengageInitiallyEngagedFunctionMode.recordGeneration({
                        text: this.currentText,
                        tokens: this.currentTokens,
                        startNewChecks: this.currentFunctionCallCurrentPartTokens.length === 1,
                        triggerMustStartWithGeneration: true
                    });

                    if (prefixDetector.hasTriggeredStops)
                        afterPrefixLeftoverTokens.push(token);
                    else
                        prefixDetector.recordGeneration({
                            text: this.currentText,
                            tokens: this.currentTokens,
                            startNewChecks: this.currentFunctionCallCurrentPartTokens.length === 1,
                            triggerMustStartWithGeneration: true
                        });

                    if (this.disengageInitiallyEngagedFunctionMode.hasTriggeredStops ||
                        !this.disengageInitiallyEngagedFunctionMode.hasInProgressStops
                    )
                        break;
                }

                const abortRes = this.handleAbortTrigger("model");
                if (abortRes != null)
                    return abortRes;

                if (this.disengageInitiallyEngagedFunctionMode.hasTriggeredStops) {
                    for (const token of this.currentFunctionCallCurrentPartTokens) {
                        this.currentToken = token;
                        this.currentTokens = [this.currentToken];
                        this.currentText = this.llamaChat.model.detokenize(this.currentTokens);

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
                    const firstRemainingGenerationAfterStop = StopGenerationDetector.getFirstRemainingGenerationAfterStop(triggeredStops);
                    this.currentFunctionCallPreviousPartLeftoverText = StopGenerationDetector.detokenizeRemainingGeneration(
                        firstRemainingGenerationAfterStop,
                        this.llamaChat.model.detokenize
                    ) + this.llamaChat.model.detokenize(afterPrefixLeftoverTokens);
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

                        for (const leftoverToken of leftoverTokens) {
                            const canBeNextToken = this.llamaChat.context._canBeNextTokenForGrammarEvaluationState(
                                this.functionsEvaluationState,
                                leftoverToken
                            );

                            if (!canBeNextToken)
                                break;

                            this.llamaChat.context._acceptTokenOnGrammarEvaluationState(this.functionsEvaluationState, leftoverToken);
                            this.currentFunctionCallCurrentPartTokens.push(leftoverToken);
                            functionNameGenerationDoneDetector.recordGeneration({
                                text: this.llamaChat.model.detokenize([leftoverToken]),
                                tokens: [leftoverToken]
                            });
                        }
                    }
                }

                for await (const token of this.evaluateWithContextShift(loadContextWindow)) {
                    this.currentFunctionCallCurrentPartTokens.push(token);

                    functionNameGenerationDoneDetector.recordGeneration({
                        text: this.currentText,
                        tokens: this.currentTokens
                    });

                    if (functionNameGenerationDoneDetector.hasTriggeredStops)
                        break;
                }

                const abortRes = this.handleAbortTrigger("model");
                if (abortRes != null)
                    return abortRes;

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
                this.currentFunctionCallCurrentPartTokens.length = 0;

                let params: any = undefined;
                let paramsText: string = "";

                const functionDefinition = (this.functions as NonNullable<Functions>)[this.functionEvaluationFunctionName];
                if (functionDefinition == null)
                    throw new Error(`Function "${this.functionEvaluationFunctionName}" is not provided in the functions object`);
                else if (functionDefinition.params == null) {
                    params = undefined;
                    paramsText = "";
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
                        grammar: this.functionsGrammar
                    });

                    StopGenerationDetector.resolveStopTriggers(this.functionsGrammar.stopGenerationTriggers, this.llamaChat.model.tokenizer)
                        .map((stopTrigger) => functionParamsGenerationDoneDetector.addStopTrigger(stopTrigger));

                    for await (const token of this.evaluateWithContextShift(loadContextWindow)) {
                        this.currentFunctionCallCurrentPartTokens.push(token);

                        functionParamsGenerationDoneDetector.recordGeneration({
                            text: this.currentText,
                            tokens: this.currentTokens
                        });

                        if (functionParamsGenerationDoneDetector.hasTriggeredStops)
                            break;
                    }

                    const abortRes = this.handleAbortTrigger("model");
                    if (abortRes != null)
                        return abortRes;

                    const functionCallParamsText = this.llamaChat.model.detokenize(this.currentFunctionCallCurrentPartTokens);
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

                for await (const token of this.evaluateWithContextShift(loadContextWindow)) {
                    this.currentFunctionCallCurrentPartTokens.push(token);

                    sectionSuffixDetector.recordGeneration({
                        text: this.currentText,
                        tokens: this.currentTokens,
                        startNewChecks: isFirstToken,
                        triggerMustStartWithGeneration: true
                    });

                    isFirstToken = false;

                    if (sectionSuffixDetector.hasTriggeredStops || !sectionSuffixDetector.hasInProgressStops)
                        break;
                }

                const abortRes = this.handleAbortTrigger("model");
                if (abortRes != null)
                    return abortRes;

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

        if (this.pendingTokens.length > 0)
            this.onToken?.(this.pendingTokens.slice());

        pushAll(this.res, this.pendingTokens);
        pushAll(this.contextWindowsRes, this.pendingTokens);
        this.pendingTokens.length = 0;

        this.streamRegulator.clearQueue();

        this.releasedPartiallyFreeTokensBeforeFunctionCallStartSyntax = true;
    }

    public returnFunctionCallResults(): LlamaChatResponse<Functions> | undefined {
        if (this.resFunctionCalls.length > 0) {
            this.releasePartiallyFreeTokensBeforeFunctionCallStart();

            let modelResponse = this.llamaChat.model.detokenize(this.res);
            let contextWindowModelResponse = this.llamaChat.model.detokenize(this.contextWindowsRes);

            if (this.grammar?.trimWhitespaceSuffix || this.trimWhitespaceSuffix) {
                modelResponse = modelResponse.trimEnd();
                contextWindowModelResponse = contextWindowModelResponse.trimEnd();
            }

            return {
                response: modelResponse,
                lastEvaluation: {
                    contextWindow: setLastTextInChatHistory(
                        "model",
                        this.lastContextWindowHistory,
                        this.contextWindowLastModelResponse + contextWindowModelResponse
                    ),
                    cleanHistory: setLastTextInChatHistory(
                        "model",
                        this.resolvedHistory,
                        this.lastModelResponse + modelResponse
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

    public async *evaluateWithContextShift(loadContextWindow: () => Promise<void>): AsyncGenerator<Token> {
        while (true) {
            this.startTokenLoop();
            await loadContextWindow();
            await this.alignCurrentSequenceStateWithCurrentTokens();

            await this.createNewEvaluationIterator();
            while (await this.iterateEvaluation()) {
                if (this.currentToken == null)
                    break;

                yield this.currentToken;

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
        let {firstDifferentIndex} = this.llamaChat.sequence.compareContextTokens(this.tokens);

        // we need to decode at least one token to generate a response
        if (firstDifferentIndex === this.tokens.length && firstDifferentIndex > 0)
            firstDifferentIndex -= 1;

        this.tokens.splice(0, firstDifferentIndex);

        if (firstDifferentIndex < this.llamaChat.sequence.nextTokenIndex) {
            await this.llamaChat.sequence.eraseContextTokenRanges([{
                start: firstDifferentIndex,
                end: this.llamaChat.sequence.nextTokenIndex
            }]);
            this.ensureNotAborted();
        }
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
            grammarEvaluationState: () => {
                if (this.functionEvaluationMode !== false)
                    return this.functionsEvaluationState;

                return this.grammarEvaluationState;
            },
            repeatPenalty: !this.repeatPenaltyEnabled ? undefined : {
                punishTokens: this.getPenaltyTokens,
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

        if (this.currentIteration != null && this.currentIteration?.done !== true) {
            this.currentToken = this.currentIteration.value;
            this.currentTokens = [this.currentToken];
            this.currentText = this.llamaChat.model.detokenize(this.currentTokens);

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

    public waitOnPartialCharactersOrWhiteSpaceTokens() {
        if (this.currentText === UNKNOWN_UNICODE_CHAR || (
            (this.grammar?.trimWhitespaceSuffix || this.trimWhitespaceSuffix) && this.currentText?.trim() === ""
        )) {
            if (this.currentQueuedTokenRelease != null)
                this.locksToReleaseOnValidGeneration.push(this.currentQueuedTokenRelease.createTextIndexLock(0));
        } else {
            while (this.locksToReleaseOnValidGeneration.length > 0)
                this.locksToReleaseOnValidGeneration.shift()!.dispose();
        }
    }

    public detectAndHandleFunctionStartSyntax() {
        this.functionSyntaxStartDetector.recordGeneration({
            text: this.currentText,
            tokens: this.currentTokens,
            queuedTokenRelease: this.currentQueuedTokenRelease
        });

        if (this.currentQueuedTokenRelease != null && this.functionEvaluationMode === false && this.functionsEnabled &&
            this.functionSyntaxStartDetector.hasTriggeredStops
        ) {
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

            const firstRemainingGenerationAfterStop = StopGenerationDetector.getFirstRemainingGenerationAfterStop(triggeredStops);
            const remainingTextAfterStop = StopGenerationDetector.detokenizeRemainingGeneration(
                firstRemainingGenerationAfterStop,
                this.llamaChat.model.detokenize
            );

            this.currentFunctionCallPreviousPartLeftoverText = remainingTextAfterStop;
        }
    }

    public recordStopGenerationEvaluation() {
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
    }

    public popStreamRegulatorFreeTokens() {
        pushAll(this.pendingTokens, this.streamRegulator.popFreeChunkTokens());
    }

    public handleStopGenerationTrigger(lastHistoryItemType: "user" | "model") {
        if (this.stopGenerationDetector.hasTriggeredStops || this.customStopGenerationTriggersDetector.hasTriggeredStops ||
            this.llamaChat.model.isEogToken(this.currentToken)
        ) {
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

            const firstRemainingGenerationAfterStop = StopGenerationDetector.getFirstRemainingGenerationAfterStop(triggeredStops);

            this.removeFoundStartIgnoreTextsFromPendingTokens(true);

            if (this.pendingTokens.length > 0)
                this.onToken?.(this.pendingTokens.slice());

            pushAll(this.res, this.pendingTokens);
            pushAll(this.contextWindowsRes, this.pendingTokens);
            this.pendingTokens.length = 0;

            let modelResponse = this.llamaChat.model.detokenize(this.res);
            let contextWindowModelResponse = this.llamaChat.model.detokenize(this.contextWindowsRes);

            if (this.grammar?.trimWhitespaceSuffix || this.trimWhitespaceSuffix) {
                modelResponse = modelResponse.trimEnd();
                contextWindowModelResponse = contextWindowModelResponse.trimEnd();
            }

            const lastEvaluation = {
                contextWindow: setLastTextInChatHistory(
                    lastHistoryItemType,
                    this.lastContextWindowHistory,
                    this.contextWindowLastModelResponse + contextWindowModelResponse
                ),
                cleanHistory: setLastTextInChatHistory(
                    lastHistoryItemType,
                    this.resolvedHistory,
                    this.lastModelResponse + modelResponse
                ),
                contextShiftMetadata: this.lastHistoryCompressionMetadata
            };
            const isEogToken = this.llamaChat.model.isEogToken(this.currentToken);

            if (isEogToken || this.stopGenerationDetector.hasTriggeredStops) {
                return {
                    response: modelResponse,
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
                response: modelResponse,
                lastEvaluation,
                metadata: {
                    remainingGenerationAfterStop: firstRemainingGenerationAfterStop,
                    stopReason: "customStopTrigger",
                    customStopTrigger: triggeredStops[0].stopTrigger
                }
            } satisfies LlamaChatResponse<Functions>;
        }

        return undefined;
    }

    public spliceIgnoreStartTextDetectedTokens() {
        if (this.res.length === 0) {
            this.ignoreStartTextDetector.clearInProgressStops();
            this.ignoreStartTextDetector.clearTriggeredStops();

            this.ignoreStartTextDetector.recordGeneration({
                text: this.llamaChat.model.detokenize(this.pendingTokens),
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

            if (this.pendingTokens.length > 0) {
                this.onToken?.(this.pendingTokens.slice());
                pushAll(this.res, this.pendingTokens);
                pushAll(this.contextWindowsRes, this.pendingTokens);
                this.pendingTokens.length = 0;
            }
        }
    }

    public handleMaxTokensTrigger(lastHistoryItemType: "user" | "model") {
        if (this.isMaxTokensTriggered()) {
            let modelResponse = this.llamaChat.model.detokenize(this.res);
            let contextWindowModelResponse = this.llamaChat.model.detokenize(this.contextWindowsRes);

            if (this.grammar?.trimWhitespaceSuffix || this.trimWhitespaceSuffix) {
                modelResponse = modelResponse.trimEnd();
                contextWindowModelResponse = contextWindowModelResponse.trimEnd();
            }

            return {
                response: modelResponse,
                lastEvaluation: {
                    contextWindow: setLastTextInChatHistory(
                        lastHistoryItemType,
                        this.lastContextWindowHistory,
                        this.contextWindowLastModelResponse + contextWindowModelResponse
                    ),
                    cleanHistory: setLastTextInChatHistory(
                        lastHistoryItemType,
                        this.resolvedHistory,
                        this.lastModelResponse + modelResponse
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

    public updateShouldContextShift() {
        this.shouldContextShift = this.llamaChat.sequence.nextTokenIndex >= this.llamaChat.context.contextSize - 1;
        return this.shouldContextShift;
    }

    public get shouldAbort() {
        return !!(this.signal?.aborted && this.stopOnAbortSignal);
    }

    public handleAbortTrigger(lastHistoryItemType: "user" | "model") {
        if (this.shouldAbort && this.signal?.aborted && this.stopOnAbortSignal) {
            if (this.res.length === 0)
                throw this.signal.reason;

            let modelResponse = this.llamaChat.model.detokenize(this.res);
            let contextWindowModelResponse = this.llamaChat.model.detokenize(this.contextWindowsRes);

            if (this.grammar?.trimWhitespaceSuffix || this.trimWhitespaceSuffix) {
                modelResponse = modelResponse.trimEnd();
                contextWindowModelResponse = contextWindowModelResponse.trimEnd();
            }

            return {
                response: modelResponse,
                lastEvaluation: {
                    contextWindow: setLastTextInChatHistory(
                        lastHistoryItemType,
                        this.lastContextWindowHistory,
                        this.contextWindowLastModelResponse + contextWindowModelResponse
                    ),
                    cleanHistory: setLastTextInChatHistory(
                        lastHistoryItemType,
                        this.resolvedHistory,
                        this.lastModelResponse + modelResponse
                    ),
                    contextShiftMetadata: this.lastHistoryCompressionMetadata
                },
                metadata: {
                    stopReason: "abort"
                }
            } satisfies LlamaChatResponse<Functions>;
        }

        return undefined;
    }
}
