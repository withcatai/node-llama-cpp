import {AsyncDisposeAggregator, EventRelay, withLock} from "lifecycle-utils";
import {Token} from "../types.js";
import {LlamaText} from "../utils/LlamaText.js";
import {tokenizeInput} from "../utils/tokenizeInput.js";
import type {LlamaModel} from "./LlamaModel/LlamaModel.js";
import type {LlamaContext, LlamaContextSequence} from "./LlamaContext/LlamaContext.js";
import type {GgufTensorInfo} from "../gguf/types/GgufTensorInfoTypes.js";

export type LlamaRankingContextOptions = {
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

    /** prompt processing batch size */
    batchSize?: number,

    /**
     * number of threads to use to evaluate tokens.
     * set to 0 to use the maximum threads supported by the current machine hardware
     */
    threads?: number,

    /** An abort signal to abort the context creation */
    createSignal?: AbortSignal,

    /**
     * Ignore insufficient memory errors and continue with the context creation.
     * Can cause the process to crash if there's not enough VRAM for the new context.
     *
     * Defaults to `false`.
     */
    ignoreMemorySafetyChecks?: boolean
};

/**
 * @see [Reranking Documents](https://node-llama-cpp.withcat.ai/guide/embedding#reranking) tutorial
 */
export class LlamaRankingContext {
    /** @internal */ private readonly _llamaContext: LlamaContext;
    /** @internal */ private readonly _sequence: LlamaContextSequence;
    /** @internal */ private readonly _disposeAggregator = new AsyncDisposeAggregator();

    public readonly onDispose = new EventRelay<void>();

    private constructor({
        _llamaContext
    }: {
        _llamaContext: LlamaContext
    }) {
        this._llamaContext = _llamaContext;
        this._sequence = this._llamaContext.getSequence();

        this._disposeAggregator.add(
            this._llamaContext.onDispose.createListener(() => {
                void this._disposeAggregator.dispose();
            })
        );
        this._disposeAggregator.add(this.onDispose.dispatchEvent);
        this._disposeAggregator.add(async () => {
            await this._llamaContext.dispose();
        });
    }

    /**
     * Get the ranking score for a document for a query.
     */
    public async rank(query: Token[] | string | LlamaText, document: Token[] | string | LlamaText) {
        if (this.model.tokens.bos == null || this.model.tokens.eos == null || this.model.tokens.sep == null)
            throw new Error("Computing rankings is not supported for this model.");

        const resolvedInput = this._getEvaluationInput(query, document);

        if (resolvedInput.length > this._llamaContext.contextSize)
            throw new Error(
                "Input is longer than the context size. " +
                "Try to increase the context size or use another model that supports longer contexts."
            );
        else if (resolvedInput.length === 0)
            return -Infinity;

        return this._evaluateRankingForInput(resolvedInput);
    }

    /**
     * Get the ranking scores for all the given documents for a query.
     */
    public async rankAll(query: Token[] | string | LlamaText, documents: Array<Token[] | string | LlamaText>): Promise<number[]> {
        const resolvedTokens = documents.map((document) => this._getEvaluationInput(query, document));

        if (resolvedTokens.some((tokens) => tokens.length > this._llamaContext.contextSize))
            throw new Error(
                "The input of one of the document is longer than the context size. " +
                "Try to increase the context size or use another model that supports longer contexts."
            );
        else if (resolvedTokens.length === 0)
            return [];

        return await Promise.all(
            resolvedTokens.map((tokens) => {
                if (tokens.length === 0)
                    return -Infinity;

                return this._evaluateRankingForInput(tokens);
            })
        );
    }

    /**
     * Get the ranking scores for all the given documents for a query and sort them by score from highest to lowest.
     */
    public async rankAndSort<const T extends string>(query: Token[] | string | LlamaText, documents: T[]): Promise<Array<{
        document: T,
        score: number
    }>> {
        const scores = await this.rankAll(query, documents);

        return documents
            .map((document, index) => ({document: document as T, score: scores[index]!}))
            .sort((a, b) => b.score - a.score);
    }

    public async dispose() {
        await this._disposeAggregator.dispose();
    }

    /** @hidden */
    public [Symbol.asyncDispose]() {
        return this.dispose();
    }

    public get disposed() {
        return this._llamaContext.disposed;
    }

    public get model() {
        return this._llamaContext.model;
    }

    /** @internal */
    private _getEvaluationInput(query: Token[] | string | LlamaText, document: Token[] | string | LlamaText) {
        if (this.model.tokens.bos == null || this.model.tokens.eos == null || this.model.tokens.sep == null)
            throw new Error("Computing rankings is not supported for this model.");

        const resolvedQuery = tokenizeInput(query, this._llamaContext.model.tokenizer, "trimLeadingSpace", false);
        const resolvedDocument = tokenizeInput(document, this._llamaContext.model.tokenizer, "trimLeadingSpace", false);

        if (resolvedQuery.length === 0 && resolvedDocument.length === 0)
            return [];

        const resolvedInput = [
            this.model.tokens.bos,
            ...resolvedQuery,
            this.model.tokens.eos,
            this.model.tokens.sep,
            ...resolvedDocument,
            this.model.tokens.eos
        ];

        return resolvedInput;
    }

    /** @internal */
    private _evaluateRankingForInput(input: Token[]): Promise<number> {
        return withLock(this, "evaluate", async () => {
            await this._sequence.eraseContextTokenRanges([{
                start: 0,
                end: this._sequence.nextTokenIndex
            }]);

            const iterator = this._sequence.evaluate(input, {_noSampling: true});
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for await (const token of iterator) {
                break; // only generate one token to get embeddings
            }

            const embedding = this._llamaContext._ctx.getEmbedding(input.length);
            if (embedding.length === 0)
                return 0;

            return embedding[0]!;
        });
    }

    /** @internal */
    public static async _create({
        _model
    }: {
        _model: LlamaModel
    }, {
        contextSize,
        batchSize,
        threads = 6,
        createSignal,
        ignoreMemorySafetyChecks
    }: LlamaRankingContextOptions) {
        const tensorInfo = _model.fileInfo.tensorInfo;

        if (_model.tokens.bos == null || _model.tokens.eos == null || _model.tokens.sep == null)
            throw new Error("Computing rankings is not supported for this model.");

        // source: `append_pooling` in `llama.cpp`
        if (findLayer(tensorInfo, "cls", "weight") == null || findLayer(tensorInfo, "cls", "bias") == null)
            throw new Error("Computing rankings is not supported for this model.");

        // source: `append_pooling` in `llama.cpp`
        if (findLayer(tensorInfo, "cls.output", "weight") != null && findLayer(tensorInfo, "cls.output", "bias") == null)
            throw new Error("Computing rankings is not supported for this model.");

        if (_model.fileInsights.hasEncoder && _model.fileInsights.hasDecoder)
            throw new Error("Computing rankings is not supported for encoder-decoder models.");

        const llamaContext = await _model.createContext({
            contextSize,
            batchSize,
            threads,
            createSignal,
            ignoreMemorySafetyChecks,
            _embeddings: true,
            _ranking: true
        });

        return new LlamaRankingContext({
            _llamaContext: llamaContext
        });
    }
}

function findLayer(tensorInfo: GgufTensorInfo[] | undefined, name: string, suffix: string) {
    if (tensorInfo == null)
        return undefined;

    for (const tensor of tensorInfo) {
        if (tensor.name === name + "." + suffix)
            return tensor;
    }

    return undefined;
}
