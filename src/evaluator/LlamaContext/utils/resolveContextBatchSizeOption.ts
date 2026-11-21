import {getDefaultContextBatchSize} from "../LlamaContext.js";
import {padSafeContextSize} from "./padSafeContextSize.js";
import type {LlamaContextOptions} from "../types.js";

export function resolveContextBatchSizeOption({batchSize, contextSize, sequences}: {
    batchSize?: LlamaContextOptions["batchSize"],
    contextSize: number,
    sequences: number
}): number {
    return batchSize === "_matchContext"
        ? padSafeContextSize(contextSize, "up")
        : batchSize ?? getDefaultContextBatchSize({contextSize, sequences});
}
