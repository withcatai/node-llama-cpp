import {LlamaModelOptions} from "../../../evaluator/LlamaModel/LlamaModel.js";
import {BuildGpu} from "../../../bindings/types.js";
import {InsufficientMemoryError} from "../../../utils/InsufficientMemoryError.js";
import {findFirstNonNullBestOptionAsync} from "../../../utils/findBestOption.js";
import {getDefaultContextBatchSize, getDefaultModelContextSize} from "../../../evaluator/LlamaContext/LlamaContext.js";
import {minAllowedContextSizeInCalculations} from "../../../config.js";
import {scoreLevels} from "./scoreLevels.js";
import type {LlamaContextOptions} from "../../../evaluator/LlamaContext/types.js";
import type {GgmlType} from "../../types/GgufTensorInfoTypes.js";
import type {GgufInsights, GgufInsightsSimulatorSession} from "../GgufInsights.js";

const fitContextExtraMemoryPaddingPercentage = 0.5;

export async function resolveModelGpuLayersOption(gpuLayers: LlamaModelOptions["gpuLayers"], options: {
    ggufInsights: GgufInsights, ignoreMemorySafetyChecks?: boolean,
    getVramState(): Promise<{total: number, free: number}>, llamaVramPaddingSize: number, llamaGpu: BuildGpu,
    llamaSupportsGpuOffloading: boolean, defaultContextFlashAttention: LlamaContextOptions["flashAttention"],
    defaultContextKvCacheKeyType?: GgmlType, defaultContextKvCacheValueType?: GgmlType, defaultContextSwaFullCache: boolean,
    useMmap?: boolean, simulatorSession?: GgufInsightsSimulatorSession, vramCapIsSet?: boolean
}): Promise<number> {
    const {
        ggufInsights, ignoreMemorySafetyChecks = false, getVramState, llamaVramPaddingSize,
        llamaGpu, llamaSupportsGpuOffloading, defaultContextFlashAttention,
        defaultContextKvCacheKeyType, defaultContextKvCacheValueType, defaultContextSwaFullCache, useMmap,
        simulatorSession: _simulatorSession, vramCapIsSet = false
    } = options;

    const simulatorSession = _simulatorSession ?? ggufInsights._createSimulatorSession();

    try {
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
            const maxLayersRequirements = await getVramRequiredForGpuLayers({
                gpuLayers: resolvedGpuLayers,
                ggufInsights,
                currentVram: vramState.free,
                defaultContextFlashAttention,
                defaultContextKvCacheKeyType,
                defaultContextKvCacheValueType,
                defaultContextSwaFullCache,
                useMmap,
                simulatorSession
            });
    
            if (maxLayersRequirements == null)
                throw new InsufficientMemoryError("Not enough VRAM to fit the model with the specified settings" + getCapErrorMessage(vramCapIsSet));
    
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
    
            const bestGpuLayersOption = await getBestGpuLayersForFreeVram({
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
                defaultContextKvCacheKeyType,
                defaultContextKvCacheValueType,
                defaultContextSwaFullCache,
                useMmap,
                simulatorSession
            });
    
            const hasGpuLayersRequirements = typeof gpuLayers === "object" &&
                (gpuLayers.min != null || gpuLayers.max != null || gpuLayers.fitContext?.contextSize != null);
    
            if (!ignoreMemorySafetyChecks && bestGpuLayersOption == null && hasGpuLayersRequirements)
                throw new InsufficientMemoryError("Not enough VRAM to fit the model with the specified settings" + getCapErrorMessage(vramCapIsSet));
    
            return bestGpuLayersOption ?? 0;
        }
    
        throw new Error(`Invalid gpuLayers value: ${gpuLayers}`);
    } finally {
        if (_simulatorSession == null)
            await simulatorSession.dispose();
    }
}

function getCapErrorMessage(vramCapIsSet: boolean) {
    if (vramCapIsSet)
        return " (VRAM cap is set, consider increasing or removing the cap to fit more layers)";

    return "";
}

async function getBestGpuLayersForFreeVram({
    ggufInsights,
    freeVram,
    fitContext,
    minGpuLayers,
    maxGpuLayers,
    defaultContextFlashAttention,
    defaultContextKvCacheKeyType,
    defaultContextKvCacheValueType,
    defaultContextSwaFullCache,
    useMmap,
    simulatorSession
}: {
    ggufInsights: GgufInsights,
    freeVram: number,
    fitContext?: {contextSize?: number, embeddingContext?: boolean},
    minGpuLayers?: number,
    maxGpuLayers?: number,
    defaultContextFlashAttention: LlamaContextOptions["flashAttention"],
    defaultContextKvCacheKeyType?: GgmlType,
    defaultContextKvCacheValueType?: GgmlType,
    defaultContextSwaFullCache: boolean,
    useMmap?: boolean,
    simulatorSession?: GgufInsightsSimulatorSession
}) {
    const minLayers = Math.floor(Math.max(0, minGpuLayers ?? 0));
    const maxLayers = Math.floor(Math.min(ggufInsights.totalLayers, maxGpuLayers ?? ggufInsights.totalLayers));

    return (await findFirstNonNullBestOptionAsync({
        prefill: Math.max(1, Math.min(100, Math.ceil((maxLayers - minLayers) / 3))),
        *generator() {
            for (let layers = maxLayers; layers >= minLayers; layers--) {
                yield {
                    gpuLayers: layers
                };
            }
        },
        async score(option) {
            const layersRequirements = await getVramRequiredForGpuLayers({
                gpuLayers: option.gpuLayers,
                ggufInsights,
                currentVram: freeVram,
                fitContext,
                defaultContextFlashAttention,
                defaultContextSwaFullCache,
                defaultContextKvCacheKeyType,
                defaultContextKvCacheValueType,
                useMmap,
                simulatorSession
            });

            if (layersRequirements == null)
                return null;

            return scoreGpuLayersAndContextCombination({gpuLayers: option.gpuLayers, contextSize: layersRequirements.contextSize}, {
                totalGpuLayers: ggufInsights.totalLayers,
                trainContextSize: getDefaultModelContextSize({trainContextSize: ggufInsights.trainContextSize})
            });
        }
    }))?.gpuLayers ?? null;
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

async function getVramRequiredForGpuLayers({
    gpuLayers, ggufInsights, currentVram, fitContext, defaultContextFlashAttention = "auto",
    defaultContextKvCacheKeyType, defaultContextKvCacheValueType, defaultContextSwaFullCache = false, useMmap,
    simulatorSession
}: {
    gpuLayers: number, ggufInsights: GgufInsights, currentVram: number, fitContext?: {contextSize?: number, embeddingContext?: boolean},
    defaultContextFlashAttention: LlamaContextOptions["flashAttention"], defaultContextKvCacheKeyType?: GgmlType, defaultContextKvCacheValueType?: GgmlType,
    defaultContextSwaFullCache: boolean, useMmap?: boolean,
    simulatorSession?: GgufInsightsSimulatorSession
}) {
    const heuristicFlashAttention = defaultContextFlashAttention === true;
    const modelVram = (await ggufInsights.estimateModelResourceRequirementsV2({
        gpuLayers,
        useMmap,
        _simulatorSession: simulatorSession
    })).gpuVram;

    if (modelVram > currentVram)
        return null;

    if (fitContext != null && fitContext.contextSize != null) {
        const contextVram = (await ggufInsights.estimateContextResourceRequirementsV2({
            contextSize: fitContext.contextSize,
            batchSize: getDefaultContextBatchSize({contextSize: fitContext.contextSize, sequences: 1}),
            modelGpuLayers: gpuLayers,
            sequences: 1,
            isEmbeddingContext: fitContext.embeddingContext ?? false,
            flashAttention: heuristicFlashAttention,
            kvCacheKeyType: defaultContextKvCacheKeyType,
            kvCacheValueType: defaultContextKvCacheValueType,
            swaFullCache: defaultContextSwaFullCache,
            
            _simulatorSession: simulatorSession,
            _useMmap: useMmap
        })).gpuVram;

        const totalVram = modelVram + contextVram;
        if (totalVram > currentVram)
            return null;

        return {
            contextSize: fitContext.contextSize,
            contextVram,
            totalVram
        };
    }

    const maxContext = await findMaxPossibleContextSizeForVram({
        gpuLayers,
        ggufInsights,
        vram: currentVram - modelVram,
        isEmbeddingContext: fitContext?.embeddingContext ?? false,
        flashAttention: heuristicFlashAttention,
        kvCacheKeyType: defaultContextKvCacheKeyType,
        kvCacheValueType: defaultContextKvCacheValueType,
        swaFullCache: defaultContextSwaFullCache,
        useMmap,
        simulatorSession
    });

    if (maxContext == null || modelVram + maxContext.vram > currentVram)
        return null;

    return {
        contextSize: maxContext.contextSize,
        contextVram: maxContext.vram,
        totalVram: modelVram + maxContext.vram
    };
}

async function findMaxPossibleContextSizeForVram({
    gpuLayers, ggufInsights, vram, isEmbeddingContext, flashAttention, kvCacheKeyType, kvCacheValueType, swaFullCache,
    useMmap, simulatorSession
}: {
    gpuLayers: number, ggufInsights: GgufInsights, vram: number, isEmbeddingContext: boolean, flashAttention: boolean,
    kvCacheKeyType?: GgmlType, kvCacheValueType?: GgmlType, swaFullCache: boolean, useMmap?: boolean,
    simulatorSession?: GgufInsightsSimulatorSession
}) {
    const maxContextSize = getDefaultModelContextSize({trainContextSize: ggufInsights.trainContextSize});

    return findMaxValidValue({
        maxValue: maxContextSize,
        minValue: minAllowedContextSizeInCalculations,
        minStep: 1,
        async test(contextSize) {
            const contextVram = (await ggufInsights.estimateContextResourceRequirementsV2({
                contextSize,
                batchSize: getDefaultContextBatchSize({contextSize, sequences: 1}),
                modelGpuLayers: gpuLayers,
                sequences: 1,
                isEmbeddingContext,
                flashAttention,
                kvCacheKeyType,
                kvCacheValueType,
                swaFullCache,

                _simulatorSession: simulatorSession,
                _useMmap: useMmap
            })).gpuVram;

            if (contextVram <= vram)
                return {
                    contextSize,
                    vram: contextVram
                };

            return null;
        }
    });
}

async function findMaxValidValue<T>({
    maxValue,
    minValue,
    minStep = 1,
    test
}: {
    maxValue: number,
    minValue: number,
    minStep?: number,
    test(value: number): Promise<T | null>
}): Promise<T | null> {
    let step = -Math.max(minStep, Math.floor((maxValue - minValue) / 4));
    let bestValue: null | {value: number, result: T} = null;

    for (let value = maxValue; value >= minValue;) {
        const result: T | null = (bestValue != null && value === bestValue.value)
            ? bestValue.result
            : await test(value);

        if (result != null) {
            if (bestValue == null || value >= bestValue.value) {
                bestValue = {value: value, result: result};

                if (step === -minStep || value === maxValue)
                    break;
                else if (step < 0)
                    step = Math.max(minStep, Math.floor(-step / 2));
            }
        } else if (bestValue != null && value < bestValue.value) {
            value = bestValue.value;
            step = Math.max(minStep, Math.floor(Math.abs(step) / 2));
        } else if (step > 0)
            step = -Math.max(minStep, Math.floor(step / 2));

        if (value === minValue && step === -minStep)
            break;

        value += step;
        if (value < minValue) {
            value = bestValue != null
                ? Math.max(bestValue.value, minValue)
                : minValue;
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
