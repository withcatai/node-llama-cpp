import {ChatHistoryItem, Tokenizer} from "../../../../types.js";
import {findCharacterRemovalCountToFitChatHistoryInContext} from "../../../../utils/findCharacterRemovalCountToFitChatHistoryInContext.js";
import {truncateLlamaTextAndRoundToWords, truncateTextAndRoundToWords} from "../../../../utils/truncateTextAndRoundToWords.js";
import {ChatWrapper} from "../../../../ChatWrapper.js";
import {LlamaText} from "../../../../utils/LlamaText.js";

export async function eraseFirstResponseAndKeepFirstSystemChatContextShiftStrategy({
    chatHistory,
    maxTokensCount,
    tokenizer,
    chatWrapper,
    lastShiftMetadata
}: {
    chatHistory: ChatHistoryItem[],
    maxTokensCount: number,
    tokenizer: Tokenizer,
    chatWrapper: ChatWrapper,
    lastShiftMetadata?: object | null
}): Promise<{
    chatHistory: ChatHistoryItem[],
    metadata: CalculationMetadata
}> {
    let initialCharactersRemovalCount = 0;
    if (isCalculationMetadata(lastShiftMetadata))
        initialCharactersRemovalCount = lastShiftMetadata.removedCharactersNumber;

    const {removedCharactersCount, compressedChatHistory} = await findCharacterRemovalCountToFitChatHistoryInContext({
        chatHistory,
        tokensCountToFit: maxTokensCount,
        initialCharactersRemovalCount,
        tokenizer,
        chatWrapper,
        failedCompressionErrorMessage: "Failed to compress chat history for context shift due to a too long prompt or system message that cannot be compressed without affecting the generation quality. " +
            "Consider increasing the context size or shortening the long prompt or system message.",
        compressChatHistory({chatHistory, charactersToRemove, estimatedCharactersPerToken}) {
            const res = chatHistory.map((item) => structuredClone(item));
            let charactersLeftToRemove = charactersToRemove;

            function compressFunctionCalls() {
                for (let i = res.length - 1; i >= 0 && charactersLeftToRemove > 0; i--) {
                    const historyItem = res[i]!;

                    if (historyItem.type !== "model")
                        continue;

                    for (let t = historyItem.response.length - 1; t >= 0 && charactersLeftToRemove > 0; t--) {
                        const item = historyItem.response[t]!;

                        if (typeof item === "string" || item.type !== "functionCall")
                            continue;

                        if (item.rawCall == null)
                            continue;

                        const originalRawCallTokensLength = LlamaText.fromJSON(item.rawCall).tokenize(tokenizer, "trimLeadingSpace").length;

                        const newRawCallText = chatWrapper.generateFunctionCall(item.name, item.params);
                        const newRawCallTextTokensLength = newRawCallText.tokenize(tokenizer, "trimLeadingSpace").length;

                        if (newRawCallTextTokensLength < originalRawCallTokensLength) {
                            item.rawCall = newRawCallText.toJSON();
                            charactersLeftToRemove -= (
                                (originalRawCallTokensLength - newRawCallTextTokensLength) * estimatedCharactersPerToken
                            );
                        }
                    }
                }
            }

            function removeHistoryThatLedToModelResponseAtIndex(index: number) {
                let removedItems = 0;

                for (let i = index - 1; i >= 0; i--) {
                    const historyItem = res[i];

                    if (historyItem == null)
                        continue;

                    if (historyItem.type === "model")
                        break; // stop removing history items if we reach another model response

                    if (i === 0 && historyItem.type === "system")
                        break; // keep the first system message

                    if (historyItem.type === "user" || historyItem.type === "system") {
                        const newText = truncateLlamaTextAndRoundToWords(
                            LlamaText.fromJSON(historyItem.text),
                            charactersLeftToRemove,
                            undefined,
                            false
                        );
                        const newTextString = newText.toString();
                        const historyItemString = LlamaText.fromJSON(historyItem.text).toString();

                        if (newText.values.length === 0) {
                            res.splice(i, 1);
                            i++;
                            removedItems++;
                            charactersLeftToRemove -= historyItemString.length;
                        } else if (newTextString.length < historyItemString.length) {
                            charactersLeftToRemove -= historyItemString.length - newTextString.length;
                            if (historyItem.type === "user")
                                historyItem.text = newText.toString();
                            else
                                historyItem.text = newText.toJSON();
                        }
                    } else {
                        void (historyItem satisfies never);
                    }
                }

                return removedItems;
            }

            function compressHistoryThatLedToModelResponseAtIndex(index: number, keepTokensCount: number = 0) {
                let removedItems = 0;
                let promptStartIndex: number | undefined = undefined;

                for (let i = index - 1; i >= 0; i--) {
                    const historyItem = res[i];

                    if (historyItem == null)
                        continue;

                    if (historyItem.type === "model") {
                        promptStartIndex = i + 1;
                        break;
                    }

                    if (i === 0 && historyItem.type === "system") {
                        promptStartIndex = i + 1;
                        break; // keep the first system message
                    }
                }

                if (promptStartIndex == null || promptStartIndex >= index)
                    return 0;

                for (let i = promptStartIndex; i < index && charactersLeftToRemove > 0; i++) {
                    const historyItem = res[i];

                    if (historyItem == null || historyItem.type !== "user")
                        continue;

                    let removeChars = Math.min(charactersLeftToRemove, historyItem.text.length);
                    if (keepTokensCount > 0) {
                        removeChars -= Math.floor(keepTokensCount * estimatedCharactersPerToken);
                        if (removeChars < 0)
                            removeChars = 0;

                        keepTokensCount -= Math.min(
                            keepTokensCount,
                            Math.max(0, historyItem.text.length - removeChars) / estimatedCharactersPerToken
                        );
                    }

                    const newText = truncateTextAndRoundToWords(historyItem.text, removeChars, undefined, false);
                    if (newText.length === 0) {
                        res.splice(i, 1);
                        i--;
                        index--;
                        removedItems++;
                        charactersLeftToRemove -= historyItem.text.length;
                    } else {
                        charactersLeftToRemove -= historyItem.text.length - newText.length;
                        historyItem.text = newText;
                    }
                }

                return removedItems;
            }

            function compressFirstModelResponse() {
                for (let i = 0; i < res.length && charactersLeftToRemove > 0; i++) {
                    const historyItem = res[i]!;
                    const isLastHistoryItem = i === res.length - 1;

                    if (historyItem.type !== "model")
                        continue;

                    for (let t = 0; t < historyItem.response.length && charactersLeftToRemove > 0; t++) {
                        const item: Readonly<typeof historyItem.response[number]> = historyItem.response[t]!;
                        const isLastText = t === historyItem.response.length - 1;

                        if (isLastHistoryItem && isLastText)
                            continue;

                        if (typeof item === "string") {
                            const newText = truncateTextAndRoundToWords(item, charactersLeftToRemove, undefined, true);

                            if (newText === "") {
                                historyItem.response.splice(t, 1);
                                t--;
                                charactersLeftToRemove -= item.length;
                            } else if (newText.length < item.length) {
                                historyItem.response[t] = newText;
                                charactersLeftToRemove -= item.length - newText.length;
                            }
                        } else if (item.type === "functionCall") {
                            historyItem.response.splice(t, 1);
                            t--;

                            const functionCallAndResultTokenUsage = chatWrapper.generateFunctionCallsAndResults([item], true)
                                .tokenize(tokenizer, "trimLeadingSpace").length;
                            charactersLeftToRemove -= functionCallAndResultTokenUsage * estimatedCharactersPerToken;
                        }
                    }

                    if (historyItem.response.length === 0) {
                        // if the model response is removed from the history,
                        // the things that led to it are not important anymore
                        i -= removeHistoryThatLedToModelResponseAtIndex(i);
                        res.splice(i, 1);
                        i--;
                    }
                }
            }

            function compressLastModelResponse(minCharactersToKeep: number = 60) {
                const lastHistoryItem = res[res.length - 1];

                if (lastHistoryItem == null || lastHistoryItem.type !== "model")
                    return;

                const lastResponseItem = lastHistoryItem.response[lastHistoryItem.response.length - 1];

                if (lastResponseItem == null || typeof lastResponseItem !== "string")
                    return;

                compressHistoryThatLedToModelResponseAtIndex(res.length - 1, maxTokensCount / 4);

                if (charactersLeftToRemove <= 0)
                    return;

                const nextTextLength = Math.max(
                    Math.min(lastResponseItem.length, minCharactersToKeep),
                    lastResponseItem.length - charactersLeftToRemove
                );
                const charactersToRemoveFromText = lastResponseItem.length - nextTextLength;
                const newText = truncateTextAndRoundToWords(lastResponseItem, charactersToRemoveFromText, undefined, true);

                if (newText.length < lastResponseItem.length) {
                    lastHistoryItem.response[lastHistoryItem.response.length - 1] = newText;
                    charactersLeftToRemove -= lastResponseItem.length - newText.length;
                }

                if (charactersLeftToRemove <= 0)
                    return;

                compressHistoryThatLedToModelResponseAtIndex(res.length - 1);
            }

            compressFunctionCalls();

            if (charactersLeftToRemove <= 0)
                return res;

            compressFirstModelResponse();

            if (charactersLeftToRemove <= 0)
                return res;

            compressLastModelResponse();

            return res;
        }
    });

    const newMetadata: CalculationMetadata = {
        removedCharactersNumber: removedCharactersCount
    };

    return {
        chatHistory: compressedChatHistory,
        metadata: newMetadata
    };
}

type CalculationMetadata = {
    removedCharactersNumber: number
};

function isCalculationMetadata(metadata: any): metadata is CalculationMetadata {
    return metadata != null && typeof metadata === "object" && typeof metadata.removedCharactersNumber === "number";
}
