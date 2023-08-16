import {llamaCppNode, LLAMAModel} from "./LlamaBins.js";


export class LlamaModel {
    /** @internal */
    public readonly _model: LLAMAModel;

    /**
     * options source:
     * https://github.com/ggerganov/llama.cpp/blob/b5ffb2849d23afe73647f68eec7b68187af09be6/llama.h#L102 (struct llama_context_params)
     * @param {string} options
     * @param {string} options.modelPath - path to the model on the filesystem
     * @param {number | null} [options.seed] - If null, a random seed will be used
     * @param {number} [options.contextSize] - text context size
     * @param {number} [options.batchSize] - prompt processing batch size
     * @param {number} [options.gpuCores] - number of layers to store in VRAM
     * @param {boolean} [options.lowVram] - if true, reduce VRAM usage at the cost of performance
     * @param {boolean} [options.f16Kv] - use fp16 for KV cache
     * @param {boolean} [options.logitsAll] - the llama_eval() call computes all logits, not just the last one
     * @param {boolean} [options.vocabOnly] - only load the vocabulary, no weights
     * @param {boolean} [options.useMmap] - use mmap if possible
     * @param {boolean} [options.useMlock] - force system to keep model in RAM
     * @param {boolean} [options.embedding] - embedding mode only
     */
    public constructor({
        modelPath, seed = null, contextSize = 1024 * 4, batchSize, gpuCores,
        lowVram, f16Kv, logitsAll, vocabOnly, useMmap, useMlock, embedding
    }: {
        modelPath: string, seed?: number | null, contextSize?: number, batchSize?: number, gpuCores?: number,
        lowVram?: boolean, f16Kv?: boolean, logitsAll?: boolean, vocabOnly?: boolean, useMmap?: boolean, useMlock?: boolean,
        embedding?: boolean
    }) {
        this._model = new LLAMAModel(modelPath, removeNullFields({
            seed: seed != null ? Math.max(-1, seed) : undefined,
            contextSize,
            batchSize,
            gpuCores,
            lowVram,
            f16Kv,
            logitsAll,
            vocabOnly,
            useMmap,
            useMlock,
            embedding
        }));
    }

    public static get systemInfo() {
        return llamaCppNode.systemInfo();
    }
}

function removeNullFields<T extends object>(obj: T): T {
    const newObj: T = Object.assign({}, obj);

    for (const key in obj) {
        if (newObj[key] == null)
            delete newObj[key];
    }

    return newObj;
}
