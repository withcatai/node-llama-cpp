import {LlamaVocabularyType} from "../bindings/types.js";
import type {LlamaModelTokens} from "../evaluator/LlamaModel/LlamaModel.js";

/**
 * Resolve whether a token has to be prepended at the beginning of the input, and what should it be,
 * based on the tokenizer implementation in `llama.cpp` under the `llama_tokenize_internal` function in `llama-vocab.cpp`
 */
export function resolveBeginningTokenToPrepend(vocabularyType: LlamaVocabularyType, tokens: LlamaModelTokens) {
    if (vocabularyType === LlamaVocabularyType.rwkv)
        return null;

    if (vocabularyType === LlamaVocabularyType.wpm)
        return tokens.bos;


    if (vocabularyType === LlamaVocabularyType.ugm)
        return null;

    if (tokens.shouldPrependBosToken)
        return tokens.bos;

    return null;
}

/**
 * Resolve whether a token has to be appended at the end of the input, and what should it be,
 * based on the tokenizer implementation in `llama.cpp` under the `llama_tokenize_internal` function in `llama-vocab.cpp`
 */
export function resolveEndTokenToAppend(vocabularyType: LlamaVocabularyType, tokens: LlamaModelTokens) {
    if (vocabularyType === LlamaVocabularyType.rwkv)
        return null;

    if (vocabularyType === LlamaVocabularyType.wpm)
        return tokens.sep;

    if (vocabularyType === LlamaVocabularyType.ugm)
        return tokens.eos;

    if (tokens.shouldAppendEosToken)
        return tokens.eos;

    return null;
}
