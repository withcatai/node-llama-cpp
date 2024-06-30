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
        chatHistory: readonly ChatHistoryItem[], charactersToRemove: number, estimatedCharactersPerToken: number
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
    let currentEstimatedCharactersPerToken = estimatedCharactersPerToken;

    function getTokensCountForChatHistory(chatHistory: readonly ChatHistoryItem[]) {
        const {contextText} = chatWrapper.generateContextState({chatHistory});
        return contextText.tokenize(tokenizer, "trimLeadingSpace").length;
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
            charactersToRemove: characterRemovalCount,
            estimatedCharactersPerToken: currentEstimatedCharactersPerToken
        });

        return {
            compressedHistory,
            tokensCount: getTokensCountForChatHistory(compressedHistory),
            characterRemovalCount
        };
    }

    let latestCompressionAttempt = await getResultForCharacterRemovalCount(initialCharactersRemovalCount);
    const firstCompressionAttempt = latestCompressionAttempt;

    if (latestCompressionAttempt.tokensCount === tokensCountToFit ||
        (latestCompressionAttempt.tokensCount < tokensCountToFit && latestCompressionAttempt.characterRemovalCount === 0)
    )
        return {
            removedCharactersCount: initialCharactersRemovalCount,
            compressedChatHistory: latestCompressionAttempt.compressedHistory
        };

    let bestCompressionAttempt = latestCompressionAttempt;
    for (
        let compressionAttempts = 0, decompressionAttempts = 0;
        bestCompressionAttempt.tokensCount !== tokensCountToFit;
    ) {
        if (compressionAttempts > 0) {
            if (latestCompressionAttempt.tokensCount != firstCompressionAttempt.tokensCount &&
                latestCompressionAttempt.characterRemovalCount != firstCompressionAttempt.characterRemovalCount
            )
                currentEstimatedCharactersPerToken =
                    Math.abs(latestCompressionAttempt.characterRemovalCount - firstCompressionAttempt.characterRemovalCount) /
                    Math.abs(latestCompressionAttempt.tokensCount - firstCompressionAttempt.tokensCount);

            if (!Number.isFinite(currentEstimatedCharactersPerToken) || currentEstimatedCharactersPerToken === 0)
                currentEstimatedCharactersPerToken = estimatedCharactersPerToken;
        }

        const tokensLeftToRemove = latestCompressionAttempt.tokensCount - tokensCountToFit;
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

        if ((
            bestCompressionAttempt.tokensCount > tokensCountToFit &&
            latestCompressionAttempt.tokensCount <= bestCompressionAttempt.tokensCount
        ) || (
            bestCompressionAttempt.tokensCount < tokensCountToFit &&
            latestCompressionAttempt.tokensCount < tokensCountToFit &&
            latestCompressionAttempt.tokensCount > bestCompressionAttempt.tokensCount
        ) || (
            bestCompressionAttempt.tokensCount <= tokensCountToFit &&
            latestCompressionAttempt.tokensCount <= tokensCountToFit &&
            latestCompressionAttempt.characterRemovalCount < bestCompressionAttempt.characterRemovalCount
        ))
            bestCompressionAttempt = latestCompressionAttempt;
    }

    return {
        removedCharactersCount: bestCompressionAttempt.characterRemovalCount,
        compressedChatHistory: bestCompressionAttempt.compressedHistory
    };
}
