import {Llama} from "../bindings/Llama.js";
import {AddonGrammarEvaluationState} from "../bindings/AddonTypes.js";
import {LlamaGrammar} from "./LlamaGrammar.js";


export type LlamaGrammarEvaluationStateOptions = {
    grammar: LlamaGrammar
};

/**
 * Grammar evaluation state is used to track the model response to determine the next allowed characters for the model to generate.
 * Create a new grammar evaluation state for every response you generate with the model.
 * This is only needed when using the `LlamaContext` class directly, as `LlamaChatSession` already handles this for you.
 */
export class LlamaGrammarEvaluationState {
    /** @internal */ public readonly _llama: Llama;
    /** @internal */ public readonly _state: AddonGrammarEvaluationState;

    /**
     * @param options
     */
    public constructor({grammar}: LlamaGrammarEvaluationStateOptions) {
        this._llama = grammar._llama;
        this._state = new grammar._llama._bindings.AddonGrammarEvaluationState(grammar._grammar);
    }
}
