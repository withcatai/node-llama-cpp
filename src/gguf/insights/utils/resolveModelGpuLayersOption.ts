import {LlamaModelOptions} from "../../../evaluator/LlamaModel/LlamaModel.js";
import {BuildGpu} from "../../../bindings/types.js";
import {InsufficientMemoryError} from "../../../utils/InsufficientMemoryError.js";
import {findFirstNonNullBestOptionAsync} from "../../../utils/findBestOption.js";
import {getDefaultContextBatchSize, getDefaultModelContextSize} from "../../../evaluator/LlamaContext/LlamaContext.js";
import {minAllowedContextSizeInCalculations} from "../../../config.js";
import {ProgressTracker, ProgressTrackerTask} from "../../../utils/ProgressTracker.js";
import {scoreLevels} from "./scoreLevels.js";
import type {LlamaContextOptions} from "../../../evaluator/LlamaContext/types.js";
import type {GgmlType} from "../../types/GgufTensorInfoTypes.js";
import type {GgufInsights, GgufInsightsSimulatorSession} from "../GgufInsights.js";

const fitContextExtraMemoryPaddingPercentage = 0.5;
const vramWastePercentageToPreferDisablingMmap = 0.2;
const contextSizeMissPercentageToPreferDisablingMmap = 0.2;

export async function resolveModelGpuLayersOption(gpuLayers: LlamaModelOptions["gpuLayers"], options: {
    ggufInsights: GgufInsights, ignoreMemorySafetyChecks?: boolean,
    getVramState(): Promise<{total: number, free: number}>, llamaVramPaddingSize: number, llamaGpu: BuildGpu,
    llamaSupportsGpuOffloading: boolean, defaultContextFlashAttention: LlamaContextOptions["flashAttention"],
    defaultContextKvCacheKeyType?: GgmlType, defaultContextKvCacheValueType?: GgmlType, defaultContextSwaFullCache: boolean,
    useMmap?: "auto" | boolean, simulatorSession?: GgufInsightsSimulatorSession, vramCapIsSet?: boolean,
    onProgress?(step: number, totalSteps: number): void
}): Promise<{gpuLayers: number, useMmap: boolean}> {
    const {
        ggufInsights, ignoreMemorySafetyChecks = false, getVramState, llamaVramPaddingSize,
        llamaGpu, llamaSupportsGpuOffloading, defaultContextFlashAttention,
        defaultContextKvCacheKeyType, defaultContextKvCacheValueType, defaultContextSwaFullCache, useMmap = "auto",
        simulatorSession: _simulatorSession, vramCapIsSet = false, onProgress
    } = options;

    const progressTracker = onProgress != null
        ? new ProgressTracker(onProgress)
        : undefined;

    const simulatorSession = _simulatorSession ?? ggufInsights._createSimulatorSession();

    try {
        if (gpuLayers == null)
            gpuLayers = "auto";
    
        if (!llamaSupportsGpuOffloading)
            return {gpuLayers: 0, useMmap: useMmap === "auto" ? ggufInsights._getUseMmap() : useMmap};
    
        if (gpuLayers === "max" || typeof gpuLayers === "number") {
            const resolvedGpuLayers = typeof gpuLayers === "number"
                ? Math.max(0, Math.min(ggufInsights.totalLayers, gpuLayers))
                : ggufInsights.totalLayers;
            const vramState = await getVramState();

            const getVramNeeds = async (useMmap: boolean, progressTask?: ProgressTrackerTask) => {
                try {
                    return await getVramRequiredForGpuLayers({
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
                } finally {
                    progressTask?.update(1);
                }
            };
            const getPreferredResolvedLayers = async () => {
                if (useMmap !== "auto")
                    return await getVramNeeds(useMmap, progressTracker?.createTask(1));

                const [
                    withMmap,
                    withoutMmap
                ] = await Promise.all([
                    getVramNeeds(true, progressTracker?.createTask(1)),
                    getVramNeeds(false)
                ]);

                if (withoutMmap != null && withMmap == null)
                    return withoutMmap;
                else if (withoutMmap != null && withMmap != null &&
                    typeof gpuLayers === "number" &&
                    withoutMmap.totalVram <= withMmap.totalVram * (1 - vramWastePercentageToPreferDisablingMmap)
                )
                    return withoutMmap;
                else if (withoutMmap != null && withMmap != null &&
                    withoutMmap.gpuLayers > withMmap.gpuLayers
                )
                    return withoutMmap;
                else if (withoutMmap != null && withMmap != null &&
                    withoutMmap.contextSize >= withMmap.contextSize * (1 + contextSizeMissPercentageToPreferDisablingMmap)
                )
                    return withoutMmap;

                return withMmap ?? withoutMmap;
            };
    
            if (ignoreMemorySafetyChecks)
                return {
                    gpuLayers: resolvedGpuLayers,
                    useMmap: useMmap === "auto"
                        ? gpuLayers === "max"
                            ? true
                            : (await getPreferredResolvedLayers())?.useMmap ?? false
                        : useMmap
                };
    
            const maxLayersRequirements = (useMmap !== "auto" || gpuLayers === "max")
                ? await getVramNeeds(
                    useMmap === "auto"
                        ? ggufInsights._getUseMmap()
                        : useMmap,
                    progressTracker?.createTask(1)
                )
                : await getPreferredResolvedLayers();
    
            if (maxLayersRequirements == null)
                throw new InsufficientMemoryError("Not enough VRAM to fit the model with the specified settings" + getCapErrorMessage(vramCapIsSet));
    
            return {
                gpuLayers: resolvedGpuLayers,
                useMmap: maxLayersRequirements.useMmap
            };
        } else if (gpuLayers === "auto" || typeof gpuLayers === "object") {
            if (llamaGpu === false)
                return {gpuLayers: 0, useMmap: useMmap === "auto" ? ggufInsights._getUseMmap() : useMmap};
    
            const vramState = await getVramState();
            if (vramState.total === 0)
                return {gpuLayers: 0, useMmap: useMmap === "auto" ? ggufInsights._getUseMmap() : useMmap};
    
            let freeVram = vramState.free;
            if (typeof gpuLayers === "object" && gpuLayers.fitContext?.contextSize != null) {
                freeVram -= llamaVramPaddingSize * fitContextExtraMemoryPaddingPercentage;
    
                if (freeVram < 0)
                    freeVram = 0;
            }

            const getGpuLayersForMmapOptions = (useMmap: boolean, skipProgress: boolean = false) => getBestGpuLayersForFreeVram({
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
                simulatorSession,
                progressTask: skipProgress
                    ? undefined
                    : progressTracker?.createTask()
            });
            const getGpuLayersForMmapOptionsWithResourceRequirements = async (useMmap: boolean, skipProgress: boolean = false) => {
                const resolvedLayers = await getGpuLayersForMmapOptions(useMmap, skipProgress);
                if (resolvedLayers == null)
                    return null;

                return getVramRequiredForGpuLayers({
                    gpuLayers: resolvedLayers,
                    ggufInsights,
                    currentVram: freeVram,
                    fitContext: typeof gpuLayers === "object"
                        ? gpuLayers.fitContext
                        : undefined,
                    defaultContextFlashAttention,
                    defaultContextSwaFullCache,
                    defaultContextKvCacheKeyType,
                    defaultContextKvCacheValueType,
                    useMmap,
                    simulatorSession
                });
            };
            const getPreferredResolvedLayers = async () => {
                if (useMmap !== "auto")
                    return {
                        gpuLayers: await getGpuLayersForMmapOptions(useMmap),
                        useMmap
                    };

                const [
                    withMmap,
                    withoutMmap
                ] = await Promise.all([
                    getGpuLayersForMmapOptionsWithResourceRequirements(true),
                    getGpuLayersForMmapOptionsWithResourceRequirements(false, true)
                ]);

                if (withoutMmap != null && withMmap == null)
                    return withoutMmap;
                else if (withoutMmap != null && withMmap != null &&
                    typeof gpuLayers === "number" &&
                    withoutMmap.totalVram <= withMmap.totalVram * (1 - vramWastePercentageToPreferDisablingMmap)
                )
                    return withoutMmap;
                else if (withoutMmap != null && withMmap != null &&
                    withoutMmap.gpuLayers > withMmap.gpuLayers
                )
                    return withoutMmap;
                else if (withoutMmap != null && withMmap != null &&
                    withoutMmap.contextSize >= withMmap.contextSize * (1 + contextSizeMissPercentageToPreferDisablingMmap)
                )
                    return withoutMmap;

                return withMmap ?? withoutMmap;
            };
    
            const bestGpuLayersOption = await getPreferredResolvedLayers();
    
            const hasGpuLayersRequirements = typeof gpuLayers === "object" &&
                (gpuLayers.min != null || gpuLayers.max != null || gpuLayers.fitContext?.contextSize != null);
    
            if (!ignoreMemorySafetyChecks && bestGpuLayersOption == null && hasGpuLayersRequirements)
                throw new InsufficientMemoryError("Not enough VRAM to fit the model with the specified settings" + getCapErrorMessage(vramCapIsSet));
    
            return {
                gpuLayers: bestGpuLayersOption?.gpuLayers ?? 0,
                useMmap: bestGpuLayersOption?.useMmap ?? (
                    useMmap === "auto"
                        ? ggufInsights._getUseMmap()
                        : useMmap
                )
            };
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
    simulatorSession,
    progressTask
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
    simulatorSession?: GgufInsightsSimulatorSession,
    progressTask?: ProgressTrackerTask
}) {
    const minLayers = Math.floor(Math.max(0, minGpuLayers ?? 0));
    const maxLayers = Math.floor(Math.min(ggufInsights.totalLayers, maxGpuLayers ?? ggufInsights.totalLayers));

    progressTask?.update(0, Math.ceil(Math.sqrt(maxLayers - minLayers)));
    let scoredLayers = 0;

    try {
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
                scoredLayers++;
                progressTask?.update(scoredLayers);

                if (layersRequirements == null)
                    return null;

                return scoreGpuLayersAndContextCombination({gpuLayers: option.gpuLayers, contextSize: layersRequirements.contextSize}, {
                    totalGpuLayers: ggufInsights.totalLayers,
                    trainContextSize: getDefaultModelContextSize({trainContextSize: ggufInsights.trainContextSize})
                });
            }
        }))?.gpuLayers ?? null;
    } finally {
        progressTask?.update(progressTask.status.estimated);
    }
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
            points: 8
        }, {
            start: 512,
            points: 8
        }, {
            start: 1024,
            points: 8
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
    defaultContextKvCacheKeyType, defaultContextKvCacheValueType, defaultContextSwaFullCache = false, useMmap = ggufInsights._getUseMmap(),
    simulatorSession
}: {
    gpuLayers: number, ggufInsights: GgufInsights, currentVram: number, fitContext?: {contextSize?: number, embeddingContext?: boolean},
    defaultContextFlashAttention: LlamaContextOptions["flashAttention"], defaultContextKvCacheKeyType?: GgmlType, defaultContextKvCacheValueType?: GgmlType,
    defaultContextSwaFullCache: boolean, useMmap?: boolean,
    simulatorSession?: GgufInsightsSimulatorSession
}) {
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
            flashAttention: defaultContextFlashAttention,
            kvCacheKeyType: defaultContextKvCacheKeyType,
            kvCacheValueType: defaultContextKvCacheValueType,
            swaFullCache: defaultContextSwaFullCache,
            
            _simulatorSession: simulatorSession,
            useMmap
        })).gpuVram;

        const totalVram = modelVram + contextVram;
        if (totalVram > currentVram)
            return null;

        return {
            gpuLayers,
            contextSize: fitContext.contextSize,
            contextVram,
            totalVram,
            useMmap
        };
    }

    const maxContext = await findMaxPossibleContextSizeForVram({
        gpuLayers,
        ggufInsights,
        vram: currentVram - modelVram,
        isEmbeddingContext: fitContext?.embeddingContext ?? false,
        flashAttention: defaultContextFlashAttention,
        kvCacheKeyType: defaultContextKvCacheKeyType,
        kvCacheValueType: defaultContextKvCacheValueType,
        swaFullCache: defaultContextSwaFullCache,
        useMmap,
        simulatorSession
    });

    if (maxContext == null || modelVram + maxContext.vram > currentVram)
        return null;

    return {
        gpuLayers,
        contextSize: maxContext.contextSize,
        contextVram: maxContext.vram,
        totalVram: modelVram + maxContext.vram,
        useMmap
    };
}

async function findMaxPossibleContextSizeForVram({
    gpuLayers, ggufInsights, vram, isEmbeddingContext, flashAttention, kvCacheKeyType, kvCacheValueType, swaFullCache,
    useMmap, simulatorSession
}: {
    gpuLayers: number, ggufInsights: GgufInsights, vram: number, isEmbeddingContext: boolean,
    flashAttention: LlamaContextOptions["flashAttention"], kvCacheKeyType?: GgmlType, kvCacheValueType?: GgmlType, swaFullCache: boolean,
    useMmap?: boolean, simulatorSession?: GgufInsightsSimulatorSession
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
                useMmap: useMmap
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

        if (result != null && (bestValue == null || value >= bestValue.value)) {
            bestValue = {value: value, result: result};

            if (step === -minStep || value === maxValue)
                break;
            else if (step < 0)
                step = Math.max(minStep, Math.floor(-step / 2));
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
