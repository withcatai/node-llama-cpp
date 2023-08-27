import {removeNullFields} from "../utils/removeNullFields.js";
import {LLAMAContext} from "./LlamaBins.js";
import {LlamaModel} from "./LlamaModel.js";
import {LlamaGrammar} from "./LlamaGrammar.js";

export class LlamaContext {
    private readonly _ctx: LLAMAContext;
    private _prependBos: boolean;

    public constructor({model, grammar, prependBos = true}: {model: LlamaModel, grammar?: LlamaGrammar, prependBos?: boolean}) {
        this._ctx = new LLAMAContext(model._model, removeNullFields({
            grammar: grammar?._grammar
        }));
        this._prependBos = prependBos;
    }

    public encode(text: string): Uint32Array {
        return this._ctx.encode(text);
    }

    public decode(tokens: Uint32Array): string {
        return this._ctx.decode(tokens);
    }

    public get prependBos() {
        return this._prependBos;
    }

    /**
     * @returns {string} The BOS (Beginning Of Sequence) token as a string.
     */
    public getBos(): string {
        return this._ctx.getTokenString(this._ctx.tokenBos());
    }

    /**
     * @returns {string} The EOS (End Of Sequence) token as a string.
     */
    public getEos(): string {
        return this._ctx.getTokenString(this._ctx.tokenEos());
    }

    public getContextSize() {
        return this._ctx.getContextSize();
    }

    public async *evaluate(tokens: Uint32Array) {
        let evalTokens = tokens;

        if (this._prependBos) {
            const tokenArray = Array.from(tokens);
            tokenArray.unshift(this._ctx.tokenBos());

            evalTokens = Uint32Array.from(tokenArray);
            this._prependBos = false;
        }

        // eslint-disable-next-line no-constant-condition
        while (true) {
            // Evaluate to get the next token.
            const nextToken = await this._ctx.eval(evalTokens);

            // the assistant finished answering
            if (nextToken === this._ctx.tokenEos())
                break;

            yield nextToken;

            // Create tokens for the next eval.
            evalTokens = Uint32Array.from([nextToken]);
        }
    }

}
