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
     *
     * Defaults to `1`.
     */
    sequences?: number,

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
     *
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
     * This value is considered as a hint, and the actual number of threads used may be lower when other evaluations are running.
     * To ensure the minimum number of threads you want to use are always used,
     * set this to an object with a `min` property (see the `min` property description for more details).
     *
     * If `maxThreads` from the Llama instance is set to `0`, this value will always be the actual number of threads used.
     *
     * If `maxThreads` from the Llama instance is set to `0`, defaults to the `.cpuMathCores` value from the Llama instance,
     * otherwise defaults to `maxThreads` from the Llama instance (see the `maxThreads` option of `getLlama` method for more details).
     */
    threads?: number | {
        /**
         * The ideal number of threads to use for evaluations.
         *
         * If other evaluations are running, the actual number of threads may be lower than this value.
         *
         * If `maxThreads` from the Llama instance is set to `0`, this value will always be the actual number of threads used.
         *
         * If `maxThreads` from the Llama instance is set to `0`, defaults to the `.cpuMathCores` value from the Llama instance,
         * otherwise defaults to `maxThreads` from the Llama instance (see the `maxThreads` option of `getLlama` method for more details).
         */
        ideal?: number,

        /**
         * Ensure evaluations always use at least this number of threads.
         *
         * Use with caution, since setting this value too high can lead to the context waiting too much time
         * to reserve this number of threads before the evaluation can start.
         */
        min?: number
    },

    /** control the parallel sequences processing behavior */
    batching?: BatchingOptions,

    /**
     * Load the provided LoRA adapters onto the context.
     * LoRA adapters are used to modify the weights of a pretrained model to adapt to new tasks or domains
     * without the need for extensive retraining from scratch.
     *
     * If a string is provided, it will be treated as a path to a single LoRA adapter file.
     */
    lora?: string | {
        adapters: Array<{
            filePath: string,

            /**
             * Defaults to `1`
             */
            scale?: number
        }>,

        /**
         * Called with the LoRA adapters load percentage when the LoRA adapters are being loaded.
         * @param loadProgress - a number between 0 (exclusive) and 1 (inclusive).
         */
        onLoadProgress?(loadProgress: number): void
    },

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
     * On failed context creation, retry the creation with a smaller context size.
     *
     * Only works if `contextSize` is set to `"auto"`, left as default or set to an object with `min` and/or `max` properties.
     *
     * Set `retries` to `false` to disable.
     */
    failedCreationRemedy?: false | {
        /**
         * Retries to attempt to create the context.
         *
         * Defaults to `6`.
         */
        retries?: number,

        /**
         * The percentage to decrease the context size by on each retry.
         * Should be a number between `0` and `1`.
         *
         * If a function is provided, it will be called with the current context size and should return the new context size.
         *
         * Defaults to `0.16`.
         */
        autoContextSizeShrink?: number | ((contextSize: number) => number)
    },

    /**
     * Track the inference performance of the context, so using `.printTimings()` will work.
     *
     * Defaults to `false`.
     */
    performanceTracking?: boolean,

    /**
     * embedding mode only
     * @internal
     */
    _embeddings?: boolean
};
export type LlamaContextSequenceRepeatPenalty = {
    /** Tokens to lower the predication probability of to be the next predicted token */
    punishTokens: Token[] | (() => Token[]),

    /**
     * The maximum number of tokens that will be provided in the `punishTokens` array.
     *
     * This is used as a hint for a performance optimization for avoiding frequent memory deallocation and reallocation.
     *
     * Don't set this value too high, as it can allocate too much memory.
     *
     * Defaults to `64`.
     */
    maxPunishTokens?: number,

    /**
     * The relative amount to lower the probability of the tokens in `punishTokens` by.
     *
     * Defaults to `1.1`.
     * Set to `1` to disable.
     */
    penalty?: number,

    /**
     * For n time a token is in the `punishTokens` array, lower its probability by `n * frequencyPenalty`.
     *
     * Disabled by default (`0`).
     * Set to a value between `0` and `1` to enable.
     */
    frequencyPenalty?: number,

    /**
     * Lower the probability of all the tokens in the `punishTokens` array by `presencePenalty`.
     *
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
