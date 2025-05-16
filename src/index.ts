import {DisposedError} from "lifecycle-utils";
import {Llama} from "./bindings/Llama.js";
import {getLlama, type LlamaOptions, type LastBuildOptions} from "./bindings/getLlama.js";
import {getLlamaGpuTypes} from "./bindings/utils/getLlamaGpuTypes.js";
import {NoBinaryFoundError} from "./bindings/utils/NoBinaryFoundError.js";
import {
    type LlamaGpuType, LlamaLogLevel, LlamaLogLevelGreaterThan, LlamaLogLevelGreaterThanOrEqual, LlamaVocabularyType
} from "./bindings/types.js";
import {resolveModelFile, type ResolveModelFileOptions} from "./utils/resolveModelFile.js";
import {LlamaModel, LlamaModelInfillTokens, type LlamaModelOptions, LlamaModelTokens} from "./evaluator/LlamaModel/LlamaModel.js";
import {TokenAttributes} from "./evaluator/LlamaModel/utils/TokenAttributes.js";
import {LlamaGrammar, type LlamaGrammarOptions} from "./evaluator/LlamaGrammar.js";
import {LlamaJsonSchemaGrammar} from "./evaluator/LlamaJsonSchemaGrammar.js";
import {LlamaJsonSchemaValidationError} from "./utils/gbnfJson/utils/validateObjectAgainstGbnfSchema.js";
import {LlamaGrammarEvaluationState, LlamaGrammarEvaluationStateOptions} from "./evaluator/LlamaGrammarEvaluationState.js";
import {LlamaContext, LlamaContextSequence} from "./evaluator/LlamaContext/LlamaContext.js";
import {LlamaEmbeddingContext, type LlamaEmbeddingContextOptions} from "./evaluator/LlamaEmbeddingContext.js";
import {LlamaEmbedding, type LlamaEmbeddingOptions, type LlamaEmbeddingJSON} from "./evaluator/LlamaEmbedding.js";
import {LlamaRankingContext, type LlamaRankingContextOptions} from "./evaluator/LlamaRankingContext.js";
import {
    type LlamaContextOptions, type SequenceEvaluateOptions, type BatchingOptions, type LlamaContextSequenceRepeatPenalty,
    type CustomBatchingDispatchSchedule, type CustomBatchingPrioritizationStrategy, type BatchItem, type PrioritizedBatchItem,
    type ContextShiftOptions, type ContextTokensDeleteRange, type EvaluationPriority, type SequenceEvaluateMetadataOptions,
    type SequenceEvaluateOutput, type ControlledEvaluateInputItem, type ControlledEvaluateIndexOutput
} from "./evaluator/LlamaContext/types.js";
import {TokenBias} from "./evaluator/TokenBias.js";
import {
    LlamaChatSession, type LlamaChatSessionOptions, type LlamaChatSessionContextShiftOptions,
    type LLamaChatPromptOptions, type LLamaChatCompletePromptOptions, type LlamaChatSessionRepeatPenalty, type LLamaChatPreloadPromptOptions
} from "./evaluator/LlamaChatSession/LlamaChatSession.js";
import {defineChatSessionFunction} from "./evaluator/LlamaChatSession/utils/defineChatSessionFunction.js";
import {
    LlamaChat, type LlamaChatOptions, type LLamaChatGenerateResponseOptions, type LLamaChatLoadAndCompleteUserMessageOptions,
    type LLamaChatContextShiftOptions, type LlamaChatResponse, type LlamaChatResponseFunctionCall,
    type LlamaChatLoadAndCompleteUserResponse, type LlamaChatResponseChunk, type LlamaChatResponseTextChunk,
    type LlamaChatResponseSegmentChunk, type LlamaChatResponseFunctionCallParamsChunk, type LlamaChatResponseSegment
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
import {DeepSeekChatWrapper} from "./chatWrappers/DeepSeekChatWrapper.js";
import {QwenChatWrapper} from "./chatWrappers/QwenChatWrapper.js";
import {Llama3_2LightweightChatWrapper} from "./chatWrappers/Llama3_2LightweightChatWrapper.js";
import {Llama3_1ChatWrapper} from "./chatWrappers/Llama3_1ChatWrapper.js";
import {Llama3ChatWrapper} from "./chatWrappers/Llama3ChatWrapper.js";
import {Llama2ChatWrapper} from "./chatWrappers/Llama2ChatWrapper.js";
import {MistralChatWrapper} from "./chatWrappers/MistralChatWrapper.js";
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
import {
    resolvableChatWrapperTypeNames, type ResolvableChatWrapperTypeName, specializedChatWrapperTypeNames,
    type SpecializedChatWrapperTypeName, templateChatWrapperTypeNames, type TemplateChatWrapperTypeName, resolveChatWrapper,
    type ResolveChatWrapperOptions, type ResolveChatWrapperWithModelOptions, type BuiltInChatWrapperType, chatWrappers
} from "./chatWrappers/utils/resolveChatWrapper.js";
import {ChatModelFunctionsDocumentationGenerator} from "./chatWrappers/utils/ChatModelFunctionsDocumentationGenerator.js";
import {
    LlamaText, SpecialTokensText, SpecialToken, isLlamaText, tokenizeText, type LlamaTextValue, type LlamaTextInputValue,
    type LlamaTextJSON, type LlamaTextJSONValue, type LlamaTextSpecialTokensTextJSON, type LlamaTextSpecialTokenJSON,
    type BuiltinSpecialTokenValue
} from "./utils/LlamaText.js";
import {appendUserMessageToChatHistory} from "./utils/appendUserMessageToChatHistory.js";
import {TokenPredictor} from "./evaluator/LlamaContext/TokenPredictor.js";
import {DraftSequenceTokenPredictor} from "./evaluator/LlamaContext/tokenPredictors/DraftSequenceTokenPredictor.js";
import {InputLookupTokenPredictor} from "./evaluator/LlamaContext/tokenPredictors/InputLookupTokenPredictor.js";
import {getModuleVersion} from "./utils/getModuleVersion.js";
import {readGgufFileInfo} from "./gguf/readGgufFileInfo.js";
import {GgufInsights, type GgufInsightsResourceRequirements} from "./gguf/insights/GgufInsights.js";
import {GgufInsightsConfigurationResolver} from "./gguf/insights/GgufInsightsConfigurationResolver.js";
import {
    createModelDownloader, ModelDownloader, type ModelDownloaderOptions, combineModelDownloaders, CombinedModelDownloader,
    type CombinedModelDownloaderOptions
} from "./utils/createModelDownloader.js";
import {jsonDumps} from "./chatWrappers/utils/jsonDumps.js";
import {experimentalChunkDocument} from "./evaluator/utils/chunkDocument.js";

import {
    type ChatHistoryItem, type ChatModelFunctionCall, type ChatModelSegmentType, type ChatModelSegment, type ChatModelFunctions,
    type ChatModelResponse, type ChatSessionModelFunction, type ChatSessionModelFunctions, type ChatSystemMessage, type ChatUserMessage,
    type Token, type Tokenizer, type Detokenizer, isChatModelResponseFunctionCall, isChatModelResponseSegment,
    type LLamaContextualRepeatPenalty, type ChatWrapperSettings, type ChatWrapperSettingsSegment,
    type ChatWrapperGenerateContextStateOptions, type ChatWrapperGeneratedContextState, type ChatWrapperGenerateInitialHistoryOptions
} from "./types.js";
import {
    type GbnfJsonArraySchema, type GbnfJsonBasicSchema, type GbnfJsonConstSchema, type GbnfJsonEnumSchema, type GbnfJsonStringSchema,
    type GbnfJsonBasicStringSchema, type GbnfJsonFormatStringSchema, type GbnfJsonObjectSchema, type GbnfJsonOneOfSchema,
    type GbnfJsonSchema, type GbnfJsonSchemaImmutableType, type GbnfJsonSchemaToType
} from "./utils/gbnfJson/types.js";
import {type GgufFileInfo} from "./gguf/types/GgufFileInfoTypes.js";
import {
    type GgufMetadata, type GgufMetadataLlmToType, GgufArchitectureType, GgufFileType, GgufMetadataTokenizerTokenType,
    GgufMetadataArchitecturePoolingType, type GgufMetadataGeneral, type GgufMetadataTokenizer, type GgufMetadataDefaultArchitectureType,
    type GgufMetadataLlmLLaMA, type GgufMetadataMPT, type GgufMetadataGPTNeoX, type GgufMetadataGPTJ, type GgufMetadataGPT2,
    type GgufMetadataBloom, type GgufMetadataFalcon, type GgufMetadataMamba, isGgufMetadataOfArchitectureType
} from "./gguf/types/GgufMetadataTypes.js";
import {GgmlType, type GgufTensorInfo} from "./gguf/types/GgufTensorInfoTypes.js";
import {type ModelFileAccessTokens} from "./utils/modelFileAccessTokens.js";
import {type OverridesObject} from "./utils/OverridesObject.js";
import type {LlamaClasses} from "./utils/getLlamaClasses.js";
import type {ChatHistoryFunctionCallMessageTemplate} from "./chatWrappers/generic/utils/chatHistoryFunctionCallMessageTemplate.js";
import type {TemplateChatWrapperSegmentsOptions} from "./chatWrappers/generic/utils/templateSegmentOptionsToChatWrapperSettings.js";


export {
    Llama,
    getLlama,
    getLlamaGpuTypes,
    type LlamaOptions,
    type LastBuildOptions,
    type LlamaGpuType,
    type LlamaClasses,
    LlamaLogLevel,
    NoBinaryFoundError,
    resolveModelFile,
    type ResolveModelFileOptions,
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
    type SequenceEvaluateOptions,
    type BatchingOptions,
    type CustomBatchingDispatchSchedule,
    type CustomBatchingPrioritizationStrategy,
    type BatchItem,
    type PrioritizedBatchItem,
    type ContextShiftOptions,
    type ContextTokensDeleteRange,
    type EvaluationPriority,
    type SequenceEvaluateMetadataOptions,
    type SequenceEvaluateOutput,
    type LlamaContextSequenceRepeatPenalty,
    type ControlledEvaluateInputItem,
    type ControlledEvaluateIndexOutput,
    TokenBias,
    LlamaEmbeddingContext,
    type LlamaEmbeddingContextOptions,
    LlamaEmbedding,
    type LlamaEmbeddingOptions,
    type LlamaEmbeddingJSON,
    LlamaRankingContext,
    type LlamaRankingContextOptions,
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
    type LlamaChatResponseChunk,
    type LlamaChatResponseTextChunk,
    type LlamaChatResponseSegmentChunk,
    type LlamaChatResponseFunctionCallParamsChunk,
    type LlamaChatResponseSegment,
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
    type ChatWrapperSettingsSegment,
    type ChatWrapperGenerateContextStateOptions,
    type ChatWrapperGeneratedContextState,
    type ChatWrapperGenerateInitialHistoryOptions,
    EmptyChatWrapper,
    DeepSeekChatWrapper,
    QwenChatWrapper,
    Llama3_2LightweightChatWrapper,
    Llama3_1ChatWrapper,
    Llama3ChatWrapper,
    Llama2ChatWrapper,
    MistralChatWrapper,
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
    type TemplateChatWrapperSegmentsOptions,
    resolveChatWrapper,
    type BuiltInChatWrapperType,
    type ResolveChatWrapperOptions,
    type ResolveChatWrapperWithModelOptions,
    resolvableChatWrapperTypeNames,
    type ResolvableChatWrapperTypeName,
    specializedChatWrapperTypeNames,
    type SpecializedChatWrapperTypeName,
    templateChatWrapperTypeNames,
    type TemplateChatWrapperTypeName,
    chatWrappers,
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
    TokenPredictor,
    DraftSequenceTokenPredictor,
    InputLookupTokenPredictor,
    appendUserMessageToChatHistory,
    getModuleVersion,
    type ChatHistoryItem,
    type ChatModelFunctionCall,
    type ChatModelSegmentType,
    type ChatModelSegment,
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
    isChatModelResponseSegment,
    type GbnfJsonSchema,
    type GbnfJsonSchemaToType,
    type GbnfJsonSchemaImmutableType,
    type GbnfJsonBasicSchema,
    type GbnfJsonConstSchema,
    type GbnfJsonEnumSchema,
    type GbnfJsonBasicStringSchema,
    type GbnfJsonFormatStringSchema,
    type GbnfJsonStringSchema,
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
    type ModelDownloaderOptions,
    type ModelFileAccessTokens,
    combineModelDownloaders,
    CombinedModelDownloader,
    type CombinedModelDownloaderOptions,
    jsonDumps,
    type OverridesObject,
    experimentalChunkDocument
};
