import type {Token} from "../../types.js";
import type {LlamaContextSequence} from "./LlamaContext.js";


export type LlamaContextOptions = {
    /**
     * number of sequences for the context.
     * Each sequence is a different "text generation process" that can run in parallel to other sequences in the same context.
     * Although a single context has multiple sequences, the sequences are separate from each other and do not share data with each other.
     * This is beneficial for performance, as multiple sequences can be evaluated in parallel (on the same batch).
     */
    sequences?: number,

    /** If null, a random seed will be used */
    seed?: number | null,

    /**
     * The number of tokens can the model see at once.
     * Defaults to the context size the model was trained on.
     */
    contextSize?: number,

    /**
     * The number of tokens that can be processed at once by the GPU.
     * Defaults to `512` or `contextSize` if `contextSize` is less than `512`.
     */
    batchSize?: number,

    /**
     * number of threads to use to evaluate tokens.
     * set to 0 to use the maximum threads supported by the current machine hardware
     */
    threads?: number,

    /** control the parallel sequences processing behavior */
    batching?: BatchingOptions,

    /** An abort signal to abort the context creation */
    createSignal?: AbortSignal,

    /**
     * embedding mode only
     * @internal
     */
    _embeddings?: boolean,

    /**
     * disable the seed generation
     * @internal
     */
    _noSeed?: boolean
};
export type LlamaContextSequenceRepeatPenalty = {
    /** Tokens to lower the predication probability of to be the next predicted token */
    punishTokens: Token[] | (() => Token[]),

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
    strategy?: "eraseBeginning" | ((options: {
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
 *
 * 5 - high
 */
export type EvaluationPriority = 1 | 2 | 3 | 4 | 5;

export type BatchItem = {
    readonly tokens: readonly Token[],
    readonly evaluationPriority: EvaluationPriority
};
export type PrioritizedBatchItem = {
    item: BatchItem,
    processAmount: number
};
