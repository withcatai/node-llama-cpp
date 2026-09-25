import type {Token, Tokenizer} from "../../../types.js";

const charCode0 = "0".charCodeAt(0);
const charCodeA = "A".charCodeAt(0);
const charCodeZ = "Z".charCodeAt(0);

export function generateCriteriaChoiceOptionTokens(count: number, tokenizer: Tokenizer) {
    if (count <= 0)
        return [];

    const res = new Set<Token>();
    const cased = new Set<Token>();

    const ranges =
        "09" +
        "AZ" +
        "\u0391\u03a1\u03a3\u03a9" + // greek symbols
        "\u0531\u0556" + // hy
        "\u05d0\u05d9\u05db\u05dc\u05de\u05de\u05e0\u05e2\u05e4\u05e4\u05e6\u05ea" + // he
        "\u1c90\u1cb0" + // ka
        "\u0915\u0928\u092a\u0930\u0932\u0932\u0935\u0939" + // hi
        "\u0a95\u0aa8\u0aaa\u0ab0\u0ab2\u0ab2\u0ab5\u0ab9\u0ab3\u0ab3" + // gu
        "\u0e01\u0e02\u0e04\u0e04\u0e07\u0e23\u0e25\u0e25\u0e27\u0e2e" + // th
        "\u3105\u3129";

    const languageDigitRanges =
        "\u0966\u096f" + // hi
        "\u0a66\u0a6f" + // pa
        "\u0ae6\u0aef" + // gu
        "\u0b66\u0b6f" + // or
        "\u0be6\u0bef" + // ta
        "\u0c66\u0c6f" + // te
        "\u0ce6\u0cef" + // kn
        "\u0d66\u0d6f" + // ml
        "\u0e50\u0e59" + // th
        "\u0ed0\u0ed9" + // lo
        "\u0f20\u0f29" + // bo
        "\u1040\u1049" + // my
        "\u17e0\u17e9" + // km
        "\u1810\u1819"; // mn

    /**
     * Delta sequences:
     * - [0-9] as the Unicode delta.
     * - [A-Z] to repeat the previous delta an additional 1-26 times.
     *
     * For example, `"2C"` expands to [2, 2, 2, 2]
     */
    const japaneseDeltas = "2C12J32B1D3D1C2B1D21C";
    const koreanConsonantDeltas = "3A28132121C";
    const koreanSyllableDeltas = "2121A2A121C";

    // Hangul syllables are arranged so changing the initial consonant while
    // keeping the vowel and final consonant fixed has a constant stride
    const hangulInitialStride =
        "\uae4c".charCodeAt(0) - // next Hangul initial
        "\uac00".charCodeAt(0); // first Hangul initial

    // CJK Heavenly Stems and Earthly Branches
    const cjkOrdinalCharacters =
        "\u7532\u4e59\u4e19\u4e01\u620a\u5df1\u5e9a\u8f9b\u58ec\u7678" +
        "\u5b50\u4e11\u5bc5\u536f\u8fb0\u5df3\u5348\u672a\u7533\u9149\u620c\u4ea5";

    function pushCharacter(char: string) {
        if (res.size >= count)
            return true;

        const token = findSingleToken(char, tokenizer);
        if (token != null) {
            if (isCasedCharacter(char))
                cased.add(token);
            else
                res.add(token);
        }

        return res.size >= count;
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

    function addDeltaSequence(start: string, compressedDeltas: string, stride: number = 1) {
        let code = start.charCodeAt(0);
        let lastDelta = 0;

        if (pushCode(code))
            return false;

        for (let i = 0; i < compressedDeltas.length; i++) {
            const encodedDelta = compressedDeltas.charCodeAt(i);

            if (encodedDelta >= charCodeA && encodedDelta <= charCodeZ) {
                const repetitions = encodedDelta - charCodeA + 1;

                for (let repetition = 0; repetition < repetitions; repetition++) {
                    code += lastDelta * stride;

                    if (pushCode(code))
                        return false;
                }
            } else {
                lastDelta = encodedDelta - charCode0;
                code += lastDelta * stride;

                if (pushCode(code))
                    return true;
            }
        }

        return false;
    }

    function addCharacters(characters: string) {
        for (let i = 0; i < characters.length; i++) {
            if (pushCharacter(characters[i]!))
                return true;
        }

        return false;
    }

    function addPendingCharacters() {
        for (const token of cased) {
            if (res.size >= count)
                break;

            res.add(token);
        }

        return res.size >= count;
    }

    const hasEnoughCharacters = addRanges(ranges) ||
        addDeltaSequence("\u3042", japaneseDeltas) || // Japanese Hiragana
        addDeltaSequence("\u30a2", japaneseDeltas) || // Japanese Katakana
        addDeltaSequence("\u3131", koreanConsonantDeltas) || // Korean consonant ordering
        addDeltaSequence("\uac00", koreanSyllableDeltas, hangulInitialStride) || // Korean syllable ordering
        addCharacters(cjkOrdinalCharacters) || // CJK Heavenly Stems and Earthly Branches
        addRanges(languageDigitRanges) ||
        addPendingCharacters();

    if (!hasEnoughCharacters)
        throw new RangeError(
            "Failed to find enough choice options for the given criteria. " +
            `${count} options are needed out of ${res.size} that are available. ` +
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

function isCasedCharacter(text: string): boolean {
    return text.toUpperCase() !== text || text.toLowerCase() !== text;
}
