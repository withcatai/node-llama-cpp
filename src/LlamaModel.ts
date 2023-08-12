import {loadBin, type LLAMAModel, type LLAMAContext} from "./utils/getBin.js";

const llamaCppNode = await loadBin();
const {LLAMAModel, LLAMAContext} = llamaCppNode;

export class LlamaModel {
    private readonly _model: LLAMAModel;
    private readonly _ctx: LLAMAContext;
    private _prependBos: boolean;

    public constructor({
        modelPath, prependBos = true
    }: {
        modelPath: string, prependBos?: boolean
    }) {
        this._model = new LLAMAModel(modelPath);
        this._ctx = new LLAMAContext(this._model);
        this._prependBos = prependBos;
    }

    public get systemInfo() {
        return llamaCppNode.systemInfo();
    }

    public encode(text: string): Uint32Array {
        return this._ctx.encode(text);
    }

    public decode(tokens: Uint32Array): string {
        return this._ctx.decode(tokens);
    }

    public async *evaluate(tokens: Uint32Array, getRestrictions?: () => Uint32Array) {
        let evalTokens = tokens;

        if (this._prependBos) {
            const tokensArray = Array.from(tokens);
            tokensArray.unshift(llamaCppNode.tokenBos());

            evalTokens = Uint32Array.from(tokensArray);
            this._prependBos = false;
        }

        // eslint-disable-next-line no-constant-condition
        while (true) {
            // Evaluate to get the next token.
            const nextToken = await this._ctx.eval(evalTokens, getRestrictions?.());

            // the assistant finished answering
            if (nextToken === llamaCppNode.tokenEos())
                break;

            yield nextToken;

            // Create tokens for the next eval.
            evalTokens = Uint32Array.from([nextToken]);
        }
    }
}
