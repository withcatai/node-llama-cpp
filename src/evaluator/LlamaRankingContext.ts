import {AsyncDisposeAggregator, EventRelay, splitText, withLock} from "lifecycle-utils";
import {Token} from "../types.js";
import {LlamaText} from "../utils/LlamaText.js";
import {tokenizeInput} from "../utils/tokenizeInput.js";
import {resolveBeginningTokenToPrepend, resolveEndTokenToAppend} from "../utils/tokenizerUtils.js";
import {isRankingTemplateValid, parseRankingTemplate} from "../gguf/insights/GgufInsights.js";
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

/**
 * @see [Reranking Documents](https://node-llama-cpp.withcat.ai/guide/embedding#reranking) tutorial
 */
export class LlamaRankingContext {
    /** @internal */ private readonly _llamaContext: LlamaContext;
    /** @internal */ private readonly _template: string | undefined;
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
    public async rank(query: Token[] | string | LlamaText, document: Token[] | string | LlamaText) {
        const resolvedInput = this._getEvaluationInput(query, document);

        if (resolvedInput.length > this._llamaContext.contextSize)
            throw new Error(
                "The input length exceed the context size. " +
                `Try to increase the context size to at least ${resolvedInput.length + 1} ` +
                "or use another model that supports longer contexts."
            );

        return this._evaluateRankingForInput(resolvedInput);
    }

    /**
     * Get the ranking scores for all the given documents for a query.
     *
     * A ranking score is a number between 0 and 1 representing the probability that the document is relevant to the query.
     * @returns an array of ranking scores between 0 and 1 representing the probability that the document is relevant to the query.
     */
    public async rankAll(query: Token[] | string | LlamaText, documents: Array<Token[] | string | LlamaText>): Promise<number[]> {
        const resolvedTokens = documents.map((document) => this._getEvaluationInput(query, document));
        const maxInputTokensLength = resolvedTokens.reduce((max, tokens) => Math.max(max, tokens.length), 0);

        if (maxInputTokensLength > this._llamaContext.contextSize)
            throw new Error(
                "The input lengths of some of the given documents exceed the context size. " +
                `Try to increase the context size to at least ${maxInputTokensLength + 1} ` +
                "or use another model that supports longer contexts."
            );
        else if (resolvedTokens.length === 0)
            return [];

        return await Promise.all(
            resolvedTokens.map((tokens) => this._evaluateRankingForInput(tokens))
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
        if (this._template != null) {
            const resolvedInput = splitText(this._template, ["{{query}}", "{{document}}"])
                .flatMap((item) => {
                    if (typeof item === "string")
                        return this._llamaContext.model.tokenize(item, true, "trimLeadingSpace");
                    else if (item.separator === "{{query}}")
                        return tokenizeInput(query, this._llamaContext.model.tokenizer, "trimLeadingSpace", false);
                    else if (item.separator === "{{document}}")
                        return tokenizeInput(document, this._llamaContext.model.tokenizer, "trimLeadingSpace", false);
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

        const resolvedQuery = tokenizeInput(query, this._llamaContext.model.tokenizer, "trimLeadingSpace", false);
        const resolvedDocument = tokenizeInput(document, this._llamaContext.model.tokenizer, "trimLeadingSpace", false);

        if (resolvedQuery.length === 0 && resolvedDocument.length === 0)
            return [];

        const resolvedInput = [
            ...(this.model.tokens.bos == null ? [] : [this.model.tokens.bos]),
            ...resolvedQuery,
            ...(this.model.tokens.eos == null ? [] : [this.model.tokens.eos]),
            ...(this.model.tokens.sep == null ? [] : [this.model.tokens.sep]),
            ...resolvedDocument,
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

            const logit = embedding[0]!;
            const probability = logitToSigmoid(logit);

            return probability;
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
