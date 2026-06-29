import {LlamaContextOptions} from "../../../evaluator/LlamaContext/types.js";
import {GgufInsights, GgufInsightsSimulatorSession} from "../GgufInsights.js";
import {BuildGpu} from "../../../bindings/types.js";
import {minAllowedContextSizeInCalculations} from "../../../config.js";
import {getDefaultContextBatchSize, getDefaultModelContextSize} from "../../../evaluator/LlamaContext/LlamaContext.js";
import {InsufficientMemoryError} from "../../../utils/InsufficientMemoryError.js";
import {getRamUsageFromUnifiedVram} from "./getRamUsageFromUnifiedVram.js";
import type {GgmlType} from "../../types/GgufTensorInfoTypes.js";

const defaultMaxContextSizeSwapUse = 2048;

export async function resolveContextContextSizeOption(options: {
    contextSize?: LlamaContextOptions["contextSize"],
    batchSize?: LlamaContextOptions["batchSize"],
    sequences: number,
    modelFileInsights: GgufInsights,
    modelGpuLayers: number,
    modelTrainContextSize: number,
    flashAttention: LlamaContextOptions["flashAttention"],
    kvCacheKeyType?: GgmlType,
    kvCacheValueType?: GgmlType,
    swaFullCache: boolean,
    useMmap?: boolean,
    getVramState(): Promise<{total: number, free: number, unifiedSize: number}>,
    getRamState(): Promise<{total: number, free: number}>,
    getSwapState(): Promise<{total: number, free: number}>,
    llamaGpu: BuildGpu,
    ignoreMemorySafetyChecks?: boolean,
    isEmbeddingContext?: boolean,
    maxContextSizeSwapUse?: number,
    simulatorSession?: GgufInsightsSimulatorSession,
    ramCapIsSet?: boolean,
    vramCapIsSet?: boolean
}): Promise<number> {
    const {
        contextSize: _contextSize, batchSize, sequences, modelFileInsights, modelGpuLayers, modelTrainContextSize, flashAttention,
        kvCacheKeyType, kvCacheValueType, swaFullCache, useMmap = modelFileInsights._llama.supportsMmap,
        getVramState, getRamState, getSwapState, ignoreMemorySafetyChecks = false, isEmbeddingContext = false,
        maxContextSizeSwapUse = defaultMaxContextSizeSwapUse,
        
        simulatorSession: _simulatorSession,
        ramCapIsSet = false,
        vramCapIsSet = false
    } = options;
    let contextSize = _contextSize;

    const simulatorSession = _simulatorSession ?? modelFileInsights._createSimulatorSession();

    try {
        if (contextSize == null)
            contextSize = "auto";

        if (typeof contextSize === "number") {
            const resolvedContextSize = Math.max(1, Math.floor(contextSize));

            if (ignoreMemorySafetyChecks)
                return resolvedContextSize;

            const [
                vramState,
                ramState,
                swapState
            ] = await Promise.all([
                getVramState(),
                getRamState(),
                getSwapState()
            ]);
            const contextResourceRequirements = await modelFileInsights.estimateContextResourceRequirementsV2({
                contextSize: resolvedContextSize,
                batchSize: batchSize ?? getDefaultContextBatchSize({contextSize: resolvedContextSize, sequences}),
                modelGpuLayers: modelGpuLayers,
                sequences,
                flashAttention,
                kvCacheKeyType,
                kvCacheValueType,
                swaFullCache,
                isEmbeddingContext,

                _simulatorSession: simulatorSession,
                useMmap
            });

            if (contextResourceRequirements.gpuVram > vramState.free)
                throw new InsufficientMemoryError(`A context size of ${resolvedContextSize}${sequences > 1 ? ` with ${sequences} sequences` : ""} is too large for the available VRAM` + getCapErrorMessage(ramCapIsSet, vramCapIsSet));
            else if (contextResourceRequirements.cpuRam > (
                ramState.free + swapState.free - getRamUsageFromUnifiedVram(contextResourceRequirements.gpuVram, vramState)
            ))
                throw new InsufficientMemoryError(`A context size of ${resolvedContextSize}${sequences > 1 ? ` with ${sequences} sequences` : ""} is too large for the available RAM${swapState.total > 0 ? " (including swap)" : ""}` + getCapErrorMessage(ramCapIsSet, vramCapIsSet));

            return resolvedContextSize;
        } else if (contextSize === "auto" || typeof contextSize === "object") {
            const [
                vramState,
                ramState,
                swapState
            ] = await Promise.all([
                getVramState(),
                getRamState(),
                getSwapState()
            ]);

            const maxContextSize = contextSize === "auto"
                ? getDefaultModelContextSize({trainContextSize: modelTrainContextSize})
                : Math.min(
                    contextSize.max ?? getDefaultModelContextSize({trainContextSize: modelTrainContextSize}),
                    getDefaultModelContextSize({trainContextSize: modelTrainContextSize})
                );

            const minContextSize = contextSize === "auto"
                ? minAllowedContextSizeInCalculations
                : Math.max(
                    contextSize.min ?? minAllowedContextSizeInCalculations,
                    minAllowedContextSizeInCalculations
                );

            let highestCompatibleContextSize: number | null = null;
            let step = -Math.max(1, Math.floor((maxContextSize - minContextSize) / 4));
            for (let testContextSize = maxContextSize; testContextSize >= minContextSize && testContextSize <= maxContextSize;) {
                const contextResourceRequirements = await modelFileInsights.estimateContextResourceRequirementsV2({
                    contextSize: testContextSize,
                    batchSize: batchSize ?? getDefaultContextBatchSize({contextSize: testContextSize, sequences}),
                    modelGpuLayers: modelGpuLayers,
                    sequences,
                    flashAttention,
                    kvCacheKeyType,
                    kvCacheValueType,
                    swaFullCache,
                    isEmbeddingContext,

                    _simulatorSession: simulatorSession,
                    useMmap
                });

                if (contextResourceRequirements.gpuVram <= vramState.free &&
                    contextResourceRequirements.cpuRam <= (
                        ramState.free - getRamUsageFromUnifiedVram(contextResourceRequirements.gpuVram, vramState) + (
                            testContextSize <= maxContextSizeSwapUse
                                ? swapState.free
                                : 0
                        )
                    )
                ) {
                    if (highestCompatibleContextSize == null || testContextSize >= highestCompatibleContextSize) {
                        highestCompatibleContextSize = testContextSize;

                        if (step === -1 || testContextSize === maxContextSize)
                            break;
                        else if (step < 0)
                            step = Math.max(1, Math.floor(-step / 2));
                    } else if (testContextSize < highestCompatibleContextSize) {
                        testContextSize = highestCompatibleContextSize;
                        step = Math.max(1, Math.floor(Math.abs(step) / 2));
                    }
                } else if (step > 0)
                    step = -Math.max(1, Math.floor(step / 2));

                if (testContextSize == minContextSize && step === -1)
                    break;

                testContextSize += step;
                if (testContextSize < minContextSize) {
                    testContextSize = minContextSize;
                    step = Math.max(1, Math.floor(Math.abs(step) / 2));
                } else if (testContextSize > maxContextSize) {
                    testContextSize = maxContextSize;
                    step = -Math.max(1, Math.floor(Math.abs(step) / 2));
                }
            }

            if (highestCompatibleContextSize != null)
                return highestCompatibleContextSize;

            if (ignoreMemorySafetyChecks)
                return minContextSize;

            const minContextSizeResourceRequirements = await modelFileInsights.estimateContextResourceRequirementsV2({
                contextSize: minContextSize,
                batchSize: batchSize ?? getDefaultContextBatchSize({contextSize: minContextSize, sequences}),
                modelGpuLayers: modelGpuLayers,
                sequences,
                flashAttention,
                kvCacheKeyType,
                kvCacheValueType,
                swaFullCache,
                isEmbeddingContext,

                _simulatorSession: simulatorSession,
                useMmap
            });

            const unifiedRamUsage = getRamUsageFromUnifiedVram(minContextSizeResourceRequirements.gpuVram, vramState);
            if (minContextSizeResourceRequirements.gpuVram > vramState.free &&
                minContextSizeResourceRequirements.cpuRam > ramState.free + swapState.free - unifiedRamUsage
            )
                throw new InsufficientMemoryError(`A context size of ${minContextSize}${sequences > 1 ? ` with ${sequences} sequences` : ""} is too large for the available VRAM and RAM${swapState.total > 0 ? " (including swap)" : ""}` + getCapErrorMessage(ramCapIsSet, vramCapIsSet));
            else if (minContextSizeResourceRequirements.gpuVram > vramState.free)
                throw new InsufficientMemoryError(`A context size of ${minContextSize}${sequences > 1 ? ` with ${sequences} sequences` : ""} is too large for the available VRAM` + getCapErrorMessage(ramCapIsSet, vramCapIsSet));
            else if (minContextSizeResourceRequirements.cpuRam > ramState.free + swapState.free - unifiedRamUsage)
                throw new InsufficientMemoryError(`A context size of ${minContextSize}${sequences > 1 ? ` with ${sequences} sequences` : ""} is too large for the available RAM${swapState.total > 0 ? " (including swap)" : ""}` + getCapErrorMessage(ramCapIsSet, vramCapIsSet));
            else if (minContextSizeResourceRequirements.cpuRam > ramState.free - unifiedRamUsage)
                throw new InsufficientMemoryError(`A context size of ${minContextSize}${sequences > 1 ? ` with ${sequences} sequences` : ""} is too large for the available RAM` + getCapErrorMessage(ramCapIsSet, vramCapIsSet));
            else
                throw new InsufficientMemoryError(`A context size of ${minContextSize}${sequences > 1 ? ` with ${sequences} sequences` : ""} is too large for the available resources` + getCapErrorMessage(ramCapIsSet, vramCapIsSet));
        }

        throw new Error(`Invalid context size: "${contextSize}"`);
    } finally {
        if (_simulatorSession == null)
            await simulatorSession.dispose();
    }
}

function getCapErrorMessage(ramCapIsSet: boolean, vramCapIsSet: boolean) {
    if (ramCapIsSet && vramCapIsSet)
        return " (RAM and VRAM caps are set, consider increasing or removing the caps to allow more memory to be used)";
    else if (vramCapIsSet)
        return " (VRAM cap is set, consider increasing or removing the cap to allow more VRAM to be used)";
    else if (ramCapIsSet)
        return " (RAM cap is set, consider increasing or removing the cap to allow more RAM to be used)";

    return "";
}
