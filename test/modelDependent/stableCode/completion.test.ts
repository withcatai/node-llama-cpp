import {describe, expect, test} from "vitest";
import {
    LlamaCompletion, LlamaContext, LlamaModel
} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("stableCode", () => {
    describe("completion", () => {
        test("complete a series", async () => {
            const modelPath = await getModelFile("stable-code-3b.Q5_K_M.gguf");
            const llama = await getTestLlama();

            const model = new LlamaModel({
                llama,
                modelPath
            });
            const context = new LlamaContext({
                model,
                contextSize: 4096
            });
            const completion = new LlamaCompletion({
                contextSequence: context.getSequence()
            });

            const res = await completion.generateCompletion("const arrayFromOneToTwenty = [1, 2, 3,", {
                maxTokens: 10
            });
            const expectedFullCompletion = " " + range(4, 20).join(", ");
            expect(expectedFullCompletion.slice(0, res.length)).to.eql(res);
        }, {
            timeout: 1000 * 60 * 60 * 2
        });

        test("complete pretictable text", async () => {
            const modelPath = await getModelFile("stable-code-3b.Q5_K_M.gguf");
            const llama = await getTestLlama();

            const model = new LlamaModel({
                llama,
                modelPath
            });
            const context = new LlamaContext({
                model,
                contextSize: 4096
            });
            const completion = new LlamaCompletion({
                contextSequence: context.getSequence()
            });

            const res = await completion.generateCompletion("const message = \"Hi there! How's it", {
                maxTokens: 10
            });
            const expectedFullCompletion = " going?";
            expect(res.slice(0, expectedFullCompletion.length)).to.eql(expectedFullCompletion);
        }, {
            timeout: 1000 * 60 * 60 * 2
        });
    });

    describe("infill", () => {
        test("fill the gap in a series", async () => {
            const modelPath = await getModelFile("stable-code-3b.Q5_K_M.gguf");
            const llama = await getTestLlama();

            const model = new LlamaModel({
                llama,
                modelPath
            });
            const context = new LlamaContext({
                model,
                contextSize: 4096
            });
            const completion = new LlamaCompletion({
                contextSequence: context.getSequence()
            });

            const res = await completion.generateInfillCompletion("const arrayFromOneToThirteen = [1, 2, 3, ", "10, 11, 12, 13];", {
                maxTokens: 16
            });
            expect(res).to.eql(range(4, 9).join(", ") + ", ");
        }, {
            timeout: 1000 * 60 * 60 * 2
        });

        test("fill expected text", async () => {
            const modelPath = await getModelFile("stable-code-3b.Q5_K_M.gguf");
            const llama = await getTestLlama();

            const model = new LlamaModel({
                llama,
                modelPath
            });
            const context = new LlamaContext({
                model,
                contextSize: 4096
            });
            const completion = new LlamaCompletion({
                contextSequence: context.getSequence()
            });

            const res = await completion.generateInfillCompletion('const message = "Hi there! How ', ' doing?";', {
                maxTokens: 10
            });
            expect(res).to.eql("are you");
        }, {
            timeout: 1000 * 60 * 60 * 2
        });
    });
});

function range(start: number, end: number) {
    const res = [];
    for (let i = start; i <= end; i++)
        res.push(i);

    return res;
}
