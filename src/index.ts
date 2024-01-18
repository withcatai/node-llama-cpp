import {DisposedError} from "lifecycle-utils";
import {LlamaModel, LlamaModelInfillTokens, type LlamaModelOptions, LlamaModelTokens} from "./llamaEvaluator/LlamaModel.js";
import {LlamaGrammar, type LlamaGrammarOptions} from "./llamaEvaluator/LlamaGrammar.js";
import {LlamaJsonSchemaGrammar} from "./llamaEvaluator/LlamaJsonSchemaGrammar.js";
import {LlamaJsonSchemaValidationError} from "./utils/gbnfJson/utils/validateObjectAgainstGbnfSchema.js";
import {LlamaGrammarEvaluationState, LlamaGrammarEvaluationStateOptions} from "./llamaEvaluator/LlamaGrammarEvaluationState.js";
import {LlamaContext, LlamaContextSequence} from "./llamaEvaluator/LlamaContext/LlamaContext.js";
import {
    type LlamaContextOptions, type BatchingOptions, type LlamaContextSequenceRepeatPenalty, type CustomBatchingDispatchSchedule,
    type CustomBatchingPrioritizeStrategy, type BatchItem, type PrioritizedBatchItem, type ContextShiftOptions,
    type ContextTokensDeleteRange, type EvaluationPriority
} from "./llamaEvaluator/LlamaContext/types.js";
import {
    LlamaChatSession, type LlamaChatSessionOptions, type LlamaChatSessionContextShiftOptions,
    type LLamaChatPromptOptions, type LlamaChatSessionRepeatPenalty
} from "./llamaEvaluator/LlamaChatSession/LlamaChatSession.js";
import {defineChatSessionFunction} from "./llamaEvaluator/LlamaChatSession/utils/defineChatSessionFunction.js";
import {
    LlamaChat, type LlamaChatOptions, type LLamaChatGenerateResponseOptions, type LLamaChatContextShiftOptions,
    type LLamaChatRepeatPenalty, type LlamaChatResponse, type LlamaChatResponseFunctionCall
} from "./llamaEvaluator/LlamaChat/LlamaChat.js";
import {AbortError} from "./AbortError.js";
import {ChatWrapper, type ChatWrapperSettings} from "./ChatWrapper.js";
import {EmptyChatWrapper} from "./chatWrappers/EmptyChatWrapper.js";
import {LlamaChatWrapper} from "./chatWrappers/LlamaChatWrapper.js";
import {GeneralChatWrapper} from "./chatWrappers/GeneralChatWrapper.js";
import {ChatMLChatWrapper} from "./chatWrappers/ChatMLChatWrapper.js";
import {FalconChatWrapper} from "./chatWrappers/FalconChatWrapper.js";
import {AlpacaChatWrapper} from "./chatWrappers/AlpacaChatWrapper.js";
import {FunctionaryChatWrapper} from "./chatWrappers/FunctionaryChatWrapper.js";
import {resolveChatWrapperBasedOnModel} from "./chatWrappers/resolveChatWrapperBasedOnModel.js";
import {
    LlamaText, SpecialToken, BuiltinSpecialToken, isLlamaText, tokenizeText, type LlamaTextJSON, type LlamaTextJSONValue,
    type LlamaTextSpecialTokenJSON
} from "./utils/LlamaText.js";
import {appendUserMessageToChatHistory} from "./utils/appendUserMessageToChatHistory.js";
import {getReleaseInfo} from "./utils/getReleaseInfo.js";

import {
    type ChatHistoryItem, type ChatModelFunctionCall, type ChatModelFunctions, type ChatModelResponse,
    type ChatSessionModelFunction, type ChatSessionModelFunctions, type ChatSystemMessage, type ChatUserMessage,
    type Token, isChatModelResponseFunctionCall
} from "./types.js";
import {
    type GbnfJsonArraySchema, type GbnfJsonBasicSchema, type GbnfJsonConstSchema, type GbnfJsonEnumSchema, type GbnfJsonObjectSchema,
    type GbnfJsonOneOfSchema, type GbnfJsonSchema, type GbnfJsonSchemaImmutableType, type GbnfJsonSchemaToType
} from "./utils/gbnfJson/types.js";


export {
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
    type LLamaChatRepeatPenalty,
    type LlamaChatResponse,
    type LlamaChatResponseFunctionCall,
    AbortError,
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
    resolveChatWrapperBasedOnModel,
    LlamaText,
    SpecialToken,
    BuiltinSpecialToken,
    isLlamaText,
    tokenizeText,
    type LlamaTextJSON,
    type LlamaTextJSONValue,
    type LlamaTextSpecialTokenJSON,
    appendUserMessageToChatHistory,
    getReleaseInfo,
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
