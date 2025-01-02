import {describe, expect, test} from "vitest";
import {LlamaChatSession, Token, DraftSequenceTokenPredictor, InputLookupTokenPredictor} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";
import {compareTokens} from "../../../src/utils/compareTokens.js";

describe("llama 3.1", () => {
    describe("token predictor", () => {
        test("DraftModelTokenPredictor", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 2048,
                sequences: 2
            });
            const draftSequence = context.getSequence();
            const predictor = new DraftSequenceTokenPredictor(draftSequence, {
                minTokens: 2,
                maxTokens: 2
            });

            const mainSequence = context.getSequence();
            const chatSession = new LlamaChatSession({
                contextSequence: mainSequence
            });

            await chatSession.preloadPrompt("Hello");

            await predictor.reset({
                targetSequence: mainSequence,
                stateTokens: mainSequence.contextTokens,
                evaluateOptions: {}
            });

            const predictedTokens = await predictor.predictTokens();
            expect(predictedTokens.map((token) => model.detokenize([token], true))).toMatchInlineSnapshot(`
              [
                ",",
                " I",
              ]
            `);

            const textTokens = model.tokenize("! The");
            predictor.pushTokens(textTokens);

            const predictedTokens2 = await predictor.predictTokens();
            expect(predictedTokens2.map((token) => model.detokenize([token], true))).toMatchInlineSnapshot(`
              [
                " weather",
                " in",
              ]
            `);


            await chatSession.preloadPrompt("What");

            await predictor.reset({
                targetSequence: mainSequence,
                stateTokens: mainSequence.contextTokens,
                evaluateOptions: {}
            });

            const predictedTokens3 = await predictor.predictTokens();
            expect(predictedTokens3.map((token) => model.detokenize([token], true))).toMatchInlineSnapshot(`
              [
                " is",
                " the",
              ]
            `);

            const text2Tokens = model.tokenize("can be");
            predictor.pushTokens(text2Tokens);

            const predictedTokens4 = await predictor.predictTokens();
            expect(predictedTokens4.map((token) => model.detokenize([token], true))).toMatchInlineSnapshot(`
              [
                " done",
                " to",
              ]
            `);
        });

        describe("InputLookupTokenPredictor", () => {
            // made up example paragraph
            const exampleParagraph = [
                "The Luminawing (genus: Luxavis, species: nocturna) is a rare and enigmatic nocturnal creature native to the dense forests of the remote continent of Aethoria.",
                "Characterized by its striking appearance and unique adaptations, this mystical animal has garnered significant attention from scientists and naturalists.",
                "",
                "## Physical Characteristics",
                "The Luminawing's most distinctive feature is its pair of iridescent wings, which reflect the colors of its surroundings through a complex process involving microscopic crystals embedded in the wing membrane.",
                "This remarkable ability allows the creature to blend seamlessly into the night sky, making it nearly invisible to predators and prey alike.",
                "",
                "Its slender body measures approximately 30-40 centimeters in length, covered in soft, glowing fur that shimmers like starlight under ultraviolet light. The Luminawing's large, round eyes are capable of perceiving even the faintest glows, allowing it to navigate through the dark forest with ease.",
                "",
                "## Behavior and Habitat",
                "The Luminawing is a solitary creature, only coming together with others of its kind during the mating season.",
                "It inhabits the dense forests of Aethoria, where it feeds on the nectar of rare, moon-blooming flowers (genus: Lunaria).",
                "These flowers are said to possess magical properties, which are believed to be absorbed by the Luminawing through its diet.",
                "",
                "The creature's haunting melody can be heard echoing through the forest at dusk, a siren call that beckons in the night creatures and fills the air with wonder. This unique vocalization is thought to play a crucial role in the Luminawing's mating rituals and territorial defense.",
                "",
                "## Conservation Status",
                "Due to its elusive nature and limited range, the Luminawing is currently listed as a species of special concern by the Aethorian Conservation Society.",
                "Efforts are being made to protect its habitat and study its behavior, but more research is needed to fully understand this enigmatic creature's place in the ecosystem."
            ].join("\n");

            test("no evaluation", {timeout: 1000 * 60 * 60 * 2}, async () => {
                const modelPath = await getModelFile("Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf");
                const llama = await getTestLlama();

                const model = await llama.loadModel({
                    modelPath
                });
                const context = await model.createContext({
                    contextSize: 2048
                });
                const predictor = new InputLookupTokenPredictor({
                    patternLength: {
                        min: 4
                    },
                    predictionLength: {
                        min: 1,
                        max: 5
                    }
                });

                const sequence = context.getSequence();
                const chatSession = new LlamaChatSession({
                    contextSequence: sequence
                });

                const paragraphTokens = model.tokenize(exampleParagraph);
                let endIndex = 3 + 4;
                const tokensExcerpt = [
                    ...model.tokenize("Some random text here"),
                    ...paragraphTokens.slice(3, endIndex)
                ];

                await chatSession.preloadPrompt("Hello");

                predictor.reset({
                    stateTokens: tokensExcerpt.slice()
                });
                predictor.updateInputTokens(paragraphTokens.slice());

                const predictedTokens = predictor.predictTokens();
                expect(predictedTokens.map((token) => model.detokenize([token], true))).toMatchInlineSnapshot(`
                  [
                    ":",
                    " Lux",
                    "avis",
                    ",",
                    " species",
                  ]
                `);

                predictor.pushTokens(paragraphTokens.slice(endIndex, endIndex + 2));
                endIndex += 2;

                const predictedTokens2 = predictor.predictTokens();
                expect(predictedTokens2.map((token) => model.detokenize([token], true))).toMatchInlineSnapshot(`
                  [
                    "avis",
                    ",",
                    " species",
                    ":",
                    " noct",
                  ]
                `);


                predictor.reset({
                    stateTokens: [...paragraphTokens, ...tokensExcerpt]
                });
                predictor.updateInputTokens(paragraphTokens.slice());

                const predictedTokens3 = predictor.predictTokens();
                expect(predictedTokens3.map((token) => model.detokenize([token], true))).toMatchInlineSnapshot(`
                  [
                    ":",
                    " Lux",
                    "avis",
                    ",",
                    " species",
                  ]
                `);
            });

            // disabled for now due to flakiness
            test.skip("with evaluation", {timeout: 1000 * 60 * 60 * 2}, async () => {
                const modelPath = await getModelFile("Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf");
                const llama = await getTestLlama();

                const model = await llama.loadModel({
                    modelPath
                });
                const context = await model.createContext({
                    contextSize: 2048
                });
                const predictor = new InputLookupTokenPredictor({
                    patternLength: {
                        min: 4
                    },
                    predictionLength: {
                        min: 1,
                        max: 5
                    }
                });

                const sequence = context.getSequence({
                    tokenPredictor: predictor
                });

                // // script to find the right maxTokens value for this test
                // {
                //     for (let maxTokens = 0; maxTokens < 80; maxTokens++) {
                //         const chatSession = new LlamaChatSession({
                //             contextSequence: sequence
                //         });
                //
                //         await chatSession.prompt("Summarize this text:\n\n" + exampleParagraph, {
                //             maxTokens
                //         });
                //         const actualContextTokensLength = sequence._contextTokens.length;
                //         const exposedContextTokensLength = sequence.contextTokens.length;
                //
                //         if (actualContextTokensLength !== exposedContextTokensLength)
                //             console.log("max tokens with validated predictions:", maxTokens);
                //     }
                // }

                const chatSession = new LlamaChatSession({
                    contextSequence: sequence
                });

                await chatSession.prompt("Summarize this text:\n\n" + exampleParagraph, {
                    maxTokens: 23
                });

                expect(sequence.tokenPredictions.validated).toMatchInlineSnapshot("2");
                expect(sequence.tokenPredictions.refuted).toMatchInlineSnapshot("8");
                expect(sequence.tokenPredictions.used).toMatchInlineSnapshot("1");
                expect(sequence.tokenPredictions.unused).toMatchInlineSnapshot("1");

                const exposedNextTokenIndex = sequence.nextTokenIndex;

                {
                    const actualContextTokensLength = sequence._contextTokens.length;
                    const exposedContextTokensLength = sequence.contextTokens.length;

                    expect(exposedContextTokensLength).toMatchInlineSnapshot("541");
                    expect(actualContextTokensLength).toMatchInlineSnapshot("542");
                    expect(exposedNextTokenIndex).toMatchInlineSnapshot("541");
                    expect(exposedContextTokensLength).to.not.be.eql(actualContextTokensLength);
                }

                const lastToken = sequence.contextTokens.at(-1)!;
                const exampleToken = sequence.contextTokens
                    .slice()
                    .reverse()
                    .find((token) => !compareTokens(token, lastToken))!;

                const addedTokens: Token[] = [];
                for await (const token of sequence.evaluate([exampleToken])) {
                    addedTokens.push(token);
                    break; // evaluate only one token
                }

                expect(addedTokens).toMatchInlineSnapshot(`
                  [
                    315,
                  ]
                `);

                await sequence.eraseContextTokenRanges([{start: sequence.nextTokenIndex - 1, end: sequence.nextTokenIndex}]);

                {
                    const actualContextTokensLength = sequence._contextTokens.length;
                    const exposedContextTokensLength = sequence.contextTokens.length;

                    expect(exposedContextTokensLength).toMatchInlineSnapshot("541");
                    expect(actualContextTokensLength).toMatchInlineSnapshot("541");
                    expect(exposedNextTokenIndex).toMatchInlineSnapshot("541");
                    expect(exposedNextTokenIndex).to.be.eql(sequence.nextTokenIndex);
                    expect(exposedContextTokensLength).to.be.eql(actualContextTokensLength);
                    expect(sequence.contextTokens.at(-1)).to.not.be.eql(exampleToken);
                    expect(sequence.contextTokens.at(-1)).to.be.eql(lastToken);
                }
            });
        });
    });
});
