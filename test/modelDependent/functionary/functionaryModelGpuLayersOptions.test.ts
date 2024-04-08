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
            const modelPath = await getModelFile("functionary-small-v2.2.q4_0.gguf");
            const llama = await getTestLlama();

            const fileInfo = await readGgufFileInfo(modelPath);
            const ggufInsights = await GgufInsights.from(fileInfo, llama);

            const s1GB = Math.pow(1024, 3);

            function resolveGpuLayers(gpuLayers: LlamaModelOptions["gpuLayers"], {
                totalVram, freeVram, ignoreMemorySafetyChecks = false, llamaGpu = "metal"
            }: {
                totalVram: number, freeVram: number, ignoreMemorySafetyChecks?: boolean, llamaGpu?: BuildGpu
            }) {
                const resolvedGpuLayers = ggufInsights.configurationResolver.resolveModelGpuLayers(gpuLayers, {
                    ignoreMemorySafetyChecks,
                    getVramState: () => ({
                        total: llamaGpu === false ? 0 : totalVram,
                        free: llamaGpu === false ? 0 : freeVram
                    }),
                    llamaVramPaddingSize: defaultLlamaVramPadding(llamaGpu === false ? 0 : totalVram),
                    llamaGpu,
                    llamaSupportsGpuOffloading: llamaGpu !== false
                });

                function resolveAutoContextSize() {
                    const modelVram = ggufInsights.estimateModelResourceRequirements({
                        gpuLayers: resolvedGpuLayers
                    }).gpuVram;

                    try {
                        return ggufInsights.configurationResolver.resolveContextContextSize("auto", {
                            batchSize: undefined,
                            sequences: 1,
                            modelGpuLayers: resolvedGpuLayers,
                            modelTrainContextSize: ggufInsights.trainContextSize ?? 4096,
                            getVramState: () => ({
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
                    contextSize: resolveAutoContextSize()
                };
            }

            it("attempts to resolve 0 gpuLayers", () => {
                {
                    const res = resolveGpuLayers(0, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 1
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("32768");
                }
                {
                    const res = resolveGpuLayers(0, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("32768");
                }

                {
                    const res = resolveGpuLayers(0, {
                        totalVram: 0,
                        freeVram: 0,
                        llamaGpu: false
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("32768");
                }
            });

            it("attempts to resolve 16 gpuLayers", () => {
                {
                    const res = resolveGpuLayers(16, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 3
                    });
                    expect(res.gpuLayers).to.eql(16);
                    expect(res.contextSize).to.toMatchInlineSnapshot("7415");
                }
                try {
                    resolveGpuLayers(16, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0
                    });
                    expect.unreachable("Should have thrown an error");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                }
                try {
                    resolveGpuLayers(16, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0.2
                    });
                    expect.unreachable("Should have thrown an error");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                }
                {
                    const res = resolveGpuLayers(16, {
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
                    const res = resolveGpuLayers(16, {
                        totalVram: 0,
                        freeVram: 0,
                        llamaGpu: false
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("32768");
                }
                {
                    const res = resolveGpuLayers(16, {
                        totalVram: 0,
                        freeVram: 0,
                        llamaGpu: false,
                        ignoreMemorySafetyChecks: true
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("32768");
                }
            });

            it("attempts to resolve 32 gpuLayers", () => {
                {
                    const res = resolveGpuLayers(32, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 6
                    });
                    expect(res.gpuLayers).to.eql(32);
                    expect(res.contextSize).to.toMatchInlineSnapshot("11260");
                }
                try {
                    resolveGpuLayers(32, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0.2
                    });
                    expect.unreachable("Should have thrown an error");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                }
                {
                    const res = resolveGpuLayers(32, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0,
                        ignoreMemorySafetyChecks: true
                    });
                    expect(res.gpuLayers).to.eql(32);
                    expect(res.contextSize).to.toMatchInlineSnapshot("null");
                }

                {
                    const res = resolveGpuLayers(32, {
                        totalVram: 0,
                        freeVram: 0,
                        llamaGpu: false
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("32768");
                }
                {
                    const res = resolveGpuLayers(32, {
                        totalVram: 0,
                        freeVram: 0,
                        llamaGpu: false,
                        ignoreMemorySafetyChecks: true
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("32768");
                }
            });

            it("attempts to resolve 33 gpuLayers", () => {
                {
                    const res = resolveGpuLayers(33, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 6
                    });
                    expect(res.gpuLayers).to.eql(33);
                    expect(res.contextSize).to.toMatchInlineSnapshot("11260");
                }
                try {
                    resolveGpuLayers(33, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0.2
                    });
                    expect.unreachable("Should have thrown an error");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                }
                {
                    const res = resolveGpuLayers(33, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0.2,
                        ignoreMemorySafetyChecks: true
                    });
                    expect(res.gpuLayers).to.eql(33);
                    expect(res.contextSize).to.toMatchInlineSnapshot("null");
                }

                {
                    const res = resolveGpuLayers(33, {
                        totalVram: 0,
                        freeVram: 0,
                        llamaGpu: false
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("32768");
                }
                {
                    const res = resolveGpuLayers(33, {
                        totalVram: 0,
                        freeVram: 0,
                        llamaGpu: false,
                        ignoreMemorySafetyChecks: true
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("32768");
                }
            });

            it('attempts to resolve "max"', () => {
                try {
                    resolveGpuLayers("max", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0
                    });
                    expect.unreachable("Should have thrown an error");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                }

                try {
                    resolveGpuLayers("max", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0.2
                    });
                    expect.unreachable("Should have thrown an error");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                }

                try {
                    resolveGpuLayers("max", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 3.2
                    });
                    expect.unreachable("Should have thrown an error");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                }

                {
                    const res = resolveGpuLayers("max", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 1.2,
                        ignoreMemorySafetyChecks: true
                    });
                    expect(res.gpuLayers).to.eql(33);
                    expect(res.contextSize).to.toMatchInlineSnapshot("null");
                }{
                    const res = resolveGpuLayers("max", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4
                    });
                    expect(res.gpuLayers).to.eql(33);
                    expect(res.contextSize).to.toMatchInlineSnapshot("561");
                }
                {
                    const res = resolveGpuLayers("max", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4.4
                    });
                    expect(res.gpuLayers).to.eql(33);
                    expect(res.contextSize).to.toMatchInlineSnapshot("2701");
                }
                {
                    const res = resolveGpuLayers("max", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4.8
                    });
                    expect(res.gpuLayers).to.eql(33);
                    expect(res.contextSize).to.toMatchInlineSnapshot("4840");
                }
            });

            it('attempts to resolve "auto"', () => {
                {
                    const res = resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: 0
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("32768");
                }
                {
                    const res = resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0.4
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("0");
                    expect(res.contextSize).to.toMatchInlineSnapshot("32768");
                }
                {
                    const res = resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0.8
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("1");
                    expect(res.contextSize).to.toMatchInlineSnapshot("6522");
                }
                {
                    const res = resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 1.4
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("4");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8799");
                }
                {
                    const res = resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 2.4
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("11");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8472");
                }
                {
                    const res = resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 3.1
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("16");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8209");
                }
                {
                    const res = resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 3.3
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("17");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8628");
                }
                {
                    const res = resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 3.5
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("18");
                    expect(res.contextSize).to.toMatchInlineSnapshot("9024");
                }
                {
                    const res = resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 3.8
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("20");
                    expect(res.contextSize).to.toMatchInlineSnapshot("9042");
                }
                {
                    const res = resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("22");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8386");
                }
                {
                    const res = resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4.3
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("24");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8434");
                }
                {
                    const res = resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4.5
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                    expect(res.contextSize).to.toMatchInlineSnapshot("3235");
                }
                {
                    const res = resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4.8
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                    expect(res.contextSize).to.toMatchInlineSnapshot("4840");
                }
                {
                    const res = resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 5.2
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                    expect(res.contextSize).to.toMatchInlineSnapshot("6980");
                }
                {
                    const res = resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 5.8
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                    expect(res.contextSize).to.toMatchInlineSnapshot("10190");
                }
                {
                    const res = resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 6
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                    expect(res.contextSize).to.toMatchInlineSnapshot("11260");
                }
            });

            it("attempts to resolve {min?: number, max?: number}", () => {
                {
                    const res = resolveGpuLayers({max: 4}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("32768");
                }
                {
                    const res = resolveGpuLayers({min: 0, max: 4}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("32768");
                }
                try {
                    resolveGpuLayers({min: 2}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0
                    });
                    expect.unreachable("Should have thrown an error");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                }
                try {
                    resolveGpuLayers({min: 2, max: 4}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0
                    });
                    expect.unreachable("Should have thrown an error");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                }

                {
                    const res = resolveGpuLayers({max: 16}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4
                    });
                    expect(res.gpuLayers).to.eql(16);
                    expect(res.contextSize).to.toMatchInlineSnapshot("15358");
                }
                try {
                    resolveGpuLayers({min: 16}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 2
                    });
                    expect.unreachable("Should have thrown an error");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                }
                {
                    const res = resolveGpuLayers({min: 16}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4
                    });
                    expect(res.gpuLayers).to.be.gte(16);
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("22");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8386");
                }
                {
                    const res = resolveGpuLayers({min: 16, max: 24}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4
                    });
                    expect(res.gpuLayers).to.be.gte(16);
                    expect(res.gpuLayers).to.be.lte(24);
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("22");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8386");
                }
                {
                    const res = resolveGpuLayers({min: 16, max: 24}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 3
                    });
                    expect(res.gpuLayers).to.be.gte(16);
                    expect(res.gpuLayers).to.be.lte(24);
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("16");
                    expect(res.contextSize).to.toMatchInlineSnapshot("7415");
                }
            });

            it("attempts to resolve {fitContext?: {contextSize?: number}}", () => {
                {
                    const contextSize = 4096;
                    const res = resolveGpuLayers({fitContext: {contextSize}}, {
                        totalVram: 0,
                        freeVram: 0,
                        llamaGpu: false
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("0");
                    expect(res.contextSize).to.toMatchInlineSnapshot("32768");
                    expect(res.contextSize).to.be.gte(contextSize);
                }
                {
                    const contextSize = 4096;
                    const res = resolveGpuLayers({fitContext: {contextSize}}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("25");
                    expect(res.contextSize).to.toMatchInlineSnapshot("5647");
                    expect(res.contextSize).to.be.gte(contextSize);
                }
                {
                    const contextSize = 4096;
                    const res = resolveGpuLayers({fitContext: {contextSize}}, {
                        totalVram: s1GB * 2,
                        freeVram: s1GB * 1
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("3");
                    expect(res.contextSize).to.toMatchInlineSnapshot("5495");
                    expect(res.contextSize).to.be.gte(contextSize);
                }
                {
                    const contextSize = 8192;
                    const res = resolveGpuLayers({fitContext: {contextSize}}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("21");
                    expect(res.contextSize).to.toMatchInlineSnapshot("9395");
                    expect(res.contextSize).to.be.gte(contextSize);
                }
                {
                    const contextSize = 8192;
                    const res = resolveGpuLayers({fitContext: {contextSize}}, {
                        totalVram: s1GB * 1,
                        freeVram: s1GB * 1
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("1");
                    expect(res.contextSize).to.toMatchInlineSnapshot("9434");
                    expect(res.contextSize).to.be.gte(contextSize);
                }
                {
                    const contextSize = 8192;
                    const res = resolveGpuLayers({fitContext: {contextSize}}, {
                        totalVram: s1GB * 0,
                        freeVram: s1GB * 0
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("0");
                    expect(res.contextSize).to.toMatchInlineSnapshot("32768");
                    expect(res.contextSize).to.be.gte(contextSize);
                }
                {
                    try {
                        resolveGpuLayers({min: 1, fitContext: {contextSize: 8192}}, {
                            totalVram: s1GB * 0.2,
                            freeVram: s1GB * 0
                        });
                        expect.unreachable("Should have thrown an error");
                    } catch (err) {
                        expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                    }
                }
                {
                    const contextSize = 16384;
                    const res = resolveGpuLayers({fitContext: {contextSize}}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("32768");
                    expect(res.contextSize).to.be.gte(contextSize);
                }
            });
        });
    });
});
