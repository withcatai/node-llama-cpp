import {describe, expect, test} from "vitest";
import {getModelFile} from "../../../utils/modelFiles.js";
import {GgufInsights, GgufInsightsResourceRequirements} from "../../../../src/gguf/insights/GgufInsights.js";
import {getTestLlama} from "../../../utils/getTestLlama.js";
import {readGgufFileInfo} from "../../../../src/gguf/readGgufFileInfo.js";
import {toBytes} from "../../../../src/cli/utils/toBytes.js";

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
                "cpuRam": "4.22GB",
                "gpuVram": "528.01MB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateModelResourceRequirements({gpuLayers: 8}))).toMatchInlineSnapshot(`
              {
                "cpuRam": "3.42GB",
                "gpuVram": "1.32GB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateModelResourceRequirements({gpuLayers: 16}))).toMatchInlineSnapshot(`
              {
                "cpuRam": "2.51GB",
                "gpuVram": "2.34GB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateModelResourceRequirements({gpuLayers: 24}))).toMatchInlineSnapshot(`
              {
                "cpuRam": "1.59GB",
                "gpuVram": "3.14GB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateModelResourceRequirements({gpuLayers: 32}))).toMatchInlineSnapshot(`
              {
                "cpuRam": "692.8MB",
                "gpuVram": "4.06GB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateModelResourceRequirements({gpuLayers: 33}))).toMatchInlineSnapshot(`
              {
                "cpuRam": "281.81MB",
                "gpuVram": "4.06GB",
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

            const s330MB = 330 * Math.pow(1024, 2);
            const s5MB = 5 * Math.pow(1024, 2);

            const estimatedModelResourceUsage = ggufInsights.estimateModelResourceRequirements({
                gpuLayers: ggufInsights.totalLayers
            });
            expect(toBytes(estimatedModelResourceUsage.gpuVram)).toMatchInlineSnapshot('"4.06GB"');
            expect(toBytes(estimatedModelResourceUsage.cpuRam)).toMatchInlineSnapshot('"281.81MB"');
            expect(Math.abs(modelVramUsageDiff - estimatedModelResourceUsage.gpuVram)).to.be.lte(s330MB);

            const modelEstimationDiffWithActual = estimatedModelResourceUsage.gpuVram + estimatedModelResourceUsage.cpuRam - model.size;
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
            expect(toBytes(estimatedContextVramUsage)).toMatchInlineSnapshot("\"1.03GB\"");
            expect(Math.abs(contextVramUsageDiff - estimatedContextVramUsage)).to.be.lte(s330MB);

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
                "cpuRam": "1.75GB",
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
                "cpuRam": "1GB",
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
                "cpuRam": "643.08MB",
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
                "cpuRam": "451.08MB",
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
                "cpuRam": "1.71GB",
                "gpuVram": "355.75MB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 4096,
                modelGpuLayers: 1,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "1002.82MB",
                "gpuVram": "315.75MB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 2048,
                modelGpuLayers: 1,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "630.82MB",
                "gpuVram": "295.75MB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 1024,
                modelGpuLayers: 1,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "444.82MB",
                "gpuVram": "285.75MB",
              }
            `);

            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 8192,
                modelGpuLayers: 16,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "1022.79MB",
                "gpuVram": "1.05GB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 4096,
                modelGpuLayers: 16,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "638.79MB",
                "gpuVram": "679.75MB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 2048,
                modelGpuLayers: 16,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "446.79MB",
                "gpuVram": "479.75MB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 1024,
                modelGpuLayers: 16,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "350.79MB",
                "gpuVram": "379.75MB",
              }
            `);

            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 8192,
                modelGpuLayers: 32,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "250.5MB",
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
                "cpuRam": "250.5MB",
                "gpuVram": "1.03GB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 2048,
                modelGpuLayers: 32,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "250.5MB",
                "gpuVram": "668.02MB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 1024,
                modelGpuLayers: 32,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "250.5MB",
                "gpuVram": "476.02MB",
              }
            `);

            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 8192,
                modelGpuLayers: 33,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "250.5MB",
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
                "cpuRam": "250.5MB",
                "gpuVram": "1.03GB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 2048,
                modelGpuLayers: 33,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "250.5MB",
                "gpuVram": "668.02MB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateContextResourceRequirements({
                contextSize: 1024,
                modelGpuLayers: 33,
                sequences: 1,
                batchSize: 512
            }))).toMatchInlineSnapshot(`
              {
                "cpuRam": "250.5MB",
                "gpuVram": "476.02MB",
              }
            `);
        });
    });
});

function makeEstimationReadable(resourceRequirements: GgufInsightsResourceRequirements) {
    return {
        cpuRam: toBytes(resourceRequirements.cpuRam),
        gpuVram: toBytes(resourceRequirements.gpuVram)
    };
}
