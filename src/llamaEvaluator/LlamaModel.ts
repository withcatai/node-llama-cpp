import {LlamaContext} from "./LlamaContext.js";
import {LLAMAContext, llamaCppNode, LLAMAModel} from "./LlamaBins.js";


export class LlamaModel {
    private readonly _model: LLAMAModel;
    private readonly _prependBos: boolean;

    public constructor({modelPath, prependBos = true}: { modelPath: string, prependBos?: boolean }) {
        this._model = new LLAMAModel(modelPath);
        this._prependBos = prependBos;
    }

    public createContext() {
        return new LlamaContext({
            ctx: new LLAMAContext(this._model),
            prependBos: this._prependBos
        });
    }

    public static get systemInfo() {
        return llamaCppNode.systemInfo();
    }
}
