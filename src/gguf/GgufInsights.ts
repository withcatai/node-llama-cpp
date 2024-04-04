import {Llama} from "../bindings/Llama.js";
import {getLlamaWithoutBackend} from "../bindings/utils/getLlamaWithoutBackend.js";
import {getDefaultContextBatchSize, getDefaultContextSequences} from "../evaluator/LlamaContext/LlamaContext.js";
import {GgufFileInfo} from "./types/GgufFileInfoTypes.js";
import {GgufTensorInfo} from "./types/GgufTensorInfoTypes.js";
import {GgufArchitectureType} from "./types/GgufMetadataTypes.js";

export type GgufInsightsResourceRequirements = {
    cpuRam: number,
    gpuVram: number
};

export class GgufInsights {
    /** @internal */ private readonly _llama: Llama;
    /** @internal */ private readonly _modelSize: number;
    /** @internal */ private _totalLayers: number | null = null;
    public readonly ggufFileInfo: GgufFileInfo;

    private constructor(ggufFileInfo: GgufFileInfo, llama: Llama) {
        this._llama = llama;
        this.ggufFileInfo = ggufFileInfo;

        this._modelSize = calculateTensorsSize(ggufFileInfo.tensorInfo ?? [], llama);
    }

    /** The context size the model was trained on */
    public get trainContextSize() {
        return this.ggufFileInfo.architectureMetadata.context_length;
    }

    /** The size of an embedding vector the model can produce */
    public get embeddingVectorSize() {
        return this.ggufFileInfo.architectureMetadata.embedding_length;
    }

    public get totalLayers() {
        if (this._totalLayers != null)
            return this._totalLayers;

        const outputLayers = 1;
        this._totalLayers = this._getFileLayers() + outputLayers;

        return this._totalLayers;
    }

    public get modelSize() {
        return this._modelSize;
    }

    public estimateModelResourceRequirements({gpuLayers}: {gpuLayers: number}): GgufInsightsResourceRequirements {
        const {cpu, gpu} = this._getTensorResourceSplit(gpuLayers);

        return {
            cpuRam: calculateTensorsSize(cpu, this._llama),
            gpuVram: calculateTensorsSize(gpu, this._llama)
        };
    }

    /**
     * Estimates the memory required to create a context of the given parameters based on the implementation details of `llama.cpp`.
     * The calculation doesn't include a precise estimation of the graph overhead memory, so it uses a rough estimate for that.
     * The estimation for the graph overhead memory will be improved in the future to be more precise, but it's good enough for now.
     */
    public estimateContextResourceRequirements({
        contextSize, modelGpuLayers, batchSize, sequences, isEmbeddingContext = false, includeGraphOverhead = true
    }: {
        contextSize: number, modelGpuLayers: number, batchSize?: number, sequences?: number, isEmbeddingContext?: boolean,
        includeGraphOverhead?: boolean
    }): GgufInsightsResourceRequirements {
        if (sequences == null) sequences = getDefaultContextSequences();
        if (batchSize == null) batchSize = getDefaultContextBatchSize({contextSize, sequences});

        const actualContextSize = contextSize * sequences;

        const totalLayers = this.totalLayers;
        const finalGpuLayers = Math.max(0, Math.min(modelGpuLayers ?? totalLayers, totalLayers));
        const finalCpuLayers = totalLayers - finalGpuLayers;
        const llmData = this.ggufFileInfo.architectureMetadata;

        const vocabularySize = llmData.vocab_size ?? this.ggufFileInfo.metadata.tokenizer.ggml.tokens.length;
        const logitsSize = vocabularySize * batchSize;
        const embedSize = isEmbeddingContext
            ? (llmData.embedding_length ?? 0) * batchSize
            : 0;

        const sizeTBytes = 8; // sizeof(size_t)
        const floatBytes = 4; // sizeof(float)
        const uint32TBytes = 4; // sizeof(uint32_t)
        const int32TBytes = 4; // sizeof(int32_t)

        // source: `llama_get_state_size` in `llama.cpp`
        const sRngSize = sizeTBytes;
        const sRng = this._llama._consts.llamaMaxRngState;
        const sNOutputs = sizeTBytes;
        const sNOutputPos = batchSize * int32TBytes;
        const sLogitsSize = sizeTBytes;
        const sLogits = logitsSize * floatBytes;
        const sEmbeddingSize = sizeTBytes;
        const sEmbedding = embedSize * floatBytes;
        const sKvBufSize = sizeTBytes;
        const sKvHead = uint32TBytes;
        const sKvSize = uint32TBytes;
        const sKvUsed = uint32TBytes;
        const sKv = 2 * int32TBytes * modelGpuLayers * this._llama._consts.ggmlTensorOverhead;
        const sKvCell = this._llama._consts.llamaPosSize + sizeTBytes + this._llama._consts.llamaSeqIdSize;
        const kvSelfLength = this.ggufFileInfo.metadata.general.architecture === GgufArchitectureType.mamba
            ? Math.max(1, sequences)
            : actualContextSize;
        const sKvCells = kvSelfLength * sKvCell;

        const overheadMemory = (
            sRngSize +
            sRng +
            sNOutputs +
            sNOutputPos +
            sLogitsSize +
            sLogits +
            sEmbeddingSize +
            sEmbedding +
            sKvBufSize +
            sKvHead +
            sKvSize +
            sKvUsed +
            sKv +
            sKvCells
        );

        // Estimates the memory allocated by `ggml_backend_sched_reserve` in `llama_new_context_with_model` in `llama.cpp`.
        // If you read this line and have better insights on how to estimate this memory, please open a PR to improve it :)
        const estimateGraphOverheadMemory = () => {
            const s1MB = Math.pow(1024, 2);
            const tensorInfo = this.ggufFileInfo.tensorInfo ?? [];

            let defaultCalculationAdjustment = 0;

            if (batchSize == null)
                return 0;

            if (this.ggufFileInfo.metadata.general.architecture === GgufArchitectureType.llama) {
                const expertCount = this.ggufFileInfo.architectureMetadata.expert_count ?? 0;
                const headCount = this.ggufFileInfo.architectureMetadata.attention?.head_count ?? 0;
                const embeddingLength = llmData.embedding_length ?? 0;

                if (expertCount > 0) {
                    const expertsUsedCount = this.ggufFileInfo.architectureMetadata.expert_used_count ?? 2;

                    return int32TBytes * batchSize * (((expertsUsedCount + 1) * embeddingLength) + (actualContextSize * headCount));
                }

                return int32TBytes * batchSize * (embeddingLength + (actualContextSize * headCount));
            } else if (this.ggufFileInfo.metadata.general.architecture === GgufArchitectureType.qwen2) {
                if (modelGpuLayers === this.totalLayers) {
                    defaultCalculationAdjustment -= (s1MB * 340) * (
                        this.trainContextSize == null
                            ? 1
                            : actualContextSize / this.trainContextSize
                    );
                } else {
                    defaultCalculationAdjustment -= (s1MB * 250) + (
                        (s1MB * 50) * (
                            this.trainContextSize == null
                                ? 1
                                : actualContextSize / this.trainContextSize
                        )
                    );
                }
            } else if (this.ggufFileInfo.metadata.general.architecture === GgufArchitectureType.gemma) {
                // only works properly when all layers are on the GPU, which is why it's commented out:
                // return int32TBytes * batchSize * ((llmData.embedding_length ?? 0));

                if (modelGpuLayers === this.totalLayers) {
                    defaultCalculationAdjustment += (s1MB * 40) - (
                        (s1MB * 270) * (
                            this.trainContextSize == null
                                ? 1
                                : actualContextSize / this.trainContextSize
                        )
                    );
                } else {
                    defaultCalculationAdjustment += -(s1MB * 550) + (
                        (s1MB * 150) * (
                            this.trainContextSize == null
                                ? 1
                                : Math.max(0, (1 - (actualContextSize / this.trainContextSize)))
                        )
                    );
                }
            } else if (this.ggufFileInfo.metadata.general.architecture === GgufArchitectureType.stablelm) {
                const headCount = this.ggufFileInfo.architectureMetadata.attention?.head_count ?? 0;

                return (int32TBytes * batchSize * actualContextSize * headCount) - (50 * s1MB);

                // if (modelGpuLayers === this.totalLayers) {
                //     defaultCalculationAdjustment += -(s1MB * 20) + (
                //         (s1MB * 250) * (
                //             this.trainContextSize == null
                //                 ? 1
                //                 : actualContextSize / this.trainContextSize
                //         )
                //     );
                // } else {
                //     defaultCalculationAdjustment += -(s1MB * 40) + (
                //         (s1MB * 300) * (
                //             this.trainContextSize == null
                //                 ? 1
                //                 : actualContextSize / this.trainContextSize
                //         )
                //     );
                // }
            }

            const totalElements = tensorInfo.length === 0
                ? this.totalLayers * (
                    (
                        (llmData.embedding_length ?? 0) +
                        (llmData.feed_forward_length ?? 0)
                    ) / 2
                )
                : tensorInfo.reduce((res, tensor) => {
                    return res + tensor.dimensions.reduce((res: number, dim) => res + Number(dim), 0);
                }, 0);

            // magic numbers for estimation. will be improved in the future
            return (totalElements * 77.655 * (actualContextSize / 4096)) + defaultCalculationAdjustment;
        };

        const graphOverheadMemory = !includeGraphOverhead
            ? 0
            : estimateGraphOverheadMemory();

        const usingGpu = finalGpuLayers !== 0;

        const cpuRam = (
            !usingGpu
                ? (overheadMemory + graphOverheadMemory)
                : 0
        ) +
            this._estimateKvMemorySizeInBytes(actualContextSize, finalCpuLayers);
        const gpuVram = usingGpu
            ? (
                overheadMemory +
                graphOverheadMemory +
                this._estimateKvMemorySizeInBytes(
                    actualContextSize,
                    finalGpuLayers < totalLayers
                        ? (finalGpuLayers + 1)
                        : finalGpuLayers
                )
            )
            : 0;

        return {
            cpuRam,
            gpuVram
        };
    }

    /**
     * Get the split tensor resources for CPU and GPU based on the number of GPU layers
     * @internal
     */
    public _getTensorResourceSplit(gpuLayers: number): {
        cpu: GgufTensorInfo[],
        gpu: GgufTensorInfo[]
    } {
        const tensorInfo = this.ggufFileInfo.tensorInfo ?? [];

        if (gpuLayers === 0) {
            return {
                cpu: tensorInfo,
                gpu: []
            };
        }

        const gpuTensors: GgufTensorInfo[] = [];
        const cpuTensors: GgufTensorInfo[] = [];

        for (const singleTensorInfo of tensorInfo) {
            const {layerNumber} = parseTensorName(singleTensorInfo.name);

            if (gpuLayers !== this.totalLayers) {
                const architecture = this.ggufFileInfo.metadata?.general?.architecture;

                if (architecture === GgufArchitectureType.qwen2 || architecture === GgufArchitectureType.gemma) {
                    if (layerNumber != null && layerNumber < gpuLayers)
                        gpuTensors.push(singleTensorInfo);
                    else
                        cpuTensors.push(singleTensorInfo);

                    continue;
                }
            }

            if (layerNumber == null || layerNumber < gpuLayers)
                gpuTensors.push(singleTensorInfo);
            else
                cpuTensors.push(singleTensorInfo);
        }

        return {
            cpu: cpuTensors,
            gpu: gpuTensors
        };
    }

    /** @internal */
    public _determineNumberOfLayersFromTensorInfo(): number {
        const layerNumbers = new Set<number>();

        for (const singleTensorInfo of (this.ggufFileInfo.tensorInfo ?? [])) {
            const {layerNumber} = parseTensorName(singleTensorInfo.name);

            if (layerNumber != null)
                layerNumbers.add(layerNumber);
        }

        return layerNumbers.size;
    }

    /** @internal */
    public _getFileLayers() {
        return this.ggufFileInfo.architectureMetadata.block_count ?? this._determineNumberOfLayersFromTensorInfo();
    }

    /** @internal */
    public _estimateKvMemorySizeInBytes(contextSize: number, layers: number) {
        // source: `llama_kv_cache_init` in `llama.cpp`
        const nHead = this.ggufFileInfo.architectureMetadata.attention?.head_count ?? 0;
        const nEmbd = this.ggufFileInfo.architectureMetadata.embedding_length ?? 0;
        const nEmbdHeadK = this.ggufFileInfo.architectureMetadata.attention?.key_length ?? ((nHead == 0) ? 0 : (nEmbd / nHead));
        const nHeadKv = this.ggufFileInfo.architectureMetadata.attention?.head_count_kv ?? nHead;
        const modelNEmbdKGqa = nEmbdHeadK * nHeadKv;

        const ssmDConv = this.ggufFileInfo.architectureMetadata.ssm?.conv_kernel ?? 0;
        const ssmDInner = this.ggufFileInfo.architectureMetadata.ssm?.inner_size ?? 0;
        const modelNEmbdKS = (ssmDConv > 0 ? (ssmDConv - 1) : 0) * ssmDInner;

        const nEmbdHeadV = this.ggufFileInfo.architectureMetadata.attention?.value_length ?? ((nHead == 0) ? 0 : nEmbd / nHead);
        const modelNEmbdVGqa = nEmbdHeadV * nHeadKv;

        const ssmDState = this.ggufFileInfo.architectureMetadata.ssm?.state_size ?? 0;
        const modelNEmbdVS = ssmDState * ssmDInner;

        const totalNEmbdKGqa = modelNEmbdKGqa + modelNEmbdKS;
        const totalNEmbdVGqa = modelNEmbdVGqa + modelNEmbdVS;

        const keyTypeSize = this.ggufFileInfo.metadata.general.architecture === GgufArchitectureType.mamba
            // if `type_k` of `llama_context_params` changes to be configurable in `LlamaContext`,
            // this would have to depend on that value
            ? this._llama._consts.ggmlTypeF32Size
            : this._llama._consts.ggmlTypeF16Size;
        const valueTypeSize = this.ggufFileInfo.metadata.general.architecture === GgufArchitectureType.mamba
            // if `type_v` of `llama_context_params` changes to be configurable in `LlamaContext`,
            // this would have to depend on that value
            ? this._llama._consts.ggmlTypeF32Size
            : this._llama._consts.ggmlTypeF16Size;

        const keyTensorsSize = layers * totalNEmbdKGqa * contextSize * keyTypeSize;
        const valueTensorsSize = layers * totalNEmbdVGqa * contextSize * valueTypeSize;

        return keyTensorsSize + valueTensorsSize;
    }

    /**
     * @param ggufFileInfo
     * @param llama - If you already have a `Llama` instance, pass it to reuse it for the `GgufInsights` instance.
     * If you don't pass a `Llama` instance, a basic `Llama` instance is created as a fallback - it's a slim instance that
     * doesn't instantiate a `llama.cpp` backend, so it won't utilize the GPU at all, and be shared with other `GgufInsights` instances
     * that need a fallback `Llama` instance.
     */
    public static async from(ggufFileInfo: GgufFileInfo, llama?: Llama) {
        let resolvedLlama = llama;
        if (resolvedLlama == null)
            resolvedLlama = await getLlamaWithoutBackend();

        return new GgufInsights(ggufFileInfo, resolvedLlama);
    }
}

function parseTensorName(tensorName?: string): {
    layerNumber: number | undefined
} {
    if (tensorName == null)
        return {layerNumber: undefined};

    const layerTensorPrefix = "blk.";
    if (!tensorName.startsWith(layerTensorPrefix))
        return {layerNumber: undefined};

    const dotIndex = tensorName.indexOf(".", layerTensorPrefix.length);
    const layerNumberString = tensorName.slice(
        layerTensorPrefix.length,
        dotIndex < 0
            ? tensorName.length
            : dotIndex
    );

    const layerNumber = parseInt(layerNumberString);
    if (Number.isFinite(layerNumber))
        return {layerNumber};

    return {layerNumber: undefined};
}

function calculateTensorsSize(tensorsInfo: GgufTensorInfo[], llama: Llama) {
    let size = 0;
    for (const tensorInfo of tensorsInfo)
        size += calculateTensorSize(tensorInfo, llama);

    return size;
}

function calculateTensorSize(tensor: GgufTensorInfo, llama: Llama) {
    const typeSize = llama._bindings.getTypeSizeForGgmlType(tensor.ggmlType);
    const blockSize = llama._bindings.getBlockSizeForGgmlType(tensor.ggmlType);
    const ggmlMaxDims = llama._consts.ggmlMaxDims;

    if (typeSize == null || blockSize == null)
        throw new Error("Invalid type or block size");

    const {ne, nb} = getTensorNeAndNb(tensor, {typeSize, blockSize, ggmlMaxDims});

    if (blockSize === 1) {
        let totalBytes = typeSize;
        for (let i = 0; i < ggmlMaxDims; i++) {
            totalBytes += (ne[i] - 1) * nb[i];
        }

        return totalBytes;
    } else {
        let totalBytes = Math.floor((ne[0] * nb[0]) / blockSize);
        for (let i = 1; i < ggmlMaxDims; i++) {
            totalBytes += (ne[i] - 1) * nb[i];
        }

        return totalBytes;
    }
}

function getTensorNeAndNb(tensor: GgufTensorInfo, {
    typeSize, blockSize, ggmlMaxDims
}: {
    typeSize: number, blockSize: number, ggmlMaxDims: number
}) {
    // number of elements
    // source: `ggml_new_tensor_impl` in `ggml.c`
    const ne = [
        ...tensor.dimensions,
        ...(Array(Math.max(0, ggmlMaxDims - tensor.dimensions.length)).fill(1))
    ].slice(0, ggmlMaxDims);

    // number of bytes
    // source: `ggml_new_tensor_impl` in `ggml.c`
    const nb = [
        typeSize,
        Math.floor(typeSize * (ne[0] / blockSize)),
        ...Array(ggmlMaxDims - 2).fill(0)
    ];
    for (let i = 2; i < ggmlMaxDims; i++) {
        nb[i] = nb[i - 1] * ne[i - 1];
    }

    return {
        ne,
        nb
    };
}
