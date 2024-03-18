import {Llama} from "../bindings/Llama.js";
import MissingNodeLlamaError from "./errors/MissingNodeLlamaError.js";
import {GGUFMetadataResponse} from "./ggufParser/GgufParser.js";
import NotEnoughVRamError from "./errors/ModelScore/NotEnoughVRamError.js";

const PAD_AVAILABLE_VRAM = 1024 ** 2 * 500; // 500MB

export type GGUFInsightsOptions = {
    contextCount?: number,
    nodeLlama?: Llama,
    modelSize?: number
};

export default class GGUFInsights {
    public readonly metadataResponse: GGUFMetadataResponse;
    public readonly options: GGUFInsightsOptions = {};

    public get metadata() {
        return this.metadataResponse.metadata;
    }

    public get architectureMetadata() {
        return this.metadata[this.metadata.general.architecture];
    }

    /**
     * fp16 k,v matrices
     */
    public get kvMatrices(){
        // 2 bytes each * 2 key and value
        return (
            2 * 2 *
            this.architectureMetadata.context_length *
            this.architectureMetadata.block_count *
            this.architectureMetadata.embedding_length *
            this.architectureMetadata.attention.head_count_kv /
            this.architectureMetadata.attention.head_count
        );
    }

    /**
     * This amount is the overhead + tensors in memory
     */
    public get graphSize() {
        // TODO: get this from the llama.cpp's graph calculations instead of
        // estimating it's 1/6 * kv_cache_size * num_gqa
        return (
            (this.architectureMetadata.attention.head_count_kv /
            this.architectureMetadata.attention.head_count) * this.kvMatrices / 6
        );
    }

    public get VRAMUsage(){
        return this.graphSize + this.kvMatrices + this.metadataResponse.metadataSize;
    }

    protected get _availableVRam(){
        if (!this.options?.nodeLlama){
            throw new MissingNodeLlamaError("GGUFInsights Calculations");
        }
        return this.options.nodeLlama.getVramState().total - PAD_AVAILABLE_VRAM;
    }

    public constructor(metadataResponse: GGUFMetadataResponse, options: GGUFInsightsOptions = {}) {
        this.options = options;
        this.metadataResponse = metadataResponse;

    }


    /**
     * The score of the model by how much it's compatible to the current system
     */
    public modelScore(){
        const vramScore = this.VRAMUsage / this._availableVRam;
        if (vramScore >= 1){
            throw new NotEnoughVRamError(this.VRAMUsage, this._availableVRam);
        }

        return vramScore;
    }

}
