import {describe, expect, test} from "vitest";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";
import {LlamaEmbedding} from "../../../src/index.js";

describe("nomic embed text", () => {
    describe("embedding", () => {
        test("deterministic", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("nomic-embed-text-v1.5.Q4_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const embeddingContext = await model.createEmbeddingContext({
                contextSize: 2048
            });

            const helloWorldEmbedding = await embeddingContext.getEmbeddingFor("Hello world");

            const helloThereEmbedding = await embeddingContext.getEmbeddingFor("Hello there");

            expect(helloWorldEmbedding.vector).to.not.eql(helloThereEmbedding.vector);

            const helloWorld2Embedding = await embeddingContext.getEmbeddingFor("Hello world");

            expect(helloWorld2Embedding.vector).to.eql(helloWorldEmbedding.vector);
            expect(helloWorld2Embedding.vector).to.not.eql(helloThereEmbedding.vector);
        });

        test("deterministic between runs", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("nomic-embed-text-v1.5.Q4_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const embeddingContext = await model.createEmbeddingContext({
                contextSize: 2048
            });

            const helloWorldEmbedding = await embeddingContext.getEmbeddingFor("Hello world");
            const helloThereEmbedding = await embeddingContext.getEmbeddingFor("Hello there");

            expect(helloWorldEmbedding.vector).to.not.eql(helloThereEmbedding.vector);

            embeddingContext.dispose();

            const embeddingContext2 = await model.createEmbeddingContext({
                contextSize: 2048
            });

            const helloWorldEmbedding2 = await embeddingContext2.getEmbeddingFor("Hello world");
            const helloThereEmbedding2 = await embeddingContext2.getEmbeddingFor("Hello there");

            expect(helloWorldEmbedding2.vector).to.eql(helloWorldEmbedding.vector);
            expect(helloThereEmbedding2.vector).to.eql(helloThereEmbedding.vector);
        });

        test("matches the batch size to contextSize 1024 and embeds 600 tokens", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("nomic-embed-text-v1.5.Q4_K_M.gguf");
            const llama = await getTestLlama();

            await using model = await llama.loadModel({modelPath});
            expect(model.fileInfo.architectureMetadata.attention?.causal).toBe(false);

            await using context = await model.createEmbeddingContext({contextSize: 1024});
            expect(context._llamaContext.getAllocatedContextSize()).toBe(1024);
            expect(context._llamaContext.batchSize).toBe(1024);

            const tokens = model.tokenize("word ".repeat(600));
            const specialTokenCount = context.calculateInputLength(tokens) - tokens.length;
            const input = tokens.slice(0, 600 - specialTokenCount);
            expect(context.calculateInputLength(input)).toBe(600);

            const embedding = await context.getEmbeddingFor(input);
            expect(embedding.vector).toHaveLength(model.embeddingVectorSize);
            expect(embedding.vector.every(Number.isFinite)).toBe(true);
            expect(embedding.vector.some((value) => value !== 0)).toBe(true);
        });

        test("similarity search", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("nomic-embed-text-v1.5.Q4_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const embeddingContext = await model.createEmbeddingContext({
                contextSize: 2048
            });

            async function embedDocuments(documents: readonly string[]) {
                const embeddings = new Map<string, LlamaEmbedding>();

                await Promise.all(
                    documents.map(async (document) => {
                        const embedding = await embeddingContext.getEmbeddingFor(document);
                        embeddings.set(document, embedding);
                    })
                );

                return embeddings;
            }

            function findSimilarDocuments(
                embedding: LlamaEmbedding,
                documentEmbeddings: Map<string, LlamaEmbedding>
            ) {
                const similarities = new Map<string, number>();
                for (const [otherDocument, otherDocumentEmbedding] of documentEmbeddings)
                    similarities.set(
                        otherDocument,
                        embedding.calculateCosineSimilarity(otherDocumentEmbedding)
                    );

                return Array.from(similarities.keys())
                    .sort((a, b) => similarities.get(b)! - similarities.get(a)!);
            }

            const documentEmbeddings = await embedDocuments([
                "The sky is clear and blue today",
                "I love eating pizza with extra cheese",
                "Dogs love to play fetch with their owners",
                "The capital of France is Paris",
                "Drinking water is important for staying hydrated",
                "Mount Everest is the tallest mountain in the world",
                "A warm cup of tea is perfect for a cold winter day",
                "Painting is a form of creative expression",
                "Not all the things that shine are made of gold",
                "Cleaning the house is a good way to keep it tidy"
            ]);

            const query = "What is the tallest mountain on Earth?";
            const queryEmbedding = await embeddingContext.getEmbeddingFor(query);

            const similarDocuments = findSimilarDocuments(
                queryEmbedding,
                documentEmbeddings
            );
            const topSimilarDocument = similarDocuments[0];

            expect(topSimilarDocument).to.eql("Mount Everest is the tallest mountain in the world");
        });

        test("similarity search 2", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("nomic-embed-text-v1.5.Q4_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const embeddingContext = await model.createEmbeddingContext({
                contextSize: 2048
            });

            async function embedDocuments(documents: readonly string[]) {
                const embeddings = new Map<string, LlamaEmbedding>();

                await Promise.all(
                    documents.map(async (document) => {
                        const embedding = await embeddingContext.getEmbeddingFor(document);
                        embeddings.set(document, embedding);
                    })
                );

                return embeddings;
            }

            function findSimilarDocuments(
                embedding: LlamaEmbedding,
                documentEmbeddings: Map<string, LlamaEmbedding>
            ) {
                const similarities = new Map<string, number>();
                for (const [otherDocument, otherDocumentEmbedding] of documentEmbeddings)
                    similarities.set(
                        otherDocument,
                        embedding.calculateCosineSimilarity(otherDocumentEmbedding)
                    );

                return Array.from(similarities.keys())
                    .sort((a, b) => similarities.get(b)! - similarities.get(a)!);
            }

            const documentEmbeddings = await embedDocuments([
                "The sky is clear and blue today",
                "I love eating pizza with extra cheese",
                "Dogs love to play fetch with their owners",
                "The capital of France is Paris",
                "Drinking water is important for staying hydrated",
                "Mount Everest is the tallest mountain in the world",
                "A warm cup of tea is perfect for a cold winter day",
                "Painting is a form of creative expression",
                "Not all the things that shine are made of gold",
                "Cleaning the house is a good way to keep it tidy"
            ]);

            const query = "Do you like pizza?";
            const queryEmbedding = await embeddingContext.getEmbeddingFor(query);

            const similarDocuments = findSimilarDocuments(
                queryEmbedding,
                documentEmbeddings
            );
            const topSimilarDocument = similarDocuments[0];

            expect(topSimilarDocument).to.eql("I love eating pizza with extra cheese");
        });
    });
});
