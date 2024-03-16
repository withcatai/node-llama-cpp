import {AsyncDisposeAggregator, EventRelay, withLock} from "lifecycle-utils";
import {Token} from "../types.js";
import {LlamaText} from "../utils/LlamaText.js";
import {tokenizeInput} from "../utils/tokenizeInput.js";
import type {LlamaModel} from "./LlamaModel.js";
import type {LlamaContext, LlamaContextSequence} from "./LlamaContext/LlamaContext.js";

export type LlamaEmbeddingContextOptions = {
    /** text context size */
    contextSize?: number,

    /** prompt processing batch size */
    batchSize?: number,

    /**
     * number of threads to use to evaluate tokens.
     * set to 0 to use the maximum threads supported by the current machine hardware
     */
    threads?: number,

    /** An abort signal to abort the context creation */
    createSignal?: AbortSignal
};

export class LlamaEmbeddingContext {
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

    public async getEmbeddingFor(input: Token[] | string | LlamaText) {
        const resolvedInput = tokenizeInput(input, this._llamaContext.model.tokenize);

        if (resolvedInput.length > this._llamaContext.contextSize)
            throw new Error(
                "Input is longer than the context size. " +
                "Try to increase the context size or use another model that supports longer contexts."
            );
        else if (resolvedInput.length === 0)
            return new LlamaEmbedding({vector: []});

        return await withLock(this, "evaluate", async () => {
            await this._sequence.eraseContextTokenRanges([{
                start: 0,
                end: this._sequence.nextTokenIndex
            }]);

            const iterator = this._sequence.evaluate(resolvedInput);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for await (const token of iterator) {
                break; // only generate one token to get embeddings
            }

            const embedding = this._llamaContext._ctx.getEmbedding(resolvedInput.length);
            const embeddingVector = Array.from(embedding);

            return new LlamaEmbedding({vector: embeddingVector});
        });
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

    /** @internal */
    public static async _create({
        _model
    }: {
        _model: LlamaModel
    }, {
        contextSize = _model.trainContextSize,
        batchSize = contextSize,
        threads = 6,
        createSignal
    }: LlamaEmbeddingContextOptions) {
        const resolvedContextSize = Math.min(contextSize, _model.trainContextSize);
        const resolvedBatchSize = Math.min(batchSize, resolvedContextSize);

        const llamaContext = await _model.createContext({
            contextSize: resolvedContextSize,
            batchSize: resolvedBatchSize,
            threads,
            createSignal,
            _embeddings: true,
            _noSeed: true
        });

        return new LlamaEmbeddingContext({
            _llamaContext: llamaContext
        });
    }
}

export type LlamaEmbeddingJSON = {
    type: "LlamaEmbedding",
    vector: number[]
};

export class LlamaEmbedding {
    public readonly vector: number[];

    public constructor({vector}: {vector: number[]}) {
        this.vector = vector;
    }

    public toJSON(): LlamaEmbeddingJSON {
        return {
            type: "LlamaEmbedding",
            vector: this.vector
        };
    }

    public static fromJSON(json: LlamaEmbeddingJSON) {
        if (json == null || json.type !== "LlamaEmbedding" || !(json.vector instanceof Array) ||
            json.vector.some(v => typeof v !== "number")
        )
            throw new Error("Invalid LlamaEmbedding JSON");

        return new LlamaEmbedding({
            vector: json.vector
        });
    }
}
