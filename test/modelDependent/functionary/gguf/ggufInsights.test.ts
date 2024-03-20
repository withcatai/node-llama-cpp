import {describe, expect, test} from "vitest";
import {getModelFile} from "../../../utils/modelFiles.js";
import {GgufInsights} from "../../../../src/gguf/GgufInsights.js";
import {getTestLlama} from "../../../utils/getTestLlama.js";
import {readGgufFileInfo} from "../../../../src/gguf/readGgufFileInfo.js";
import {getGgufMetadataLlmData} from "../../../../src/gguf/utils/getGgufMetadataLlmData.js";

describe("gguf", async () => {
    describe("insights", async () => {
        const modelPath = await getModelFile("functionary-small-v2.2.q4_0.gguf");

        test("determine the number of layers from the tensor info", async () => {
            const llama = await getTestLlama();
            const ggufMetadataParseResult = await readGgufFileInfo(modelPath);
            const insights = await GgufInsights.from(ggufMetadataParseResult, llama);
            const llmData = getGgufMetadataLlmData(ggufMetadataParseResult.metadata);

            expect(insights._determineNumberOfLayersFromTensorInfo()).to.be.eql(llmData.block_count);
        });

        test("calculated model size stays the same", async () => {
            const llama = await getTestLlama();
            const ggufMetadataParseResult = await readGgufFileInfo(modelPath);

            const ggufInsights = await GgufInsights.from(ggufMetadataParseResult, llama);
            expect(ggufInsights.modelSize).toMatchInlineSnapshot("4108204160");
        });

        test("predicted VRAM usage should match actual VRAM usage", async () => {
            const llama = await getTestLlama();
            const ggufMetadataParseResult = await readGgufFileInfo(modelPath);

            const ggufInsights = await GgufInsights.from(ggufMetadataParseResult, llama);

            const initialVramUsage = llama.getVramState().used;
            const model = await llama.loadModel({
                modelPath: modelPath
            });
            const currentVramUsage = llama.getVramState().used;

            const vramUsageDiff = currentVramUsage - initialVramUsage;

            const s100MB = 100 * Math.pow(1024, 2);
            const s5MB = 5 * Math.pow(1024, 2);

            expect(ggufInsights.modelSize).toMatchInlineSnapshot("4108204160");
            expect(Math.abs(vramUsageDiff - ggufInsights.modelSize)).to.be.lte(s100MB);

            const calculationDiffWithActual = ggufInsights.modelSize - model.size;
            expect(Math.abs(calculationDiffWithActual)).to.be.lte(s5MB); // tolerate such a small difference

            if (calculationDiffWithActual !== 0)
                console.warn("Model size calculation is off by", calculationDiffWithActual, "bytes");

            await model.dispose();
        });

        test("predicted VRAM usage should match actual VRAM usage when using gpuLayers", async () => {
            const llama = await getTestLlama();
            const ggufMetadataParseResult = await readGgufFileInfo(modelPath);

            const ggufInsights = await GgufInsights.from(ggufMetadataParseResult, llama);

            const initialVramUsage = llama.getVramState().used;
            const model = await llama.loadModel({
                modelPath: modelPath,
                gpuLayers: 16
            });
            const currentVramUsage = llama.getVramState().used;

            const vramUsageDiff = currentVramUsage - initialVramUsage;

            const s100MB = 100 * Math.pow(1024, 2);
            const calculatedVramUsage = ggufInsights.calculateModelResourceRequirements(16).gpuVram;

            expect(Math.abs(vramUsageDiff - calculatedVramUsage)).to.be.lte(s100MB);

            await model.dispose();
        });
    });
});
