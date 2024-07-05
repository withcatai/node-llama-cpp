import {LlamaContextOptions} from "../../../evaluator/LlamaContext/types.js";
import {GgufInsights} from "../GgufInsights.js";
import {BuildGpu} from "../../../bindings/types.js";
import {minAllowedContextSizeInCalculations} from "../../../config.js";
import {getDefaultContextBatchSize, getDefaultModelContextSize} from "../../../evaluator/LlamaContext/LlamaContext.js";

export async function resolveContextContextSizeOption({
    contextSize, batchSize, sequences, modelFileInsights, modelGpuLayers, modelTrainContextSize, flashAttention, getVramState, llamaGpu,
    ignoreMemorySafetyChecks = false, isEmbeddingContext = false
}: {
    contextSize?: LlamaContextOptions["contextSize"],
    batchSize?: LlamaContextOptions["batchSize"],
    sequences: number,
    modelFileInsights: GgufInsights,
    modelGpuLayers: number,
    modelTrainContextSize: number,
    flashAttention: boolean,
    getVramState(): Promise<{total: number, free: number}>,
    llamaGpu: BuildGpu,
    ignoreMemorySafetyChecks?: boolean,
    isEmbeddingContext?: boolean
}): Promise<number> {
    if (contextSize == null)
        contextSize = "auto";

    if (typeof contextSize === "number") {
        const resolvedContextSize = Math.max(1, Math.floor(contextSize));

        if (ignoreMemorySafetyChecks)
            return resolvedContextSize;

        const vramState = await getVramState();
        const contextVram = modelFileInsights.estimateContextResourceRequirements({
            contextSize: resolvedContextSize,
            batchSize: batchSize ?? getDefaultContextBatchSize({contextSize: resolvedContextSize, sequences}),
            modelGpuLayers: modelGpuLayers,
            sequences,
            flashAttention,
            isEmbeddingContext
        }).gpuVram;

        if (contextVram > vramState.free)
            throw new Error(`The context size of ${resolvedContextSize}${sequences > 1 ? ` with ${sequences} sequences` : ""} is too large for the available VRAM`);

        return resolvedContextSize;
    } else if (contextSize === "auto" || typeof contextSize === "object") {
        if (llamaGpu === false)
            return modelTrainContextSize;

        const vramState = await getVramState();

        if (vramState.total === 0)
            return modelTrainContextSize;

        const freeVram = vramState.free;

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
            const contextVram = modelFileInsights.estimateContextResourceRequirements({
                contextSize: testContextSize,
                batchSize: batchSize ?? getDefaultContextBatchSize({contextSize: testContextSize, sequences}),
                modelGpuLayers: modelGpuLayers,
                sequences,
                flashAttention,
                isEmbeddingContext
            }).gpuVram;

            if (contextVram <= freeVram) {
                if (highestCompatibleContextSize == null || testContextSize > highestCompatibleContextSize) {
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

        throw new Error(`The available VRAM is too small to fit the context size of ${maxContextSize}${sequences > 1 ? ` with ${sequences} sequences` : ""}`);
    }

    throw new Error(`Invalid context size: "${contextSize}"`);
}
