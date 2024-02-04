import {describe, expect, test} from "vitest";
import {defineChatSessionFunction, getLlama, LlamaChatSession, LlamaContext, LlamaModel} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";

describe("functionary", () => {
    describe("functions", () => {
        test("get time", async () => {
            const modelPath = await getModelFile("functionary-small-v2.2.q4_0.gguf");
            const llama = await getLlama();

            const model = new LlamaModel({
                llama,
                modelPath
            });
            const context = new LlamaContext({
                model,
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
        }, {
            timeout: 1000 * 60 * 60 * 2
        });
    });
});
