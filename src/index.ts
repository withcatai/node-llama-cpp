import {DisposedError} from "lifecycle-utils";
import {Llama} from "./bindings/Llama.js";
import {getLlama, LlamaOptions} from "./bindings/getLlama.js";
import {NoBinaryFoundError} from "./bindings/utils/NoBinaryFoundError.js";
import {LlamaLogLevel} from "./bindings/types.js";
import {LlamaModel, LlamaModelInfillTokens, type LlamaModelOptions, LlamaModelTokens} from "./evaluator/LlamaModel.js";
import {LlamaGrammar, type LlamaGrammarOptions} from "./evaluator/LlamaGrammar.js";
import {LlamaJsonSchemaGrammar} from "./evaluator/LlamaJsonSchemaGrammar.js";
import {LlamaJsonSchemaValidationError} from "./utils/gbnfJson/utils/validateObjectAgainstGbnfSchema.js";
import {LlamaGrammarEvaluationState, LlamaGrammarEvaluationStateOptions} from "./evaluator/LlamaGrammarEvaluationState.js";
import {LlamaContext, LlamaContextSequence} from "./evaluator/LlamaContext/LlamaContext.js";
import {
    LlamaEmbeddingContext, type LlamaEmbeddingContextOptions, LlamaEmbedding, type LlamaEmbeddingJSON
} from "./evaluator/LlamaEmbeddingContext.js";
import {
    type LlamaContextOptions, type BatchingOptions, type LlamaContextSequenceRepeatPenalty, type CustomBatchingDispatchSchedule,
    type CustomBatchingPrioritizeStrategy, type BatchItem, type PrioritizedBatchItem, type ContextShiftOptions,
    type ContextTokensDeleteRange, type EvaluationPriority
} from "./evaluator/LlamaContext/types.js";
import {
    LlamaChatSession, type LlamaChatSessionOptions, type LlamaChatSessionContextShiftOptions,
    type LLamaChatPromptOptions, type LlamaChatSessionRepeatPenalty
} from "./evaluator/LlamaChatSession/LlamaChatSession.js";
import {defineChatSessionFunction} from "./evaluator/LlamaChatSession/utils/defineChatSessionFunction.js";
import {
    LlamaChat, type LlamaChatOptions, type LLamaChatGenerateResponseOptions, type LLamaChatContextShiftOptions,
    type LlamaChatResponse, type LlamaChatResponseFunctionCall
} from "./evaluator/LlamaChat/LlamaChat.js";
import {
    LlamaCompletion, type LlamaCompletionOptions, type LlamaCompletionGenerationOptions, type LlamaInfillGenerationOptions
} from "./evaluator/LlamaCompletion.js";
import {UnsupportedError} from "./utils/UnsupportedError.js";
import {ChatWrapper, type ChatWrapperSettings} from "./ChatWrapper.js";
import {EmptyChatWrapper} from "./chatWrappers/EmptyChatWrapper.js";
import {LlamaChatWrapper} from "./chatWrappers/LlamaChatWrapper.js";
import {GeneralChatWrapper} from "./chatWrappers/GeneralChatWrapper.js";
import {ChatMLChatWrapper} from "./chatWrappers/ChatMLChatWrapper.js";
import {FalconChatWrapper} from "./chatWrappers/FalconChatWrapper.js";
import {AlpacaChatWrapper} from "./chatWrappers/AlpacaChatWrapper.js";
import {FunctionaryChatWrapper} from "./chatWrappers/FunctionaryChatWrapper.js";
import {GemmaChatWrapper} from "./chatWrappers/GemmaChatWrapper.js";
import {resolveChatWrapperBasedOnModel} from "./chatWrappers/resolveChatWrapperBasedOnModel.js";
import {
    resolveChatWrapperBasedOnWrapperTypeName, chatWrapperTypeNames, type ChatWrapperTypeName
} from "./bindings/utils/resolveChatWrapperBasedOnWrapperTypeName.js";
import {
    LlamaText, SpecialToken, BuiltinSpecialToken, isLlamaText, tokenizeText, type LlamaTextJSON, type LlamaTextJSONValue,
    type LlamaTextSpecialTokenJSON
} from "./utils/LlamaText.js";
import {appendUserMessageToChatHistory} from "./utils/appendUserMessageToChatHistory.js";
import {getModuleVersion} from "./utils/getModuleVersion.js";

import {
    type ChatHistoryItem, type ChatModelFunctionCall, type ChatModelFunctions, type ChatModelResponse,
    type ChatSessionModelFunction, type ChatSessionModelFunctions, type ChatSystemMessage, type ChatUserMessage,
    type Token, isChatModelResponseFunctionCall, type LLamaContextualRepeatPenalty
} from "./types.js";
import {
    type GbnfJsonArraySchema, type GbnfJsonBasicSchema, type GbnfJsonConstSchema, type GbnfJsonEnumSchema, type GbnfJsonObjectSchema,
    type GbnfJsonOneOfSchema, type GbnfJsonSchema, type GbnfJsonSchemaImmutableType, type GbnfJsonSchemaToType
} from "./utils/gbnfJson/types.js";


export {
    Llama,
    getLlama,
    type LlamaOptions,
    LlamaLogLevel,
    NoBinaryFoundError,
    LlamaModel,
    LlamaModelTokens,
    LlamaModelInfillTokens,
    type LlamaModelOptions,
    LlamaGrammar,
    type LlamaGrammarOptions,
    LlamaJsonSchemaGrammar,
    LlamaJsonSchemaValidationError,
    LlamaGrammarEvaluationState,
    type LlamaGrammarEvaluationStateOptions,
    LlamaContext,
    LlamaContextSequence,
    type LlamaContextOptions,
    type BatchingOptions,
    type CustomBatchingDispatchSchedule,
    type CustomBatchingPrioritizeStrategy,
    type BatchItem,
    type PrioritizedBatchItem,
    type ContextShiftOptions,
    type ContextTokensDeleteRange,
    type EvaluationPriority,
    type LlamaContextSequenceRepeatPenalty,
    LlamaEmbeddingContext,
    type LlamaEmbeddingContextOptions,
    LlamaEmbedding,
    type LlamaEmbeddingJSON,
    LlamaChatSession,
    defineChatSessionFunction,
    type LlamaChatSessionOptions,
    type LlamaChatSessionContextShiftOptions,
    type LLamaChatPromptOptions,
    type LlamaChatSessionRepeatPenalty,
    LlamaChat,
    type LlamaChatOptions,
    type LLamaChatGenerateResponseOptions,
    type LLamaChatContextShiftOptions,
    type LLamaContextualRepeatPenalty,
    type LlamaChatResponse,
    type LlamaChatResponseFunctionCall,
    LlamaCompletion,
    type LlamaCompletionOptions,
    type LlamaCompletionGenerationOptions,
    type LlamaInfillGenerationOptions,
    UnsupportedError,
    DisposedError,
    ChatWrapper,
    type ChatWrapperSettings,
    EmptyChatWrapper,
    LlamaChatWrapper,
    GeneralChatWrapper,
    ChatMLChatWrapper,
    FalconChatWrapper,
    AlpacaChatWrapper,
    FunctionaryChatWrapper,
    GemmaChatWrapper,
    resolveChatWrapperBasedOnModel,
    resolveChatWrapperBasedOnWrapperTypeName,
    chatWrapperTypeNames,
    type ChatWrapperTypeName,
    LlamaText,
    SpecialToken,
    BuiltinSpecialToken,
    isLlamaText,
    tokenizeText,
    type LlamaTextJSON,
    type LlamaTextJSONValue,
    type LlamaTextSpecialTokenJSON,
    appendUserMessageToChatHistory,
    getModuleVersion,
    type ChatHistoryItem,
    type ChatModelFunctionCall,
    type ChatModelFunctions,
    type ChatModelResponse,
    type ChatSessionModelFunction,
    type ChatSessionModelFunctions,
    type ChatSystemMessage,
    type ChatUserMessage,
    type Token,
    isChatModelResponseFunctionCall,
    type GbnfJsonSchema,
    type GbnfJsonSchemaToType,
    type GbnfJsonSchemaImmutableType,
    type GbnfJsonBasicSchema,
    type GbnfJsonConstSchema,
    type GbnfJsonEnumSchema,
    type GbnfJsonOneOfSchema,
    type GbnfJsonObjectSchema,
    type GbnfJsonArraySchema
};
