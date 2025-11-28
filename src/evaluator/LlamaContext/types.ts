import {PickOptions} from "../../utils/utilTypes.js";
import type {LlamaGrammarEvaluationState} from "../LlamaGrammarEvaluationState.js";
import type {TokenBias} from "../TokenBias.js";
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
     * The actual context size may be slightly larger than your request (by up to 256) due to the implementation in `llama.cpp` that
     * aligns the context size to multiples of 256 for performance reasons.
     * To check the actual context size that gets created, use the `.contextSize` property
     * of the created context instance or any of its sequences.
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

    /**
     * Control the parallel sequences processing behavior.
     *
     * See {@link BatchingOptions} for more information.
     */
    batching?: BatchingOptions,

    /**
     * When using SWA (Sliding Window Attention) on a supported model,
     * extend the sliding window size to the current context size (meaning practically disabling SWA).
     *
     * Enabling this option will consume more memory on models that support SWA (Sliding Window Attention),
     * but will allow reusing the evaluation cache of any prefix length of the context sequence state
     * (instead of just the size of the sliding window when SWA is used).
     *
     * This option has no effect on models that do not support SWA (Sliding Window Attention).
     *
     * > **Note:** you can check the SWA size using `model.fileInsights.swaSize`.
     *
     * Defaults to `false` (inherited from the model option `defaultContextSwaFullCache`);
     */
    swaFullCache?: boolean,

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
    _embeddings?: boolean,

    /**
     * ranking mode
     * @internal
     */
    _ranking?: boolean
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
     * - **`"nextCycle"`** - dispatch the items on the next event loop cycle.
     * You can provide a custom function to define a custom dispatch schedule.
     *
     * Defaults to `"nextCycle"`.
     */
    dispatchSchedule?: "nextCycle" | CustomBatchingDispatchSchedule,

    /**
     * The strategy used to prioritize pending items to be processed.
     * - **`"maximumParallelism"`** - process as many different sequences in parallel as possible.
     * - **`"firstInFirstOut"`** - process items in the order they were added.
     * - **Custom prioritization function** - a custom function that prioritizes the items to be processed.
     * See the {@link CustomBatchingPrioritizationStrategy} type for more information.
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

export type SequenceEvaluateOptions = {
    temperature?: number, minP?: number, topK?: number, topP?: number,

    /**
     * Used to control the randomness of the generated text.
     *
     * Change the seed to get different results.
     *
     * Defaults to the current epoch time.
     *
     * Only relevant when using `temperature`.
     */
    seed?: number,
    grammarEvaluationState?: LlamaGrammarEvaluationState | (() => LlamaGrammarEvaluationState | undefined),
    repeatPenalty?: LlamaContextSequenceRepeatPenalty,

    /**
     * Adjust the probability of tokens being generated.
     * Can be used to bias the model to generate tokens that you want it to lean towards,
     * or to avoid generating tokens that you want it to avoid.
     */
    tokenBias?: TokenBias | (() => TokenBias),

    /**
     * When a lot of tokens are queued for the next batch, more than the configured `batchSize`, the tokens for each sequence will be
     * evaluated based on the strategy chosen for the context.
     * By default, the `"maximumParallelism"` strategy is used, which will try to evaluate as many sequences in parallel as possible,
     * but at some point, it'll have to choose which sequences to evaluate more tokens of, so it'll prioritize the sequences with the
     * highest evaluation priority.
     * Also, a custom strategy can be used to prioritize the sequences differently, but generally, the higher the evaluation priority
     * is, the more likely and more tokens will be evaluated for that sequence in the next queued batch.
     */
    evaluationPriority?: EvaluationPriority,

    /**
     * Override the sequence context shift options for this evaluation
     *
     * See {@link ContextShiftOptions} for more information.
     */
    contextShift?: ContextShiftOptions,

    /**
     * Yield an EOG (End Of Generation) token (like EOS and EOT) when it's generated.
     * When `false` the generation will stop when an EOG token is generated and the token won't be yielded.
     * Defaults to `false`.
     */
    yieldEogToken?: boolean,

    /** @internal */
    _noSampling?: boolean
};

export type SequenceEvaluateMetadataOptions = {
    /**
     * Get the confidence (probability) of the selected token.
     *
     * Same as `probabilities.get(token)` from the output.
     *
     * If you need only this value, you can skip getting the full probabilities list to improve performance.
     *
     * This value might be slightly different when evaluated on different GPUs and configurations.
     */
    readonly confidence?: boolean,

    /**
     * Get the full probabilities list of tokens from the vocabulary to be the next token, after applying the given options.
     *
     * Only enable when needed, as it impacts the performance.
     *
     * Defaults to `false`.
     */
    readonly probabilities?: boolean
};

export type SequenceEvaluateOutput<
    Options extends {
        readonly confidence?: boolean,
        readonly probabilities?: boolean
    } = {
        readonly confidence: true,
        readonly probabilities: true
    }
> = PickOptions<{
    /**
     * The next token generated by the model and selected using the given options (such a temperature).
     */
    token: Token,

    /**
     * The confidence (probability) of the selected token.
     *
     * Same as `probabilities.get(token)`.
     *
     * If you need only this value, you can skip getting the full probabilities list to improve performance.
     *
     * This value might be slightly different when evaluated on different GPUs and configurations.
     */
    confidence: number,

    /**
     * The probabilities of the tokens from the vocabulary to be the next token.
     *
     * A probability is a number from `0` to `1`.
     *
     * The probabilities might be slightly different when evaluated on different GPUs and configurations.
     *
     * The map is sorted by the probability of the tokens from the highest to the lowest,
     * and is reflected in the order of the entries when iterating over the map.
     * Use `.entries().next().value` to get the top probability pair
     * ([learn more](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/entries)).
     */
    probabilities: Map<Token, number>
}, Options & {token: true}>;

export type ControlledEvaluateInputItem = Token | [token: Token, options: {
    generateNext?: {
        /**
         * Get the full probabilities list of tokens from the vocabulary to be the next token, after applying the given options.
         *
         * Only enable when needed, as it impacts the performance.
         *
         * Defaults to `false`.
         */
        probabilities?: boolean,

        /**
         * Get the confidence (probability) of the selected token.
         *
         * Same as `next.probabilities.get(next.token)` from the output.
         *
         * If you need only this value, you can skip getting the full probabilities list to improve performance.
         *
         * This value might be slightly different when evaluated on different GPUs and configurations.
         */
        confidence?: boolean,

        /**
         * Generate the next token with the provided options using sampling.
         *
         * Setting this to `true` will generate probabilities for the next token and sample it.
         */
        token?: boolean,

        options?: {
            temperature?: number, minP?: number, topK?: number, topP?: number,

            /**
             * Used to control the randomness of the generated text.
             *
             * Change the seed to get different results.
             *
             * Defaults to the current epoch time.
             *
             * Only relevant when using `temperature`.
             */
            seed?: number,
            repeatPenalty?: LlamaContextSequenceRepeatPenalty,

            /**
             * Adjust the probability of tokens being generated.
             * Can be used to bias the model to generate tokens that you want it to lean towards,
             * or to avoid generating tokens that you want it to avoid.
             */
            tokenBias?: TokenBias | (() => TokenBias)
        }
    }
}];

export type ControlledEvaluateIndexOutput = {
    next: {
        token?: Token | null,

        /**
         * The confidence (probability) of the selected token (the `token` field in this object).
         *
         * Same as `next.probabilities.get(next.token)`.
         *
         * If you need only this value, you can skip getting the full probabilities list to improve performance.
         *
         * This value might be slightly different when evaluated on different GPUs and configurations.
         */
        confidence?: number,

        /**
         * The probabilities of the tokens from the vocabulary to be the next token.
         *
         * A probability is a number from `0` to `1`.
         *
         * The probabilities might be slightly different when evaluated on different GPUs and configurations.
         *
         * The map is sorted by the probability of the tokens from the highest to the lowest,
         * and is reflected in the order of the entries when iterating over the map.
         * Use `.entries().next().value` to get the top probability pair
         * ([learn more](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/entries)).
         */
        probabilities?: Map<Token, number>
    }
};

/**
 * 1 - low
 *
 * 5 - high
 */
export type EvaluationPriority = 1 | 2 | 3 | 4 | 5;

export type BatchItem = {
    readonly tokens: readonly Token[],
    readonly logits: readonly (true | undefined)[],
    readonly evaluationPriority: EvaluationPriority
};
export type PrioritizedBatchItem = {
    item: BatchItem,
    processAmount: number
};
