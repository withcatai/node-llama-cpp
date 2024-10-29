import {describe, expect, test} from "vitest";
import {LlamaCompletion} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("CodeGemma", () => {
    describe("completion", () => {
        test("complete a list of sweet fruits", {timeout: 1000 * 60 * 60 * 2, retry: 4}, async () => {
            const modelPath = await getModelFile("codegemma-2b-Q4_K_M.gguf");
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

            const res = await completion.generateCompletion("Sweet fruit names:\n* ", {
                maxTokens: 10,
                seed: 30
            });
            expect(res).toMatchInlineSnapshot(`
              "1. Apple
              * 2. Banana
              "
            `);
        });
    });

    describe("infill", () => {
        test("fill in a list of sweet fruits", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("codegemma-2b-Q4_K_M.gguf");
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

            const prefix = "4 sweet fruits, listed alphabetically: Apple,";
            const suffix = "and Grape.\n\n";
            const res = await completion.generateInfillCompletion(prefix, suffix, {
                maxTokens: 10
            });
            expect(res).toMatchInlineSnapshot('"Banana, Kiwi, "');
        });
    });
});
