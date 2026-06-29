import {describe, expect, test} from "vitest";
import {defineChatSessionFunction, Gemma4ChatWrapper, LlamaChatSession} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("gemma4 e2b", () => {
    describe("functions", () => {
        test("auto-resolves Gemma4ChatWrapper and can call a function", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("gemma-4-E2B-it-Q4_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 2048
            });
            const chatSession = new LlamaChatSession({
                contextSequence: context.getSequence()
            });

            expect(chatSession.chatWrapper).toBeInstanceOf(Gemma4ChatWrapper);

            let functionCallCount = 0;
            const promptOptions: Parameters<typeof chatSession.prompt>[1] = {
                maxTokens: 200,
                functions: {
                    getNthWord: defineChatSessionFunction({
                        description: "Get an n-th word",
                        params: {
                            type: "object",
                            properties: {
                                n: {
                                    enum: [1, 2, 3, 4]
                                }
                            },
                            required: ["n"]
                        },
                        handler(params) {
                            functionCallCount++;
                            return ["very", "secret", "this", "hello"][params.n - 1];
                        }
                    })
                }
            };
            const response = await chatSession.prompt("What is the second word?", promptOptions);

            expect(functionCallCount).toBeGreaterThan(0);
            expect(functionCallCount).toBeLessThanOrEqual(2);
            expect(response.toLowerCase()).toContain("secret");

            const followUpResponse = await chatSession.prompt("Explain what this word means in one short sentence.", {
                ...promptOptions,
                maxTokens: 60
            });

            expect(followUpResponse.length).toBeGreaterThan(10);
        });
    });
});
