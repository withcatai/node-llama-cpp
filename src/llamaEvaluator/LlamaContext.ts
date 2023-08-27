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

    public getBos() {
        return this._ctx.decode(Uint32Array.from([this._ctx.tokenBos()]));
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
