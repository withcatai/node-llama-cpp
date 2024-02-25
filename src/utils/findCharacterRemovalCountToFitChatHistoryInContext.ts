import {ChatHistoryItem, Tokenizer} from "../types.js";
import {ChatWrapper} from "../ChatWrapper.js";

export async function findCharacterRemovalCountToFitChatHistoryInContext({
    compressChatHistory,
    chatHistory,
    tokensCountToFit,
    tokenizer,
    chatWrapper,
    initialCharactersRemovalCount = 0,
    estimatedCharactersPerToken = 5,
    maxDecompressionAttempts = 2
}: {
    compressChatHistory(options: {
        chatHistory: readonly ChatHistoryItem[], charactersToRemove: number
    }): ChatHistoryItem[] | Promise<ChatHistoryItem[]>,
    chatHistory: ChatHistoryItem[],
    tokensCountToFit: number,
    tokenizer: Tokenizer,
    chatWrapper: ChatWrapper,
    initialCharactersRemovalCount?: number,
    estimatedCharactersPerToken?: number,
    maxDecompressionAttempts?: number
}): Promise<{
    removedCharactersCount: number,
    compressedChatHistory: ChatHistoryItem[]
}> {
    function getTokensCountForChatHistory(chatHistory: readonly ChatHistoryItem[]) {
        const {contextText} = chatWrapper.generateContextText(chatHistory);
        return contextText.tokenize(tokenizer).length;
    }

    async function getResultForCharacterRemovalCount(characterRemovalCount: number) {
        if (characterRemovalCount === 0)
            return {
                compressedHistory: chatHistory,
                tokensCount: getTokensCountForChatHistory(chatHistory),
                characterRemovalCount
            };

        const compressedHistory = await compressChatHistory({
            chatHistory,
            charactersToRemove: characterRemovalCount
        });

        return {
            compressedHistory,
            tokensCount: getTokensCountForChatHistory(compressedHistory),
            characterRemovalCount
        };
    }

    let latestCompressionAttempt = await getResultForCharacterRemovalCount(initialCharactersRemovalCount);
    const firstCompressionAttempt = latestCompressionAttempt;
    let currentEstimatedCharactersPerToken = estimatedCharactersPerToken;

    if (latestCompressionAttempt.tokensCount === tokensCountToFit ||
        (latestCompressionAttempt.tokensCount < tokensCountToFit && latestCompressionAttempt.characterRemovalCount === 0)
    )
        return {
            removedCharactersCount: initialCharactersRemovalCount,
            compressedChatHistory: latestCompressionAttempt.compressedHistory
        };

    for (
        let compressionAttempts = 0, decompressionAttempts = 0;
        latestCompressionAttempt.tokensCount !== tokensCountToFit;
    ) {
        if (compressionAttempts > 0) {
            currentEstimatedCharactersPerToken =
                Math.abs(latestCompressionAttempt.characterRemovalCount - firstCompressionAttempt.characterRemovalCount) /
                Math.abs(latestCompressionAttempt.tokensCount - firstCompressionAttempt.tokensCount);

            if (!Number.isFinite(currentEstimatedCharactersPerToken))
                currentEstimatedCharactersPerToken = estimatedCharactersPerToken;
        }

        const tokensLeftToRemove = tokensCountToFit - latestCompressionAttempt.tokensCount;
        let additionalCharactersToRemove = Math.round(tokensLeftToRemove * currentEstimatedCharactersPerToken);

        if (additionalCharactersToRemove === 0) {
            if (tokensLeftToRemove > 0)
                additionalCharactersToRemove = 1;
            else if (tokensLeftToRemove < 0)
                additionalCharactersToRemove = -1;
        }

        if (tokensLeftToRemove > 0)
            compressionAttempts++;
        else if (tokensLeftToRemove < 0)
            decompressionAttempts++;

        if (decompressionAttempts >= maxDecompressionAttempts)
            break;

        latestCompressionAttempt = await getResultForCharacterRemovalCount(
            latestCompressionAttempt.characterRemovalCount + additionalCharactersToRemove
        );
    }

    return {
        removedCharactersCount: latestCompressionAttempt.characterRemovalCount,
        compressedChatHistory: latestCompressionAttempt.compressedHistory
    };
}
