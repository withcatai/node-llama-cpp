import {LlamaModelOptions} from "../../../evaluator/LlamaModel/LlamaModel.js";
import {BuildGpu} from "../../../bindings/types.js";
import {InsufficientMemoryError} from "../../../utils/InsufficientMemoryError.js";
import {findBestOption} from "../../../utils/findBestOption.js";
import {getDefaultContextBatchSize, getDefaultModelContextSize} from "../../../evaluator/LlamaContext/LlamaContext.js";
import {minAllowedContextSizeInCalculations} from "../../../config.js";
import {scoreLevels} from "./scoreLevels.js";
import type {GgufInsights} from "../GgufInsights.js";

const fitContextExtraMemoryPaddingPercentage = 0.5;

export async function resolveModelGpuLayersOption(gpuLayers: LlamaModelOptions["gpuLayers"], {
    ggufInsights, ignoreMemorySafetyChecks = false, getVramState, llamaVramPaddingSize,
    llamaGpu, llamaSupportsGpuOffloading, defaultContextFlashAttention
}: {
    ggufInsights: GgufInsights, ignoreMemorySafetyChecks?: boolean,
    getVramState(): Promise<{total: number, free: number}>, llamaVramPaddingSize: number, llamaGpu: BuildGpu,
    llamaSupportsGpuOffloading: boolean, defaultContextFlashAttention: boolean
}): Promise<number> {
    if (gpuLayers == null)
        gpuLayers = "auto";

    if (!llamaSupportsGpuOffloading)
        return 0;

    if (gpuLayers === "max" || typeof gpuLayers === "number") {
        const resolvedGpuLayers = typeof gpuLayers === "number"
            ? Math.max(0, Math.min(ggufInsights.totalLayers, gpuLayers))
            : ggufInsights.totalLayers;

        if (ignoreMemorySafetyChecks)
            return resolvedGpuLayers;

        const vramState = await getVramState();
        const maxLayersRequirements = getVramRequiredForGpuLayers({
            gpuLayers: resolvedGpuLayers,
            ggufInsights,
            currentVram: vramState.free,
            defaultContextFlashAttention
        });

        if (maxLayersRequirements == null)
            throw new InsufficientMemoryError("Not enough VRAM to fit the model with the specified settings");

        return resolvedGpuLayers;
    } else if (gpuLayers === "auto" || typeof gpuLayers === "object") {
        if (llamaGpu === false)
            return 0;

        const vramState = await getVramState();
        if (vramState.total === 0)
            return 0;

        let freeVram = vramState.free;
        if (typeof gpuLayers === "object" && gpuLayers.fitContext?.contextSize != null) {
            freeVram -= llamaVramPaddingSize * fitContextExtraMemoryPaddingPercentage;

            if (freeVram < 0)
                freeVram = 0;
        }

        const bestGpuLayersOption = getBestGpuLayersForFreeVram({
            ggufInsights,
            freeVram,
            fitContext: typeof gpuLayers === "object"
                ? gpuLayers.fitContext
                : undefined,
            minGpuLayers: typeof gpuLayers === "object"
                ? gpuLayers.min
                : undefined,
            maxGpuLayers: typeof gpuLayers === "object"
                ? gpuLayers.max
                : undefined,
            defaultContextFlashAttention
        });

        const hasGpuLayersRequirements = typeof gpuLayers === "object" &&
            (gpuLayers.min != null || gpuLayers.max != null || gpuLayers.fitContext?.contextSize != null);

        if (!ignoreMemorySafetyChecks && bestGpuLayersOption == null && hasGpuLayersRequirements)
            throw new InsufficientMemoryError("Not enough VRAM to fit the model with the specified settings");

        return bestGpuLayersOption ?? 0;
    }

    throw new Error(`Invalid gpuLayers value: ${gpuLayers}`);
}

function getBestGpuLayersForFreeVram({
    ggufInsights,
    freeVram,
    fitContext,
    minGpuLayers,
    maxGpuLayers,
    defaultContextFlashAttention
}: {
    ggufInsights: GgufInsights,
    freeVram: number,
    fitContext?: {contextSize?: number, embeddingContext?: boolean},
    minGpuLayers?: number,
    maxGpuLayers?: number,
    defaultContextFlashAttention: boolean
}) {
    return findBestOption({
        *generator() {
            const minLayers = Math.floor(Math.max(0, minGpuLayers ?? 0));
            const maxLayers = Math.floor(Math.min(ggufInsights.totalLayers, maxGpuLayers ?? ggufInsights.totalLayers));

            for (let layers = maxLayers; layers >= minLayers; layers--) {
                yield {
                    gpuLayers: layers
                };
            }
        },
        score(option) {
            const layersRequirements = getVramRequiredForGpuLayers({
                gpuLayers: option.gpuLayers,
                ggufInsights,
                currentVram: freeVram,
                fitContext,
                defaultContextFlashAttention
            });

            if (layersRequirements == null)
                return null;

            return scoreGpuLayersAndContextCombination({gpuLayers: option.gpuLayers, contextSize: layersRequirements.contextSize}, {
                totalGpuLayers: ggufInsights.totalLayers,
                trainContextSize: getDefaultModelContextSize({trainContextSize: ggufInsights.trainContextSize})
            });
        }
    })?.gpuLayers ?? null;
}

function scoreGpuLayersAndContextCombination({gpuLayers, contextSize}: {gpuLayers: number, contextSize: number}, {
    totalGpuLayers, trainContextSize
}: {
    totalGpuLayers: number, trainContextSize: number
}) {
    function scoreGpuLayers() {
        return scoreLevels(gpuLayers, [{
            start: 0,
            points: 4
        }, {
            start: 1,
            points: 26
        }, {
            start: totalGpuLayers,
            points: 14,
            end: totalGpuLayers
        }]);
    }

    function scoreContextSize() {
        const gpuLayersPercentage = gpuLayers / totalGpuLayers;

        return scoreLevels(contextSize, [{
            start: 0,
            points: 2
        }, {
            start: 1024,
            points: 4
        }, {
            start: 2048,
            points: gpuLayersPercentage < 0.1 ? 1 : 8
        }, {
            start: 4096,
            points: gpuLayersPercentage < 0.3 ? 4 : 16
        }, {
            start: 8192,
            points: gpuLayersPercentage < 0.6 ? 1 : 8,
            end: Math.max(trainContextSize, 16384)
        }]);
    }

    return scoreGpuLayers() + scoreContextSize();
}

function getVramRequiredForGpuLayers({
    gpuLayers, ggufInsights, currentVram, fitContext, defaultContextFlashAttention = false
}: {
    gpuLayers: number, ggufInsights: GgufInsights, currentVram: number, fitContext?: {contextSize?: number, embeddingContext?: boolean},
    defaultContextFlashAttention: boolean
}) {
    const modelVram = ggufInsights.estimateModelResourceRequirements({gpuLayers}).gpuVram;

    if (modelVram > currentVram)
        return null;

    if (fitContext != null && fitContext.contextSize != null) {
        const contextVram = ggufInsights.estimateContextResourceRequirements({
            contextSize: fitContext.contextSize,
            batchSize: getDefaultContextBatchSize({contextSize: fitContext.contextSize, sequences: 1}),
            modelGpuLayers: gpuLayers,
            sequences: 1,
            isEmbeddingContext: fitContext.embeddingContext ?? false,
            flashAttention: defaultContextFlashAttention
        }).gpuVram;

        const totalVram = modelVram + contextVram;
        if (totalVram > currentVram)
            return null;

        return {
            contextSize: fitContext.contextSize,
            contextVram,
            totalVram
        };
    }

    const maxContext = findMaxPossibleContextSizeForVram({
        gpuLayers,
        ggufInsights,
        vram: currentVram - modelVram,
        isEmbeddingContext: fitContext?.embeddingContext ?? false,
        flashAttention: defaultContextFlashAttention
    });

    if (maxContext == null || modelVram + maxContext.vram > currentVram)
        return null;

    return {
        contextSize: maxContext.contextSize,
        contextVram: maxContext.vram,
        totalVram: modelVram + maxContext.vram
    };
}

function findMaxPossibleContextSizeForVram({gpuLayers, ggufInsights, vram, isEmbeddingContext, flashAttention}: {
    gpuLayers: number, ggufInsights: GgufInsights, vram: number, isEmbeddingContext: boolean, flashAttention: boolean
}) {
    const maxContextSize = getDefaultModelContextSize({trainContextSize: ggufInsights.trainContextSize});

    for (let contextSize = maxContextSize; contextSize >= minAllowedContextSizeInCalculations; contextSize--) {
        const contextVram = ggufInsights.estimateContextResourceRequirements({
            contextSize,
            batchSize: getDefaultContextBatchSize({contextSize, sequences: 1}),
            modelGpuLayers: gpuLayers,
            sequences: 1,
            isEmbeddingContext,
            flashAttention
        }).gpuVram;

        if (contextVram <= vram)
            return {
                contextSize,
                vram: contextVram
            };
    }

    return null;
}
