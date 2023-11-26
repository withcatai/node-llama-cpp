import {Token} from "../../types.js";
import {LlamaModel} from "../LlamaModel.js";
import {LlamaContextSequence} from "./LlamaContext.js";


export type LlamaContextOptions = {
    model: LlamaModel,

    /**
     * number of sequences for the context.
     * Each sequence is a different "text generation process" that can run in parallel to other sequences in the same context.
     * Although a single context has multiple sequences, the sequences are separate from each other and do not share data with each other.
     * This is beneficial for performance, as multiple sequences can be evaluated in parallel (on the same batch).
     */
    sequences?: number,

    /** If null, a random seed will be used */
    seed?: number | null,

    /** text context size */
    contextSize?: number,

    /** prompt processing batch size */
    batchSize?: number,

    /** use fp16 for KV cache */
    f16Kv?: boolean,

    /** the llama_eval() call computes all logits, not just the last one */
    logitsAll?: boolean,

    /** embedding mode only */
    embedding?: boolean

    /** number of threads to use to evaluate tokens */
    threads?: number,

    /** control the parallel sequences processing behavior */
    batching?: BatchingOptions
};
export type LlamaContextRepeatPenalty = {
    /** Tokens to lower the predication probability of to be the next predicted token */
    punishTokens: Uint32Array | (() => Uint32Array),

    /**
     * The relative amount to lower the probability of the tokens in `punishTokens` by
     * Defaults to `1.1`.
     * Set to `1` to disable.
     */
    penalty?: number,

    /**
     * For n time a token is in the `punishTokens` array, lower its probability by `n * frequencyPenalty`
     * Disabled by default (`0`).
     * Set to a value between `0` and `1` to enable.
     */
    frequencyPenalty?: number,

    /**
     * Lower the probability of all the tokens in the `punishTokens` array by `presencePenalty`
     * Disabled by default (`0`).
     * Set to a value between `0` and `1` to enable.
     */
    presencePenalty?: number
};

export type BatchingOptions = {
    dispatchSchedule?: "nextTick" | CustomBatchingDispatchSchedule,
    itemsPrioritizingStrategy?: "maximumParallelism" | "firstInFirstOut" | CustomBatchingPrioritizeStrategy
};
export type CustomBatchingDispatchSchedule = (dispatch: () => void) => void;
export type CustomBatchingPrioritizeStrategy = (options: {
    items: readonly BatchItem[],
    size: number
}) => PrioritizedBatchItem[];

export type ContextShiftOptions = {
    size?: number | ((sequence: LlamaContextSequence) => number | Promise<number>),
    strategy?: "eraseLowestTokenPriorityBeginning" | "eraseBeginning" | ((options: {
        sequence: LlamaContextSequence,
        size: number
    }) => ContextTokensDeleteRange[] | Promise<ContextTokensDeleteRange[]>)
};

export type ContextTokensDeleteRange = {
    start: number,
    end: number
};

/**
 * 1 - low
 * 5 - high
 */
export type EvaluationPriority = 1 | 2 | 3 | 4 | 5;

/**
 * 1 - low, minimum
 * Infinity - high, maximum
 */
export type TokenPriority = number;

export type BatchItem = {
    readonly tokens: readonly Token[],
    readonly evaluationPriority: EvaluationPriority
};
export type PrioritizedBatchItem = {
    item: BatchItem,
    processAmount: number
};
