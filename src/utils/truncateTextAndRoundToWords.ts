import {LlamaText, SpecialToken, SpecialTokensText} from "./LlamaText.js";

const truncatePrefix = "...";

/**
 * Truncate the given text starting from the specified index and try to round to the nearest word.
 * @param text - The text to truncate and round
 * @param truncateStartIndex - The index to start truncating the text at
 * @param maxRound - The maximum number of extra characters to delete to round to the nearest word
 * @returns - The truncated and rounded text
 */
export function truncateTextAndRoundToWords(text: string, truncateStartIndex: number, maxRound: number = 6): string {
    const res = text.slice(truncateStartIndex);

    if (res.length === 0)
        return res;

    if (truncateStartIndex === 0 || text[truncateStartIndex - 1] === " ")
        return res;

    const nextSpaceIndex = res.indexOf(" ");

    if (nextSpaceIndex < 0) {
        if (res.length <= maxRound || res.length < truncatePrefix.length)
            return "";

        return truncatePrefix + res.slice(truncatePrefix.length);
    }

    if (nextSpaceIndex <= maxRound)
        return res.slice(nextSpaceIndex + 1);

    if (res.length < truncatePrefix.length)
        return "";

    return truncatePrefix + res.slice(truncatePrefix.length);
}

export function truncateLlamaTextAndRoundToWords(llamaText: LlamaText, truncateStartIndex: number, maxRound: number = 6): LlamaText {
    if (truncateStartIndex <= 0)
        return llamaText;

    for (let i = 0; i < llamaText.values.length; i++) {
        const value = llamaText.values[i];
        if (typeof value === "string") {
            if (value.length > truncateStartIndex) {
                return LlamaText([
                    truncateTextAndRoundToWords(value, truncateStartIndex, maxRound),
                    ...llamaText.values.slice(i + 1)
                ]);
            }

            truncateStartIndex -= value.length;
        } else if (value instanceof SpecialToken) {
            truncateStartIndex--;
            if (truncateStartIndex <= 0)
                return LlamaText(llamaText.values.slice(i + 1));
        } else {
            void (value satisfies SpecialTokensText);

            // SpecialTokensText shouldn't be truncated
            if (value.value.length > truncateStartIndex)
                return LlamaText(llamaText.values.slice(i + 1));

            truncateStartIndex -= value.value.length;
        }
    }

    return LlamaText([]);
}
