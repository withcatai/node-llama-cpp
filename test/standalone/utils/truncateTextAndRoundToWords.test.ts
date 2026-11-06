import {describe, expect, test} from "vitest";
import {truncateLlamaTextAndRoundToWords, truncateTextAndRoundToWords} from "../../../src/utils/truncateTextAndRoundToWords.js";
import {LlamaText, SpecialToken, SpecialTokensText} from "../../../src/utils/LlamaText.js";


describe("utils", () => {
    describe("truncateTextAndRoundToWords", () => {
        test("truncate size of 0 keeps the whole text", () => {
            expect(truncateTextAndRoundToWords("hello world", 0, undefined, false)).toBe("hello world");
            expect(truncateTextAndRoundToWords("hello world", 0, undefined, true)).toBe("hello world");
            expect(truncateTextAndRoundToWords("hello world", 0)).toBe("hello world");
        });

        test("negative truncate size keeps the whole text", () => {
            expect(truncateTextAndRoundToWords("hello world", -3, undefined, false)).toBe("hello world");
            expect(truncateTextAndRoundToWords("hello world", -3, undefined, true)).toBe("hello world");
        });

        test("empty text with truncate size of 0", () => {
            expect(truncateTextAndRoundToWords("", 0, undefined, false)).toBe("");
            expect(truncateTextAndRoundToWords("", 0, undefined, true)).toBe("");
        });

        test("truncating the entire text results in an empty string", () => {
            expect(truncateTextAndRoundToWords("hello world", 11, undefined, false)).toBe("");
            expect(truncateTextAndRoundToWords("hello world", 11, undefined, true)).toBe("");
            expect(truncateTextAndRoundToWords("hello world", 50, undefined, false)).toBe("");
            expect(truncateTextAndRoundToWords("hello world", 50, undefined, true)).toBe("");
        });

        test("truncate on a word boundary", () => {
            expect(truncateTextAndRoundToWords("hello world", 6, undefined, false)).toBe("hello");
            expect(truncateTextAndRoundToWords("hello world", 6, undefined, true)).toBe("world");
        });
    });

    describe("truncateLlamaTextAndRoundToWords", () => {
        test("truncate size of 0 or less keeps the whole text", () => {
            const text = LlamaText(["abc", new SpecialTokensText("<x>"), "def"]);

            expect(truncateLlamaTextAndRoundToWords(text, 0, undefined, false).values).to.eql(text.values);
            expect(truncateLlamaTextAndRoundToWords(text, 0, undefined, true).values).to.eql(text.values);
            expect(truncateLlamaTextAndRoundToWords(text, -3, undefined, false).values).to.eql(text.values);
            expect(truncateLlamaTextAndRoundToWords(text, -3, undefined, true).values).to.eql(text.values);
        });

        test("keeps the remaining items whole when the truncate size is consumed exactly at an item boundary (from end)", () => {
            const text = LlamaText(["abc", new SpecialTokensText("<x>"), "def"]);

            expect(truncateLlamaTextAndRoundToWords(text, 3, undefined, false).values)
                .to.eql([...LlamaText(["abc", new SpecialTokensText("<x>")]).values]);
        });

        test("keeps the remaining items whole when the truncate size is consumed exactly at an item boundary (from start)", () => {
            const text = LlamaText(["abc", new SpecialTokensText("<x>"), "def"]);

            expect(truncateLlamaTextAndRoundToWords(text, 3, undefined, true).values)
                .to.eql([...LlamaText([new SpecialTokensText("<x>"), "def"]).values]);
        });

        test("keeps a special token that follows an exactly consumed string", () => {
            const token = new SpecialToken("BOS");
            const text = LlamaText(["abc", token, "def"]);

            expect(truncateLlamaTextAndRoundToWords(text, 3, undefined, false).values)
                .to.eql([...LlamaText(["abc", token]).values]);
            expect(truncateLlamaTextAndRoundToWords(text, 3, undefined, true).values)
                .to.eql([...LlamaText([token, "def"]).values]);
        });

        test("still removes the items that fall within the truncate size", () => {
            const text = LlamaText(["abc", new SpecialTokensText("<x>"), "def"]);

            expect(truncateLlamaTextAndRoundToWords(text, 6, undefined, false).values).to.eql(["abc"]);
            expect(truncateLlamaTextAndRoundToWords(text, 6, undefined, true).values).to.eql(["def"]);
            expect(truncateLlamaTextAndRoundToWords(text, 100, undefined, false).values).to.eql([]);
            expect(truncateLlamaTextAndRoundToWords(text, 100, undefined, true).values).to.eql([]);
        });
    });
});
