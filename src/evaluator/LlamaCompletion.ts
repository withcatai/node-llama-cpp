import {DisposeAggregator, DisposedError, EventRelay, withLock} from "lifecycle-utils";
import {LLamaContextualRepeatPenalty, Token} from "../types.js";
import {LlamaText} from "../utils/LlamaText.js";
import {tokenizeInput} from "../utils/tokenizeInput.js";
import {UnsupportedError} from "../utils/UnsupportedError.js";
import {removeNullFields} from "../utils/removeNullFields.js";
import {QueuedTokenReleaseLock, TokenStreamRegulator} from "../utils/TokenStreamRegulator.js";
import {StopGenerationDetector} from "../utils/StopGenerationDetector.js";
import {UNKNOWN_UNICODE_CHAR} from "../consts.js";
import {getQueuedTokensBeforeStopTrigger} from "../utils/getQueuedTokensBeforeStopTrigger.js";
import {safeEventCallback} from "../utils/safeEventCallback.js";
import {pushAll} from "../utils/pushAll.js";
import {LlamaGrammarEvaluationState} from "./LlamaGrammarEvaluationState.js";
import {LlamaGrammar} from "./LlamaGrammar.js";
import {EvaluationPriority} from "./LlamaContext/types.js";
import {LlamaContextSequence} from "./LlamaContext/LlamaContext.js";
import {TokenBias} from "./TokenBias.js";

export type LlamaCompletionOptions = {
    contextSequence: LlamaContextSequence,

    /** Automatically dispose the sequence when the object is disposed */
    autoDisposeSequence?: boolean
};

export type LlamaCompletionGenerationOptions = {
    onToken?: (tokens: Token[]) => void,
    signal?: AbortSignal,
    maxTokens?: number,

    /**
     * Temperature is a hyperparameter that controls the randomness of the generated text.
     * It affects the probability distribution of the model's output tokens.
     * A higher temperature (e.g., 1.5) makes the output more random and creative,
     * while a lower temperature (e.g., 0.5) makes the output more focused, deterministic, and conservative.
     * The suggested temperature is 0.8, which provides a balance between randomness and determinism.
     * At the extreme, a temperature of 0 will always pick the most likely next token, leading to identical outputs in each run.
     *
     * Set to `0` to disable.
     * Disabled by default (set to `0`).
     */
    temperature?: number,

    /**
     * From the next token candidates, discard the percentage of tokens with the lowest probability.
     * For example, if set to `0.05`, 5% of the lowest probability tokens will be discarded.
     * This is useful for generating more high-quality results when using a high temperature.
     * Set to a value between `0` and `1` to enable.
     *
     * Only relevant when `temperature` is set to a value greater than `0`.
     * Disabled by default.
     */
    minP?: number,

    /**
     * Limits the model to consider only the K most likely next tokens for sampling at each step of sequence generation.
     * An integer number between `1` and the size of the vocabulary.
     * Set to `0` to disable (which uses the full vocabulary).
     *
     * Only relevant when `temperature` is set to a value greater than 0.
     */
    topK?: number,

    /**
     * Dynamically selects the smallest set of tokens whose cumulative probability exceeds the threshold P,
     * and samples the next token only from this set.
     * A float number between `0` and `1`.
     * Set to `1` to disable.
     *
     * Only relevant when `temperature` is set to a value greater than `0`.
     */
    topP?: number,

    /**
     * Trim whitespace from the end of the generated text
     * Disabled by default.
     */
    trimWhitespaceSuffix?: boolean,

    repeatPenalty?: false | LLamaContextualRepeatPenalty,

    /**
     * Adjust the probability of tokens being generated.
     * Can be used to bias the model to generate tokens that you want it to lean towards,
     * or to avoid generating tokens that you want it to avoid.
     */
    tokenBias?: TokenBias | (() => TokenBias),

    /**
     * See the parameter `evaluationPriority` on the `LlamaContextSequence.evaluate()` function for more information.
     */
    evaluationPriority?: EvaluationPriority,

    grammar?: LlamaGrammar,

    /**
     * Custom stop triggers to stop the completion when any of the provided triggers are found.
     */
    customStopTriggers?: readonly (LlamaText | string | readonly (string | Token)[])[],

    /**
     * The number of tokens to delete from the context window to make space for new ones.
     * Defaults to 10% of the context size.
     */
    contextShiftSize?: number | ((sequence: LlamaContextSequence) => number | Promise<number>),

    /**
     * Context shift reconstructs the context with partial relevant data to continue generation when the context fills up.
     * This flag disables this behavior.
     * This flag will cause the generation to stop when the context fills up
     * by setting an appropriate `maxTokens` value or lowering the given `maxTokens` value when needed.
     * This flag will cause the generation to fail if there's no space for generating new tokens at all with the given inputs.
     *
     * Disabled by default. Not recommended unless you know what you're doing.
     */
    disableContextShift?: boolean
};

export type LlamaInfillGenerationOptions = LlamaCompletionGenerationOptions & {
    /**
     * The minimum number of tokens to keep from the prefix input when making a context shift.
     * Defaults to 10% of the context size.
     */
    minPrefixKeepTokens?: number | ((sequence: LlamaContextSequence) => number | Promise<number>)
};

export type LlamaCompletionResponse = {
    response: string,
    metadata: {
        remainingGenerationAfterStop?: string | Token[],
        stopReason: "eogToken" | "stopGenerationTrigger" | "maxTokens"
    } | {
        remainingGenerationAfterStop?: string | Token[],
        stopReason: "customStopTrigger",
        customStopTrigger: (string | Token)[]
    }
};

const defaultContextShiftSize = (
    (sequence) => Math.max(1, Math.floor(sequence.context.contextSize / 10))
) satisfies LlamaCompletionGenerationOptions["contextShiftSize"];
const defaultMinPrefixKeepTokens = (
    (sequence) => Math.max(1, Math.floor(sequence.context.contextSize / 10))
) satisfies LlamaInfillGenerationOptions["minPrefixKeepTokens"];

export class LlamaCompletion {
    /** @internal */ private readonly _disposeAggregator = new DisposeAggregator();
    /** @internal */ private readonly _autoDisposeSequence: boolean;
    /** @internal */ private _sequence: LlamaContextSequence | null;
    public readonly onDispose = new EventRelay<void>();

    public constructor({
        contextSequence,
        autoDisposeSequence = true
    }: LlamaCompletionOptions) {
        this._sequence = contextSequence;
        this._autoDisposeSequence = autoDisposeSequence;

        this._disposeAggregator.add(
            this._sequence.onDispose.createListener(() => {
                this.dispose();
            })
        );
        this._disposeAggregator.add(this.onDispose.dispatchEvent);
    }

    public dispose({disposeSequence = this._autoDisposeSequence}: {disposeSequence?: boolean} = {}) {
        if (this._sequence == null || this.disposed)
            return;

        if (disposeSequence)
            this._sequence.dispose();

        this._sequence = null;

        this._disposeAggregator.dispose();
    }

    /** @hidden */
    public [Symbol.dispose]() {
        return this.dispose();
    }

    public get disposed() {
        return this._sequence == null || this._sequence.disposed;
    }

    public get infillSupported() {
        if (this._sequence == null)
            throw new DisposedError();

        return this._sequence.model.tokens.infill.prefix != null &&
            this._sequence.model.tokens.infill.suffix != null &&
            this._sequence.model.tokens.infill.middle != null;
    }

    /**
     * Generate a completion for an input.
     */
    public async generateCompletion(input: Token[] | string | LlamaText, options: LlamaCompletionGenerationOptions = {}) {
        const {response} = await this.generateCompletionWithMeta(input, options);

        return response;
    }

    /**
     * Same as `generateCompletion`, but returns additional metadata about the generation.
     * See `generateCompletion` for more information.
     */
    public async generateCompletionWithMeta(
        input: Token[] | string | LlamaText,
        {
            onToken,
            signal,
            maxTokens,
            temperature,
            minP,
            topK,
            topP,
            trimWhitespaceSuffix = false,
            repeatPenalty = {},
            tokenBias,
            evaluationPriority = 5,
            grammar,
            customStopTriggers,
            contextShiftSize = defaultContextShiftSize,
            disableContextShift
        }: LlamaCompletionGenerationOptions = {}
    ): Promise<LlamaCompletionResponse> {
        if (this._sequence == null || this.disposed)
            throw new DisposedError();

        const bosToken = this._sequence.model.tokens.bos;
        const shouldPrependBosToken = this._sequence.model.tokens.shouldPrependBosToken;

        async function fitInputIntoContext({
            maxTokens, tokens
        }: {
            maxTokens: number, tokens: Token[]
        }): Promise<Token[]> {
            const res = [];

            if (shouldPrependBosToken && bosToken != null)
                res.push(bosToken);

            const inputTokensSize = Math.max(0, Math.min(maxTokens - res.length, tokens.length));

            if (inputTokensSize === 0 && tokens.length > 0)
                throw new Error("The context size is too small to generate a response for the given input");

            const slicedTokens = tokens.slice(-inputTokensSize);
            pushAll(res, slicedTokens);

            return res;
        }

        const ensureNotAborted = () => {
            if (signal?.aborted)
                throw signal.reason;

            if (this.disposed)
                throw new DisposedError();
        };

        return await withLock(this, "generateCompletion", signal, async () => {
            ensureNotAborted();

            if (this._sequence == null || this.disposed)
                throw new DisposedError();

            const resolvedInput = tokenizeInput(
                input,
                this._sequence.model.tokenizer,
                (shouldPrependBosToken && bosToken != null)
                    ? "trimLeadingSpace"
                    : undefined
            );
            const resolvedContextShiftSize = await resolveContextShiftSize(contextShiftSize, this._sequence);
            ensureNotAborted();

            const inputTokens = await fitInputIntoContext({
                maxTokens: this._sequence.context.contextSize - resolvedContextShiftSize,
                tokens: resolvedInput
            });
            ensureNotAborted();
            const resolvedMaxTokens = !disableContextShift
                ? maxTokens
                : (maxTokens != null && maxTokens > 0)
                    ? Math.min(maxTokens, this._sequence.context.contextSize - inputTokens.length)
                    : this._sequence.context.contextSize - inputTokens.length;

            return await this._generateResponse(inputTokens, {
                onToken: safeEventCallback(onToken),
                signal,
                maxTokens: resolvedMaxTokens,
                temperature,
                minP,
                topK,
                topP,
                trimWhitespaceSuffix,
                repeatPenalty,
                tokenBias,
                evaluationPriority,
                grammar,
                contextShiftSize,
                customStopTriggers
            }, {
                async contextShift({shiftSize, res, pendingTokens, sequence}): Promise<{
                    newContextState: Token[]
                }> {
                    return {
                        newContextState: await fitInputIntoContext({
                            maxTokens: sequence.context.contextSize - shiftSize,
                            tokens: [...resolvedInput, ...res, ...pendingTokens]
                        })
                    };
                }
            });
        });
    }

    /**
     * Infill (also known as Fill-In-Middle), generates a completion for an input (`prefixInput`) that
     * should connect to a given continuation (`suffixInput`).
     * For example, for `prefixInput: "123"` and `suffixInput: "789"`, the model is expected to generate `456`
     * to make the final text be `123456789`.
     */
    public async generateInfillCompletion(
        prefixInput: Token[] | string | LlamaText,
        suffixInput: Token[] | string | LlamaText,
        options: LlamaInfillGenerationOptions = {}
    ) {
        const {response} = await this.generateInfillCompletionWithMeta(prefixInput, suffixInput, options);

        return response;
    }

    /**
     * Same as `generateInfillCompletion`, but returns additional metadata about the generation.
     * See `generateInfillCompletion` for more information.
     */
    public async generateInfillCompletionWithMeta(
        prefixInput: Token[] | string | LlamaText,
        suffixInput: Token[] | string | LlamaText,
        {
            onToken,
            signal,
            maxTokens,
            temperature,
            minP,
            topK,
            topP,
            trimWhitespaceSuffix = false,
            repeatPenalty = {},
            tokenBias,
            evaluationPriority = 5,
            grammar,
            contextShiftSize = defaultContextShiftSize,
            customStopTriggers,
            minPrefixKeepTokens = defaultMinPrefixKeepTokens,
            disableContextShift = false
        }: LlamaInfillGenerationOptions = {}
    ): Promise<LlamaCompletionResponse> {
        if (this._sequence == null || this.disposed)
            throw new DisposedError();

        const prefixToken = this._sequence.model.tokens.infill.prefix;
        const suffixToken = this._sequence.model.tokens.infill.suffix;
        const middleToken = this._sequence.model.tokens.infill.middle;
        const bosToken = this._sequence.model.tokens.bos;
        const shouldPrependBosToken = this._sequence.model.tokens.shouldPrependBosToken;

        if (prefixToken == null || suffixToken == null || middleToken == null)
            throw new UnsupportedError("Infill completions are not supported by this model");

        async function fitInputIntoContext({
            maxTokens, prefixTokens, suffixTokens, sequence
        }: {
            maxTokens: number, prefixTokens: Token[], suffixTokens: Token[], sequence: LlamaContextSequence
        }): Promise<Token[]> {
            if (prefixToken == null || suffixToken == null || middleToken == null)
                throw new UnsupportedError("Infill completions are not supported by this model");

            // 3 - InfillPrefix token, InfillSuffix token, InfillMiddle token
            const specialTokensInContext = 3 + (
                (shouldPrependBosToken && bosToken != null)
                    ? 1
                    : 0
            );
            const resolvedMaxTokens = maxTokens - specialTokensInContext;
            let sizeLeftToFill = resolvedMaxTokens;

            let suffixTokensSize = Math.min(sizeLeftToFill, suffixTokens.length);
            sizeLeftToFill -= suffixTokensSize;

            let prefixTokensSize = Math.min(sizeLeftToFill, prefixTokens.length);
            sizeLeftToFill -= prefixTokensSize;

            if (sizeLeftToFill <= 0 && disableContextShift)
                throw new Error(
                    "The context size is too small to generate a response for the given input, and context shift is disabled. " +
                    "Consider removing `disableContextShift` or reducing the input size."
                );

            const resolvedMinPrefixKeepTokens = Math.min(
                Math.min(resolvedMaxTokens, prefixTokens.length),
                Math.max(
                    1,
                    Math.floor(
                        minPrefixKeepTokens instanceof Function
                            ? await minPrefixKeepTokens(sequence)
                            : minPrefixKeepTokens
                    )
                )
            );

            if (prefixTokensSize < resolvedMinPrefixKeepTokens) {
                const diffToFill = Math.min(suffixTokensSize, resolvedMinPrefixKeepTokens - prefixTokensSize);
                prefixTokensSize += diffToFill;
                suffixTokensSize -= diffToFill;
            }

            const resolvedPrefixTokens = prefixTokens.slice(-prefixTokensSize);
            const resolvedSuffixTokens = suffixTokens.slice(0, suffixTokensSize);

            const newContextState: Token[] = [];

            if (shouldPrependBosToken && bosToken != null)
                newContextState.push(bosToken);

            newContextState.push(prefixToken);
            pushAll(newContextState, resolvedPrefixTokens);

            newContextState.push(suffixToken);
            pushAll(newContextState, resolvedSuffixTokens);

            newContextState.push(middleToken);

            return newContextState;
        }

        const ensureNotAborted = () => {
            if (signal?.aborted)
                throw signal.reason;

            if (this.disposed)
                throw new DisposedError();
        };

        return await withLock(this, "generateCompletion", signal, async () => {
            ensureNotAborted();

            if (this._sequence == null || this.disposed)
                throw new DisposedError();

            const resolvedPrefixInputTokens = tokenizeInput(prefixInput, this._sequence.model.tokenizer, "trimLeadingSpace");
            const resolvedSuffixInputTokens = tokenizeInput(suffixInput, this._sequence.model.tokenizer, "trimLeadingSpace");
            const resolvedContextShiftSize = await resolveContextShiftSize(contextShiftSize, this._sequence);
            ensureNotAborted();

            const inputTokens = await fitInputIntoContext({
                maxTokens: this._sequence.context.contextSize - resolvedContextShiftSize,
                prefixTokens: resolvedPrefixInputTokens,
                suffixTokens: resolvedSuffixInputTokens,
                sequence: this._sequence
            });
            ensureNotAborted();

            const resolvedMaxTokens = !disableContextShift
                ? maxTokens
                : (maxTokens != null && maxTokens > 0)
                    ? Math.min(maxTokens, this._sequence.context.contextSize - inputTokens.length)
                    : this._sequence.context.contextSize - inputTokens.length;

            return await this._generateResponse(inputTokens, {
                onToken: safeEventCallback(onToken),
                signal,
                maxTokens: resolvedMaxTokens,
                temperature,
                minP,
                topK,
                topP,
                trimWhitespaceSuffix,
                repeatPenalty,
                tokenBias,
                evaluationPriority,
                grammar,
                contextShiftSize,
                customStopTriggers
            }, {
                async contextShift({shiftSize, res, pendingTokens, sequence}): Promise<{
                    newContextState: Token[]
                }> {
                    return {
                        newContextState: await fitInputIntoContext({
                            maxTokens: sequence.context.contextSize - shiftSize,
                            prefixTokens: [...resolvedPrefixInputTokens, ...res, ...pendingTokens],
                            suffixTokens: resolvedSuffixInputTokens,
                            sequence
                        })
                    };
                }
            });
        });
    }

    /** @internal */
    private async _generateResponse(
        tokens: Token[],
        {
            onToken,
            signal,
            maxTokens,
            temperature,
            minP,
            topK,
            topP,
            trimWhitespaceSuffix = false,
            repeatPenalty = {},
            tokenBias,
            evaluationPriority = 5,
            grammar,
            contextShiftSize = defaultContextShiftSize,
            customStopTriggers
        }: LlamaCompletionGenerationOptions,
        {
            contextShift
        }: {
            contextShift(state: {
                shiftSize: number,
                res: Token[],
                pendingTokens: Token[],
                sequence: LlamaContextSequence
            }): Promise<{newContextState: Token[]}>
        }
    ): Promise<LlamaCompletionResponse> {
        if (this._sequence == null)
            throw new DisposedError();

        const sequence = this._sequence;
        const model = sequence.model;
        const context = sequence.context;

        const res: Token[] = [];
        const pendingTokens: Token[] = [];
        const grammarEvaluationState = grammar != null
            ? new LlamaGrammarEvaluationState({grammar})
            : undefined;
        const {
            lastTokens: repeatPenaltyLastTokens = 64,
            punishTokensFilter,
            penalizeNewLine,
            penalty,
            frequencyPenalty,
            presencePenalty
        }: LLamaContextualRepeatPenalty = repeatPenalty === false
            ? {lastTokens: 0}
            : repeatPenalty;
        const streamRegulator = new TokenStreamRegulator();
        const stopGenerationDetector = new StopGenerationDetector();
        const customStopGenerationTriggersDetector = new StopGenerationDetector();
        const locksToReleaseOnValidGeneration: QueuedTokenReleaseLock[] = [];
        const repeatPenaltyEnabled = repeatPenaltyLastTokens > 0;

        let inputTokens = tokens;
        let generatedTokens = 0;

        if (grammar != null)
            StopGenerationDetector.resolveStopTriggers(grammar.stopGenerationTriggers, model.tokenizer)
                .map((stopTrigger) => stopGenerationDetector.addStopTrigger(stopTrigger));

        if (customStopTriggers != null)
            StopGenerationDetector.resolveStopTriggers(customStopTriggers, model.tokenizer)
                .map((stopTrigger) => customStopGenerationTriggersDetector.addStopTrigger(stopTrigger));

        const ensureNotAborted = () => {
            if (signal?.aborted)
                throw signal.reason;

            if (this.disposed)
                throw new DisposedError();
        };

        const getPenaltyTokens = () => {
            if (this._sequence == null)
                throw new DisposedError();

            let punishTokens = res.slice(-repeatPenaltyLastTokens);

            if (punishTokensFilter != null)
                punishTokens = punishTokensFilter(punishTokens);

            if (penalizeNewLine == null || !penalizeNewLine) {
                const nlToken = model.tokens.nl;

                if (nlToken != null)
                    punishTokens = punishTokens.filter(token => token !== nlToken);
            }

            return punishTokens;
        };

        // eslint-disable-next-line no-constant-condition
        while (true) {
            ensureNotAborted();

            let shouldContextShift = false;

            let {firstDifferentIndex} = sequence.compareContextTokens(inputTokens);

            // we need to decode at least one token to generate a response
            if (firstDifferentIndex === inputTokens.length && firstDifferentIndex > 0)
                firstDifferentIndex -= 1;

            inputTokens.splice(0, firstDifferentIndex);

            if (firstDifferentIndex < sequence.nextTokenIndex) {
                await sequence.eraseContextTokenRanges([{
                    start: firstDifferentIndex,
                    end: sequence.nextTokenIndex
                }]);
                ensureNotAborted();
            }

            const evaluationIterator = sequence.evaluate(inputTokens, removeNullFields({
                temperature, minP, topK, topP,
                grammarEvaluationState,
                repeatPenalty: !repeatPenaltyEnabled ? undefined : {
                    punishTokens: getPenaltyTokens,
                    penalty,
                    frequencyPenalty,
                    presencePenalty
                },
                tokenBias,
                evaluationPriority,
                yieldEogToken: true
            }));

            for await (const token of evaluationIterator) {
                ensureNotAborted();
                generatedTokens++;

                const tokens = [token];
                const text = model.detokenize([token]);
                const queuedTokenRelease = streamRegulator.addChunk({tokens, text});

                if (text === UNKNOWN_UNICODE_CHAR || (
                    (grammar?.trimWhitespaceSuffix || trimWhitespaceSuffix) && text.trim() === ""
                )) {
                    locksToReleaseOnValidGeneration.push(queuedTokenRelease.createTextIndexLock(0));
                } else {
                    while (locksToReleaseOnValidGeneration.length > 0)
                        locksToReleaseOnValidGeneration.shift()!.dispose();
                }

                stopGenerationDetector.recordGeneration({text, tokens, queuedTokenRelease});
                customStopGenerationTriggersDetector.recordGeneration({text, tokens, queuedTokenRelease});

                pushAll(pendingTokens, streamRegulator.popFreeChunkTokens());

                if (stopGenerationDetector.hasTriggeredStops || customStopGenerationTriggersDetector.hasTriggeredStops ||
                    model.isEogToken(token)
                ) {
                    const triggeredStops  = stopGenerationDetector.hasTriggeredStops
                        ? stopGenerationDetector.getTriggeredStops()
                        : customStopGenerationTriggersDetector.getTriggeredStops();
                    const partiallyFreeTokens = streamRegulator.getPartiallyFreeChunk(model.tokenizer);

                    const queuedTokensBeforeStopTrigger = getQueuedTokensBeforeStopTrigger(
                        triggeredStops,
                        partiallyFreeTokens,
                        model.tokenizer
                    );
                    pushAll(pendingTokens, queuedTokensBeforeStopTrigger);

                    const firstRemainingGenerationAfterStop = StopGenerationDetector.getFirstRemainingGenerationAfterStop(triggeredStops);

                    if (pendingTokens.length > 0)
                        onToken?.(pendingTokens.slice());

                    pushAll(res, pendingTokens);
                    pendingTokens.length = 0;

                    let modelResponse = model.detokenize(res);

                    if (grammar?.trimWhitespaceSuffix || trimWhitespaceSuffix)
                        modelResponse = modelResponse.trimEnd();

                    const isEogToken = model.isEogToken(token);

                    if (isEogToken || stopGenerationDetector.hasTriggeredStops)
                        return {
                            response: modelResponse,
                            metadata: {
                                remainingGenerationAfterStop: firstRemainingGenerationAfterStop,
                                stopReason: isEogToken
                                    ? "eogToken"
                                    : "stopGenerationTrigger"
                            }
                        };

                    return {
                        response: modelResponse,
                        metadata: {
                            remainingGenerationAfterStop: firstRemainingGenerationAfterStop,
                            stopReason: "customStopTrigger",
                            customStopTrigger: triggeredStops[0].stopTrigger
                        }
                    };
                }

                if (pendingTokens.length > 0) {
                    onToken?.(pendingTokens.slice());
                    pushAll(res, pendingTokens);
                    pendingTokens.length = 0;
                }

                if (maxTokens != null && maxTokens > 0 && generatedTokens >= maxTokens) {
                    let modelResponse = model.detokenize(res);

                    if (grammar?.trimWhitespaceSuffix || trimWhitespaceSuffix)
                        modelResponse = modelResponse.trimEnd();

                    return {
                        response: modelResponse,
                        metadata: {
                            stopReason: "maxTokens"
                        }
                    };
                }

                if (sequence.nextTokenIndex >= context.contextSize - 1) {
                    shouldContextShift = true;
                    break;
                }
            }

            if (shouldContextShift) {
                const resolvedContextShiftSize = await resolveContextShiftSize(contextShiftSize, sequence);
                ensureNotAborted();

                const {newContextState} = await contextShift({
                    shiftSize: resolvedContextShiftSize,
                    res,
                    pendingTokens,
                    sequence
                });
                ensureNotAborted();
                inputTokens = newContextState;

                continue;
            }

            break;
        }

        throw new Error("The context size is too small to generate a response");
    }
}

async function resolveContextShiftSize(
    contextShiftSize: Required<LlamaCompletionGenerationOptions>["contextShiftSize"],
    sequence: LlamaContextSequence
) {
    if (typeof contextShiftSize === "number")
        return contextShiftSize;
    else if (contextShiftSize instanceof Function)
        return Math.min(
            sequence.context.contextSize,
            Math.max(
                1,
                Math.floor(
                    contextShiftSize instanceof Function
                        ? await contextShiftSize(sequence)
                        : contextShiftSize
                )
            )
        );

    return defaultContextShiftSize(sequence);
}
