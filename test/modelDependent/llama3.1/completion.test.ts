import {describe, expect, test} from "vitest";
import {LlamaCompletion} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("llama 3.1", () => {
    describe("completion", () => {
        test("complete a list of sweet fruits", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 4096
            });
            const completion = new LlamaCompletion({
                contextSequence: context.getSequence()
            });

            const res = await completion.generateCompletion("Here is a list of sweet fruits:\n* ", {
                maxTokens: 10
            });
            expect(res).toMatchInlineSnapshot(`
              "1. Mango
              * 2. Pineapple"
            `);
        });
    });
});
