import {Llama} from "../bindings/Llama.js";
import {AddonGrammarEvaluationState} from "../bindings/AddonTypes.js";
import type {LlamaGrammar} from "./LlamaGrammar.js";
import type {LlamaModel} from "./LlamaModel/LlamaModel.js";


export type LlamaGrammarEvaluationStateOptions = {
    model: LlamaModel,
    grammar: LlamaGrammar
};

/**
 * Grammar evaluation state is used to track the model response to determine the next allowed characters for the model to generate.
 *
 * Create a new grammar evaluation state for every response you generate with the model.
 *
 * This is only needed when using the `LlamaContext` class directly, since `LlamaChatSession` already handles this for you.
 */
export class LlamaGrammarEvaluationState {
    /** @internal */ public readonly _llama: Llama;
    /** @internal */ public readonly _state: AddonGrammarEvaluationState;

    public constructor(options: LlamaGrammarEvaluationStateOptions);
    public constructor(existingState: LlamaGrammarEvaluationState);
    public constructor(existingStateOrOptions: LlamaGrammarEvaluationStateOptions | LlamaGrammarEvaluationState) {
        if (existingStateOrOptions instanceof LlamaGrammarEvaluationState) {
            this._llama = existingStateOrOptions._llama;
            this._state = new this._llama._bindings.AddonGrammarEvaluationState(existingStateOrOptions._state);
        } else {
            const {model, grammar} = existingStateOrOptions;
            this._llama = model._llama;

            if (model._llama !== grammar._llama)
                throw new Error("The given LlamaModel and LlamaGrammar must be from the same Llama instance");

            this._state = new model._llama._bindings.AddonGrammarEvaluationState(model._model, grammar._grammar);
        }
    }

    /** Clone the grammar evaluation state */
    public clone(): LlamaGrammarEvaluationState {
        return new LlamaGrammarEvaluationState(this);
    }
}
