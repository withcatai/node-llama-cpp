import {LlamaContextOptions} from "../../../evaluator/LlamaContext/types.js";
import {GgufInsights} from "../GgufInsights.js";
import {BuildGpu} from "../../../bindings/types.js";
import {minAllowedContextSizeInCalculations} from "../../../config.js";
import {getDefaultContextBatchSize, getDefaultModelContextSize} from "../../../evaluator/LlamaContext/LlamaContext.js";
import {InsufficientMemoryError} from "../../../utils/InsufficientMemoryError.js";
import {getRamUsageFromUnifiedVram} from "./getRamUsageFromUnifiedVram.js";

const defaultMaxContextSizeSwapUse = 2048;

export async function resolveContextContextSizeOption({
    contextSize, batchSize, sequences, modelFileInsights, modelGpuLayers, modelTrainContextSize, flashAttention, swaFullCache,
    getVramState, getRamState, getSwapState, ignoreMemorySafetyChecks = false, isEmbeddingContext = false,
    maxContextSizeSwapUse = defaultMaxContextSizeSwapUse
}: {
    contextSize?: LlamaContextOptions["contextSize"],
    batchSize?: LlamaContextOptions["batchSize"],
    sequences: number,
    modelFileInsights: GgufInsights,
    modelGpuLayers: number,
    modelTrainContextSize: number,
    flashAttention: boolean,
    swaFullCache: boolean,
    getVramState(): Promise<{total: number, free: number, unifiedSize: number}>,
    getRamState(): Promise<{total: number, free: number}>,
    getSwapState(): Promise<{total: number, free: number}>,
    llamaGpu: BuildGpu,
    ignoreMemorySafetyChecks?: boolean,
    isEmbeddingContext?: boolean,
    maxContextSizeSwapUse?: number
}): Promise<number> {
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
        const contextResourceRequirements = modelFileInsights.estimateContextResourceRequirements({
            contextSize: resolvedContextSize,
            batchSize: batchSize ?? getDefaultContextBatchSize({contextSize: resolvedContextSize, sequences}),
            modelGpuLayers: modelGpuLayers,
            sequences,
            flashAttention,
            swaFullCache,
            isEmbeddingContext
        });

        if (contextResourceRequirements.gpuVram > vramState.free)
            throw new InsufficientMemoryError(`A context size of ${resolvedContextSize}${sequences > 1 ? ` with ${sequences} sequences` : ""} is too large for the available VRAM`);
        else if (contextResourceRequirements.cpuRam > (
            ramState.free + swapState.free - getRamUsageFromUnifiedVram(contextResourceRequirements.gpuVram, vramState)
        ))
            throw new InsufficientMemoryError(`A context size of ${resolvedContextSize}${sequences > 1 ? ` with ${sequences} sequences` : ""} is too large for the available RAM${swapState.total > 0 ? " (including swap)" : ""}`);

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
            const contextResourceRequirements = modelFileInsights.estimateContextResourceRequirements({
                contextSize: testContextSize,
                batchSize: batchSize ?? getDefaultContextBatchSize({contextSize: testContextSize, sequences}),
                modelGpuLayers: modelGpuLayers,
                sequences,
                flashAttention,
                swaFullCache,
                isEmbeddingContext
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

                    if (step === -1)
                        break;
                    else if (step < 0)
                        step = Math.max(1, Math.floor(-step / 2));
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

        const minContextSizeResourceRequirements = modelFileInsights.estimateContextResourceRequirements({
            contextSize: minContextSize,
            batchSize: batchSize ?? getDefaultContextBatchSize({contextSize: minContextSize, sequences}),
            modelGpuLayers: modelGpuLayers,
            sequences,
            flashAttention,
            swaFullCache,
            isEmbeddingContext
        });

        const unifiedRamUsage = getRamUsageFromUnifiedVram(minContextSizeResourceRequirements.gpuVram, vramState);
        if (minContextSizeResourceRequirements.gpuVram > vramState.free &&
            minContextSizeResourceRequirements.cpuRam > ramState.free + swapState.free - unifiedRamUsage
        )
            throw new InsufficientMemoryError(`A context size of ${minContextSize}${sequences > 1 ? ` with ${sequences} sequences` : ""} is too large for the available VRAM and RAM${swapState.total > 0 ? " (including swap)" : ""}`);
        else if (minContextSizeResourceRequirements.gpuVram > vramState.free)
            throw new InsufficientMemoryError(`A context size of ${minContextSize}${sequences > 1 ? ` with ${sequences} sequences` : ""} is too large for the available VRAM`);
        else if (minContextSizeResourceRequirements.cpuRam > ramState.free + swapState.free - unifiedRamUsage)
            throw new InsufficientMemoryError(`A context size of ${minContextSize}${sequences > 1 ? ` with ${sequences} sequences` : ""} is too large for the available RAM${swapState.total > 0 ? " (including swap)" : ""}`);
        else if (minContextSizeResourceRequirements.cpuRam > ramState.free - unifiedRamUsage)
            throw new InsufficientMemoryError(`A context size of ${minContextSize}${sequences > 1 ? ` with ${sequences} sequences` : ""} is too large for the available RAM`);
        else
            throw new InsufficientMemoryError(`A context size of ${minContextSize}${sequences > 1 ? ` with ${sequences} sequences` : ""} is too large for the available resources`);
    }

    throw new Error(`Invalid context size: "${contextSize}"`);
}
