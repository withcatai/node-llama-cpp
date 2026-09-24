import {ChatWrapper} from "../../../ChatWrapper.js";
import {ChatHistoryItem, Tokenizer, ChatModelFunctions} from "../../../types.js";
import {LLamaChatContextShiftOptions} from "../LlamaChat.js";
import {eraseFirstResponseAndKeepFirstSystemChatContextShiftStrategy} from "./contextShiftStrategies/eraseFirstResponseAndKeepFirstSystemChatContextShiftStrategy.js";


export async function compressHistoryToFitContextSize({
    history,
    contextShiftSize,
    contextShiftStrategy,
    contextShiftLastEvaluationMetadata,
    contextSize,
    tokenizer,
    chatWrapper,
    functions,
    documentFunctionParams,
    fallbackToDefaultStrategy = true
}: {
    history: ChatHistoryItem[],
    contextShiftSize: number,
    contextShiftStrategy: LLamaChatContextShiftOptions["strategy"],
    contextShiftLastEvaluationMetadata: LLamaChatContextShiftOptions["lastEvaluationMetadata"],
    contextSize: number,
    tokenizer: Tokenizer,
    chatWrapper: ChatWrapper,
    functions?: ChatModelFunctions,
    documentFunctionParams?: boolean,
    fallbackToDefaultStrategy?: boolean
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
            if (!fallbackToDefaultStrategy)
                throw err;

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
