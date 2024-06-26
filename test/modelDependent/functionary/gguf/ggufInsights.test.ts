import {describe, expect, test} from "vitest";
import bytes from "bytes";
import {getModelFile} from "../../../utils/modelFiles.js";
import {GgufInsights, GgufInsightsResourceRequirements} from "../../../../src/gguf/insights/GgufInsights.js";
import {getTestLlama} from "../../../utils/getTestLlama.js";
import {readGgufFileInfo} from "../../../../src/gguf/readGgufFileInfo.js";

describe("gguf", async () => {
    describe("insights", async () => {
        const modelPath = await getModelFile("functionary-small-v2.5.Q4_0.gguf");

        test("determine the number of layers from the tensor info", async () => {
            const llama = await getTestLlama();
            const ggufMetadataParseResult = await readGgufFileInfo(modelPath);
            const insights = await GgufInsights.from(ggufMetadataParseResult, llama);

            expect(insights._determineNumberOfLayersFromTensorInfo()).to.be.eql(ggufMetadataParseResult.architectureMetadata.block_count);
        });

        test("calculated model size stays the same", async () => {
            const llama = await getTestLlama();
            const ggufMetadataParseResult = await readGgufFileInfo(modelPath);

            const ggufInsights = await GgufInsights.from(ggufMetadataParseResult, llama);
            expect(ggufInsights.modelSize).toMatchInlineSnapshot("4653375488");
        });

        test("estimated model memory footprint stays the same", async () => {
            const llama = await getTestLlama();
            const ggufMetadataParseResult = await readGgufFileInfo(modelPath);

            const ggufInsights = await GgufInsights.from(ggufMetadataParseResult, llama);
            expect(makeEstimationReadable(ggufInsights.estimateModelResourceRequirements({gpuLayers: 0}))).toMatchInlineSnapshot(`
              {
                "cpuRam": "4.33GB",
                "gpuVram": "0B",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateModelResourceRequirements({gpuLayers: 1}))).toMatchInlineSnapshot(`
              {
                "cpuRam": "3.54GB",
                "gpuVram": "809.84MB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateModelResourceRequirements({gpuLayers: 8}))).toMatchInlineSnapshot(`
              {
                "cpuRam": "2.74GB",
                "gpuVram": "1.59GB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateModelResourceRequirements({gpuLayers: 16}))).toMatchInlineSnapshot(`
              {
                "cpuRam": "1.83GB",
                "gpuVram": "2.51GB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateModelResourceRequirements({gpuLayers: 24}))).toMatchInlineSnapshot(`
              {
                "cpuRam": "936.25MB",
                "gpuVram": "3.42GB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateModelResourceRequirements({gpuLayers: 32}))).toMatchInlineSnapshot(`
              {
                "cpuRam": "0B",
                "gpuVram": "4.33GB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateModelResourceRequirements({gpuLayers: 33}))).toMatchInlineSnapshot(`
              {
                "cpuRam": "0B",
                "gpuVram": "4.33GB",
              }
            `);
        });

        test("predicted VRAM usage should match actual VRAM usage", {timeout: 1000 * 60 * 5}, async (testContext) => {
            const llama = await getTestLlama();
            const ggufMetadataParseResult = await readGgufFileInfo(modelPath);

            if (llama.gpu === false)
                return testContext.skip();

            const ggufInsights = await GgufInsights.from(ggufMetadataParseResult, llama);

            const initialModelVramUsage = (await llama.getVramState()).used;
            const model = await llama.loadModel({
                modelPath: modelPath,
                gpuLayers: ggufInsights.totalLayers
            });
            const currentModelVramUsage = (await llama.getVramState()).used;

            const modelVramUsageDiff = currentModelVramUsage - initialModelVramUsage;

            const s300MB = 300 * Math.pow(1024, 2);
            const s5MB = 5 * Math.pow(1024, 2);

            const estimatedModelVramUsage = ggufInsights.estimateModelResourceRequirements({gpuLayers: ggufInsights.totalLayers}).gpuVram;
            expect(bytes(estimatedModelVramUsage)).toMatchInlineSnapshot('"4.33GB"');
            expect(Math.abs(modelVramUsageDiff - estimatedModelVramUsage)).to.be.lte(s300MB);

            const modelEstimationDiffWithActual = estimatedModelVramUsage - model.size;
            expect(Math.abs(modelEstimationDiffWithActual)).to.be.lte(s5MB); // tolerate such a small difference

            if (modelEstimationDiffWithActual !== 0)
                console.warn("Model size estimation is off by", modelEstimationDiffWithActual, "bytes");

            const initialContextVramUsage = (await llama.getVramState()).used;
            const context = await model.createContext({
                contextSize: 4096,
                batchSize: 512,
                sequences: 1
            });
            const currentContextVramUsage = (await llama.getVramState()).used;

            const contextVramUsageDiff = currentContextVramUsage - initialContextVramUsage;

            const estimatedContextVramUsage = ggufInsights.estimateContextResourceRequirements({
                contextSize: context.contextSize,
                batchSize: context.batchSize,
                sequences: context.totalSequences,
                modelGpuLayers: ggufInsights.totalLayers
            }).gpuVram;
            expect(bytes(estimatedContextVramUsage)).toMatchInlineSnapshot('"1.02GB"');
            expect(Math.abs(contextVramUsageDiff - estimatedContextVramUsage)).to.be.lte(s300MB);

            await model.dispose();
        });

        test("predicted VRAM usage should match actual VRAM usage when using gpuLayers", {timeout: 1000 * 60 * 5}, async (context) => {
            const llama = await getTestLlama();
            const ggufMetadataParseResult = await readGgufFileInfo(modelPath);

            if (llama.gpu === false)
                return context.skip();

            const ggufInsights = await GgufInsights.from(ggufMetadataParseResult, llama);

            const initialVramUsage = (await llama.getVramState()).used;
            const model = await llama.loadModel({
                modelPath: modelPath,
                gpuLayers: 16
            });
            const currentVramUsage = (await llama.getVramState()).used;

            const vramUsageDiff = currentVramUsage - initialVramUsage;

            const s200MB = 200 * Math.pow(1024, 2);
            const calculatedVramUsage = ggufInsights.estimateModelResourceRequirements({gpuLayers: 16}).gpuVram;

            expect(Math.abs(vramUsageDiff - calculatedVramUsage)).to.be.lte(s200MB);

            await model.dispose();
        });

        test("estimated context memory footprint stays the same", async () => {
            const llama = await getTestLlama();
            const ggufMetadataParseResult = await readGgufFileInfo(modelPath);

            const ggufInsights = await GgufInsights.from(ggufMetadataParseResult, llama);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 8192,
                modelGpuLayers: 0,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "1.78GB",
                "gpuVram": "0B",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 4096,
                modelGpuLayers: 0,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "1.02GB",
                "gpuVram": "0B",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 2048,
                modelGpuLayers: 0,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "650.6MB",
                "gpuVram": "0B",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 1024,
                modelGpuLayers: 0,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "454.58MB",
                "gpuVram": "0B",
              }
            `);

            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 8192,
                modelGpuLayers: 1,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "1GB",
                "gpuVram": "834.69MB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 4096,
                modelGpuLayers: 1,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "512MB",
                "gpuVram": "546.63MB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 2048,
                modelGpuLayers: 1,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "256MB",
                "gpuVram": "402.6MB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 1024,
                modelGpuLayers: 1,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "128MB",
                "gpuVram": "330.58MB",
              }
            `);

            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 8192,
                modelGpuLayers: 16,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "544MB",
                "gpuVram": "1.28GB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 4096,
                modelGpuLayers: 16,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "272MB",
                "gpuVram": "786.67MB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 2048,
                modelGpuLayers: 16,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "136MB",
                "gpuVram": "522.64MB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 1024,
                modelGpuLayers: 16,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "68MB",
                "gpuVram": "390.63MB",
              }
            `);

            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 8192,
                modelGpuLayers: 32,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "32MB",
                "gpuVram": "1.78GB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 4096,
                modelGpuLayers: 32,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "16MB",
                "gpuVram": "1.02GB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 2048,
                modelGpuLayers: 32,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "8MB",
                "gpuVram": "650.69MB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 1024,
                modelGpuLayers: 32,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "4MB",
                "gpuVram": "454.67MB",
              }
            `);

            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 8192,
                modelGpuLayers: 33,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "0B",
                "gpuVram": "1.78GB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 4096,
                modelGpuLayers: 33,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "0B",
                "gpuVram": "1.02GB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 2048,
                modelGpuLayers: 33,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "0B",
                "gpuVram": "650.69MB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 1024,
                modelGpuLayers: 33,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "0B",
                "gpuVram": "454.67MB",
              }
            `);
        });
    });
});

function makeEstimationReadable(resourceRequirements: GgufInsightsResourceRequirements) {
    return {
        cpuRam: bytes(resourceRequirements.cpuRam),
        gpuVram: bytes(resourceRequirements.gpuVram)
    };
}
