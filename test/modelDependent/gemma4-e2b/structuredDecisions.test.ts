import {describe, expect, test} from "vitest";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";
import {simplifyTestDecisionAnswers} from "../../utils/helpers/simplifyTestDecisionAnswerRange.js";
import {LlamaChatSession} from "../../../src/index.js";

describe("gemma4 e2b", () => {
    describe("structuredDecisions", () => {
        describe("decision context", () => {
            test("single decision", {timeout: 1000 * 60 * 60 * 2}, async () => {
                const modelPath = await getModelFile("gemma-4-E2B-it-Q4_K_M.gguf");
                const llama = await getTestLlama();

                const model = await llama.loadModel({
                    modelPath
                });
                const context = await model.createDecisionContext({
                    contextSize: 1024
                });

                const document = "The API is down but the servers are running";
                const res = await context.decide(document, {
                    isUrgent: {
                        type: "noul",
                        instruction: "Does it require immediate urgent attention?"
                    }
                });

                expect(simplifyTestDecisionAnswers(res)).toMatchInlineSnapshot(`
                  {
                    "isUrgent": {
                      "type": "noul",
                      "value": 0.999,
                    },
                  }
                `);
            });

            test("multiple decisions", {timeout: 1000 * 60 * 60 * 2}, async (test) => {
                const modelPath = await getModelFile("gemma-4-E2B-it-Q4_K_M.gguf");
                const llama = await getTestLlama();

                if (llama.gpu === false)
                    test.skip("Logits are a bit different on different backends to cause test flakiness");

                const model = await llama.loadModel({
                    modelPath
                });
                const context = await model.createDecisionContext({
                    contextSize: 1024
                });

                const document = "The API is down";
                const res = await context.decide(document, {
                    team: {
                        type: "choice",
                        instruction: "Which team is responsible?",
                        criteria: {
                            engineering: "Engineering",
                            hr: "Human Resources",
                            sales: "Sales"
                        }
                    },
                    component: {
                        type: "choice",
                        instruction: "Which component is relevant?",
                        criteria: {
                            API: null,
                            codebase: null,
                            database: null
                        }
                    },
                    isUrgent: {
                        type: "noul",
                        instruction: "Does it require immediate urgent attention?",
                        criteria: {
                            true: "This should be handled immediately",
                            false: "We can address this later"
                        }
                    },
                    level: {
                        type: "score",
                        instruction: "What is the severity level?",
                        criteria: [
                            "The service is operational",
                            "The service is degraded",
                            "The service is down"
                        ]
                    }
                });

                expect(Object.keys(res)).toEqual(["team", "component", "isUrgent", "level"]);
                expect(Object.keys(res.team.probabilities)).toEqual(["engineering", "hr", "sales"]);
                expect(simplifyTestDecisionAnswers(res)).toMatchInlineSnapshot(`
                  {
                    "component": {
                      "choice": "API",
                      "confidence": 1,
                      "probabilities": {
                        "API": 1,
                        "codebase": 0.000028,
                        "database": 9.01e-7,
                      },
                      "type": "choice",
                    },
                    "isUrgent": {
                      "type": "noul",
                      "value": 1,
                    },
                    "level": {
                      "confidence": 1,
                      "probabilities": [
                        7.93e-8,
                        1.66e-7,
                        1,
                      ],
                      "score": 2,
                      "type": "score",
                    },
                    "team": {
                      "choice": "engineering",
                      "confidence": 1,
                      "probabilities": {
                        "engineering": 1,
                        "hr": 0.0000956,
                        "sales": 0.0000154,
                      },
                      "type": "choice",
                    },
                  }
                `);
            });

            describe("onOverflow", () => {
                const longText = "I spent the morning clearing a cupboard that had become difficult to close. First I carried the boxes into the living room and laid an old sheet over the carpet. The largest box contained tangled cables, spare buttons, and instruction booklets for appliances I no longer owned. I checked each cable, wound the useful ones neatly, and put them in a small basket. The buttons went into a glass jar beside my sewing kit. Under the box I found a wooden frame with a loose corner, so I cleaned the joints and applied a little glue. While it dried, I sorted a pile of notebooks into used and unused pages. Some contained shopping lists, others had sketches of furniture I once planned to build. I kept the sketches and placed the blank paper in a drawer for future notes. A tin of pencils needed sharpening, and several pens had dried out completely. By lunchtime the floor was covered with small groups of objects, each waiting for a proper place. I made a sandwich and ate it at the kitchen table before returning to the work. In the afternoon I lined the cupboard shelves with clean paper and measured the space available for baskets. The lighter boxes went on the upper shelf, with tools and household supplies below. I wrote labels on pieces of card and attached them with string so that everything would be easier to find. Finally, I vacuumed the carpet and folded the sheet away. Only a forgotten quiz book remained on the sofa. I sat down to read it and discovered the answer to one of its questions.";

                test("throw", {timeout: 1000 * 60 * 60 * 2}, async () => {
                    const modelPath = await getModelFile("gemma-4-E2B-it-Q4_K_M.gguf");
                    const llama = await getTestLlama();

                    const model = await llama.loadModel({
                        modelPath
                    });
                    const context = await model.createDecisionContext({
                        parallelQuestions: 1,
                        contextSize: 256
                    });
                    try {
                        await context.decide(longText, {
                            cables: {
                                type: "noul",
                                instruction: "Did the user mention cables?"
                            }
                        });
                        expect.unreachable("Should have thrown an error");
                    } catch (err) {
                        expect(err).toMatchInlineSnapshot("[Error: The context size is too small to fit the provided context and the given questions and/or criteria. Increase the context size or reduce the length of the longest questions or criteria]");
                    }
                });

                test("truncateDocument", {timeout: 1000 * 60 * 60 * 2}, async () => {
                    const modelPath = await getModelFile("gemma-4-E2B-it-Q4_K_M.gguf");
                    const llama = await getTestLlama();

                    const model = await llama.loadModel({
                        modelPath
                    });
                    const context = await model.createDecisionContext({
                        parallelQuestions: 1,
                        contextSize: 256
                    });
                    const res = await context.decide(longText, {
                        cables: {
                            type: "noul",
                            instruction: "Did the user mention cables?"
                        }
                    }, {
                        onOverflow: "truncateDocument"
                    });
                    expect(simplifyTestDecisionAnswers(res)).toMatchInlineSnapshot(`
                      {
                        "cables": {
                          "type": "noul",
                          "value": 1,
                        },
                      }
                    `);

                    // @ts-expect-error
                    using internalSeqHandle = await context._seqQueue.acquire();
                    const contextText = model.detokenize(internalSeqHandle.item.contextTokens, true);
                    expect(internalSeqHandle.item.nextTokenIndex).toMatchInlineSnapshot("254");
                    expect(contextText).to.include(longText.slice(0, 64));
                    expect(contextText).to.not.include(longText.slice(-64));
                });

                test("compressDocument", {timeout: 1000 * 60 * 60 * 2}, async () => {
                    const modelPath = await getModelFile("gemma-4-E2B-it-Q4_K_M.gguf");
                    const llama = await getTestLlama();

                    const model = await llama.loadModel({
                        modelPath
                    });
                    const context = await model.createDecisionContext({
                        parallelQuestions: 1,
                        contextSize: 256
                    });
                    const res = await context.decide(longText, {
                        cables: {
                            type: "noul",
                            instruction: "Did the user mention cables?"
                        }
                    }, {
                        onOverflow: {
                            type: "compressDocument",
                            compressDocument({document, maxTokensCount, tokenizer}) {
                                const tokenizedDocument = tokenizer("Starting here." + document, false, "trimLeadingSpace");
                                const slicedTokens = tokenizedDocument.slice(0, maxTokensCount);
                                return tokenizer.detokenize(slicedTokens, false);
                            }
                        }
                    });
                    expect(simplifyTestDecisionAnswers(res)).toMatchInlineSnapshot(`
                      {
                        "cables": {
                          "type": "noul",
                          "value": 1,
                        },
                      }
                    `);

                    // @ts-expect-error
                    using internalSeqHandle = await context._seqQueue.acquire();
                    const contextText = model.detokenize(internalSeqHandle.item.contextTokens, true);
                    expect(internalSeqHandle.item.nextTokenIndex).toMatchInlineSnapshot("254");
                    expect(contextText).to.include("Starting here.");
                    expect(contextText).to.include(longText.slice(0, 64));
                    expect(contextText).to.not.include(longText.slice(-64));
                });
            });
        });

        describe("in a chat", () => {
            test("matching", {timeout: 1000 * 60 * 60 * 2}, async () => {
                const modelPath = await getModelFile("gemma-4-E2B-it-Q4_K_M.gguf");
                const llama = await getTestLlama();

                if (llama.gpu === false)
                    test.skip("Logits are a bit different on different backends to cause test flakiness");

                const model = await llama.loadModel({
                    modelPath
                });
                const context = await model.createContext({
                    contextSize: 4096
                });
                const chat = new LlamaChatSession({
                    contextSequence: context.getSequence()
                });

                await chat.prompt("Tell me about llamas and where they are from, and a related animal", {
                    maxTokens: 100,
                    budgets: {
                        thoughtTokens: 40
                    }
                });

                const res = await chat.decide({
                    animal: {
                        type: "noul",
                        instruction: "Did we talk about an animal?"
                    },
                    animalOrigins: {
                        type: "noul",
                        instruction: "Did we discuss an animal's geographic origin?",
                        criteria: {
                            true: "The conversation identifies a region where an animal comes from",
                            false: null as any
                        }
                    },
                    relatedAnimals: {
                        type: "noul",
                        instruction: "Did we connect two animals through a biological relationship?",
                        criteria: {
                            true: null as any,
                            false: "No relationship between different animals was mentioned"
                        }
                    },
                    educational: {
                        type: "noul",
                        instruction: "Was the response intended to teach the reader something?",
                        criteria: {
                            true: null as any,
                            false: null as any
                        }
                    },
                    realWorldAnimals: {
                        type: "noul",
                        instruction: "Were we discussing real animals rather than mythical creatures?",
                        criteria: {
                            true: "The animals discussed exist in the real world",
                            false: "The discussion was about imaginary or mythical animals"
                        }
                    }
                });

                expect(simplifyTestDecisionAnswers(res)).toMatchInlineSnapshot(`
                  {
                    "animal": {
                      "type": "noul",
                      "value": 0.999,
                    },
                    "animalOrigins": {
                      "type": "noul",
                      "value": 1,
                    },
                    "educational": {
                      "type": "noul",
                      "value": 1,
                    },
                    "realWorldAnimals": {
                      "type": "noul",
                      "value": 1,
                    },
                    "relatedAnimals": {
                      "type": "noul",
                      "value": 0.998,
                    },
                  }
                `);
            });

            test("not matching", {timeout: 1000 * 60 * 60 * 2}, async (test) => {
                const modelPath = await getModelFile("gemma-4-E2B-it-Q4_K_M.gguf");
                const llama = await getTestLlama();

                if (llama.gpu === false)
                    test.skip("Logits are a bit different on different backends to cause test flakiness");

                const model = await llama.loadModel({
                    modelPath
                });
                const context = await model.createContext({
                    contextSize: 4096
                });

                const sequence = context.getSequence();

                const chat = new LlamaChatSession({
                    contextSequence: sequence
                });

                await chat.prompt("Where is wood coming from?", {
                    maxTokens: 100,
                    budgets: {
                        thoughtTokens: 40
                    }
                });

                const res = await chat.decide({
                    animal: {
                        type: "noul",
                        instruction: "Did we talk about an animal?"
                    },
                    mineralOrigin: {
                        type: "noul",
                        instruction: "Did we say wood is mined from rocks?",
                        criteria: {
                            true: "Wood was described as a mineral extracted from rock",
                            false: null as any
                        }
                    },
                    cookingRecipe: {
                        type: "noul",
                        instruction: "Did we give a recipe for cooking a meal?",
                        criteria: {
                            true: null as any,
                            false: "The response explains a material's origin without giving cooking instructions"
                        }
                    },
                    spaceTravel: {
                        type: "noul",
                        instruction: "Did we discuss a journey to another planet?",
                        criteria: {
                            true: null as any,
                            false: null as any
                        }
                    },
                    fictionalStory: {
                        type: "noul",
                        instruction: "Was the response a fictional story with characters and a plot?",
                        criteria: {
                            true: "The response tells an invented story",
                            false: "The response gives a factual explanation of where a material comes from"
                        }
                    },
                    wood: {
                        type: "noul",
                        instruction: "Did we talk about wood?"
                    },
                    subject: {
                        type: "choice",
                        instruction: "What did we talk about?",
                        criteria: {
                            materials: null,
                            food: null,
                            brushing: null,
                            other: null
                        }
                    }
                });

                expect(simplifyTestDecisionAnswers(res)).toMatchInlineSnapshot(`
                  {
                    "animal": {
                      "type": "noul",
                      "value": 0.0000739,
                    },
                    "cookingRecipe": {
                      "type": "noul",
                      "value": 0.000116,
                    },
                    "fictionalStory": {
                      "type": "noul",
                      "value": 0.00000194,
                    },
                    "mineralOrigin": {
                      "type": "noul",
                      "value": 0.0000033,
                    },
                    "spaceTravel": {
                      "type": "noul",
                      "value": 0.0000856,
                    },
                    "subject": {
                      "choice": "materials",
                      "confidence": 1,
                      "probabilities": {
                        "brushing": 0.0000072,
                        "food": 0.000124,
                        "materials": 1,
                        "other": 0.0000823,
                      },
                      "type": "choice",
                    },
                    "wood": {
                      "type": "noul",
                      "value": 1,
                    },
                  }
                `);
            });

            test("with document", {timeout: 1000 * 60 * 60 * 2}, async () => {
                const modelPath = await getModelFile("gemma-4-E2B-it-Q4_K_M.gguf");
                const llama = await getTestLlama();

                const model = await llama.loadModel({
                    modelPath
                });
                const context = await model.createContext({
                    contextSize: 4096
                });
                const chat = new LlamaChatSession({
                    contextSequence: context.getSequence()
                });

                await chat.prompt("Tell me about llamas and where they are from, and a related animal", {
                    maxTokens: 100,
                    budgets: {
                        thoughtTokens: 40
                    }
                });

                const res1 = await chat.decide({
                    locks: {
                        type: "choice",
                        instruction: "What are locks?",
                        criteria: {
                            useful: "They are useful",
                            notDoors: "Not doors",
                            cats: "Not cats"
                        }
                    }
                }, {
                    document: "Locks are not doors"
                });
                const res2 = await chat.decide({
                    locks: {
                        type: "choice",
                        instruction: "What are locks?",
                        criteria: {
                            useful: "They are useful",
                            notDoors: "Not doors",
                            cats: "Not cats"
                        }
                    }
                });

                expect(res1.locks.confidence).to.be.greaterThan(0.8);
                expect(res1.locks.choice).to.equal("notDoors");

                expect(res2.locks.confidence).to.be.greaterThan(0.8);
                expect(res2.locks.choice).to.equal("useful");
            });
        });
    });
});
