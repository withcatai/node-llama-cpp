import {Llama} from "../bindings/Llama.js";
import {getLlamaWithoutBackend} from "../bindings/utils/getLlamaWithoutBackend.js";
import {getGgufMetadataLlmData} from "./utils/getGgufMetadataLlmData.js";
import {GgufFileInfo} from "./types/GgufFileInfoTypes.js";
import {GgufTensorInfo} from "./types/GgufTensorInfoTypes.js";

export class GgufInsights {
    /** @internal */ private readonly _llama: Llama;
    /** @internal */ private readonly _modelSize: number;
    public readonly ggufFileInfo: GgufFileInfo;

    private constructor(ggufFileInfo: GgufFileInfo, llama: Llama) {
        this._llama = llama;
        this.ggufFileInfo = ggufFileInfo;

        this._modelSize = calculateTensorsSize(ggufFileInfo.tensorInfo ?? [], llama);
    }

    public get totalLayers() {
        const llmData = getGgufMetadataLlmData(this.ggufFileInfo.metadata);

        return (llmData.block_count ?? this._determineNumberOfLayersFromTensorInfo()) + 1;
    }

    public get modelSize() {
        return this._modelSize;
    }

    public calculateModelResourceRequirements(gpuLayers: number) {
        const {cpu, gpu} = this.getTensorLoadSplit(gpuLayers);

        return {
            cpuRam: calculateTensorsSize(cpu, this._llama),
            gpuVram: calculateTensorsSize(gpu, this._llama)
        };
    }

    public getTensorLoadSplit(gpuLayers: number): {
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
