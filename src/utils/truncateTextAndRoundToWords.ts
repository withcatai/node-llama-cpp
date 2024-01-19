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
