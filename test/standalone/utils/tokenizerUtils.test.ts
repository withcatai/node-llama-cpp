import {describe, expect, test} from "vitest";
import {LlamaVocabularyType} from "../../../src/bindings/types.js";
import {resolveBeginningTokenToPrepend, resolveEndTokenToAppend} from "../../../src/utils/tokenizerUtils.js";
import type {LlamaModelTokens} from "../../../src/evaluator/LlamaModel/LlamaModel.js";
import type {Token} from "../../../src/types.js";

function createTokens({
    bos = 1 as Token,
    eos = 2 as Token,
    sep = 3 as Token,
    shouldPrependBosToken = false,
    shouldAppendEosToken = false
}: {
    bos?: Token | null,
    eos?: Token | null,
    sep?: Token | null,
    shouldPrependBosToken?: boolean,
    shouldAppendEosToken?: boolean
} = {}) {
    return {
        bos,
        eos,
        sep,
        shouldPrependBosToken,
        shouldAppendEosToken
    } as LlamaModelTokens;
}

describe("utils", () => {
    describe("tokenizerUtils", () => {
        describe("resolveBeginningTokenToPrepend", () => {
            test("prepends BOS for ugm models that request it (e.g. bge-m3)", () => {
                // XLM-RoBERTa-based models (like bge-m3) are converted with a ugm vocabulary
                // and set `tokenizer.ggml.add_bos_token = true` in the GGUF metadata.
                // llama.cpp prepends the BOS token for ugm when `add_bos` is set
                // (`llama_vocab::impl::tokenize` in `llama-vocab.cpp`).
                const tokens = createTokens({shouldPrependBosToken: true});
                expect(resolveBeginningTokenToPrepend(LlamaVocabularyType.ugm, tokens)).to.eql(tokens.bos);
            });

            test("prepends nothing for ugm models that do not request BOS (e.g. T5)", () => {
                const tokens = createTokens({shouldPrependBosToken: false});
                expect(resolveBeginningTokenToPrepend(LlamaVocabularyType.ugm, tokens)).to.eql(null);
            });

            test("prepends BOS for spm models that request it", () => {
                const tokens = createTokens({shouldPrependBosToken: true});
                expect(resolveBeginningTokenToPrepend(LlamaVocabularyType.spm, tokens)).to.eql(tokens.bos);
            });

            test("prepends BOS for bpe models that request it", () => {
                const tokens = createTokens({shouldPrependBosToken: true});
                expect(resolveBeginningTokenToPrepend(LlamaVocabularyType.bpe, tokens)).to.eql(tokens.bos);
            });

            test("prepends nothing for spm models that do not request BOS", () => {
                const tokens = createTokens({shouldPrependBosToken: false});
                expect(resolveBeginningTokenToPrepend(LlamaVocabularyType.spm, tokens)).to.eql(null);
            });

            test("prepends BOS for wpm models", () => {
                const tokens = createTokens({shouldPrependBosToken: false});
                expect(resolveBeginningTokenToPrepend(LlamaVocabularyType.wpm, tokens)).to.eql(tokens.bos);
            });

            test("prepends nothing for rwkv models", () => {
                const tokens = createTokens({shouldPrependBosToken: true});
                expect(resolveBeginningTokenToPrepend(LlamaVocabularyType.rwkv, tokens)).to.eql(null);
            });
        });

        describe("resolveEndTokenToAppend", () => {
            test("appends EOS for ugm models", () => {
                const tokens = createTokens();
                expect(resolveEndTokenToAppend(LlamaVocabularyType.ugm, tokens)).to.eql(tokens.eos);
            });

            test("appends SEP for wpm models", () => {
                const tokens = createTokens();
                expect(resolveEndTokenToAppend(LlamaVocabularyType.wpm, tokens)).to.eql(tokens.sep);
            });

            test("appends EOS for spm models that request it", () => {
                const tokens = createTokens({shouldAppendEosToken: true});
                expect(resolveEndTokenToAppend(LlamaVocabularyType.spm, tokens)).to.eql(tokens.eos);
            });

            test("appends nothing for spm models that do not request EOS", () => {
                const tokens = createTokens({shouldAppendEosToken: false});
                expect(resolveEndTokenToAppend(LlamaVocabularyType.spm, tokens)).to.eql(null);
            });

            test("appends nothing for rwkv models", () => {
                const tokens = createTokens({shouldAppendEosToken: true});
                expect(resolveEndTokenToAppend(LlamaVocabularyType.rwkv, tokens)).to.eql(null);
            });
        });
    });
});
