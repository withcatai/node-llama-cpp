import {GgufParsedMetadataResult} from "./ggufParser/GgufParser.js";

export class GgufInsights {
    public readonly metadataResponse: GgufParsedMetadataResult;

    public constructor(metadataResponse: GgufParsedMetadataResult) {
        this.metadataResponse = metadataResponse;
    }

    public get metadata() {
        return this.metadataResponse.metadata;
    }

    public get architectureMetadata() {
        return this.metadata[this.metadata.general.architecture];
    }

    /**
     * fp16 k,v matrices
     */
    public get kvMatrices() {
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
        return (this.architectureMetadata.attention.head_count_kv / this.architectureMetadata.attention.head_count) * this.kvMatrices / 6;
    }

    public get VRAMUsage() {
        return this.graphSize + this.kvMatrices + this.metadataResponse.metadataSize;
    }
}
