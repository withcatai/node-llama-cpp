/* eslint @stylistic/max-statements-per-line: ["warn", {"ignoredNodes": ["BreakStatement"]}] */
import type {GgufInsights} from "./GgufInsights.js";

export class GgufInsightsTokens {
    /** @internal */ private readonly _ggufInsights: GgufInsights;

    private constructor(ggufInsights: GgufInsights) {
        this._ggufInsights = ggufInsights;
    }

    public get sepToken(): number | null {
        const tokenizerModel = this._ggufInsights._ggufFileInfo?.metadata?.tokenizer?.ggml?.model;
        const totalTokens = this._ggufInsights._ggufFileInfo?.metadata?.tokenizer?.ggml?.tokens?.length;

        let sepTokenId = this._ggufInsights._ggufFileInfo?.metadata?.tokenizer?.ggml?.["seperator_token_id"];
        if (sepTokenId == null && tokenizerModel === "bert") {
            sepTokenId = 102; // source: `llama_vocab::impl::load` in `llama-vocab.cpp`
        }

        if (totalTokens != null && sepTokenId != null && sepTokenId >= totalTokens)
            return null;

        return sepTokenId ?? null;
    }

    public get eosToken(): number | null {
        const tokenizerModel = this._ggufInsights._ggufFileInfo?.metadata?.tokenizer?.ggml?.model;
        const totalTokens = this._ggufInsights._ggufFileInfo?.metadata?.tokenizer?.ggml?.tokens?.length;

        const eosTokenId = this._ggufInsights._ggufFileInfo?.metadata?.tokenizer?.ggml?.["eos_token_id"];
        if (eosTokenId != null && totalTokens != null && eosTokenId < totalTokens)
            return eosTokenId;

        switch (tokenizerModel) {
            case "no_vocab": return null;
            case "none": return null;
            case "bert": return null;
            case "rwkv": return null;
            case "llama": return 2;
            case "gpt2": return 11;
            case "t5": return 1;
            case "plamo2": return 2;
        }
        return 2; // source: `llama_vocab::impl::load` in `llama-vocab.cpp`
    }

    /** @internal */
    public static _create(ggufInsights: GgufInsights) {
        return new GgufInsightsTokens(ggufInsights);
    }
}
