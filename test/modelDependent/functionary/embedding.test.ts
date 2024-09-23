import {describe, expect, test} from "vitest";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("functionary", () => {
    describe("embedding", () => {
        test("deterministic", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("functionary-small-v2.5.Q4_0.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const embeddingContext = await model.createEmbeddingContext({
                contextSize: 4096
            });

            const helloWorldEmbedding = await embeddingContext.getEmbeddingFor("Hello world");

            const helloThereEmbedding = await embeddingContext.getEmbeddingFor("Hello there");

            expect(helloWorldEmbedding.vector).to.not.eql(helloThereEmbedding.vector);

            const helloWorld2Embedding = await embeddingContext.getEmbeddingFor("Hello world");

            expect(helloWorld2Embedding.vector).to.eql(helloWorldEmbedding.vector);
            expect(helloWorld2Embedding.vector).to.not.eql(helloThereEmbedding.vector);
        });

        test("deterministic between runs", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("functionary-small-v2.5.Q4_0.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const embeddingContext = await model.createEmbeddingContext({
                contextSize: 4096
            });

            const helloWorldEmbedding = await embeddingContext.getEmbeddingFor("Hello world");
            const helloThereEmbedding = await embeddingContext.getEmbeddingFor("Hello there");

            expect(helloWorldEmbedding.vector).to.not.eql(helloThereEmbedding.vector);

            embeddingContext.dispose();

            const embeddingContext2 = await model.createEmbeddingContext({
                contextSize: 4096
            });

            const helloWorldEmbedding2 = await embeddingContext2.getEmbeddingFor("Hello world");
            const helloThereEmbedding2 = await embeddingContext2.getEmbeddingFor("Hello there");

            expect(helloWorldEmbedding2.vector).to.eql(helloWorldEmbedding.vector);
            expect(helloThereEmbedding2.vector).to.eql(helloThereEmbedding.vector);
        });
    });
});
