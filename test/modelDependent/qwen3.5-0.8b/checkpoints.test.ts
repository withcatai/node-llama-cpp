import {describe, expect, test} from "vitest";
import {defineChatSessionFunction, LlamaChatSession, QwenChatWrapper} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("qwen3.5 0.8b", () => {
    describe("functions", () => {
        test("use checkpoints", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Qwen3.5-0.8B-Q8_0.gguf");
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
            expect(chatSession.chatWrapper).toBeInstanceOf(QwenChatWrapper);

            const promptOptions: Parameters<typeof chatSession.prompt>[1] = {
                functions: {
                    getNthWord: defineChatSessionFunction({
                        description: "Get an n-th word",
                        params: {
                            type: "object",
                            properties: {
                                n: {
                                    enum: [1, 2, 3, 4]
                                },
                                dummy: {
                                    const: "This is a long text, I'll write it"
                                }
                            }
                        },
                        handler(params) {
                            return ["very", "secret", "this", "hello"][params.n - 1];
                        }
                    })
                }
            } as const;

            const res = await chatSession.prompt("What is the second word? use the function", promptOptions);

            expect(res).to.toMatchInlineSnapshot(`
              "



              The second word is "secret"."
            `);
            expect(chatSession.sequence.tokenMeter.usedInputTokens).toMatchInlineSnapshot("391");
            expect(chatSession.sequence.lastCheckpointIndex).toMatchInlineSnapshot("550");
            expect(chatSession.sequence.nextTokenIndex).toMatchInlineSnapshot("585");

            const initialMeterState = chatSession.sequence.tokenMeter.getState();
            const res2 = await chatSession.prompt("Explain what this word means. short", {
                ...promptOptions,
                maxTokens: 12,
                budgets: {
                    thoughtTokens: 4
                }
            });

            const diffMeterState = chatSession.sequence.tokenMeter.diff(initialMeterState);
            expect(res2.toLowerCase()).to.toMatchInlineSnapshot(`
              "

              "secret" means something hidden or"
            `);
            expect(diffMeterState.usedInputTokens).toMatchInlineSnapshot("94");
            expect(diffMeterState.usedInputTokens).to.be.lessThanOrEqual(95);
            expect(chatSession.sequence.lastCheckpointIndex).toMatchInlineSnapshot("448");
            expect(chatSession.sequence.nextTokenIndex).toMatchInlineSnapshot("464");
        });

        test("disposing the context asynchronously works", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Qwen3.5-0.8B-Q8_0.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });

            for (let i = 0; i < 4; i++) {
                const context = await model.createContext({
                    contextSize: 4096
                });
                const contextSequence = context.getSequence();
                const chatSession = new LlamaChatSession({contextSequence});

                await chatSession.prompt("Tell me a short story", {maxTokens: 40});

                void contextSequence.takeCheckpoint();
                await context.dispose(); // should not crash the process
            }
        });
    });
});
