import type {Token} from "../../types.js";
import type {LlamaContextSequence} from "./LlamaContext.js";


export type LlamaContextOptions = {
    /**
     * number of sequences for the context.
     * Each sequence is a different "text generation process" that can run in parallel to other sequences in the same context.
     * Although a single context has multiple sequences, the sequences are separate from each other and do not share data with each other.
     * This is beneficial for performance, as multiple sequences can be evaluated in parallel (on the same batch).
     *
     * Each sequence increases the memory usage of the context.
     * Defaults to `1`.
     */
    sequences?: number,

    /** If null, a random seed will be used */
    seed?: number | null,

    /**
     * The number of tokens the model can see at once.
     * - **`"auto"`** - adapt to the current VRAM state and attemp to set the context size as high as possible up to the size
     * the model was trained on.
     * - **`number`** - set the context size to a specific number of tokens.
     * If there's not enough VRAM, an error will be thrown.
     * Use with caution.
     * - **`{min?: number, max?: number}`** - adapt to the current VRAM state and attemp to set the context size as high as possible
     * up to the size the model was trained on, but at least `min` and at most `max`.
     *
     * Defaults to `"auto"`.
     */
    contextSize?: "auto" | number | {
        min?: number,
        max?: number
    },

    /**
     * The number of tokens that can be processed at once by the GPU.
     * Defaults to `512` or `contextSize` if `contextSize` is less than `512`.
     */
    batchSize?: number,

    /**
     * Flash attention is an optimization in the attention mechanism that makes inference faster, more efficient and uses less memory.
     *
     * The support for flash attention is currently experimental and may not always work as expected.
     * Use with caution.
     *
     * This option will be ignored if flash attention is not supported by the model.
     *
     * Defaults to `false` (inherited from the model option `defaultContextFlashAttention`).
     *
     * Upon flash attention exiting the experimental status, the default value will become `true`
     * (the inherited value from the model option `defaultContextFlashAttention` will become `true`).
     */
    flashAttention?: boolean,

    /**
     * number of threads to use to evaluate tokens.
     * set to 0 to use the maximum threads supported by the current machine hardware.
     *
     * Defaults to `6`.
     */
    threads?: number,

    /** control the parallel sequences processing behavior */
    batching?: BatchingOptions,

    /** An abort signal to abort the context creation */
    createSignal?: AbortSignal,

    /**
     * Ignore insufficient memory errors and continue with the context creation.
     * Can cause the process to crash if there's not enough VRAM for the new context.
     *
     * Defaults to `false`.
     */
    ignoreMemorySafetyChecks?: boolean,

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
    /**
     * The strategy used to dispatch items to be processed when there are items pending to be processed.
     * - **`"nextTick"`** - dispatch the items on the next even loop tick.
     * You can provide a custom function to define a custom dispatch schedule.
     *
     * Defaults to `"nextTick"`.
     */
    dispatchSchedule?: "nextTick" | CustomBatchingDispatchSchedule,

    /**
     * The strategy used to prioritize pending items to be processed.
     * - **`"maximumParallelism"`** - process as many different sequences in parallel as possible.
     * - **`"firstInFirstOut"`** - process items in the order they were added.
     * - **Custom prioritization function** - a custom function that prioritizes the items to be processed.
     * See the `CustomBatchingPrioritizationStrategy` type for more information.
     *
     * Defaults to `"maximumParallelism"`.
     */
    itemPrioritizationStrategy?: "maximumParallelism" | "firstInFirstOut" | CustomBatchingPrioritizationStrategy
};

/**
 * A function that schedules the dispatch of the batch items.
 * Call the `dispatch` function to dispatch the items.
 */
export type CustomBatchingDispatchSchedule = (dispatch: () => void) => void;

/**
 * A function that prioritizes the batch items to be processed.
 * The function receives an array of `items` and the `size` of how many tokens can be processed in this batch.
 *
 * The function should return an array of prioritized items,
 * where the sum of `processAmount` of all the items is less or equal to the given `size` that the function received,
 * and where the `item` of each prioritized item is the same reference to an original item in the `items` array.
 */
export type CustomBatchingPrioritizationStrategy = (options: {
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
