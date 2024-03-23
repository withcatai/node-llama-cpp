import {describe, expect, test} from "vitest";
import bytes from "bytes";
import {getModelFile} from "../../../utils/modelFiles.js";
import {GgufInsights, GgufInsightsResourceRequirements} from "../../../../src/gguf/GgufInsights.js";
import {getTestLlama} from "../../../utils/getTestLlama.js";
import {readGgufFileInfo} from "../../../../src/gguf/readGgufFileInfo.js";

describe("gguf", async () => {
    describe("insights", async () => {
        const modelPath = await getModelFile("functionary-small-v2.2.q4_0.gguf");

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
            expect(ggufInsights.modelSize).toMatchInlineSnapshot("4108204160");
        });

        test("estimated model memory footprint stays the same", async () => {
            const llama = await getTestLlama();
            const ggufMetadataParseResult = await readGgufFileInfo(modelPath);

            const ggufInsights = await GgufInsights.from(ggufMetadataParseResult, llama);
            expect(makeEstimationReadable(ggufInsights.estimateModelResourceRequirements({gpuLayers: 0}))).toMatchInlineSnapshot(`
              {
                "cpuRam": "3.83GB",
                "gpuVram": "0B",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateModelResourceRequirements({gpuLayers: 1}))).toMatchInlineSnapshot(`
              {
                "cpuRam": "3.54GB",
                "gpuVram": "289.92MB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateModelResourceRequirements({gpuLayers: 8}))).toMatchInlineSnapshot(`
              {
                "cpuRam": "2.74GB",
                "gpuVram": "1.08GB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateModelResourceRequirements({gpuLayers: 16}))).toMatchInlineSnapshot(`
              {
                "cpuRam": "1.83GB",
                "gpuVram": "2GB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateModelResourceRequirements({gpuLayers: 24}))).toMatchInlineSnapshot(`
              {
                "cpuRam": "936.25MB",
                "gpuVram": "2.91GB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateModelResourceRequirements({gpuLayers: 32}))).toMatchInlineSnapshot(`
              {
                "cpuRam": "0B",
                "gpuVram": "3.83GB",
              }
            `);
            expect(makeEstimationReadable(ggufInsights.estimateModelResourceRequirements({gpuLayers: 33}))).toMatchInlineSnapshot(`
              {
                "cpuRam": "0B",
                "gpuVram": "3.83GB",
              }
            `);
        });

        test("predicted VRAM usage should match actual VRAM usage", async (testContext) => {
            const llama = await getTestLlama();
            const ggufMetadataParseResult = await readGgufFileInfo(modelPath);

            if (llama.gpu === false)
                return testContext.skip();

            const ggufInsights = await GgufInsights.from(ggufMetadataParseResult, llama);

            const initialModelVramUsage = llama.getVramState().used;
            const model = await llama.loadModel({
                modelPath: modelPath,
                gpuLayers: ggufInsights.totalLayers
            });
            const currentModelVramUsage = llama.getVramState().used;

            const modelVramUsageDiff = currentModelVramUsage - initialModelVramUsage;

            const s100MB = 100 * Math.pow(1024, 2);
            const s5MB = 5 * Math.pow(1024, 2);

            const estimatedModelVramUsage = ggufInsights.estimateModelResourceRequirements({gpuLayers: ggufInsights.totalLayers}).gpuVram;
            expect(bytes(estimatedModelVramUsage)).toMatchInlineSnapshot('"3.83GB"');
            expect(Math.abs(modelVramUsageDiff - estimatedModelVramUsage)).to.be.lte(s100MB);

            const modelEstimationDiffWithActual = estimatedModelVramUsage - model.size;
            expect(Math.abs(modelEstimationDiffWithActual)).to.be.lte(s5MB); // tolerate such a small difference

            if (modelEstimationDiffWithActual !== 0)
                console.warn("Model size estimation is off by", modelEstimationDiffWithActual, "bytes");

            const initialContextVramUsage = llama.getVramState().used;
            const context = await model.createContext({
                contextSize: 4096,
                batchSize: 512,
                sequences: 1
            });
            const currentContextVramUsage = llama.getVramState().used;

            const contextVramUsageDiff = currentContextVramUsage - initialContextVramUsage;

            const estimatedContextVramUsage = ggufInsights.estimateContextResourceRequirements({
                contextSize: context.contextSize,
                batchSize: context.batchSize,
                sequences: context.totalSequences,
                modelGpuLayers: ggufInsights.totalLayers
            }).gpuVram;
            expect(bytes(estimatedContextVramUsage)).toMatchInlineSnapshot('"809.83MB"');
            expect(Math.abs(contextVramUsageDiff - estimatedContextVramUsage)).to.be.lte(s100MB);

            await model.dispose();
        });

        test("predicted VRAM usage should match actual VRAM usage when using gpuLayers", async (context) => {
            const llama = await getTestLlama();
            const ggufMetadataParseResult = await readGgufFileInfo(modelPath);

            if (llama.gpu === false)
                return context.skip();

            const ggufInsights = await GgufInsights.from(ggufMetadataParseResult, llama);

            const initialVramUsage = llama.getVramState().used;
            const model = await llama.loadModel({
                modelPath: modelPath,
                gpuLayers: 16
            });
            const currentVramUsage = llama.getVramState().used;

            const vramUsageDiff = currentVramUsage - initialVramUsage;

            const s100MB = 100 * Math.pow(1024, 2);
            const calculatedVramUsage = ggufInsights.estimateModelResourceRequirements({gpuLayers: 16}).gpuVram;

            expect(Math.abs(vramUsageDiff - calculatedVramUsage)).to.be.lte(s100MB);

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
                "cpuRam": "1.52GB",
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
                "cpuRam": "809.83MB",
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
                "cpuRam": "436.2MB",
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
                "cpuRam": "249.39MB",
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
                "gpuVram": "565.1MB",
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
                "gpuVram": "313.83MB",
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
                "gpuVram": "188.2MB",
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
                "gpuVram": "125.39MB",
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
                "gpuVram": "1.02GB",
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
                "gpuVram": "553.83MB",
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
                "gpuVram": "308.2MB",
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
                "gpuVram": "185.39MB",
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
                "gpuVram": "1.52GB",
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
                "gpuVram": "809.83MB",
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
                "gpuVram": "436.2MB",
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
                "gpuVram": "249.39MB",
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
                "gpuVram": "1.52GB",
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
                "gpuVram": "809.83MB",
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
                "gpuVram": "436.2MB",
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
                "gpuVram": "249.39MB",
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
