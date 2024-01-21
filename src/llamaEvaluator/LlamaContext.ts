import {removeNullFields} from "../utils/removeNullFields.js";
import {Token} from "../types.js";
import {LLAMAContext} from "./LlamaBins.js";
import {LlamaModel} from "./LlamaModel.js";
import {LlamaGrammarEvaluationState} from "./LlamaGrammarEvaluationState.js";
import {LlamaGrammar} from "./LlamaGrammar.js";


export type LlamaContextOptions = {
    model: LlamaModel,
    prependBos?: boolean,

    /**
     * @deprecated use the `grammar` option on `LlamaChatSession`'s `prompt` function
     * or the `grammarEvaluationState` option on `LlamaContext`'s `evaluate` function instead
     * @hidden
     */
    grammar?: LlamaGrammar,

    /** If null, a random seed will be used */
    seed?: number | null,

    /** text context size */
    contextSize?: number,

    /** prompt processing batch size */
    batchSize?: number,

    /** the llama_eval() call computes all logits, not just the last one */
    logitsAll?: boolean,

    /** embedding mode only */
    embedding?: boolean

    /** number of threads to use to evaluate tokens */
    threads?: number,
};

export type LlamaContextRepeatPenalty = {
    /** Tokens to lower the predication probability of to be the next predicted token */
    punishTokens: Uint32Array | (() => Uint32Array),

    /**
     * The relative amount to lower the probability of the tokens in `punishTokens` by
     * Defaults to `1.1`.
     * Set to `1` to disable.
     */
    penalty?: number,

    /**
     * For n time a token is in the `punishTokens` array, lower its probability by `n * frequencyPenalty`
     * Disabled by default (`0`).
     * Set to a value between `0` and `1` to enable.
     */
    frequencyPenalty?: number,

    /**
     * Lower the probability of all the tokens in the `punishTokens` array by `presencePenalty`
     * Disabled by default (`0`).
     * Set to a value between `0` and `1` to enable.
     */
    presencePenalty?: number
};

export class LlamaContext {
    private readonly _model: LlamaModel;
    private readonly _ctx: LLAMAContext;
    private readonly _prependBos: boolean;
    private _prependTokens: Token[];

    /** @internal */
    public readonly _chatGrammar?: LlamaGrammar;


    /**
     * @param {LlamaContextOptions} options
     */
    public constructor({
        model,
        prependBos = true,
        grammar,
        seed = model._contextOptions.seed,
        contextSize = model._contextOptions.contextSize,
        batchSize = model._contextOptions.batchSize,
        logitsAll = model._contextOptions.logitsAll,
        embedding = model._contextOptions.embedding,
        threads = model._contextOptions.threads
    }: LlamaContextOptions) {
        this._model = model;
        this._ctx = new LLAMAContext(model._model, removeNullFields({
            seed: seed != null ? Math.max(-1, seed) : undefined,
            contextSize,
            batchSize,
            logitsAll,
            embedding,
            threads
        }));
        this._prependBos = prependBos;
        this._prependTokens = [];
        this._chatGrammar = grammar;

        if (prependBos) {
            this._prependTokens.unshift(this._ctx.tokenBos());
        }
    }

    public encode(text: string): Uint32Array {
        if (text === "")
            return new Uint32Array();

        return this._ctx.encode(text);
    }

    public decode(tokens: Uint32Array | Token[]): string {
        if (tokens.length === 0)
            return "";

        if (tokens instanceof Uint32Array)
            return this._ctx.decode(tokens);

        return this._ctx.decode(Uint32Array.from(tokens));
    }

    public get prependBos() {
        return this._prependBos;
    }

    /**
     * @returns {Token | null} The BOS (Beginning Of Sequence) token.
     */
    public getBosToken(): Token | null {
        const bosToken = this._ctx.tokenBos();

        if (bosToken === -1)
            return null;

        return bosToken;
    }

    /**
     * @returns {Token | null} The EOS (End Of Sequence) token.
     */
    public getEosToken(): Token | null {
        const eosToken = this._ctx.tokenEos();

        if (eosToken === -1)
            return null;

        return eosToken;
    }

    /**
     * @returns {Token | null} The NL (New Line) token.
     */
    public getNlToken(): Token | null {
        const nlToken = this._ctx.tokenNl();

        if (nlToken === -1)
            return null;

        return nlToken;
    }

    /**
     * @returns {string | null} The BOS (Beginning Of Sequence) token as a string.
     */
    public getBosString(): string | null {
        const bosToken = this.getBosToken();

        if (bosToken == null)
            return null;

        return this._ctx.getTokenString(bosToken);
    }

    /**
     * @returns {string | null} The EOS (End Of Sequence) token as a string.
     */
    public getEosString(): string | null {
        const eosToken = this.getEosToken();

        if (eosToken == null)
            return null;

        return this._ctx.getTokenString(eosToken);
    }

    /**
     * @returns {string | null} The NL (New Line) token as a string.
     */
    public getNlString(): string | null {
        const nlToken = this.getNlToken();

        if (nlToken == null)
            return null;

        return this._ctx.getTokenString(nlToken);
    }

    public getContextSize(): number {
        return this._ctx.getContextSize();
    }

    public printTimings() {
        this._ctx.printTimings();
    }

    /**
     * @param {Uint32Array} tokens
     * @param {object} options
     * @returns {AsyncGenerator<Token, void>}
     */
    public async *evaluate(tokens: Uint32Array, {
        temperature = this._model._evaluationOptions.temperature,
        topK = this._model._evaluationOptions.topK,
        topP = this._model._evaluationOptions.topP,
        grammarEvaluationState,
        repeatPenalty
    }: {
        temperature?: number, topK?: number, topP?: number, grammarEvaluationState?: LlamaGrammarEvaluationState,
        repeatPenalty?: LlamaContextRepeatPenalty
    } = {}): AsyncGenerator<Token, void> {
        let evalTokens = tokens;

        if (this._prependTokens.length > 0) {
            const tokenArray: Token[] = this._prependTokens.concat(Array.from(tokens));

            evalTokens = Uint32Array.from(tokenArray);
            this._prependTokens = [];
        }

        if (evalTokens.length === 0)
            return;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            // Evaluate to get the next token.
            const nextToken: Token = await this._ctx.eval(evalTokens, removeNullFields({
                temperature,
                topK,
                topP,
                repeatPenalty: repeatPenalty?.penalty,
                repeatPenaltyTokens: repeatPenalty?.punishTokens instanceof Function
                    ? repeatPenalty.punishTokens()
                    : repeatPenalty?.punishTokens,
                repeatPenaltyPresencePenalty: repeatPenalty?.presencePenalty,
                repeatPenaltyFrequencyPenalty: repeatPenalty?.frequencyPenalty,
                grammarEvaluationState: grammarEvaluationState?._state
            }));

            // the assistant finished answering
            if (nextToken === this._ctx.tokenEos())
                break;

            yield nextToken;

            // Create tokens for the next eval.
            evalTokens = Uint32Array.from([nextToken]);
        }
    }
}
