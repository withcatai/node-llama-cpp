import {describe, expect, test} from "vitest";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("bgeReranker", () => {
    describe("rank", () => {
        test("simple ranking", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("bge-reranker-v2-m3-Q8_0.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const rankingContext = await model.createRankingContext({
                contextSize: 512
            });

            const documents = [
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
            ];

            const query = "Tell me a geographical fact";

            const ranks = await Promise.all(
                documents.map((doc) => rankingContext.rank(query, doc))
            );

            const highestRank = ranks.reduce((highest, rank) => Math.max(highest, rank));
            const highestRankIndex = ranks.indexOf(highestRank);

            const highestRankDocument = documents[highestRankIndex];
            expect(highestRankDocument).to.eql("Mount Everest is the tallest mountain in the world");

            expect(simplifyRanks([highestRank])[0]).toMatchInlineSnapshot("0.01798620996209156");
            expect(simplifyRanks(ranks)).toMatchInlineSnapshot(`
              [
                0.000013674009084599736,
                0.000013674009084599736,
                0.000013674009084599736,
                0.003684239899435989,
                0.000013674009084599736,
                0.01798620996209156,
                0.000013674009084599736,
                0.000013674009084599736,
                0.00002039908727992137,
                0.000013674009084599736,
              ]
            `);
        });

        test("rank all", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("bge-reranker-v2-m3-Q8_0.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const rankingContext = await model.createRankingContext({
                contextSize: 512
            });

            const documents = [
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
            ];

            const query = "Tell me a geographical fact";

            const ranks = await rankingContext.rankAll(query, documents);

            const highestRank = ranks.reduce((highest, rank) => Math.max(highest, rank));
            const highestRankIndex = ranks.indexOf(highestRank);

            const highestRankDocument = documents[highestRankIndex];
            expect(highestRankDocument).to.eql("Mount Everest is the tallest mountain in the world");

            expect(simplifyRanks([highestRank])[0]).toMatchInlineSnapshot("0.01798620996209156");
            expect(simplifyRanks(ranks)).toMatchInlineSnapshot(`
              [
                0.000013674009084599736,
                0.000013674009084599736,
                0.000013674009084599736,
                0.003684239899435989,
                0.000013674009084599736,
                0.01798620996209156,
                0.000013674009084599736,
                0.000013674009084599736,
                0.00002039908727992137,
                0.000013674009084599736,
              ]
            `);
        });

        test("rank and sort", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("bge-reranker-v2-m3-Q8_0.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const rankingContext = await model.createRankingContext({
                contextSize: 512
            });

            const documents = [
                "The sky is clear and blue today",
                "I love eating pizza with extra cheese",
                "Dogs love to play fetch with their owners",
                "The capital of France is Paris",
                "Mount Everest is the tallest mountain in the world",
                "A warm cup of tea is perfect for a cold winter day",
                "Not all the things that shine are made of gold",
                "Cleaning the house is a good way to keep it tidy"
            ];

            const query = "Tell me a geographical fact";

            const rankedDocuments = await rankingContext.rankAndSort(query, documents);

            const topDocument = rankedDocuments[0]!;

            expect(topDocument.document).to.eql("Mount Everest is the tallest mountain in the world");

            expect(simplifySortedRanks([topDocument])[0]).toMatchInlineSnapshot(`
              {
                "document": "Mount Everest is the tallest mountain in the world",
                "score": 0.01798620996209156,
              }
            `);
            expect(simplifySortedRanks(rankedDocuments)).toMatchInlineSnapshot(`
              [
                {
                  "document": "Mount Everest is the tallest mountain in the world",
                  "score": 0.01798620996209156,
                },
                {
                  "document": "The capital of France is Paris",
                  "score": 0.003684239899435989,
                },
                {
                  "document": "Not all the things that shine are made of gold",
                  "score": 0.00002039908727992137,
                },
                {
                  "document": "I love eating pizza with extra cheese",
                  "score": 0.000013674009084599736,
                },
                {
                  "document": "Dogs love to play fetch with their owners",
                  "score": 0.000013674009084599736,
                },
                {
                  "document": "The sky is clear and blue today",
                  "score": 0.000013674009084599736,
                },
                {
                  "document": "Cleaning the house is a good way to keep it tidy",
                  "score": 0.000013674009084599736,
                },
                {
                  "document": "A warm cup of tea is perfect for a cold winter day",
                  "score": 0.000013674009084599736,
                },
              ]
            `);
        });
    });
});

function simplifyRanks<const T extends number[]>(ranks: T): T {
    return ranks.map((rank) => simplifyScore(rank)) as T;
}

function simplifySortedRanks<const T extends {document: string, score: number}[]>(values: T): T {
    return values.map((item) => ({
        document: item.document,
        score: simplifyScore(item.score)
    })) as T;
}

function simplifyScore(score: number) {
    return toSigmoid(parseFloat(roundToPrecision(toLogit(score), 0.4).toFixed(1)));
}

function roundToPrecision(value: number, precision: number): number {
    return Math.round(value / precision) * precision;
}

function toLogit(sigmoid: number) {
    return Math.log(sigmoid / (1 - sigmoid));
}

function toSigmoid(logit: number) {
    return 1 / (1 + Math.exp(-logit));
}
