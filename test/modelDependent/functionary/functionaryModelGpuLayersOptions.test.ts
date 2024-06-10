import {describe, expect, it} from "vitest";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";
import {LlamaModelOptions, readGgufFileInfo} from "../../../src/index.js";
import {GgufInsights} from "../../../src/gguf/insights/GgufInsights.js";
import {defaultLlamaVramPadding} from "../../../src/bindings/getLlama.js";
import {BuildGpu} from "../../../src/bindings/types.js";

describe("functionary", () => {
    describe("model options", () => {
        describe("Resolve the correct number of GPU layers", async () => {
            const modelPath = await getModelFile("functionary-small-v2.5.Q4_0.gguf");
            const llama = await getTestLlama();

            const fileInfo = await readGgufFileInfo(modelPath);
            const ggufInsights = await GgufInsights.from(fileInfo, llama);

            const s1GB = Math.pow(1024, 3);

            async function resolveGpuLayers(gpuLayers: LlamaModelOptions["gpuLayers"], {
                totalVram, freeVram, ignoreMemorySafetyChecks = false, llamaGpu = "metal"
            }: {
                totalVram: number, freeVram: number, ignoreMemorySafetyChecks?: boolean, llamaGpu?: BuildGpu
            }) {
                const resolvedGpuLayers = await ggufInsights.configurationResolver.resolveModelGpuLayers(gpuLayers, {
                    ignoreMemorySafetyChecks,
                    getVramState: async () => ({
                        total: llamaGpu === false ? 0 : totalVram,
                        free: llamaGpu === false ? 0 : freeVram
                    }),
                    llamaVramPaddingSize: defaultLlamaVramPadding(llamaGpu === false ? 0 : totalVram),
                    llamaGpu,
                    llamaSupportsGpuOffloading: llamaGpu !== false
                });

                async function resolveAutoContextSize() {
                    const modelVram = ggufInsights.estimateModelResourceRequirements({
                        gpuLayers: resolvedGpuLayers
                    }).gpuVram;

                    try {
                        return await ggufInsights.configurationResolver.resolveContextContextSize("auto", {
                            batchSize: undefined,
                            sequences: 1,
                            modelGpuLayers: resolvedGpuLayers,
                            modelTrainContextSize: ggufInsights.trainContextSize ?? 4096,
                            getVramState: async () => ({
                                total: llamaGpu === false ? 0 : totalVram,
                                free: llamaGpu === false ? 0 : (freeVram - modelVram)
                            }),
                            llamaGpu,
                            ignoreMemorySafetyChecks: false,
                            isEmbeddingContext: false
                        });
                    } catch (err) {
                        return null;
                    }
                }

                return {
                    gpuLayers: resolvedGpuLayers,
                    contextSize: await resolveAutoContextSize()
                };
            }

            it("attempts to resolve 0 gpuLayers", async () => {
                {
                    const res = await resolveGpuLayers(0, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 1
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                }
                {
                    const res = await resolveGpuLayers(0, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                }

                {
                    const res = await resolveGpuLayers(0, {
                        totalVram: 0,
                        freeVram: 0,
                        llamaGpu: false
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                }
            });

            it("attempts to resolve 16 gpuLayers", async () => {
                {
                    const res = await resolveGpuLayers(16, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 3
                    });
                    expect(res.gpuLayers).to.eql(16);
                    expect(res.contextSize).to.toMatchInlineSnapshot("1924");
                }
                try {
                    await resolveGpuLayers(16, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0
                    });
                    expect.unreachable("Should have thrown an error");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                }
                try {
                    await resolveGpuLayers(16, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0.2
                    });
                    expect.unreachable("Should have thrown an error");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                }
                {
                    const res = await resolveGpuLayers(16, {
                        totalVram: s1GB * 6,

                        // play with this number to make the test pass, it should be low enough so that there won't be any VRAM left
                        // to create a context
                        freeVram: s1GB * 0.2,

                        ignoreMemorySafetyChecks: true
                    });
                    expect(res.gpuLayers).to.eql(16);
                    expect(res.contextSize).to.eql(null);
                }


                {
                    const res = await resolveGpuLayers(16, {
                        totalVram: 0,
                        freeVram: 0,
                        llamaGpu: false
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                }
                {
                    const res = await resolveGpuLayers(16, {
                        totalVram: 0,
                        freeVram: 0,
                        llamaGpu: false,
                        ignoreMemorySafetyChecks: true
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                }
            });

            it("attempts to resolve 32 gpuLayers", async () => {
                {
                    const res = await resolveGpuLayers(32, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 6
                    });
                    expect(res.gpuLayers).to.eql(32);
                    expect(res.contextSize).to.toMatchInlineSnapshot("7562");
                }
                try {
                    await resolveGpuLayers(32, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0.2
                    });
                    expect.unreachable("Should have thrown an error");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                }
                {
                    const res = await resolveGpuLayers(32, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0,
                        ignoreMemorySafetyChecks: true
                    });
                    expect(res.gpuLayers).to.eql(32);
                    expect(res.contextSize).to.toMatchInlineSnapshot("null");
                }

                {
                    const res = await resolveGpuLayers(32, {
                        totalVram: 0,
                        freeVram: 0,
                        llamaGpu: false
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                }
                {
                    const res = await resolveGpuLayers(32, {
                        totalVram: 0,
                        freeVram: 0,
                        llamaGpu: false,
                        ignoreMemorySafetyChecks: true
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                }
            });

            it("attempts to resolve 33 gpuLayers", async () => {
                {
                    const res = await resolveGpuLayers(33, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 6
                    });
                    expect(res.gpuLayers).to.eql(33);
                    expect(res.contextSize).to.toMatchInlineSnapshot("7562");
                }
                try {
                    await resolveGpuLayers(33, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0.2
                    });
                    expect.unreachable("Should have thrown an error");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                }
                {
                    const res = await resolveGpuLayers(33, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0.2,
                        ignoreMemorySafetyChecks: true
                    });
                    expect(res.gpuLayers).to.eql(33);
                    expect(res.contextSize).to.toMatchInlineSnapshot("null");
                }

                {
                    const res = await resolveGpuLayers(33, {
                        totalVram: 0,
                        freeVram: 0,
                        llamaGpu: false
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                }
                {
                    const res = await resolveGpuLayers(33, {
                        totalVram: 0,
                        freeVram: 0,
                        llamaGpu: false,
                        ignoreMemorySafetyChecks: true
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                }
            });

            it('attempts to resolve "max"', async () => {
                try {
                    await resolveGpuLayers("max", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0
                    });
                    expect.unreachable("Should have thrown an error");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                }

                try {
                    await resolveGpuLayers("max", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0.2
                    });
                    expect.unreachable("Should have thrown an error");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                }

                try {
                    await resolveGpuLayers("max", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 3.2
                    });
                    expect.unreachable("Should have thrown an error");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                }

                {
                    const res = await resolveGpuLayers("max", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 1.2,
                        ignoreMemorySafetyChecks: true
                    });
                    expect(res.gpuLayers).to.eql(33);
                    expect(res.contextSize).to.toMatchInlineSnapshot("null");
                }{
                    const res = await resolveGpuLayers("max", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4.7
                    });
                    expect(res.gpuLayers).to.eql(33);
                    expect(res.contextSize).to.toMatchInlineSnapshot("607");
                }
                {
                    const res = await resolveGpuLayers("max", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4.8
                    });
                    expect(res.gpuLayers).to.eql(33);
                    expect(res.contextSize).to.toMatchInlineSnapshot("1142");
                }
            });

            it('attempts to resolve "auto"', async () => {
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: 0
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0.4
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("0");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 1.4
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("1");
                    expect(res.contextSize).to.toMatchInlineSnapshot("5192");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 1.8
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("4");
                    expect(res.contextSize).to.toMatchInlineSnapshot("5164");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 2.4
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("6");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 3.1
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("11");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 3.3
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("12");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 3.5
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("14");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 3.8
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("16");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("17");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4.3
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("19");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4.5
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("21");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8076");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4.8
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("23");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8140");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 5.2
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                    expect(res.contextSize).to.toMatchInlineSnapshot("3282");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 5.8
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                    expect(res.contextSize).to.toMatchInlineSnapshot("6492");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 6
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                    expect(res.contextSize).to.toMatchInlineSnapshot("7562");
                }
            });

            it("attempts to resolve {min?: number, max?: number}", async () => {
                {
                    const res = await resolveGpuLayers({max: 4}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                }
                {
                    const res = await resolveGpuLayers({min: 0, max: 4}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                }
                try {
                    await resolveGpuLayers({min: 2}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0
                    });
                    expect.unreachable("Should have thrown an error");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                }
                try {
                    await resolveGpuLayers({min: 2, max: 4}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0
                    });
                    expect.unreachable("Should have thrown an error");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                }

                {
                    const res = await resolveGpuLayers({max: 16}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 3.8
                    });
                    expect(res.gpuLayers).to.eql(16);
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                }
                try {
                    await resolveGpuLayers({min: 16}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 2
                    });
                    expect.unreachable("Should have thrown an error");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                }
                {
                    const res = await resolveGpuLayers({min: 16}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4
                    });
                    expect(res.gpuLayers).to.be.gte(16);
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("17");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                }
                {
                    const res = await resolveGpuLayers({min: 16, max: 24}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4
                    });
                    expect(res.gpuLayers).to.be.gte(16);
                    expect(res.gpuLayers).to.be.lte(24);
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("17");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                }
                {
                    const res = await resolveGpuLayers({min: 16, max: 24}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 3
                    });
                    expect(res.gpuLayers).to.be.gte(16);
                    expect(res.gpuLayers).to.be.lte(24);
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("16");
                    expect(res.contextSize).to.toMatchInlineSnapshot("1924");
                }
            });

            it("attempts to resolve {fitContext?: {contextSize?: number}}", async () => {
                {
                    const contextSize = 4096;
                    const res = await resolveGpuLayers({fitContext: {contextSize}}, {
                        totalVram: 0,
                        freeVram: 0,
                        llamaGpu: false
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("0");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    expect(res.contextSize).to.be.gte(contextSize);
                }
                {
                    const contextSize = 4096;
                    const res = await resolveGpuLayers({fitContext: {contextSize}}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("20");
                    expect(res.contextSize).to.toMatchInlineSnapshot("5561");
                    expect(res.contextSize).to.be.gte(contextSize);
                }
                {
                    const contextSize = 4096;
                    const res = await resolveGpuLayers({fitContext: {contextSize}}, {
                        totalVram: s1GB * 2,
                        freeVram: s1GB * 1.8
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("4");
                    expect(res.contextSize).to.toMatchInlineSnapshot("5164");
                    expect(res.contextSize).to.be.gte(contextSize);
                }
                {
                    const contextSize = 8192;
                    const res = await resolveGpuLayers({fitContext: {contextSize}}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("16");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    expect(res.contextSize).to.be.gte(contextSize);
                }
                {
                    const contextSize = 8192;
                    const res = await resolveGpuLayers({fitContext: {contextSize}}, {
                        totalVram: s1GB * 1,
                        freeVram: s1GB * 1.8
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("2");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    expect(res.contextSize).to.be.gte(contextSize);
                }
                {
                    const contextSize = 8192;
                    const res = await resolveGpuLayers({fitContext: {contextSize}}, {
                        totalVram: s1GB * 0,
                        freeVram: s1GB * 0
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("0");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    expect(res.contextSize).to.be.gte(contextSize);
                }
                {
                    try {
                        await resolveGpuLayers({min: 1, fitContext: {contextSize: 8192}}, {
                            totalVram: s1GB * 0.2,
                            freeVram: s1GB * 0
                        });
                        expect.unreachable("Should have thrown an error");
                    } catch (err) {
                        expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                    }
                }
            });
        });
    });
});
