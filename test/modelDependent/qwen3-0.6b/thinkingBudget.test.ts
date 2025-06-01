import {describe, expect, test} from "vitest";
import {LlamaChatSession, isChatModelResponseSegment} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("qwen3 0.6b", () => {
    describe("thinking budget", () => {
        test("doesn't exceed thinking budget", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Qwen3-0.6B-Q8_0.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 512
            });
            const chatSession = new LlamaChatSession({
                contextSequence: context.getSequence()
            });

            const initialChatHistory = chatSession.getChatHistory();

            async function promptWithBudget({
                prompt, maxTokens, thinkingBudget
            }: {
                prompt: string, maxTokens: number, thinkingBudget?: number
            }) {
                let thoughtTokens = 0;
                let totalTokens = 0;

                chatSession.setChatHistory(initialChatHistory);
                const {responseText, response} = await chatSession.promptWithMeta(prompt, {
                    maxTokens,
                    budgets: {
                        thoughtTokens: thinkingBudget
                    },
                    onResponseChunk(chunk) {
                        if (chunk.type === "segment" && chunk.segmentType === "thought") {
                            thoughtTokens += chunk.tokens.length;
                        }

                        totalTokens += chunk.tokens.length;
                    }
                });

                return {
                    thoughtTokens,
                    totalTokens,
                    responseText,
                    thoughts: response
                        .filter((item) => isChatModelResponseSegment(item))
                        .filter((item) => item.segmentType === "thought")
                        .map((item) => item.text)
                };
            }

            const res1 = await promptWithBudget({
                prompt: "Where do llamas come from?",
                thinkingBudget: 10,
                maxTokens: 20
            });
            expect(res1.thoughtTokens).to.be.gt(1);
            expect(res1.thoughtTokens).to.be.lte(10);
            expect(res1.totalTokens).to.be.gte(16);
            expect(res1.totalTokens).to.be.lte(20);

            const res2 = await promptWithBudget({
                prompt: "Where do llamas come from?",
                thinkingBudget: 0,
                maxTokens: 20
            });
            expect(res2.thoughtTokens).to.be.eq(0);
            expect(res2.totalTokens).to.be.gte(16);
            expect(res2.totalTokens).to.be.lte(20);

            const res3 = await promptWithBudget({
                prompt: "Where do llamas come from?",
                thinkingBudget: 20,
                maxTokens: 20
            });
            expect(res3.thoughtTokens).to.be.eq(res3.totalTokens);
            expect(res3.totalTokens).to.be.gte(16);
            expect(res3.totalTokens).to.be.lte(20);

            const res4 = await promptWithBudget({
                prompt: "Where do llamas come from?",
                maxTokens: 20
            });
            expect(res4.thoughtTokens).to.be.eq(res4.totalTokens);
            expect(res4.totalTokens).to.be.gte(16);
            expect(res4.totalTokens).to.be.lte(20);
        });
    });
});
