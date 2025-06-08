import {describe, expect, test} from "vitest";
import {
    defineChatSessionFunction, JinjaTemplateChatWrapper, LlamaChatSession, QwenChatWrapper, resolveChatWrapper
} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("qwen3 0.6b", () => {
    describe("functions", () => {
        test("get n-th word", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Qwen3-0.6B-Q8_0.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 1024
            });
            const chatSession = new LlamaChatSession({
                contextSequence: context.getSequence()
            });
            expect(chatSession.chatWrapper).to.be.instanceof(QwenChatWrapper);

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

            const res = await chatSession.prompt("What is the second word? No yapping, no formatting", {
                ...promptOptions,
                maxTokens: 250,
                budgets: {
                    thoughtTokens: 100
                }
            });

            expect(res.trim()).to.be.eq('The second word is "secret".');

            const res2 = await chatSession.prompt("Explain what this word means", {
                ...promptOptions,
                maxTokens: 40,
                budgets: {
                    thoughtTokens: 0
                }
            });

            expect(res2.length).to.be.greaterThan(1);
        });

        test("get n-th word using jinja template", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Qwen3-0.6B-Q8_0.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 1024
            });
            const chatSession = new LlamaChatSession({
                contextSequence: context.getSequence(),
                chatWrapper: resolveChatWrapper(model, {
                    type: "jinjaTemplate"
                })
            });
            expect(chatSession.chatWrapper).to.be.instanceof(JinjaTemplateChatWrapper);

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

            const res = await chatSession.prompt("What is the second word? No yapping, no formatting", {
                ...promptOptions,
                maxTokens: 250,
                budgets: {
                    thoughtTokens: 100
                }
            });

            expect(res.trim()).to.be.eq('The second word is "secret".');

            const res2 = await chatSession.prompt("Explain what this word means", {
                ...promptOptions,
                maxTokens: 40,
                budgets: {
                    thoughtTokens: 0
                }
            });

            expect(res2.length).to.be.greaterThan(1);
        });
    });
});
