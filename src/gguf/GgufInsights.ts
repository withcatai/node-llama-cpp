import {getGgufMetadataLlmData} from "./ggufParser/utils/getGgufMetadataLlmData.js";
import {GgufMetadata} from "./ggufParser/types/GgufMetadataTypes.js";

export class GgufInsights {
    public readonly metadata: GgufMetadata;
    public readonly metadataSize: number;

    public constructor({
        metadata,
        metadataSize
    }: {
        metadata: GgufMetadata,
        metadataSize: number
    }) {
        this.metadata = metadata;
        this.metadataSize = metadataSize;
    }

    /**
     * fp16 k,v matrices
     */
    public get kvMatrices() {
        // 2 bytes each * 2 key and value
        const llmData = getGgufMetadataLlmData(this.metadata);
        return (
            2 * 2 *
            (llmData.context_length ?? 1) *
            (llmData.block_count ?? 1) *
            (llmData.embedding_length ?? 1) *
            (llmData.attention?.head_count_kv ?? 1) /
            (llmData.attention?.head_count ?? 1)
        );
    }

    /**
     * This amount is the overhead + tensors in memory
     */
    public get graphSize() {
        // TODO: get this from the llama.cpp's graph calculations instead of
        // estimating it's 1/6 * kv_cache_size * num_gqa
        const llmData = getGgufMetadataLlmData(this.metadata);
        return (
            (llmData.attention?.head_count_kv ?? 1) /
            (llmData.attention?.head_count ?? 1)
        ) * this.kvMatrices / 6;
    }

    public get VRAMUsage() {
        return this.graphSize + this.kvMatrices + this.metadataSize;
    }
}
