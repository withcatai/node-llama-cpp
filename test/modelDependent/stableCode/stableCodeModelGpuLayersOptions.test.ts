import {describe, expect, it} from "vitest";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";
import {LlamaModelOptions, readGgufFileInfo} from "../../../src/index.js";
import {GgufInsights} from "../../../src/gguf/insights/GgufInsights.js";
import {BuildGpu} from "../../../src/bindings/types.js";
import {defaultLlamaVramPadding} from "../../../src/bindings/getLlama.js";

describe("stableCode", () => {
    describe("model options", () => {
        describe("Resolve the correct number of GPU layers", async () => {
            const modelPath = await getModelFile("stable-code-3b-Q5_K_M.gguf");
            const llama = await getTestLlama();

            const fileInfo = await readGgufFileInfo(modelPath);
            const ggufInsights = await GgufInsights.from(fileInfo, llama);

            const s1GB = Math.pow(1024, 3);

            async function resolveGpuLayers(gpuLayers: LlamaModelOptions["gpuLayers"], {
                totalVram, freeVram, unifiedMemorySize = 0,
                totalRam = s1GB * 10, freeRam = s1GB * 10, // TODO: update all tests to test different RAM sizes
                totalSwap = 0, freeSwap = 0,
                ignoreMemorySafetyChecks = false, llamaGpu = "metal"
            }: {
                totalVram: number, freeVram: number, unifiedMemorySize?: number,
                totalRam?: number, freeRam?: number,
                totalSwap?: number, freeSwap?: number,
                ignoreMemorySafetyChecks?: boolean, llamaGpu?: BuildGpu
            }) {
                const resolvedGpuLayers = await ggufInsights.configurationResolver.resolveModelGpuLayers(gpuLayers, {
                    ignoreMemorySafetyChecks,
                    getVramState: async () => ({
                        total: llamaGpu === false ? 0 : totalVram,
                        free: llamaGpu === false ? 0 : freeVram
                    }),
                    llamaVramPaddingSize: defaultLlamaVramPadding(llamaGpu === false ? 0 : totalVram),
                    llamaGpu,
                    llamaSupportsGpuOffloading: llamaGpu !== false,
                    useMmap: true
                });

                async function resolveAutoContextSize() {
                    const resolvedConfig = await ggufInsights.configurationResolver.resolveAndScoreConfig({
                        targetGpuLayers: resolvedGpuLayers,
                        useMmap: true
                    }, {
                        llamaGpu,
                        getVramState: async () => ({
                            total: llamaGpu === false ? 0 : totalVram,
                            free: llamaGpu === false ? 0 : freeVram,
                            unifiedSize: unifiedMemorySize
                        }),
                        getRamState: async () => ({
                            total: totalRam,
                            free: freeRam
                        }),
                        getSwapState: async () => ({
                            total: totalSwap,
                            free: freeSwap
                        }),
                        llamaSupportsGpuOffloading: llamaGpu !== false,
                        llamaVramPaddingSize: defaultLlamaVramPadding(llamaGpu === false ? 0 : totalVram)
                    });

                    if (resolvedConfig.compatibilityScore === 0)
                        return null;

                    return resolvedConfig.resolvedValues.contextSize;
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
                    expect(res.contextSize).to.toMatchInlineSnapshot("16384");
                }
                {
                    const res = await resolveGpuLayers(0, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("16384");
                }

                {
                    const res = await resolveGpuLayers(0, {
                        totalVram: 0,
                        freeVram: 0,
                        llamaGpu: false
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("16384");
                }
            });

            it("attempts to resolve 16 gpuLayers", async () => {
                {
                    const res = await resolveGpuLayers(16, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 3
                    });
                    expect(res.gpuLayers).to.eql(16);
                    expect(res.contextSize).to.toMatchInlineSnapshot("7177");
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
                    expect(res.contextSize).to.toMatchInlineSnapshot("133");
                }


                {
                    const res = await resolveGpuLayers(16, {
                        totalVram: 0,
                        freeVram: 0,
                        llamaGpu: false
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("16384");
                }
                {
                    const res = await resolveGpuLayers(16, {
                        totalVram: 0,
                        freeVram: 0,
                        llamaGpu: false,
                        ignoreMemorySafetyChecks: true
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("16384");
                }
            });

            it("attempts to resolve 32 gpuLayers", async () => {
                {
                    const res = await resolveGpuLayers(32, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 6
                    });
                    expect(res.gpuLayers).to.eql(32);
                    expect(res.contextSize).to.toMatchInlineSnapshot("11125");
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
                    expect(res.contextSize).to.toMatchInlineSnapshot("94");
                }

                {
                    const res = await resolveGpuLayers(32, {
                        totalVram: 0,
                        freeVram: 0,
                        llamaGpu: false
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("16384");
                }
                {
                    const res = await resolveGpuLayers(32, {
                        totalVram: 0,
                        freeVram: 0,
                        llamaGpu: false,
                        ignoreMemorySafetyChecks: true
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("16384");
                }
            });

            it("attempts to resolve 33 gpuLayers", async () => {
                {
                    const res = await resolveGpuLayers(33, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 6
                    });
                    expect(res.gpuLayers).to.eql(33);
                    expect(res.contextSize).to.toMatchInlineSnapshot("11125");
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
                    expect(res.contextSize).to.toMatchInlineSnapshot("94");
                }

                {
                    const res = await resolveGpuLayers(33, {
                        totalVram: 0,
                        freeVram: 0,
                        llamaGpu: false
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("16384");
                }
                {
                    const res = await resolveGpuLayers(33, {
                        totalVram: 0,
                        freeVram: 0,
                        llamaGpu: false,
                        ignoreMemorySafetyChecks: true
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("16384");
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
                    expect(err).toMatchInlineSnapshot("[AssertionError: expected \"Should have thrown an error\" not to be reached]");
                }

                {
                    const res = await resolveGpuLayers("max", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 1.2,
                        ignoreMemorySafetyChecks: true
                    });
                    expect(res.gpuLayers).to.eql(33);
                    expect(res.contextSize).to.toMatchInlineSnapshot("94");
                }
                {
                    const res = await resolveGpuLayers("max", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4
                    });
                    expect(res.gpuLayers).to.eql(33);
                    expect(res.contextSize).to.toMatchInlineSnapshot("5802");
                }
                {
                    const res = await resolveGpuLayers("max", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4.4
                    });
                    expect(res.gpuLayers).to.eql(33);
                    expect(res.contextSize).to.toMatchInlineSnapshot("6866");
                }
                {
                    const res = await resolveGpuLayers("max", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4.8
                    });
                    expect(res.gpuLayers).to.eql(33);
                    expect(res.contextSize).to.toMatchInlineSnapshot("7931");
                }
            });

            it('attempts to resolve "auto"', async () => {
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: 0
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("16384");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0.4
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("0");
                    expect(res.contextSize).to.toMatchInlineSnapshot("16384");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0.8
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("1");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8724");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 1.4
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("4");
                    expect(res.contextSize).to.toMatchInlineSnapshot("6203");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 2.4
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                    expect(res.contextSize).to.toMatchInlineSnapshot("1544");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 3.1
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                    expect(res.contextSize).to.toMatchInlineSnapshot("3407");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 3.3
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                    expect(res.contextSize).to.toMatchInlineSnapshot("3939");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 3.5
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                    expect(res.contextSize).to.toMatchInlineSnapshot("4471");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 3.8
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                    expect(res.contextSize).to.toMatchInlineSnapshot("5270");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                    expect(res.contextSize).to.toMatchInlineSnapshot("5802");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4.3
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                    expect(res.contextSize).to.toMatchInlineSnapshot("6600");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4.5
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                    expect(res.contextSize).to.toMatchInlineSnapshot("7133");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4.8
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                    expect(res.contextSize).to.toMatchInlineSnapshot("7931");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 5.2
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8995");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 5.8
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                    expect(res.contextSize).to.toMatchInlineSnapshot("10592");
                }
                {
                    const res = await resolveGpuLayers("auto", {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 6
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                    expect(res.contextSize).to.toMatchInlineSnapshot("11125");
                }
            });

            it("attempts to resolve {min?: number, max?: number}", async () => {
                {
                    const res = await resolveGpuLayers({max: 4}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("16384");
                }
                {
                    const res = await resolveGpuLayers({min: 0, max: 4}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("16384");
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
                        freeVram: s1GB * 4
                    });
                    expect(res.gpuLayers).to.eql(16);
                    expect(res.contextSize).to.toMatchInlineSnapshot("11658");
                }
                try {
                    await resolveGpuLayers({min: 16}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 2
                    });
                    expect.unreachable("Should have thrown an error");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot("[AssertionError: expected \"Should have thrown an error\" not to be reached]");
                }
                {
                    const res = await resolveGpuLayers({min: 16}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4
                    });
                    expect(res.gpuLayers).to.be.gte(16);
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                    expect(res.contextSize).to.toMatchInlineSnapshot("5802");
                }
                {
                    const res = await resolveGpuLayers({min: 16, max: 24}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4
                    });
                    expect(res.gpuLayers).to.be.gte(16);
                    expect(res.gpuLayers).to.be.lte(24);
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("22");
                    expect(res.contextSize).to.toMatchInlineSnapshot("8160");
                }
                {
                    const res = await resolveGpuLayers({min: 16, max: 24}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 3
                    });
                    expect(res.gpuLayers).to.be.gte(16);
                    expect(res.gpuLayers).to.be.lte(24);
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("16");
                    expect(res.contextSize).to.toMatchInlineSnapshot("7177");
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
                    expect(res.contextSize).to.toMatchInlineSnapshot("16384");
                    expect(res.contextSize).to.be.gte(contextSize);
                }
                {
                    const contextSize = 4096;
                    const res = await resolveGpuLayers({fitContext: {contextSize}}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                    expect(res.contextSize).to.toMatchInlineSnapshot("5802");
                    expect(res.contextSize).to.be.gte(contextSize);
                }
                {
                    const contextSize = 4096;
                    const res = await resolveGpuLayers({fitContext: {contextSize}}, {
                        totalVram: s1GB * 2,
                        freeVram: s1GB * 1
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("2");
                    expect(res.contextSize).to.toMatchInlineSnapshot("9426");
                    expect(res.contextSize).to.be.gte(contextSize);
                }
                {
                    const contextSize = 8192;
                    const res = await resolveGpuLayers({fitContext: {contextSize}}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 4
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("20");
                    expect(res.contextSize).to.toMatchInlineSnapshot("9167");
                    expect(res.contextSize).to.be.gte(contextSize);
                }
                {
                    const contextSize = 8192;
                    const res = await resolveGpuLayers({fitContext: {contextSize}}, {
                        totalVram: s1GB * 1,
                        freeVram: s1GB * 1
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("2");
                    expect(res.contextSize).to.toMatchInlineSnapshot("9426");
                    expect(res.contextSize).to.be.gte(contextSize);
                }
                {
                    const contextSize = 8192;
                    const res = await resolveGpuLayers({fitContext: {contextSize}}, {
                        totalVram: s1GB * 0,
                        freeVram: s1GB * 0
                    });
                    expect(res.gpuLayers).to.toMatchInlineSnapshot("0");
                    expect(res.contextSize).to.toMatchInlineSnapshot("16384");
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
                {
                    const contextSize = 16384;
                    const res = await resolveGpuLayers({fitContext: {contextSize}}, {
                        totalVram: s1GB * 6,
                        freeVram: s1GB * 0
                    });
                    expect(res.gpuLayers).to.eql(0);
                    expect(res.contextSize).to.toMatchInlineSnapshot("16384");
                    expect(res.contextSize).to.be.gte(contextSize);
                }
            });
        });
    });
});
