import {describe, expect, test} from "vitest";
import {LlamaChatSession, LlamaContext, LlamaModel} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("functionary", () => {
    describe("sanity", () => {
        test("How much is 6+6", async () => {
            const modelPath = await getModelFile("functionary-small-v2.2.q4_0.gguf");
            const llama = await getTestLlama();

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

            const res = await chatSession.prompt("How much is 6+6");

            expect(res).to.eql("6+6 equals 12.");
        }, {
            timeout: 1000 * 60 * 60 * 2
        });
    });
});
