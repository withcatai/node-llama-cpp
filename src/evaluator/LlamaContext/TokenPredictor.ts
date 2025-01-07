import {Token} from "../../types.js";
import {SequenceEvaluateOptions} from "./types.js";
import {LlamaContextSequence} from "./LlamaContext.js";

/**
 * @see [Using Token Predictors](https://node-llama-cpp.withcat.ai/guide/token-prediction#custom)
 */
export abstract class TokenPredictor {
    /**
     * Resets the state of the predictor.
     *
     * Called before the generation starts.
     */
    public abstract reset(params: {
        /** The target sequence that this token predictor is generating tokens for */
        targetSequence: LlamaContextSequence,

        /**
         * The tokens that are or will be loaded into the state.
         *
         * The initial predictions should be based on these tokens.
         *
         * When additional tokens are pushed into the state, the `pushTokens` method will be called with those tokens.
         */
        stateTokens: Token[],

        /**
         * Options used for the evaluation on the target sequence.
         *
         * The `grammarEvaluationState` is cloned before being passed to the token predictor,
         * so it can be modified without affecting the original state.
         */
        evaluateOptions: Readonly<SequenceEvaluateOptions>
    }): Promise<void> | void;
    public abstract pushTokens(tokens: Token[]): void;

    /**
     * Predicts the next tokens based on the current state.
     *
     * If the generation should wait until the minimum predications are ready,
     * this method should return a promise that resolves when the minimum predictions are ready.
     *
     * A background prediction process can be started when this function is called,
     * so that the next predictions will be ready when this function is called again.
     */
    public abstract predictTokens(): Promise<Token[]> | Token[];

    /**
     * Stops the prediction process when it runs in the background.
     * @param untilPredictionsExhausted - If true, the prediction process should not resume until the current predictions are exhausted.
     */
    public stop(untilPredictionsExhausted?: boolean): Promise<void> | void {}

    /**
     * Called with the input tokens before the generation starts when using `LlamaChatSession`, `LlamaChat`, and `LlamaCompletion`.
     */
    public updateInputTokens(tokens: Token[]): void {}

    public dispose(): Promise<void> | void {}

    /** @hidden */
    public [Symbol.dispose]() {
        return this.dispose();
    }
}
