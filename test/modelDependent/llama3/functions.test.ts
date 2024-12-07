import {describe, expect, test} from "vitest";
import {defineChatSessionFunction, LlamaChatSession, LlamaJsonSchemaGrammar} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("llama 3", () => {
    describe("functions", () => {
        test("get n-th word", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Meta-Llama-3-8B-Instruct-Q4_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 4096
            });
            const chatSession = new LlamaChatSession({
                contextSequence: context.getSequence()
            });

            const promptOptions: Parameters<typeof chatSession.prompt>[1] = {
                functions: {
                    getNthWord: defineChatSessionFunction({
                        description: "Get an n-th word",
                        params: {
                            type: "object",
                            properties: {
                                n: {
                                    enum: [1, 2, 3, 4]
                                }
                            }
                        },
                        handler(params) {
                            return ["very", "secret", "this", "hello"][params.n - 1];
                        }
                    })
                }
            } as const;

            const res = await chatSession.prompt("What is the second word?", promptOptions);

            expect(res).to.be.eq('The second word is "secret".');

            const res2 = await chatSession.prompt("Explain what this word means", {
                ...promptOptions,
                maxTokens: 40
            });

            expect(res2.length).to.be.greaterThan(1);
        });

        test("async get n-th word", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Meta-Llama-3-8B-Instruct-Q4_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 4096
            });
            const chatSession = new LlamaChatSession({
                contextSequence: context.getSequence()
            });

            const promptOptions: Parameters<typeof chatSession.prompt>[1] = {
                functions: {
                    getNthWord: defineChatSessionFunction({
                        description: "Get an n-th word",
                        params: {
                            type: "object",
                            properties: {
                                n: {
                                    enum: [1, 2, 3, 4]
                                }
                            }
                        },
                        async handler(params) {
                            return ["very", "secret", "this", "hello"][params.n - 1];
                        }
                    })
                }
            } as const;

            const res = await chatSession.prompt("What is the second word?", promptOptions);

            expect(res).to.be.eq('The second word is "secret".');

            const res2 = await chatSession.prompt("Explain what this word means", {
                ...promptOptions,
                maxTokens: 40
            });

            expect(res2.length).to.be.greaterThan(1);
        });

        test("async get n-th word twice", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Meta-Llama-3-8B-Instruct-Q4_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });

            const context = await model.createContext({
                contextSize: 4096
            });
            const chatSession = new LlamaChatSession({
                contextSequence: context.getSequence()
            });

            const promptOptions: Parameters<typeof chatSession.prompt>[1] = {
                functions: {
                    getNthWord: defineChatSessionFunction({
                        description: "Get an n-th word",
                        params: {
                            type: "object",
                            properties: {
                                n: {
                                    enum: [1, 2, 3, 4]
                                }
                            }
                        },
                        async handler(params) {
                            return ["very", "secret", "this", "hello"][params.n - 1];
                        }
                    })
                }
            } as const;

            const res = await chatSession.prompt("what are the first and second words?", promptOptions);

            expect(res).to.be.eq('The first word is "very" and the second word is "secret".');

            const res2 = await chatSession.prompt("Explain what these words mean", {
                ...promptOptions,
                maxTokens: 40
            });

            expect(res2.length).to.be.greaterThan(1);
        });

        test("Compare fruit prices", {timeout: 1000 * 60 * 60 * 2, retry: 4}, async () => {
            const modelPath = await getModelFile("Meta-Llama-3-8B-Instruct-Q4_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });

            const context = await model.createContext({
                contextSize: 4096
            });
            const chatSession = new LlamaChatSession({
                contextSequence: context.getSequence()
            });

            const fruitPrices: Record<string, string> = {
                "apple": "$6",
                "banana": "$4"
            };

            const promptOptions: Parameters<typeof chatSession.prompt>[1] = {
                functions: {
                    getFruitPrice: defineChatSessionFunction({
                        description: "Get the price of a fruit",
                        params: {
                            type: "object",
                            properties: {
                                name: {
                                    type: "string"
                                }
                            }
                        },
                        async handler(params) {
                            const name = params.name.toLowerCase();
                            if (Object.hasOwn(fruitPrices, name))
                                return {
                                    name: name,
                                    price: fruitPrices[name]
                                };

                            return `Fruit "${params.name}" is not recognized`;
                        }
                    })
                }
            } as const;

            const res = await chatSession.prompt("Is an apple more expensive than a banana?", promptOptions);

            expect(res).to.be.satisfy((text: string) => [
                "According to the information I have, an apple is more expensive than a banana.",
                "Let me check the prices for you.  According to the prices I checked, an apple is more expensive than a banana. The apple costs $6, while the banana costs $4."
            ].includes(text));
        });

        test("Compare fruit prices with currency", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Meta-Llama-3-8B-Instruct-Q4_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });

            const context = await model.createContext({
                contextSize: 4096
            });
            const chatSession = new LlamaChatSession({
                contextSequence: context.getSequence()
            });

            const fruitPrices: Record<string, {USD: number, EUR: number}> = {
                "apple": {
                    USD: 6,
                    EUR: 5
                },
                "banana": {
                    USD: 4,
                    EUR: 4
                }
            };

            const promptOptions: Parameters<typeof chatSession.prompt>[1] = {
                functions: {
                    getFruitPrice: defineChatSessionFunction({
                        description: "Get the price of a fruit",
                        params: {
                            type: "object",
                            properties: {
                                name: {
                                    type: "string"
                                },
                                currency: {
                                    oneOf: [{
                                        type: "null"
                                    }, {
                                        enum: ["USD", "EUR"]
                                    }]
                                }
                            }
                        },
                        async handler(params) {
                            const name = params.name.toLowerCase();
                            const currency = params.currency ?? "USD";
                            if (Object.keys(fruitPrices).includes(name))
                                return {
                                    name: name,
                                    price: currency === "USD"
                                        ? `${fruitPrices[name]!.USD}$`
                                        : `${fruitPrices[name]!.EUR}€`
                                };

                            return `Unrecognized fruit "${params.name}"`;
                        }
                    })
                }
            } as const;

            const res = await chatSession.prompt("Is an apple more expensive than a banana?", promptOptions);

            expect(res).toMatchInlineSnapshot(
                '"Let me check the prices for you.  According to the prices I checked, an apple is indeed more expensive than a banana. The apple costs $6, while the banana costs $4."'
            );
        });
    });

    describe("functions and grammar", () => {
        test("get n-th word", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Meta-Llama-3-8B-Instruct-Q4_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 4096
            });
            const chatSession = new LlamaChatSession({
                contextSequence: context.getSequence()
            });

            const res = await chatSession.prompt("What is the second word?", {
                functions: {
                    getNthWord: defineChatSessionFunction({
                        description: "Get an n-th word",
                        params: {
                            type: "object",
                            properties: {
                                n: {
                                    enum: [1, 2, 3, 4]
                                }
                            }
                        },
                        handler(params) {
                            return ["very", "secret", "this", "hello"][params.n - 1];
                        }
                    })
                }
            });

            expect(res).to.be.eq('The second word is "secret".');

            const res2SchemaGrammar = new LlamaJsonSchemaGrammar(llama, {
                type: "object",
                properties: {
                    word: {
                        type: "string"
                    }
                }
            });

            const res2 = await chatSession.prompt("Repeat your response", {
                grammar: res2SchemaGrammar
            });

            const parsedRes2 = res2SchemaGrammar.parse(res2);

            expect(parsedRes2).to.eql({word: "secret"});
        });
    });
});
