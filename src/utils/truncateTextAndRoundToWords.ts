import {LlamaText, SpecialToken, SpecialTokensText} from "./LlamaText.js";

const truncatePrefix = "...";

/**
 * Truncate the given text starting from the specified index and try to round to the nearest word.
 * @param text - The text to truncate and round
 * @param truncateSize - The size of the text to truncate
 * @param maxRound - The maximum number of extra characters to delete to round to the nearest word
 * @param truncateStart - Whether to truncate from the start of the text. If false, truncate from the end.
 * @returns - The truncated and rounded text
 */
export function truncateTextAndRoundToWords(
    text: string, truncateSize: number, maxRound: number = 6, truncateStart: boolean = false
): string {
    if (truncateStart) {
        const res = text.slice(truncateSize);

        if (res.length === 0)
            return res;

        if (truncateSize === 0 || text[truncateSize - 1] === " ")
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
    } else {
        const res = text.slice(0, -truncateSize);

        if (res.length === 0)
            return res;

        if (truncateSize === 0 || (text.length === res.length || text[res.length] === " "))
            return res;

        const nextSpaceIndex = res.lastIndexOf(" ");

        if (nextSpaceIndex < 0) {
            if (res.length <= maxRound || res.length < truncatePrefix.length)
                return "";

            return res.slice(truncatePrefix.length) + truncatePrefix;
        }

        if (nextSpaceIndex <= maxRound)
            return res.slice(0, nextSpaceIndex);

        if (res.length < truncatePrefix.length)
            return "";

        return res.slice(truncatePrefix.length) + truncatePrefix;
    }
}

export function truncateLlamaTextAndRoundToWords(
    llamaText: LlamaText, truncateSize: number, maxRound: number = 6, truncateStart: boolean = false
): LlamaText {
    if (truncateSize <= 0)
        return llamaText;

    if (truncateStart) {
        for (let i = 0; i < llamaText.values.length; i++) {
            const value = llamaText.values[i];

            if (value == null)
                continue;

            if (typeof value === "string") {
                if (value.length > truncateSize) {
                    return LlamaText([
                        truncateTextAndRoundToWords(value, truncateSize, maxRound, true),
                        ...llamaText.values.slice(i + 1)
                    ]);
                }

                truncateSize -= value.length;
            } else if (value instanceof SpecialToken) {
                truncateSize--;
                if (truncateSize <= 0)
                    return LlamaText(llamaText.values.slice(i + 1));
            } else {
                void (value satisfies SpecialTokensText);

                // SpecialTokensText shouldn't be truncated
                if (value.value.length > truncateSize)
                    return LlamaText(llamaText.values.slice(i + 1));

                truncateSize -= value.value.length;
            }
        }
    } else {
        for (let i = llamaText.values.length - 1; i >= 0; i--) {
            const value = llamaText.values[i];

            if (value == null)
                continue;

            if (typeof value === "string") {
                if (value.length > truncateSize) {
                    return LlamaText([
                        ...llamaText.values.slice(0, i),
                        truncateTextAndRoundToWords(value, truncateSize, maxRound, false)
                    ]);
                }

                truncateSize -= value.length;
            } else if (value instanceof SpecialToken) {
                truncateSize--;
                if (truncateSize <= 0)
                    return LlamaText(llamaText.values.slice(0, i));
            } else {
                void (value satisfies SpecialTokensText);

                // SpecialTokensText shouldn't be truncated
                if (value.value.length > truncateSize)
                    return LlamaText(llamaText.values.slice(0, i));

                truncateSize -= value.value.length;
            }
        }
    }

    return LlamaText([]);
}
