import {describe, expect, test} from "vitest";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("bgeReranker", () => {
    describe("rank", () => {
        test("simple ranking", {timeout: 1000 * 60 * 60 * 2}, async (test) => {
            if (process.platform !== "darwin" && process.arch !== "arm64")
                test.skip(); // the scores are a bit different on different platforms, so skipping on other platforms due to flakiness

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

            expect(simplifyRanks([highestRank])[0]).toMatchInlineSnapshot("0.014774031693273055");
            expect(simplifyRanks(ranks)).toMatchInlineSnapshot(`
              [
                0.00002039908727992137,
                0.00002039908727992137,
                0.00002039908727992137,
                0.004496273160941178,
                0.00002039908727992137,
                0.014774031693273055,
                0.00002039908727992137,
                0.00002039908727992137,
                0.00002039908727992137,
                0.00002039908727992137,
              ]
            `);
        });

        test("rank all", {timeout: 1000 * 60 * 60 * 2}, async (test) => {
            if (process.platform !== "darwin" && process.arch !== "arm64")
                test.skip(); // the scores are a bit different on different platforms, so skipping on other platforms due to flakiness

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

            expect(simplifyRanks([highestRank])[0]).toMatchInlineSnapshot("0.014774031693273055");
            expect(simplifyRanks(ranks)).toMatchInlineSnapshot(`
              [
                0.00002039908727992137,
                0.00002039908727992137,
                0.00002039908727992137,
                0.004496273160941178,
                0.00002039908727992137,
                0.014774031693273055,
                0.00002039908727992137,
                0.00002039908727992137,
                0.00002039908727992137,
                0.00002039908727992137,
              ]
            `);
        });

        describe("overflow", () => {
            const contextSize = 256;
            const query = "Tell me a geographical fact";
            const parisIntroduction = "The volunteers arrived early to prepare the community hall for an evening reading club. They unfolded the tables, checked that every chair was steady, and moved the spare furniture into a storage cupboard. One person wiped the windows while another tested the lamps beside the comfortable armchairs. A box of donated books waited near the entrance, with handwritten notes explaining who had brought each one. The organizers sorted the books by size so that the shelves would look tidy, then made small paper labels for the empty spaces. In the kitchen, two helpers washed the cups and counted the spoons. They prepared a tray of biscuits, filled a jug with water, and put clean towels beside the sink. Someone noticed that a table leg was loose and fetched a screwdriver from the cupboard. Once the repair was finished, the group covered the tables with plain cloths and set out pencils and blank cards for visitors to write recommendations. The first guests arrived carrying coats and shopping bags. They chose seats, introduced themselves, and talked about how they found time to read during a busy week. One guest preferred reading before breakfast, while another listened to stories while washing dishes. A child drew a picture on a spare card and asked whether it could be used as a bookmark. The organizer agreed and found a ribbon to tie through a hole in the paper. When everyone had settled, the host invited each reader to share something from a book. After several people discussed recipes and craft projects, the final guest opened an encyclopedia and read a fact aloud.";
            const everestIntroduction = "I spent the morning clearing a cupboard that had become difficult to close. First I carried the boxes into the living room and laid an old sheet over the carpet. The largest box contained tangled cables, spare buttons, and instruction booklets for appliances I no longer owned. I checked each cable, wound the useful ones neatly, and put them in a small basket. The buttons went into a glass jar beside my sewing kit. Under the box I found a wooden frame with a loose corner, so I cleaned the joints and applied a little glue. While it dried, I sorted a pile of notebooks into used and unused pages. Some contained shopping lists, others had sketches of furniture I once planned to build. I kept the sketches and placed the blank paper in a drawer for future notes. A tin of pencils needed sharpening, and several pens had dried out completely. By lunchtime the floor was covered with small groups of objects, each waiting for a proper place. I made a sandwich and ate it at the kitchen table before returning to the work. In the afternoon I lined the cupboard shelves with clean paper and measured the space available for baskets. The lighter boxes went on the upper shelf, with tools and household supplies below. I wrote labels on pieces of card and attached them with string so that everything would be easier to find. Finally, I vacuumed the carpet and folded the sheet away. Only a forgotten quiz book remained on the sofa. I sat down to read it and discovered the answer to one of its questions.";
            const documents = [
                "The sky is clear and blue today. A few white clouds drift slowly above the houses while sunlight fills the garden. People open their windows and enjoy the warm afternoon outside.",
                "Making pizza starts with kneading dough and letting it rise. The cook spreads tomato sauce over the base, adds cheese and vegetables, and bakes everything until the crust is crisp and golden.",
                "Dogs love to play fetch with their owners. A ball thrown across the garden sends an excited dog running through the grass. After returning the ball, the dog waits eagerly for another throw.",
                parisIntroduction + " Paris is the capital of France and stands on the banks of the Seine. The river flows through the city beneath many bridges, connecting neighborhoods with museums, parks, shops, and historic buildings.",
                "After walking around the neighborhood, I stopped at home for a glass of water. I filled a bottle for the rest of the afternoon and placed it beside my backpack near the front door.",
                everestIntroduction + " Mount Everest is the highest mountain above sea level in the world. It belongs to the Himalayan mountain range and lies on the border between Nepal and China. Snow and ice cover its upper slopes.",
                "A warm cup of tea is pleasant on a cold winter day. I boil water, let the tea leaves steep, and carry the cup to a comfortable chair where I can read a book.",
                "Painting is a form of creative expression. An artist mixes colors on a palette before applying them to a canvas. Different brushes create broad areas of color, delicate lines, and interesting textures in the picture.",
                "Not everything that shines is made of gold. A shop window can display polished brass, colored glass, and silver jewelry beside golden objects. Their bright surfaces look similar even though the materials are different.",
                "Cleaning the house begins with putting scattered objects back in their places. I dust the shelves, sweep the floor, and wash the dishes. Opening a window lets fresh air into the newly tidy room."
            ];

            test("rank", {timeout: 1000 * 60 * 60 * 2}, async (test) => {
                if (process.platform !== "darwin" && process.arch !== "arm64")
                    test.skip(); // the scores are a bit different on different platforms, so skipping on other platforms due to flakiness

                const modelPath = await getModelFile("bge-reranker-v2-m3-Q8_0.gguf");
                const llama = await getTestLlama();

                const model = await llama.loadModel({
                    modelPath
                });
                const rankingContext = await model.createRankingContext({
                    contextSize
                });

                for (const introduction of [parisIntroduction, everestIntroduction])
                    expect(rankingContext.calculateInputLength(query, introduction)).toBeGreaterThan(contextSize);

                for (const index of [3, 5]) {
                    const document = documents[index]!;
                    expect(rankingContext.calculateInputLength(query, document)).toBeGreaterThan(contextSize);
                    await expect(rankingContext.rank(query, document)).rejects.toThrow("exceed the context size");
                }

                const ranks = await Promise.all(
                    documents.map((document) => rankingContext.rank(query, document, {onOverflow: "maxChunk"}))
                );

                const firstChunkSize = contextSize - rankingContext.calculateInputLength(query, []) - 1;
                for (const index of [3, 5]) {
                    const firstChunk = model.tokenize(documents[index]!, false, "trimLeadingSpace").slice(0, firstChunkSize);
                    expect(ranks[index]).toBeGreaterThan(await rankingContext.rank(query, firstChunk));
                }

                expect(ranks).toHaveLength(documents.length);
                expect(simplifyRanks(ranks)).toMatchInlineSnapshot(`
                  [
                    0.00002039908727992137,
                    0.00002039908727992137,
                    0.00002039908727992137,
                    0.026596993576865856,
                    0.00002039908727992137,
                    0.08317269649392238,
                    0.00002039908727992137,
                    0.00003716893710288947,
                    0.00002039908727992137,
                    0.00002039908727992137,
                  ]
                `);
            });

            test("rank all", {timeout: 1000 * 60 * 60 * 2}, async (test) => {
                if (process.platform !== "darwin" && process.arch !== "arm64")
                    test.skip(); // the scores are a bit different on different platforms, so skipping on other platforms due to flakiness

                const modelPath = await getModelFile("bge-reranker-v2-m3-Q8_0.gguf");
                const llama = await getTestLlama();

                const model = await llama.loadModel({
                    modelPath
                });
                const rankingContext = await model.createRankingContext({
                    contextSize
                });

                for (const introduction of [parisIntroduction, everestIntroduction])
                    expect(rankingContext.calculateInputLength(query, introduction)).toBeGreaterThan(contextSize);

                for (const index of [3, 5])
                    expect(rankingContext.calculateInputLength(query, documents[index]!)).toBeGreaterThan(contextSize);

                await expect(rankingContext.rankAll(query, documents)).rejects.toThrow("exceed the context size");

                const ranks = await rankingContext.rankAll(query, documents, {onOverflow: "maxChunk"});

                const firstChunkSize = contextSize - rankingContext.calculateInputLength(query, []) - 1;
                for (const index of [3, 5]) {
                    const firstChunk = model.tokenize(documents[index]!, false, "trimLeadingSpace").slice(0, firstChunkSize);
                    expect(ranks[index]).toBeGreaterThan(await rankingContext.rank(query, firstChunk));
                }

                expect(ranks).toHaveLength(documents.length);
                expect(simplifyRanks(ranks)).toMatchInlineSnapshot(`
                  [
                    0.00002039908727992137,
                    0.00002039908727992137,
                    0.00002039908727992137,
                    0.026596993576865856,
                    0.00002039908727992137,
                    0.08317269649392238,
                    0.00002039908727992137,
                    0.00003716893710288947,
                    0.00002039908727992137,
                    0.00002039908727992137,
                  ]
                `);
            });
        });

        test("rank and sort", {timeout: 1000 * 60 * 60 * 2}, async (test) => {
            if (process.platform !== "darwin" && process.arch !== "arm64")
                test.skip(); // the scores are a bit different on different platforms, so skipping on other platforms due to flakiness

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
                "score": 0.014774031693273055,
              }
            `);
            expect(simplifySortedRanks(rankedDocuments)).toMatchInlineSnapshot(`
              [
                {
                  "document": "Mount Everest is the tallest mountain in the world",
                  "score": 0.014774031693273055,
                },
                {
                  "document": "The capital of France is Paris",
                  "score": 0.004496273160941178,
                },
                {
                  "document": "Not all the things that shine are made of gold",
                  "score": 0.00002039908727992137,
                },
                {
                  "document": "I love eating pizza with extra cheese",
                  "score": 0.00002039908727992137,
                },
                {
                  "document": "Dogs love to play fetch with their owners",
                  "score": 0.00002039908727992137,
                },
                {
                  "document": "The sky is clear and blue today",
                  "score": 0.00002039908727992137,
                },
                {
                  "document": "Cleaning the house is a good way to keep it tidy",
                  "score": 0.00002039908727992137,
                },
                {
                  "document": "A warm cup of tea is perfect for a cold winter day",
                  "score": 0.00002039908727992137,
                },
              ]
            `);
        });

        test("rank and sort without scores", {timeout: 1000 * 60 * 60 * 2}, async () => {
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

            expect(onlyDocuments([topDocument])[0]).toMatchInlineSnapshot('"Mount Everest is the tallest mountain in the world"');
            expect(onlyDocuments(rankedDocuments)).toMatchInlineSnapshot(`
              [
                "Mount Everest is the tallest mountain in the world",
                "The capital of France is Paris",
                "Not all the things that shine are made of gold",
                "I love eating pizza with extra cheese",
                "Dogs love to play fetch with their owners",
                "The sky is clear and blue today",
                "Cleaning the house is a good way to keep it tidy",
                "A warm cup of tea is perfect for a cold winter day",
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

function onlyDocuments(values: {document: string, score: number}[]): string[] {
    return values.map((item) => item.document);
}

function simplifyScore(score: number) {
    return toSigmoid(parseFloat(roundToPrecision(toLogit(score), 0.6).toFixed(1)));
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
