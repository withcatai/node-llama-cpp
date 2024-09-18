import {describe, expect, test} from "vitest";
import {LlamaChatSession, TokenBias} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("llama 3.1", () => {
    describe("token bias", () => {
        test("say a word", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf");
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

            const customBias = new TokenBias(model.tokenizer);

            for (const token of model.iterateAllTokens()) {
                const text = model.detokenize([token]);

                if (text.toLowerCase().includes("hello"))
                    customBias.set(token, -0.9);
                else if (text.toLowerCase().includes("hi"))
                    customBias.set(token, "never");
            }

            const res = await chatSession.prompt('Greet me by saying "hello" to me', {
                tokenBias: customBias,
                maxTokens: 100
            });

            expect(res.toLowerCase()).to.not.include("hello");
            expect(res.toLowerCase()).to.not.include("hi ");
            expect(res.toLowerCase()).to.not.include("hi.");
        });
    });
});
