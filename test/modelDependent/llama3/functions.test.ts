import {describe, expect, test} from "vitest";
import {defineChatSessionFunction, LlamaChatSession, LlamaJsonSchemaGrammar} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("llama 3", () => {
    describe("functions", () => {
        test("get n-th word", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Meta-Llama-3-8B-Instruct.Q4_K_M.gguf");
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
            const modelPath = await getModelFile("Meta-Llama-3-8B-Instruct.Q4_K_M.gguf");
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
            const modelPath = await getModelFile("Meta-Llama-3-8B-Instruct.Q4_K_M.gguf");
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
    });

    describe("functions and grammar", () => {
        test("get n-th word", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Meta-Llama-3-8B-Instruct.Q4_K_M.gguf");
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
