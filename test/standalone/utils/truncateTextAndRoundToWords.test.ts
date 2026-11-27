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

        test("truncating from the end rounds to the last whole word and keeps the start of the text", () => {
            const text = "the quick brown fox jumps over the lazy dog";

            expect(truncateTextAndRoundToWords(text, 1, undefined, false)).toBe("the quick brown fox jumps over the lazy");
            expect(truncateTextAndRoundToWords(text, 5, undefined, false)).toBe("the quick brown fox jumps over the");
            expect(truncateTextAndRoundToWords(text, 30, undefined, false)).toBe("the quick");
        });

        test("truncating from the end of a long word replaces its end with an ellipsis", () => {
            expect(truncateTextAndRoundToWords("a supercalifragilistic", 2, undefined, false)).toBe("a supercalifragil...");
            expect(truncateTextAndRoundToWords("supercalifragilistic", 2, undefined, false)).toBe("supercalifragil...");
        });

        test("truncating from the start rounds to the next whole word and keeps the end of the text", () => {
            const text = "the quick brown fox jumps over the lazy dog";

            expect(truncateTextAndRoundToWords(text, 1, undefined, true)).toBe("quick brown fox jumps over the lazy dog");
            expect(truncateTextAndRoundToWords(text, 30, undefined, true)).toBe("the lazy dog");
            expect(truncateTextAndRoundToWords("supercalifragilistic a", 2, undefined, true)).toBe("...califragilistic a");
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
                .to.eql(LlamaText(["abc", new SpecialTokensText("<x>")]).values);
        });

        test("keeps the remaining items whole when the truncate size is consumed exactly at an item boundary (from start)", () => {
            const text = LlamaText(["abc", new SpecialTokensText("<x>"), "def"]);

            expect(truncateLlamaTextAndRoundToWords(text, 3, undefined, true).values)
                .to.eql(LlamaText([new SpecialTokensText("<x>"), "def"]).values);
        });

        test("keeps a special token that follows an exactly consumed string", () => {
            const token = new SpecialToken("BOS");
            const text = LlamaText(["abc", token, "def"]);

            expect(truncateLlamaTextAndRoundToWords(text, 3, undefined, false).values)
                .to.eql(LlamaText(["abc", token]).values);
            expect(truncateLlamaTextAndRoundToWords(text, 3, undefined, true).values)
                .to.eql(LlamaText([token, "def"]).values);
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
