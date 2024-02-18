import {describe, expect, test} from "vitest";
import {
    LlamaCompletion, LlamaContext, LlamaModel
} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("stableCode", () => {
    describe("parallel", () => {
        test("can use multiple models in parallel", async () => {
            const modelPath = await getModelFile("stable-code-3b.Q5_K_M.gguf");
            const llama = await getTestLlama();

            const model = new LlamaModel({
                llama,
                modelPath
            });
            const model2 = new LlamaModel({
                llama,
                modelPath
            });
            const context = new LlamaContext({
                model,
                contextSize: 4096
            });
            const context2 = new LlamaContext({
                model: model2,
                contextSize: 4096
            });
            const completion = new LlamaCompletion({
                contextSequence: context.getSequence()
            });
            const completion2 = new LlamaCompletion({
                contextSequence: context2.getSequence()
            });

            const resPromise = completion.generateCompletion("const arrayFromOneToHundred = [1, 2, 3,", {
                maxTokens: 50
            });
            const resPromise2 = completion2.generateCompletion("const arrayFromOneHundredToOne = [100, 99, 98, 97,", {
                maxTokens: 50
            });

            const [
                res,
                res2
            ] = await Promise.all([
                resPromise,
                resPromise2
            ]);

            const expectedFullCompletion = " " + range(4, 100).join(", ");
            const expectedFullCompletion2 = " " + range(96, 1).join(", ");
            expect(expectedFullCompletion.slice(0, res.length)).to.eql(res);
            expect(expectedFullCompletion2.slice(0, res2.length)).to.eql(res2);
        }, {
            timeout: 1000 * 60 * 60 * 2
        });

        test("can use multiple contexts in parallel", async () => {
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
            const context2 = new LlamaContext({
                model: model,
                contextSize: 4096
            });
            const completion = new LlamaCompletion({
                contextSequence: context.getSequence()
            });
            const completion2 = new LlamaCompletion({
                contextSequence: context2.getSequence()
            });

            const resPromise = completion.generateCompletion("const arrayFromOneToHundred = [1, 2, 3,", {
                maxTokens: 50
            });
            const resPromise2 = completion2.generateCompletion("const arrayFromOneHundredToOne = [100, 99, 98, 97,", {
                maxTokens: 50
            });

            const [
                res,
                res2
            ] = await Promise.all([
                resPromise,
                resPromise2
            ]);

            const expectedFullCompletion = " " + range(4, 100).join(", ");
            const expectedFullCompletion2 = " " + range(96, 1).join(", ");
            expect(expectedFullCompletion.slice(0, res.length)).to.eql(res);
            expect(expectedFullCompletion2.slice(0, res2.length)).to.eql(res2);
        }, {
            timeout: 1000 * 60 * 60 * 2
        });

        test("can use multiple context sequences in parallel", async () => {
            const modelPath = await getModelFile("stable-code-3b.Q5_K_M.gguf");
            const llama = await getTestLlama();

            const model = new LlamaModel({
                llama,
                modelPath
            });
            const context = new LlamaContext({
                model,
                contextSize: 4096,
                sequences: 2
            });
            const completion = new LlamaCompletion({
                contextSequence: context.getSequence()
            });
            const completion2 = new LlamaCompletion({
                contextSequence: context.getSequence()
            });

            const resPromise = completion.generateCompletion("const arrayFromOneToHundred = [1, 2, 3,", {
                maxTokens: 50
            });
            const resPromise2 = completion2.generateCompletion("const arrayFromOneHundredToOne = [100, 99, 98, 97,", {
                maxTokens: 50
            });

            const [
                res,
                res2
            ] = await Promise.all([
                resPromise,
                resPromise2
            ]);

            const expectedFullCompletion = " " + range(4, 100).join(", ");
            const expectedFullCompletion2 = " " + range(96, 1).join(", ");
            expect(expectedFullCompletion.slice(0, res.length)).to.eql(res);
            expect(expectedFullCompletion2.slice(0, res2.length)).to.eql(res2);
        }, {
            timeout: 1000 * 60 * 60 * 2
        });
    });
});

function range(start: number, end: number) {
    const res = [];
    if (start <= end) {
        for (let i = start; i <= end; i++)
            res.push(i);
    } else {
        for (let i = start; i >= end; i--)
            res.push(i);
    }

    return res;
}
