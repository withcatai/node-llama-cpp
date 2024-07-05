import {DisposedError} from "lifecycle-utils";
import {Llama} from "./bindings/Llama.js";
import {getLlama, type LlamaOptions, type LastBuildOptions} from "./bindings/getLlama.js";
import {NoBinaryFoundError} from "./bindings/utils/NoBinaryFoundError.js";
import {
    type LlamaGpuType, LlamaLogLevel, LlamaLogLevelGreaterThan, LlamaLogLevelGreaterThanOrEqual, LlamaVocabularyType
} from "./bindings/types.js";
import {LlamaModel, LlamaModelInfillTokens, type LlamaModelOptions, LlamaModelTokens} from "./evaluator/LlamaModel/LlamaModel.js";
import {TokenAttributes} from "./evaluator/LlamaModel/utils/TokenAttributes.js";
import {LlamaGrammar, type LlamaGrammarOptions} from "./evaluator/LlamaGrammar.js";
import {LlamaJsonSchemaGrammar} from "./evaluator/LlamaJsonSchemaGrammar.js";
import {LlamaJsonSchemaValidationError} from "./utils/gbnfJson/utils/validateObjectAgainstGbnfSchema.js";
import {LlamaGrammarEvaluationState, LlamaGrammarEvaluationStateOptions} from "./evaluator/LlamaGrammarEvaluationState.js";
import {LlamaContext, LlamaContextSequence} from "./evaluator/LlamaContext/LlamaContext.js";
import {LlamaEmbeddingContext, type LlamaEmbeddingContextOptions, type LlamaEmbedding} from "./evaluator/LlamaEmbeddingContext.js";
import {
    type LlamaContextOptions, type BatchingOptions, type LlamaContextSequenceRepeatPenalty, type CustomBatchingDispatchSchedule,
    type CustomBatchingPrioritizationStrategy, type BatchItem, type PrioritizedBatchItem, type ContextShiftOptions,
    type ContextTokensDeleteRange, type EvaluationPriority
} from "./evaluator/LlamaContext/types.js";
import {TokenBias} from "./evaluator/TokenBias.js";
import {
    LlamaChatSession, type LlamaChatSessionOptions, type LlamaChatSessionContextShiftOptions,
    type LLamaChatPromptOptions, type LLamaChatCompletePromptOptions, type LlamaChatSessionRepeatPenalty, type LLamaChatPreloadPromptOptions
} from "./evaluator/LlamaChatSession/LlamaChatSession.js";
import {defineChatSessionFunction} from "./evaluator/LlamaChatSession/utils/defineChatSessionFunction.js";
import {
    LlamaChat, type LlamaChatOptions, type LLamaChatGenerateResponseOptions, type LLamaChatLoadAndCompleteUserMessageOptions,
    type LLamaChatContextShiftOptions, type LlamaChatResponse, type LlamaChatResponseFunctionCall, type LlamaChatLoadAndCompleteUserResponse
} from "./evaluator/LlamaChat/LlamaChat.js";
import {
    LlamaChatSessionPromptCompletionEngine, type LLamaChatPromptCompletionEngineOptions
} from "./evaluator/LlamaChatSession/utils/LlamaChatSessionPromptCompletionEngine.js";
import {
    LlamaCompletion, type LlamaCompletionOptions, type LlamaCompletionGenerationOptions, type LlamaInfillGenerationOptions,
    type LlamaCompletionResponse
} from "./evaluator/LlamaCompletion.js";
import {TokenMeter, type TokenMeterState} from "./evaluator/TokenMeter.js";
import {UnsupportedError} from "./utils/UnsupportedError.js";
import {InsufficientMemoryError} from "./utils/InsufficientMemoryError.js";
import {ChatWrapper} from "./ChatWrapper.js";
import {EmptyChatWrapper} from "./chatWrappers/EmptyChatWrapper.js";
import {Llama3ChatWrapper} from "./chatWrappers/Llama3ChatWrapper.js";
import {Llama2ChatWrapper} from "./chatWrappers/Llama2ChatWrapper.js";
import {GeneralChatWrapper} from "./chatWrappers/GeneralChatWrapper.js";
import {ChatMLChatWrapper} from "./chatWrappers/ChatMLChatWrapper.js";
import {FalconChatWrapper} from "./chatWrappers/FalconChatWrapper.js";
import {AlpacaChatWrapper} from "./chatWrappers/AlpacaChatWrapper.js";
import {FunctionaryChatWrapper} from "./chatWrappers/FunctionaryChatWrapper.js";
import {GemmaChatWrapper} from "./chatWrappers/GemmaChatWrapper.js";
import {TemplateChatWrapper, type TemplateChatWrapperOptions} from "./chatWrappers/generic/TemplateChatWrapper.js";
import {
    JinjaTemplateChatWrapper, type JinjaTemplateChatWrapperOptions, type JinjaTemplateChatWrapperOptionsConvertMessageFormat
} from "./chatWrappers/generic/JinjaTemplateChatWrapper.js";
import {ChatHistoryFunctionCallMessageTemplate} from "./chatWrappers/generic/utils/chatHistoryFunctionCallMessageTemplate.js";
import {
    resolvableChatWrapperTypeNames, type ResolvableChatWrapperTypeName, specializedChatWrapperTypeNames,
    type SpecializedChatWrapperTypeName, templateChatWrapperTypeNames, type TemplateChatWrapperTypeName, resolveChatWrapper,
    type ResolveChatWrapperOptions
} from "./chatWrappers/utils/resolveChatWrapper.js";
import {ChatModelFunctionsDocumentationGenerator} from "./chatWrappers/utils/ChatModelFunctionsDocumentationGenerator.js";
import {
    LlamaText, SpecialTokensText, SpecialToken, isLlamaText, tokenizeText, type LlamaTextValue, type LlamaTextInputValue,
    type LlamaTextJSON, type LlamaTextJSONValue, type LlamaTextSpecialTokensTextJSON, type LlamaTextSpecialTokenJSON,
    type BuiltinSpecialTokenValue
} from "./utils/LlamaText.js";
import {appendUserMessageToChatHistory} from "./utils/appendUserMessageToChatHistory.js";
import {getModuleVersion} from "./utils/getModuleVersion.js";
import {readGgufFileInfo} from "./gguf/readGgufFileInfo.js";
import {GgufInsights, type GgufInsightsResourceRequirements} from "./gguf/insights/GgufInsights.js";
import {GgufInsightsConfigurationResolver} from "./gguf/insights/GgufInsightsConfigurationResolver.js";
import {createModelDownloader, ModelDownloader, type ModelDownloaderOptions} from "./utils/createModelDownloader.js";

import {
    type ChatHistoryItem, type ChatModelFunctionCall, type ChatModelFunctions, type ChatModelResponse,
    type ChatSessionModelFunction, type ChatSessionModelFunctions, type ChatSystemMessage, type ChatUserMessage,
    type Token, type Tokenizer, type Detokenizer, isChatModelResponseFunctionCall, type LLamaContextualRepeatPenalty,
    type ChatWrapperSettings, type ChatWrapperGenerateContextStateOptions, type ChatWrapperGeneratedContextState
} from "./types.js";
import {
    type GbnfJsonArraySchema, type GbnfJsonBasicSchema, type GbnfJsonConstSchema, type GbnfJsonEnumSchema, type GbnfJsonObjectSchema,
    type GbnfJsonOneOfSchema, type GbnfJsonSchema, type GbnfJsonSchemaImmutableType, type GbnfJsonSchemaToType
} from "./utils/gbnfJson/types.js";
import {type GgufFileInfo} from "./gguf/types/GgufFileInfoTypes.js";
import {
    type GgufMetadata, type GgufMetadataLlmToType, GgufArchitectureType, GgufFileType, GgufMetadataTokenizerTokenType,
    GgufMetadataArchitecturePoolingType, type GgufMetadataGeneral, type GgufMetadataTokenizer, type GgufMetadataDefaultArchitectureType,
    type GgufMetadataLlmLLaMA, type GgufMetadataMPT, type GgufMetadataGPTNeoX, type GgufMetadataGPTJ, type GgufMetadataGPT2,
    type GgufMetadataBloom, type GgufMetadataFalcon, type GgufMetadataMamba, isGgufMetadataOfArchitectureType
} from "./gguf/types/GgufMetadataTypes.js";
import {GgmlType, type GgufTensorInfo} from "./gguf/types/GgufTensorInfoTypes.js";


export {
    Llama,
    getLlama,
    type LlamaOptions,
    type LastBuildOptions,
    type LlamaGpuType,
    LlamaLogLevel,
    NoBinaryFoundError,
    LlamaModel,
    LlamaModelTokens,
    LlamaModelInfillTokens,
    TokenAttributes,
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
    type CustomBatchingPrioritizationStrategy,
    type BatchItem,
    type PrioritizedBatchItem,
    type ContextShiftOptions,
    type ContextTokensDeleteRange,
    type EvaluationPriority,
    type LlamaContextSequenceRepeatPenalty,
    TokenBias,
    LlamaEmbeddingContext,
    type LlamaEmbeddingContextOptions,
    type LlamaEmbedding,
    LlamaChatSession,
    defineChatSessionFunction,
    type LlamaChatSessionOptions,
    type LlamaChatSessionContextShiftOptions,
    type LLamaChatPromptOptions,
    type LLamaChatCompletePromptOptions,
    type LlamaChatSessionRepeatPenalty,
    type LLamaChatPreloadPromptOptions,
    LlamaChat,
    type LlamaChatOptions,
    type LLamaChatGenerateResponseOptions,
    type LLamaChatLoadAndCompleteUserMessageOptions,
    type LLamaChatContextShiftOptions,
    type LLamaContextualRepeatPenalty,
    type LlamaChatResponse,
    type LlamaChatResponseFunctionCall,
    type LlamaChatLoadAndCompleteUserResponse,
    LlamaChatSessionPromptCompletionEngine,
    type LLamaChatPromptCompletionEngineOptions,
    LlamaCompletion,
    type LlamaCompletionOptions,
    type LlamaCompletionGenerationOptions,
    type LlamaInfillGenerationOptions,
    type LlamaCompletionResponse,
    TokenMeter,
    type TokenMeterState,
    UnsupportedError,
    InsufficientMemoryError,
    DisposedError,
    ChatWrapper,
    type ChatWrapperSettings,
    type ChatWrapperGenerateContextStateOptions,
    type ChatWrapperGeneratedContextState,
    EmptyChatWrapper,
    Llama3ChatWrapper,
    Llama2ChatWrapper,
    GeneralChatWrapper,
    ChatMLChatWrapper,
    FalconChatWrapper,
    AlpacaChatWrapper,
    FunctionaryChatWrapper,
    GemmaChatWrapper,
    TemplateChatWrapper,
    type TemplateChatWrapperOptions,
    JinjaTemplateChatWrapper,
    type JinjaTemplateChatWrapperOptions,
    type JinjaTemplateChatWrapperOptionsConvertMessageFormat,
    type ChatHistoryFunctionCallMessageTemplate,
    resolveChatWrapper,
    type ResolveChatWrapperOptions,
    resolvableChatWrapperTypeNames,
    type ResolvableChatWrapperTypeName,
    specializedChatWrapperTypeNames,
    type SpecializedChatWrapperTypeName,
    templateChatWrapperTypeNames,
    type TemplateChatWrapperTypeName,
    ChatModelFunctionsDocumentationGenerator,
    LlamaText,
    SpecialTokensText,
    SpecialToken,
    isLlamaText,
    tokenizeText,
    type LlamaTextValue,
    type LlamaTextInputValue,
    type LlamaTextJSON,
    type LlamaTextJSONValue,
    type LlamaTextSpecialTokensTextJSON,
    type LlamaTextSpecialTokenJSON,
    type BuiltinSpecialTokenValue,
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
    type Tokenizer,
    type Detokenizer,
    isChatModelResponseFunctionCall,
    type GbnfJsonSchema,
    type GbnfJsonSchemaToType,
    type GbnfJsonSchemaImmutableType,
    type GbnfJsonBasicSchema,
    type GbnfJsonConstSchema,
    type GbnfJsonEnumSchema,
    type GbnfJsonOneOfSchema,
    type GbnfJsonObjectSchema,
    type GbnfJsonArraySchema,
    LlamaVocabularyType,
    LlamaLogLevelGreaterThan,
    LlamaLogLevelGreaterThanOrEqual,
    readGgufFileInfo,
    type GgufFileInfo,
    type GgufMetadata,
    type GgufTensorInfo,
    type GgufMetadataLlmToType,
    GgufArchitectureType,
    GgufFileType,
    GgufMetadataTokenizerTokenType,
    GgufMetadataArchitecturePoolingType,
    type GgufMetadataGeneral,
    type GgufMetadataTokenizer,
    type GgufMetadataDefaultArchitectureType,
    type GgufMetadataLlmLLaMA,
    type GgufMetadataMPT,
    type GgufMetadataGPTNeoX,
    type GgufMetadataGPTJ,
    type GgufMetadataGPT2,
    type GgufMetadataBloom,
    type GgufMetadataFalcon,
    type GgufMetadataMamba,
    GgmlType,
    isGgufMetadataOfArchitectureType,
    GgufInsights,
    type GgufInsightsResourceRequirements,
    GgufInsightsConfigurationResolver,
    createModelDownloader,
    ModelDownloader,
    type ModelDownloaderOptions
};
