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
    llamaGpu, llamaSupportsGpuOffloading, defaultContextFlashAttention, defaultContextSwaFullCache, useMmap
}: {
    ggufInsights: GgufInsights, ignoreMemorySafetyChecks?: boolean,
    getVramState(): Promise<{total: number, free: number}>, llamaVramPaddingSize: number, llamaGpu: BuildGpu,
    llamaSupportsGpuOffloading: boolean, defaultContextFlashAttention: boolean, defaultContextSwaFullCache: boolean, useMmap?: boolean
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
            defaultContextFlashAttention,
            defaultContextSwaFullCache,
            useMmap
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
            defaultContextFlashAttention,
            defaultContextSwaFullCache,
            useMmap
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
    defaultContextFlashAttention,
    defaultContextSwaFullCache,
    useMmap
}: {
    ggufInsights: GgufInsights,
    freeVram: number,
    fitContext?: {contextSize?: number, embeddingContext?: boolean},
    minGpuLayers?: number,
    maxGpuLayers?: number,
    defaultContextFlashAttention: boolean,
    defaultContextSwaFullCache: boolean,
    useMmap?: boolean
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
                defaultContextFlashAttention,
                defaultContextSwaFullCache,
                useMmap
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
    gpuLayers, ggufInsights, currentVram, fitContext, defaultContextFlashAttention = false, defaultContextSwaFullCache = false, useMmap
}: {
    gpuLayers: number, ggufInsights: GgufInsights, currentVram: number, fitContext?: {contextSize?: number, embeddingContext?: boolean},
    defaultContextFlashAttention: boolean, defaultContextSwaFullCache: boolean, useMmap?: boolean
}) {
    const modelVram = ggufInsights.estimateModelResourceRequirements({
        gpuLayers,
        useMmap
    }).gpuVram;

    if (modelVram > currentVram)
        return null;

    if (fitContext != null && fitContext.contextSize != null) {
        const contextVram = ggufInsights.estimateContextResourceRequirements({
            contextSize: fitContext.contextSize,
            batchSize: getDefaultContextBatchSize({contextSize: fitContext.contextSize, sequences: 1}),
            modelGpuLayers: gpuLayers,
            sequences: 1,
            isEmbeddingContext: fitContext.embeddingContext ?? false,
            flashAttention: defaultContextFlashAttention,
            swaFullCache: defaultContextSwaFullCache
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
        flashAttention: defaultContextFlashAttention,
        swaFullCache: defaultContextSwaFullCache
    });

    if (maxContext == null || modelVram + maxContext.vram > currentVram)
        return null;

    return {
        contextSize: maxContext.contextSize,
        contextVram: maxContext.vram,
        totalVram: modelVram + maxContext.vram
    };
}

function findMaxPossibleContextSizeForVram({gpuLayers, ggufInsights, vram, isEmbeddingContext, flashAttention, swaFullCache}: {
    gpuLayers: number, ggufInsights: GgufInsights, vram: number, isEmbeddingContext: boolean, flashAttention: boolean, swaFullCache: boolean
}) {
    const maxContextSize = getDefaultModelContextSize({trainContextSize: ggufInsights.trainContextSize});

    return findMaxValidValue({
        maxValue: maxContextSize,
        minValue: minAllowedContextSizeInCalculations,
        minStep: 1,
        test(contextSize) {
            const contextVram = ggufInsights.estimateContextResourceRequirements({
                contextSize,
                batchSize: getDefaultContextBatchSize({contextSize, sequences: 1}),
                modelGpuLayers: gpuLayers,
                sequences: 1,
                isEmbeddingContext,
                flashAttention,
                swaFullCache
            }).gpuVram;

            if (contextVram <= vram)
                return {
                    contextSize,
                    vram: contextVram
                };

            return null;
        }
    });
}

function findMaxValidValue<T>({
    maxValue,
    minValue,
    minStep = 1,
    test
}: {
    maxValue: number,
    minValue: number,
    minStep?: number,
    test(value: number): T | null
}): T | null {
    let step = -Math.max(minStep, Math.floor((maxValue - minValue) / 4));
    let bestValue: null | {value: number, result: T} = null;

    for (let value = maxValue; value >= minValue;) {
        const result: T | null = (bestValue != null && value === bestValue.value)
            ? bestValue.result
            : test(value);

        if (result != null) {
            if (bestValue == null || value >= bestValue.value) {
                bestValue = {value: value, result: result};

                if (step === -minStep)
                    break;
                else if (step < 0)
                    step = Math.max(minStep, Math.floor(-step / 2));
            }
        } else if (bestValue != null && value < bestValue.value) {
            value = bestValue.value;
            step = Math.max(minStep, Math.floor(Math.abs(step) / 2));
            continue;
        } else if (step > 0)
            step = -Math.max(minStep, Math.floor(step / 2));

        if (value === minValue && step === -minStep)
            break;

        value += step;
        if (value < minValue) {
            value = minValue;
            step = Math.max(minStep, Math.floor(Math.abs(step) / 2));
        } else if (value > maxValue) {
            value = maxValue;
            step = -Math.max(minStep, Math.floor(Math.abs(step) / 2));
        }
    }

    if (bestValue != null)
        return bestValue.result;

    return null;
}
