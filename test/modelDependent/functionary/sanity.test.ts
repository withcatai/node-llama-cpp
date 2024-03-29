import {describe, expect, test} from "vitest";
import {LlamaChatSession} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("functionary", () => {
    describe("sanity", () => {
        test("How much is 6+6", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("functionary-small-v2.2.q4_0.gguf");
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

            const res = await chatSession.prompt("How much is 6+6");

            expect(res).to.eql("6+6 equals 12.");
        });

        test("text is tokenized with special tokens when appropriate", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("functionary-small-v2.2.q4_0.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });

            const text = "<|from|>system\n<|recipient|>all\n<|content|>How much is 6+6\n";

            const tokensWithSpecialTokens = model.tokenize(text, true);
            const tokensWithoutSpecialTokens = model.tokenize(text);

            expect(tokensWithSpecialTokens).to.not.eql(tokensWithoutSpecialTokens);

            expect(tokensWithSpecialTokens).to.toMatchInlineSnapshot(`
              [
                32002,
                6574,
                13,
                32001,
                455,
                13,
                32000,
                5660,
                1188,
                349,
                28705,
                28784,
                28806,
                28784,
                13,
              ]
            `);
            expect(tokensWithoutSpecialTokens).to.toMatchInlineSnapshot(`
              [
                523,
                28766,
                3211,
                28766,
                28767,
                6574,
                13,
                28789,
                28766,
                3354,
                508,
                722,
                28766,
                28767,
                455,
                13,
                28789,
                28766,
                3789,
                28766,
                28767,
                5660,
                1188,
                349,
                28705,
                28784,
                28806,
                28784,
                13,
              ]
            `);
        });
    });
});
