import {UniqueIdGenerator} from "../../../chatWrappers/generic/utils/UniqueIdGenerator.js";
import {LlamaText} from "../../../utils/LlamaText.js";
import {minAllowedContextSizeInCalculations} from "../../../config.js";
import {compressHistoryToFitContextSize} from "./compressHistoryToFitContextSize.js";
import type {ChatWrapper} from "../../../ChatWrapper.js";
import type {ChatHistoryItem, ChatModelFunctions, ChatModelResponse} from "../../../types.js";
import type {LlamaContextSequence} from "../../LlamaContext/LlamaContext.js";
import type {LLamaChatContextShiftOptions} from "../LlamaChat.js";

export async function prepareDecisionContextWindow({
    fullHistory, lastEvaluationContextWindowHistory,
    resolvedContextShift,
    fitInContextSize, chatWrapper, sequence,
    functions, documentFunctionParams, minFreeContextTokens = 1
}: {
    fullHistory: ChatHistoryItem[], lastEvaluationContextWindowHistory?: ChatHistoryItem[],
    resolvedContextShift: Required<LLamaChatContextShiftOptions>,
    fitInContextSize: number, chatWrapper: ChatWrapper, sequence: LlamaContextSequence,
    functions?: ChatModelFunctions, documentFunctionParams?: boolean, minFreeContextTokens?: number
}): Promise<{
    prefix: LlamaText,
    afterQuestion: LlamaText,
    newContextWindow: ChatHistoryItem[],
    lastHistoryCompressionMetadata: object | null | undefined
}> {
    const model = sequence.model;
    const context = sequence.context;

    function generateResponseForChatHistory(contextWindowChatHistory: ChatHistoryItem[], compressionMetadata: object | null | undefined) {
        const questionContext = addQuestionMarkerToContextWindow(chatWrapper, contextWindowChatHistory);
        const questionContextState = chatWrapper.generateContextState({
            chatHistory: questionContext.contextWindow,
            availableFunctions: functions,
            documentFunctionParams
        });
        const evaluationTextParts = getEvaluationTextParts(
            questionContextState.contextText,
            questionContext.questionMarker,
            questionContext.decisionMarker
        );
        if (evaluationTextParts == null)
            throw new Error("Failed to extract evaluation text parts from context window");

        const questionContextTokensCount = (
            evaluationTextParts.prefix.tokenize(model.tokenizer, "trimLeadingSpace").length +
            evaluationTextParts.afterQuestion.tokenize(model.tokenizer, "trimLeadingSpace").length
        );
        if (questionContextTokensCount <= fitInContextSize)
            return {
                prefix: evaluationTextParts.prefix,
                afterQuestion: evaluationTextParts.afterQuestion,
                newContextWindow: contextWindowChatHistory,
                lastHistoryCompressionMetadata: compressionMetadata
            };

        return questionContextTokensCount;
    }

    const responseForInitialContextWindow = (lastEvaluationContextWindowHistory != null && sequence.isLoadedToMemory)
        ? generateResponseForChatHistory(lastEvaluationContextWindowHistory, resolvedContextShift.lastEvaluationMetadata)
        : generateResponseForChatHistory(fullHistory, resolvedContextShift.lastEvaluationMetadata);
    if (typeof responseForInitialContextWindow !== "number")
        return responseForInitialContextWindow;

    const questionContextTokensCount = responseForInitialContextWindow;

    const regularContextState = chatWrapper.generateContextState({
        chatHistory: (lastEvaluationContextWindowHistory != null && sequence.isLoadedToMemory)
            ? lastEvaluationContextWindowHistory
            : fullHistory,
        availableFunctions: functions,
        documentFunctionParams
    });
    const regularContextTokensCount = regularContextState.contextText.tokenize(model.tokenizer, "trimLeadingSpace").length;
    const addedTokensCount = Math.max(0, questionContextTokensCount - regularContextTokensCount);
    const fitRegularContextWindowUnderTokenCount = fitInContextSize - addedTokensCount;
    if (fitRegularContextWindowUnderTokenCount <= minAllowedContextSizeInCalculations)
        throw new Error(
            "The context size is too small to fit the provided questions and/or criteria. " +
            "Increase the context size or reduce the length of the longest questions or criteria"
        );

    if (resolvedContextShift.lastEvaluationMetadata != null) {
        const contextShiftSize = resolvedContextShift.size instanceof Function
            ? await resolvedContextShift.size(sequence)
            : resolvedContextShift.size;

        const {compressedHistory, metadata} = await compressHistoryToFitContextSize({
            history: fullHistory,
            contextShiftSize: Math.max(
                minFreeContextTokens,
                contextShiftSize,
                context.contextSize - fitRegularContextWindowUnderTokenCount
            ),
            contextShiftStrategy: resolvedContextShift.strategy,
            contextShiftLastEvaluationMetadata: resolvedContextShift.lastEvaluationMetadata,
            contextSize: context.contextSize,
            tokenizer: model.tokenizer,
            chatWrapper: chatWrapper,
            functions,
            documentFunctionParams
        });
        const responseForCompressedHistory = generateResponseForChatHistory(compressedHistory, metadata);
        if (typeof responseForCompressedHistory !== "number")
            return responseForCompressedHistory;
    }

    // only runs when we haven't initially made a response for the full history
    if (lastEvaluationContextWindowHistory != null && sequence.isLoadedToMemory) {
        const responseForFullHistory = generateResponseForChatHistory(fullHistory, resolvedContextShift.lastEvaluationMetadata);
        if (typeof responseForFullHistory !== "number")
            return responseForFullHistory;
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
        history: fullHistory,
        contextShiftSize: Math.max(minFreeContextTokens, contextShiftSize, context.contextSize - fitRegularContextWindowUnderTokenCount),
        contextShiftStrategy: resolvedContextShift.strategy,
        contextShiftLastEvaluationMetadata: resolvedContextShift.lastEvaluationMetadata,
        contextSize: context.contextSize,
        tokenizer: model.tokenizer,
        chatWrapper: chatWrapper,
        functions,
        documentFunctionParams
    });
    const responseForCompressedHistory = generateResponseForChatHistory(compressedHistory, metadata);
    if (typeof responseForCompressedHistory !== "number")
        return responseForCompressedHistory;

    throw new Error(
        "Failed to compress chat history to fit context window. Try increasing the context size or shortening the system prompt"
    );
}

function getEvaluationTextParts(contextText: LlamaText, questionMarker: string, decisionMarker: string) {
    const questionSplit = splitLlamaTextByLastRegularTextMatch(contextText, questionMarker);
    if (questionSplit == null)
        return null;

    const decisionSplit = splitLlamaTextByLastRegularTextMatch(questionSplit.after, decisionMarker);
    if (decisionSplit == null)
        return null;

    return {
        prefix: questionSplit.before,
        afterQuestion: decisionSplit.before
    };
}

function addQuestionMarkerToContextWindow(chatWrapper: ChatWrapper, contextWindow: ChatHistoryItem[]): {
    contextWindow: ChatHistoryItem[],
    questionMarker: string,
    decisionMarker: string
} {
    const lastItem = contextWindow.at(-1);
    const idGenerator = new UniqueIdGenerator(
        lastItem?.type === "user"
            ? lastItem.text
            : ""
    );

    const questionMarker = idGenerator.generateId();
    const decisionMarker = idGenerator.generateId();

    let modelText = decisionMarker;

    const modelMessage: ChatModelResponse = {
        type: "model",
        response: []
    };

    if (chatWrapper.settings.segments?.thought != null) {
        const now = new Date().toISOString();
        modelMessage.response.unshift({
            type: "segment",
            segmentType: "thought",
            text: "",
            ended: true,
            startTime: now,
            endTime: now
        });

        modelText = "Answer: " + modelText;
    }

    modelMessage.response.push(modelText);

    return {
        questionMarker,
        decisionMarker: decisionMarker,
        contextWindow: [...contextWindow, {
            type: "user",
            text: questionMarker
        }, modelMessage]
    };
}

function splitLlamaTextByLastRegularTextMatch(llamaText: LlamaText, textToMatch: string) {
    for (let i = llamaText.values.length - 1; i >= 0; i--) {
        const value = llamaText.values[i];
        if (value == null)
            continue;

        if (typeof value !== "string")
            continue;

        const matchIndex = value.lastIndexOf(textToMatch);
        if (matchIndex < 0)
            continue;

        return {
            before: LlamaText([
                ...llamaText.values.slice(0, i),
                value.slice(0, matchIndex)
            ]),
            after: LlamaText([
                value.slice(matchIndex + textToMatch.length),
                ...llamaText.values.slice(i + 1)
            ])
        };
    }

    return null;
}
