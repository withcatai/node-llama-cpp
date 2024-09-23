export type LlamaEmbeddingOptions = {
    vector: readonly number[]
};

export type LlamaEmbeddingJSON = {
    type: "embedding",
    vector: readonly number[]
};

export class LlamaEmbedding {
    public readonly vector: readonly number[];

    public constructor(options: LlamaEmbeddingOptions) {
        this.vector = Object.freeze(options.vector.slice());
    }

    public toJSON(): LlamaEmbeddingJSON {
        return {
            type: "embedding",
            vector: this.vector
        };
    }

    /**
     * Calculates the cosine similarity between this embedding and another embedding.
     *
     * Note that you should only compare embeddings created by the exact same model file.
     * @returns A value between 0 and 1 representing the similarity between the embedding vectors,
     * where 1 means the embeddings are identical.
     */
    public calculateCosineSimilarity(other: LlamaEmbedding | LlamaEmbeddingJSON | readonly number[]) {
        const otherVector = other instanceof Array
            ? other
            : other.vector;

        if (otherVector == null)
            throw new Error("Other vector is null");
        else if (otherVector.length !== this.vector.length) {
            if (otherVector.length === 0 || this.vector.length === 0)
                return 0;
            else
                throw new Error("Vectors have different lengths");
        }

        let dotProduct = 0;
        let thisMagnitude = 0;
        let otherMagnitude = 0;
        for (let i = 0; i < this.vector.length; i++) {
            dotProduct += this.vector[i]! * otherVector[i]!;
            thisMagnitude += Math.pow(this.vector[i]!, 2);
            otherMagnitude += Math.pow(otherVector[i]!, 2);
        }

        if (thisMagnitude === 0 && otherMagnitude === 0)
            return 1;
        else if (thisMagnitude === 0 || otherMagnitude === 0)
            return 0;

        const thisNorm = Math.sqrt(thisMagnitude);
        const otherNorm = Math.sqrt(otherMagnitude);

        return dotProduct / (thisNorm * otherNorm);
    }

    public static fromJSON(json: LlamaEmbeddingJSON) {
        return new LlamaEmbedding({
            vector: json.vector
        });
    }
}
