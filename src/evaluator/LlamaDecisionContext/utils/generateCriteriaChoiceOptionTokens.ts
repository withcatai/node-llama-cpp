import type {Token, Tokenizer} from "../../../types.js";

export function generateCriteriaChoiceOptionTokens(min: number, max: number, tokenizer: Tokenizer, additionalChars: string = ""): Token[] {
    if (max <= 0)
        return [];

    const res = new Set<Token>();

    function pushCharacter(char: string) {
        if (res.size >= max)
            return true;

        const token = findSingleToken(char, tokenizer);
        if (token != null)
            res.add(token);

        return res.size >= max;
    }

    function pushCode(code: number) {
        return pushCharacter(String.fromCharCode(code));
    }

    function addRanges(encodedRanges: string) {
        for (let rangeIndex = 0; rangeIndex < encodedRanges.length; rangeIndex += 2) {
            const rangeStart = encodedRanges.charCodeAt(rangeIndex);
            const rangeEnd = encodedRanges.charCodeAt(rangeIndex + 1);

            for (let code = rangeStart; code <= rangeEnd; code++) {
                if (pushCode(code))
                    return true;
            }
        }

        return false;
    }

    if (additionalChars !== "") {
        for (const char of additionalChars) {
            if (pushCharacter(char))
                break;
        }
    }

    addRanges("09");

    if (res.size < min)
        throw new RangeError(
            "Failed to find enough choice options for the given criteria. " +
            `${min} options are needed out of ${res.size} that are available. ` +
            "Reduce the number of criteria or use a different model"
        );

    return [...res];
}

function findSingleToken(text: string, tokenizer: Tokenizer) {
    const tokens = tokenizer(text, false, "trimLeadingSpace");
    for (const token of tokens) {
        if (tokenizer.detokenize([token], false).trim() === text)
            return token;
    }

    return undefined;
}
