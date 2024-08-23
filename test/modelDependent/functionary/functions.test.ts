import {describe, expect, test} from "vitest";
import {defineChatSessionFunction, FunctionaryChatWrapper, LlamaChatSession, LlamaJsonSchemaGrammar} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("functionary", () => {
    describe("functions", () => {
        test("get n-th word", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("functionary-small-v2.5.Q4_0.gguf");
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

            expect(chatSession.chatWrapper).to.be.an.instanceof(FunctionaryChatWrapper);

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
            const modelPath = await getModelFile("functionary-small-v2.5.Q4_0.gguf");
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
            const modelPath = await getModelFile("functionary-small-v2.5.Q4_0.gguf");
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

        test("Compare fruit prices", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("functionary-small-v2.5.Q4_0.gguf");
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

            expect(res).to.be.eq(
                "Yes, an apple is more expensive than a banana. The price of an apple is $6, while the price of a banana is $4."
            );
        });
    });

    describe("functions and grammar", () => {
        test("get n-th word", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("functionary-small-v2.5.Q4_0.gguf");
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
