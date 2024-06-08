import {describe, expect, test} from "vitest";
import {LlamaCompletion} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {createTestLlama, getTestLlama} from "../../utils/getTestLlama.js";

describe("stableCode", () => {
    describe("parallel", () => {
        test("can use multiple bindings in parallel", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("stable-code-3b-Q5_K_M.gguf");
            const llama = await getTestLlama();
            const llama2 = await createTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const model2 = await llama2.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 4096
            });
            const context2 = await model2.createContext({
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

            await llama2.dispose();
            expect(model2.disposed).toBe(true);
            expect(context2.disposed).toBe(true);
            expect(completion2.disposed).toBe(true);
        });

        test("can use multiple models in parallel", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("stable-code-3b-Q5_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const model2 = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 4096
            });
            const context2 = await model2.createContext({
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
            expect(res).to.eql(expectedFullCompletion.slice(0, res.length));
            expect(res2).to.eql(expectedFullCompletion2.slice(0, res2.length));
        });

        test("can use multiple contexts in parallel", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("stable-code-3b-Q5_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 4096
            });
            const context2 = await model.createContext({
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
            expect(res).to.eql(expectedFullCompletion.slice(0, res.length));
            expect(res2).to.eql(expectedFullCompletion2.slice(0, res2.length));
        });

        test("can use multiple context sequences in parallel", {timeout: 1000 * 60 * 60 * 2, retry: 4}, async () => {
            const modelPath = await getModelFile("stable-code-3b-Q5_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 4096,
                sequences: 2,
                seed: 0
            });
            const completion = new LlamaCompletion({
                contextSequence: context.getSequence()
            });
            const completion2 = new LlamaCompletion({
                contextSequence: context.getSequence()
            });

            const resPromise = completion.generateCompletion("const arrayFromOneToHundred = [1, 2, 3", {
                maxTokens: 40
            });
            const resPromise2 = completion2.generateCompletion("const arrayFromOneHundredToOne = [100, 99, 98, 97, 96,", {
                maxTokens: 40
            });

            const [
                res,
                res2
            ] = await Promise.all([
                resPromise,
                resPromise2
            ]);

            const expectedFullCompletion = ", " + range(4, 100).join(", ");
            const expectedFullCompletion2 = " " + range(95, 1).join(", ");
            expect(res).to.eql(expectedFullCompletion.slice(0, res.length));
            expect(res2.trim()).to.eql(expectedFullCompletion2.trim().slice(0, res2.trim().length));
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
