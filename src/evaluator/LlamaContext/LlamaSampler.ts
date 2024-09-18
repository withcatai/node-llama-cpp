import type {AddonSampler} from "../../bindings/AddonTypes.js";
import type {LlamaModel} from "../LlamaModel/LlamaModel.js";
import type {LlamaGrammarEvaluationState} from "../LlamaGrammarEvaluationState.js";
import type {Token} from "../../types.js";
import type {Llama} from "../../bindings/Llama.js";

/** @internal */
export class LlamaSampler {
    /** @internal */ public readonly _llama: Llama;
    /** @internal */ public readonly _sampler: AddonSampler;
    /** @internal */ public disposed: boolean = false;

    public constructor(model: LlamaModel) {
        this._llama = model._llama;
        this._sampler = new this._llama._bindings.AddonSampler(model._model);

        this.asyncDispose = this.asyncDispose.bind(this);
    }

    public dispose() {
        this.disposed = true;
        this._sampler.dispose();
    }

    public async asyncDispose() {
        this.disposed = true;
        this._sampler.dispose();
    }

    public applyConfig(config: Parameters<AddonSampler["applyConfig"]>[0]) {
        return this._sampler.applyConfig(config);
    }

    /** @internal */
    public static _canBeNextTokenForGrammarEvaluationState(
        llama: Llama,
        grammarEvaluationState: LlamaGrammarEvaluationState,
        token: Token
    ) {
        return llama._bindings.AddonSampler.canBeNextTokenForGrammarEvaluationState(
            grammarEvaluationState._state,
            token
        );
    }

    /** @internal */
    public static _acceptTokenOnGrammarEvaluationState(
        llama: Llama,
        grammarEvaluationState: LlamaGrammarEvaluationState,
        token: Token
    ) {
        llama._bindings.AddonSampler.acceptGrammarEvaluationStateToken(grammarEvaluationState._state, token);
    }
}
