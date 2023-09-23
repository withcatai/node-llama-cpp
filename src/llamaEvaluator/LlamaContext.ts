import {removeNullFields} from "../utils/removeNullFields.js";
import {Token} from "../types.js";
import {LLAMAContext} from "./LlamaBins.js";
import {LlamaModel} from "./LlamaModel.js";
import {LlamaGrammar} from "./LlamaGrammar.js";


export type LlamaContextOptions = {
    model: LlamaModel,
    grammar?: LlamaGrammar,
    prependBos?: boolean
};

export class LlamaContext {
    private readonly _ctx: LLAMAContext;
    private readonly _prependBos: boolean;
    private _prependTokens: Token[];

    public constructor({model, grammar, prependBos = true}: LlamaContextOptions) {
        this._ctx = new LLAMAContext(model._model, removeNullFields({
            grammar: grammar?._grammar
        }));
        this._prependBos = prependBos;
        this._prependTokens = [];

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

    public async *evaluate(tokens: Uint32Array): AsyncGenerator<Token, void> {
        let evalTokens = tokens;

        if (this._prependTokens.length > 0) {
            const tokenArray: Token[] = this._prependTokens.concat(Array.from(tokens));

            evalTokens = Uint32Array.from(tokenArray);
            this._prependTokens = [];
        }

        // eslint-disable-next-line no-constant-condition
        while (true) {
            // Evaluate to get the next token.
            const nextToken: Token = await this._ctx.eval(evalTokens);

            // the assistant finished answering
            if (nextToken === this._ctx.tokenEos())
                break;

            yield nextToken;

            // Create tokens for the next eval.
            evalTokens = Uint32Array.from([nextToken]);
        }
    }
}
