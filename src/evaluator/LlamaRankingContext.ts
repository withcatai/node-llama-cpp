import {AsyncDisposeAggregator, EventRelay, splitText, withLock} from "lifecycle-utils";
import {Token} from "../types.js";
import {LlamaText} from "../utils/LlamaText.js";
import {tokenizeInput} from "../utils/tokenizeInput.js";
import {resolveBeginningTokenToPrepend, resolveEndTokenToAppend} from "../utils/tokenizerUtils.js";
import {isRankingTemplateValid, parseRankingTemplate} from "../gguf/insights/GgufInsights.js";
import {GgufArchitectureType} from "../gguf/types/GgufMetadataTypes.js";
import type {LlamaModel} from "./LlamaModel/LlamaModel.js";
import type {LlamaContext, LlamaContextSequence} from "./LlamaContext/LlamaContext.js";

export type LlamaRankingContextOptions = {
    /**
     * The number of tokens the model can see at once.
     * - **`"auto"`** - adapt to the current VRAM state and attempt to set the context size as high as possible up to the size
     * the model was trained on.
     * - **`number`** - set the context size to a specific number of tokens.
     * If there's not enough VRAM, an error will be thrown.
     * Use with caution.
     * - **`{min?: number, max?: number}`** - adapt to the current VRAM state and attempt to set the context size as high as possible
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
     * The template to use for the ranking evaluation.
     * If not provided, the model's template will be used by default.
     *
     * The template is tokenized with special tokens enabled, but the provided query and document are not.
     *
     * **<span v-pre>`{{query}}`</span>** is replaced with the query content.
     *
     * **<span v-pre>`{{document}}`</span>** is replaced with the document content.
     *
     * It's recommended to not set this option unless you know what you're doing.
     *
     * Defaults to the model's template.
     */
    template?: `${string}{{query}}${string}{{document}}${string}` | `${string}{{document}}${string}{{query}}${string}`,

    /**
     * Ignore insufficient memory errors and continue with the context creation.
     * Can cause the process to crash if there's not enough VRAM for the new context.
     *
     * Defaults to `false`.
     */
    ignoreMemorySafetyChecks?: boolean
};

export type RankingOptions = {
    /**
     * When the given document it too big that it exceeds the context size, this option determines how to handle it.
     *
     * - `"throw"`: throw an error
     * - `"maxChunk"`: split the document into smaller chunks that would fit the context, rank all of them,
     *     and return the highest ranking score among the chunks. By default, sequential chunks will overlap by at least 50%.
     *
     * Default to `"throw"`.
     */
    onOverflow?: "throw" | "maxChunk" | {
        type: "throw"
    } | {
        type: "maxChunk",

        /**
         * The percentage of overlap between sequential chunks when splitting the document.
         *
         * Defaults to `0.5`.
         */
        overlapPercentage?: number
    }
};

const defaultOverlapPercentage = 0.5;

/**
 * @see [Reranking Documents](https://node-llama-cpp.withcat.ai/guide/embedding#reranking) tutorial
 */
export class LlamaRankingContext {
    /** @internal */ private readonly _llamaContext: LlamaContext;
    /** @internal */ private readonly _template: string | undefined;
    /** @internal */ private readonly _templateDocumentInstances?: number;
    /** @internal */ private readonly _sequence: LlamaContextSequence;
    /** @internal */ private readonly _disposeAggregator = new AsyncDisposeAggregator();

    public readonly onDispose = new EventRelay<void>();

    private constructor({
        _llamaContext,
        _template
    }: {
        _llamaContext: LlamaContext,
        _template: string | undefined
    }) {
        this._llamaContext = _llamaContext;
        this._template = _template;
        this._templateDocumentInstances = _template == null
            ? undefined
            : _template.split("{{document}}").length - 1;
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
     *
     * A ranking score is a number between 0 and 1 representing the probability that the document is relevant to the query.
     * @returns a ranking score between 0 and 1 representing the probability that the document is relevant to the query.
     */
    public async rank(
        query: Token[] | string | LlamaText,
        document: Token[] | string | LlamaText,
        options?: RankingOptions
    ): Promise<number> {
        const resolvedQuery = tokenizeInput(query, this._llamaContext.model.tokenizer, "trimLeadingSpace", false);
        const resolvedDocument = tokenizeInput(document, this._llamaContext.model.tokenizer, "trimLeadingSpace", false);
        const resolvedInput = this._chunkEvaluatedInputs(resolvedQuery, resolvedDocument, options);

        if (resolvedInput[0] == null)
            throw new Error("Failed to generate a valid input for ranking.");
        else if (resolvedInput.length === 1 && resolvedInput[0].length >= this._llamaContext.contextSize)
            throw new Error(
                "The input length exceed the context size. " +
                `Try to increase the context size to at least ${resolvedInput[0].length + 1} ` +
                "or use another model that supports longer contexts."
            );

        return getMaxScore(await this._evaluateChunks(resolvedInput));
    }

    /**
     * Get the ranking scores for all the given documents for a query.
     *
     * A ranking score is a number between 0 and 1 representing the probability that the document is relevant to the query.
     * @returns an array of ranking scores between 0 and 1 representing the probability that the document is relevant to the query.
     */
    public async rankAll(
        query: Token[] | string | LlamaText,
        documents: Array<Token[] | string | LlamaText>,
        options?: RankingOptions
    ): Promise<number[]> {
        const resolvedQuery = tokenizeInput(query, this._llamaContext.model.tokenizer, "trimLeadingSpace", false);
        const resolvedInputs = documents.map((document) => this._chunkEvaluatedInputs(
            resolvedQuery,
            tokenizeInput(document, this._llamaContext.model.tokenizer, "trimLeadingSpace", false),
            options
        ));
        const maxInputTokensLength = resolvedInputs.reduce((max, chunks) => (
            (chunks[0] == null || chunks.length !== 1)
                ? max
                : Math.max(max, chunks[0].length)
        ), 0);

        if (maxInputTokensLength >= this._llamaContext.contextSize)
            throw new Error(
                "The input lengths of some of the given documents exceed the context size. " +
                `Try to increase the context size to at least ${maxInputTokensLength + 1} ` +
                "or use another model that supports longer contexts."
            );
        else if (resolvedInputs.length === 0)
            return [];

        return await Promise.all(
            resolvedInputs.map(async (chunks) => getMaxScore(await this._evaluateChunks(chunks)))
        );
    }

    /**
     * Get the ranking scores for all the given documents for a query and sort them by score from highest to lowest.
     *
     * A ranking score is a number between 0 and 1 representing the probability that the document is relevant to the query.
     */
    public async rankAndSort<const T extends string>(query: Token[] | string | LlamaText, documents: T[]): Promise<Array<{
        document: T,

        /**
         * A ranking score is a number between 0 and 1 representing the probability that the document is relevant to the query.
         */
        score: number
    }>> {
        const scores = await this.rankAll(query, documents);

        return documents
            .map((document, index) => ({document: document as T, score: scores[index]!}))
            .sort((a, b) => b.score - a.score);
    }

    /** Calculate the input length for a given query and document so you can determine whether it fits in the context size */
    public calculateInputLength(query: Token[] | string | LlamaText, document: Token[] | string | LlamaText) {
        const resolvedQuery = tokenizeInput(query, this._llamaContext.model.tokenizer, "trimLeadingSpace", false);
        const resolvedDocument = tokenizeInput(document, this._llamaContext.model.tokenizer, "trimLeadingSpace", false);
        return this._getEvaluationInput(resolvedQuery, resolvedDocument).length;
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

    public get contextSize() {
        return this._llamaContext.contextSize;
    }

    /** @internal */
    private _getEvaluationInput(query: Token[], document: Token[]) {
        if (this._template != null) {
            const resolvedInput = splitText(this._template, ["{{query}}", "{{document}}"])
                .flatMap((item) => {
                    if (typeof item === "string")
                        return this._llamaContext.model.tokenize(item, true, "trimLeadingSpace");
                    else if (item.separator === "{{query}}")
                        return query;
                    else if (item.separator === "{{document}}")
                        return document;
                    else
                        void (item satisfies never);

                    void (item satisfies never);
                    return [];
                });

            const beginningTokens = resolveBeginningTokenToPrepend(this.model.vocabularyType, this.model.tokens);
            const endToken = resolveEndTokenToAppend(this.model.vocabularyType, this.model.tokens);

            if (beginningTokens != null && resolvedInput.at(0) !== beginningTokens)
                resolvedInput.unshift(beginningTokens);

            if (endToken != null && resolvedInput.at(-1) !== endToken)
                resolvedInput.unshift(endToken);

            return resolvedInput;
        }

        if (this.model.tokens.eos == null && this.model.tokens.sep == null)
            throw new Error("Computing rankings is not supported for this model.");

        if (query.length === 0 && document.length === 0)
            return [];

        const resolvedInput = [
            ...(this.model.tokens.bos == null ? [] : [this.model.tokens.bos]),
            ...query,
            ...(this.model.tokens.eos == null ? [] : [this.model.tokens.eos]),
            ...(this.model.tokens.sep == null ? [] : [this.model.tokens.sep]),
            ...document,
            ...(this.model.tokens.eos == null ? [] : [this.model.tokens.eos])
        ];

        return resolvedInput;
    }

    /** @internal */
    private _evaluateRankingForInput(input: Token[]): Promise<number> {
        if (input.length === 0)
            return Promise.resolve(0);

        return withLock([this as LlamaRankingContext, "evaluate"], async () => {
            await this._sequence.eraseContextTokenRanges([{
                start: 0,
                end: this._sequence.nextTokenIndex
            }]);

            const iterator = this._sequence.evaluate(input, {_noSampling: true});
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for await (const token of iterator) {
                break; // only generate one token to get embeddings
            }

            const embedding = this._llamaContext._ctx.getEmbedding(input.length, 1);
            if (embedding.length === 0)
                return 0;

            const evalValue = embedding[0]!;
            const probability = this._currentArchRankingAlreadyNormalized
                ? evalValue
                : logitToSigmoid(evalValue);

            return probability;
        });
    }

    private _evaluateChunks(input: Token[][]): Promise<number[]> {
        return Promise.all(input.map((chunk) => this._evaluateRankingForInput(chunk)));
    }

    /** @internal */
    private _chunkEvaluatedInputs(query: Token[], document: Token[], options?: RankingOptions): Token[][] {
        const fullInput = this._getEvaluationInput(query, document);
        if (fullInput.length < this._llamaContext.contextSize || options?.onOverflow == null || options?.onOverflow === "throw" || (
            typeof options?.onOverflow === "object" && options.onOverflow.type === "throw"
        ))
            return [fullInput];

        const templateDocumentInstances = Math.max(1, this._templateDocumentInstances ?? 1);
        const maxChunkSize = Math.floor(
            (
                this._llamaContext.contextSize - (fullInput.length - (document.length * templateDocumentInstances)) - 1
            ) / templateDocumentInstances
        );
        if (maxChunkSize <= 0)
            throw new Error("The document is too long to fit into the context window with the given query");

        const overlapPercentage = (typeof options?.onOverflow === "object" && options.onOverflow.type === "maxChunk" && options.onOverflow.overlapPercentage != null)
            ? Math.min(1, Math.max(0, Math.min(1, options.onOverflow.overlapPercentage)))
            : defaultOverlapPercentage;

        const overlapTokens = Math.min(Math.max(0, Math.ceil(maxChunkSize * overlapPercentage)), maxChunkSize - 1);

        const result: Token[][] = [];
        let start = 0;
        while (start < document.length) {
            const end = Math.min(start + maxChunkSize, document.length);
            result.push(this._getEvaluationInput(query, document.slice(start, end)));

            if (end === document.length)
                break;

            start = Math.min(end - overlapTokens, document.length - maxChunkSize);
        }

        return result;
    }

    /** @internal */
    private get _currentArchRankingAlreadyNormalized() {
        const architecture = this.model.fileInfo.metadata?.general?.architecture;

        // source: `llm_graph_context::build_pooling` in `llama-graph.cpp`, the arches where `cur = ggml_soft_max(ctx0, cur)` is called
        return architecture === GgufArchitectureType.qwen3 || architecture === GgufArchitectureType.qwen3vl;
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
        template,
        ignoreMemorySafetyChecks
    }: LlamaRankingContextOptions) {
        const resolvedTemplate = template ?? parseRankingTemplate(_model.fileInfo.metadata?.tokenizer?.["chat_template.rerank"]);

        if (_model.tokens.eos == null && _model.tokens.sep == null) {
            if (!isRankingTemplateValid(resolvedTemplate)) {
                if (resolvedTemplate === _model.fileInfo.metadata?.tokenizer?.["chat_template.rerank"])
                    throw new Error("The model's builtin template is invalid. It must contain both {query} and {document} placeholders.");
                else
                    throw new Error("The provided template is invalid. It must contain both {{query}} and {{document}} placeholders.");
            } else if (resolvedTemplate == null)
                throw new Error("Computing rankings is not supported for this model.");
        }

        if (_model.fileInsights.hasEncoder && _model.fileInsights.hasDecoder)
            throw new Error("Computing rankings is not supported for encoder-decoder models.");

        if (!_model.fileInsights.supportsRanking)
            throw new Error("Computing rankings is not supported for this model.");

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
            _llamaContext: llamaContext,
            _template: resolvedTemplate
        });
    }
}

function logitToSigmoid(logit: number) {
    return 1 / (1 + Math.exp(-logit));
}

function getMaxScore(arr: number[]) {
    let max = 0;
    for (const num of arr) {
        if (num > max) {
            max = num;
        }
    }
    return max;
}
