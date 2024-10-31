import {describe, expect, it, test} from "vitest";
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
                totalVram, freeVram, unifiedMemorySize = 0,
                totalRam = 0, freeRam = 0,
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
                    llamaSupportsGpuOffloading: llamaGpu !== false
                });

                async function resolveAutoContextSize() {
                    const resolvedConfig = await ggufInsights.configurationResolver.resolveAndScoreConfig({
                        targetGpuLayers: resolvedGpuLayers
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

            describe("attempts to resolve 0 gpuLayers", () => {
                test("no RAM", async () => {
                    {
                        const res = await resolveGpuLayers(0, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 1
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("null");
                    }
                    {
                        const res = await resolveGpuLayers(0, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 0
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("null");
                    }

                    {
                        const res = await resolveGpuLayers(0, {
                            totalVram: 0,
                            freeVram: 0,
                            llamaGpu: false
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("null");
                    }
                });

                test("some RAM", async () => {
                    {
                        const res = await resolveGpuLayers(0, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 1,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 6
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("7562");
                    }
                    {
                        const res = await resolveGpuLayers(0, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 0,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 0
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("null");
                    }

                    {
                        const res = await resolveGpuLayers(0, {
                            totalVram: 0,
                            freeVram: 0,
                            totalRam: s1GB * 0,
                            freeRam: s1GB * 0,
                            llamaGpu: false
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("null");
                    }
                });

                test("with swap", async () => {
                    {
                        const res = await resolveGpuLayers(0, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 1,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 5,
                            totalSwap: s1GB * 6,
                            freeSwap: s1GB * 1
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("2213");
                    }
                    {
                        const res = await resolveGpuLayers(0, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 0,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 4,
                            totalSwap: s1GB * 6,
                            freeSwap: s1GB * 1
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("2048");
                    }

                    {
                        const res = await resolveGpuLayers(0, {
                            totalVram: 0,
                            freeVram: 0,
                            totalRam: s1GB * 0,
                            freeRam: s1GB * 0,
                            totalSwap: s1GB * 0,
                            freeSwap: s1GB * 0,
                            llamaGpu: false
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("null");
                    }
                });
            });

            describe("attempts to resolve 16 gpuLayers", () => {
                test("no RAM", async () => {
                    {
                        const res = await resolveGpuLayers(16, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 3
                        });
                        expect(res.gpuLayers).to.eql(16);
                        expect(res.contextSize).to.toMatchInlineSnapshot("null");
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
                        expect(res.contextSize).to.toMatchInlineSnapshot("null");
                    }
                    {
                        const res = await resolveGpuLayers(16, {
                            totalVram: 0,
                            freeVram: 0,
                            llamaGpu: false,
                            ignoreMemorySafetyChecks: true
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("null");
                    }
                });

                test("some RAM", async () => {
                    {
                        const res = await resolveGpuLayers(16, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 3,
                            totalRam: s1GB * 3,
                            freeRam: s1GB * 2
                        });
                        expect(res.gpuLayers).to.eql(16);
                        expect(res.contextSize).to.toMatchInlineSnapshot("1924");
                    }
                    try {
                        await resolveGpuLayers(16, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 0,
                            totalRam: s1GB * 3,
                            freeRam: s1GB * 2
                        });
                        expect.unreachable("Should have thrown an error");
                    } catch (err) {
                        expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                    }
                    try {
                        await resolveGpuLayers(16, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 0.2,
                            totalRam: s1GB * 3,
                            freeRam: s1GB * 2
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

                            totalRam: s1GB * 3,
                            freeRam: s1GB * 2,

                            ignoreMemorySafetyChecks: true
                        });
                        expect(res.gpuLayers).to.eql(16);
                        expect(res.contextSize).to.eql(null);
                    }


                    {
                        const res = await resolveGpuLayers(16, {
                            totalVram: 0,
                            freeVram: 0,
                            totalRam: s1GB * 7,
                            freeRam: s1GB * 7,
                            llamaGpu: false
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    }
                    {
                        const res = await resolveGpuLayers(16, {
                            totalVram: 0,
                            freeVram: 0,
                            totalRam: s1GB * 7,
                            freeRam: s1GB * 6,
                            llamaGpu: false,
                            ignoreMemorySafetyChecks: true
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("7562");
                    }
                });

                test("some unified RAM", async () => {
                    {
                        const res = await resolveGpuLayers(16, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 6,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 6,
                            unifiedMemorySize: s1GB * 6
                        });
                        expect(res.gpuLayers).to.eql(16);
                        expect(res.contextSize).to.toMatchInlineSnapshot("7411");
                    }
                    {
                        const res = await resolveGpuLayers(16, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 6,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 5,
                            unifiedMemorySize: s1GB * 6
                        });
                        expect(res.gpuLayers).to.eql(16);
                        expect(res.contextSize).to.toMatchInlineSnapshot("2168");
                    }
                    {
                        const res = await resolveGpuLayers(16, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 6,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 5,
                            unifiedMemorySize: s1GB * 5
                        });
                        expect(res.gpuLayers).to.eql(16);
                        expect(res.contextSize).to.toMatchInlineSnapshot("7411");
                    }
                    try {
                        await resolveGpuLayers(16, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 0,
                            totalRam: s1GB * 3,
                            freeRam: s1GB * 2,
                            unifiedMemorySize: s1GB * 6
                        });
                        expect.unreachable("Should have thrown an error");
                    } catch (err) {
                        expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                    }
                    try {
                        await resolveGpuLayers(16, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 0.2,
                            totalRam: s1GB * 3,
                            freeRam: s1GB * 2,
                            unifiedMemorySize: s1GB * 6
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

                            totalRam: s1GB * 3,
                            freeRam: s1GB * 2,
                            unifiedMemorySize: s1GB * 6,

                            ignoreMemorySafetyChecks: true
                        });
                        expect(res.gpuLayers).to.eql(16);
                        expect(res.contextSize).to.eql(null);
                    }


                    {
                        const res = await resolveGpuLayers(16, {
                            totalVram: s1GB * 6,
                            freeVram: 0,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 5.4,
                            unifiedMemorySize: s1GB * 6,
                            llamaGpu: false
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("4352");
                    }
                    {
                        const res = await resolveGpuLayers(16, {
                            totalVram: s1GB * 6,
                            freeVram: 0,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 5,
                            unifiedMemorySize: s1GB * 6,
                            llamaGpu: false,
                            ignoreMemorySafetyChecks: true
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("2213");
                    }
                });

                test("with swap", async () => {
                    {
                        const res = await resolveGpuLayers(16, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 3,
                            totalRam: s1GB * 3,
                            freeRam: s1GB * 2,
                            totalSwap: s1GB * 6,
                            freeSwap: s1GB * 3
                        });
                        expect(res.gpuLayers).to.eql(16);
                        expect(res.contextSize).to.toMatchInlineSnapshot("1924");
                    }
                    try {
                        await resolveGpuLayers(16, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 0,
                            totalRam: s1GB * 3,
                            freeRam: s1GB * 2,
                            totalSwap: s1GB * 6,
                            freeSwap: s1GB * 3
                        });
                        expect.unreachable("Should have thrown an error");
                    } catch (err) {
                        expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                    }
                    try {
                        await resolveGpuLayers(16, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 0.2,
                            totalRam: s1GB * 3,
                            freeRam: s1GB * 2,
                            totalSwap: s1GB * 6,
                            freeSwap: s1GB * 3
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

                            totalRam: s1GB * 3,
                            freeRam: s1GB * 2,
                            totalSwap: s1GB * 6,
                            freeSwap: s1GB * 3,

                            ignoreMemorySafetyChecks: true
                        });
                        expect(res.gpuLayers).to.eql(16);
                        expect(res.contextSize).to.eql(null);
                    }


                    {
                        const res = await resolveGpuLayers(16, {
                            totalVram: 0,
                            freeVram: 0,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 3,
                            totalSwap: s1GB * 6,
                            freeSwap: s1GB * 3,
                            llamaGpu: false
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("2048");
                    }
                    {
                        const res = await resolveGpuLayers(16, {
                            totalVram: 0,
                            freeVram: 0,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 0,
                            totalSwap: s1GB * 6,
                            freeSwap: s1GB * 3,
                            llamaGpu: false,
                            ignoreMemorySafetyChecks: true
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("null");
                    }
                });
            });

            describe("attempts to resolve 32 gpuLayers", () => {
                it("no RAM", async () => {
                    {
                        const res = await resolveGpuLayers(32, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 6
                        });
                        expect(res.gpuLayers).to.eql(32);
                        expect(res.contextSize).to.toMatchInlineSnapshot("null");
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
                        expect(res.contextSize).to.toMatchInlineSnapshot("null");
                    }
                    {
                        const res = await resolveGpuLayers(32, {
                            totalVram: 0,
                            freeVram: 0,
                            llamaGpu: false,
                            ignoreMemorySafetyChecks: true
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("null");
                    }
                });

                it("some RAM", async () => {
                    {
                        const res = await resolveGpuLayers(32, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 6,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 6
                        });
                        expect(res.gpuLayers).to.eql(32);
                        expect(res.contextSize).to.toMatchInlineSnapshot("7562");
                    }
                    try {
                        await resolveGpuLayers(32, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 0.2,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 0.2
                        });
                        expect.unreachable("Should have thrown an error");
                    } catch (err) {
                        expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                    }
                    {
                        const res = await resolveGpuLayers(32, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 0,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 0,
                            ignoreMemorySafetyChecks: true
                        });
                        expect(res.gpuLayers).to.eql(32);
                        expect(res.contextSize).to.toMatchInlineSnapshot("null");
                    }

                    {
                        const res = await resolveGpuLayers(32, {
                            totalVram: 0,
                            freeVram: 0,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 5,
                            llamaGpu: false
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("2213");
                    }
                    {
                        const res = await resolveGpuLayers(32, {
                            totalVram: 0,
                            freeVram: 0,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 4.8,
                            llamaGpu: false
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("1143");
                    }
                    {
                        const res = await resolveGpuLayers(32, {
                            totalVram: 0,
                            freeVram: 0,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 4,
                            llamaGpu: false,
                            ignoreMemorySafetyChecks: true
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("null");
                    }
                });
            });

            describe("attempts to resolve 33 gpuLayers", () => {
                test("no RAM", async () => {
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
                        expect(res.contextSize).to.toMatchInlineSnapshot("null");
                    }
                    {
                        const res = await resolveGpuLayers(33, {
                            totalVram: 0,
                            freeVram: 0,
                            llamaGpu: false,
                            ignoreMemorySafetyChecks: true
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("null");
                    }
                });

                test("some RAM", async () => {
                    {
                        const res = await resolveGpuLayers(33, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 6,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 6
                        });
                        expect(res.gpuLayers).to.eql(33);
                        expect(res.contextSize).to.toMatchInlineSnapshot("7562");
                    }
                    {
                        const res = await resolveGpuLayers(33, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 6,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 5
                        });
                        expect(res.gpuLayers).to.eql(33);
                        expect(res.contextSize).to.toMatchInlineSnapshot("7562");
                    }
                    {
                        const res = await resolveGpuLayers(33, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 6,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 4
                        });
                        expect(res.gpuLayers).to.eql(33);
                        expect(res.contextSize).to.toMatchInlineSnapshot("7562");
                    }
                    try {
                        await resolveGpuLayers(33, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 0.2,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 6
                        });
                        expect.unreachable("Should have thrown an error");
                    } catch (err) {
                        expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                    }
                    {
                        const res = await resolveGpuLayers(33, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 0.2,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 6,
                            ignoreMemorySafetyChecks: true
                        });
                        expect(res.gpuLayers).to.eql(33);
                        expect(res.contextSize).to.toMatchInlineSnapshot("null");
                    }

                    {
                        const res = await resolveGpuLayers(33, {
                            totalVram: 0,
                            freeVram: 0,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 4,
                            llamaGpu: false
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("null");
                    }
                    {
                        const res = await resolveGpuLayers(33, {
                            totalVram: 0,
                            freeVram: 0,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 4.8,
                            llamaGpu: false
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("1143");
                    }
                    {
                        const res = await resolveGpuLayers(33, {
                            totalVram: 0,
                            freeVram: 0,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 5,
                            llamaGpu: false
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("2213");
                    }
                    {
                        const res = await resolveGpuLayers(33, {
                            totalVram: 0,
                            freeVram: 0,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 6,
                            llamaGpu: false
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("7562");
                    }
                    {
                        const res = await resolveGpuLayers(33, {
                            totalVram: 0,
                            freeVram: 0,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 6,
                            llamaGpu: false,
                            ignoreMemorySafetyChecks: true
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("7562");
                    }
                });

                test("some unified RAM", async () => {
                    {
                        const res = await resolveGpuLayers(33, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 6,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 6,
                            unifiedMemorySize: s1GB * 6
                        });
                        expect(res.gpuLayers).to.eql(33);
                        expect(res.contextSize).to.toMatchInlineSnapshot("7562");
                    }
                    {
                        const res = await resolveGpuLayers(33, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 6,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 5.4,
                            unifiedMemorySize: s1GB * 6
                        });
                        expect(res.gpuLayers).to.eql(33);
                        expect(res.contextSize).to.toMatchInlineSnapshot("4352");
                    }
                    {
                        const res = await resolveGpuLayers(33, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 6,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 4.8,
                            unifiedMemorySize: s1GB * 6
                        });
                        expect(res.gpuLayers).to.eql(33);
                        expect(res.contextSize).to.toMatchInlineSnapshot("1142");
                    }
                    try {
                        await resolveGpuLayers(33, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 0.2,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 6,
                            unifiedMemorySize: s1GB * 6
                        });
                        expect.unreachable("Should have thrown an error");
                    } catch (err) {
                        expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                    }
                    {
                        const res = await resolveGpuLayers(33, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 0.2,
                            totalRam: s1GB * 6,
                            freeRam: s1GB * 6,
                            unifiedMemorySize: s1GB * 6,
                            ignoreMemorySafetyChecks: true
                        });
                        expect(res.gpuLayers).to.eql(33);
                        expect(res.contextSize).to.toMatchInlineSnapshot("null");
                    }
                });
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
                }
                {
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

            describe('attempts to resolve "auto"', () => {
                test("8GB RAM", async () => {
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: 0,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 0.4,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("0");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 1.4,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("1");
                        expect(res.contextSize).to.toMatchInlineSnapshot("5192");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 1.8,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("4");
                        expect(res.contextSize).to.toMatchInlineSnapshot("5164");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 2.4,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("6");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 3.1,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("11");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 3.3,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("12");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 3.5,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("14");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 3.8,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("16");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 4,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("17");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 4.3,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("19");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 4.5,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("21");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8076");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 4.8,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("23");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8140");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 5.2,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                        expect(res.contextSize).to.toMatchInlineSnapshot("3282");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 5.8,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                        expect(res.contextSize).to.toMatchInlineSnapshot("6492");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 6,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                        expect(res.contextSize).to.toMatchInlineSnapshot("7562");
                    }
                });

                test("5GB RAM", async () => {
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: 0,
                            totalRam: s1GB * 5,
                            freeRam: s1GB * 5
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("2213");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 0.4,
                            totalRam: s1GB * 5,
                            freeRam: s1GB * 5
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("0");
                        expect(res.contextSize).to.toMatchInlineSnapshot("2213");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 1.4,
                            totalRam: s1GB * 5,
                            freeRam: s1GB * 5
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("1");
                        expect(res.contextSize).to.toMatchInlineSnapshot("5192");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 1.8,
                            totalRam: s1GB * 5,
                            freeRam: s1GB * 5
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("4");
                        expect(res.contextSize).to.toMatchInlineSnapshot("5164");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 2.4,
                            totalRam: s1GB * 5,
                            freeRam: s1GB * 5
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("6");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 3.1,
                            totalRam: s1GB * 5,
                            freeRam: s1GB * 5
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("11");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 3.3,
                            totalRam: s1GB * 5,
                            freeRam: s1GB * 5
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("12");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 3.5,
                            totalRam: s1GB * 5,
                            freeRam: s1GB * 5
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("14");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 3.8,
                            totalRam: s1GB * 5,
                            freeRam: s1GB * 5
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("16");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 4,
                            totalRam: s1GB * 5,
                            freeRam: s1GB * 5
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("17");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 4.3,
                            totalRam: s1GB * 5,
                            freeRam: s1GB * 5
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("19");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 4.5,
                            totalRam: s1GB * 5,
                            freeRam: s1GB * 5
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("21");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8076");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 4.8,
                            totalRam: s1GB * 5,
                            freeRam: s1GB * 5
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("23");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8140");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 5.2,
                            totalRam: s1GB * 5,
                            freeRam: s1GB * 5
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                        expect(res.contextSize).to.toMatchInlineSnapshot("3282");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 5.8,
                            totalRam: s1GB * 5,
                            freeRam: s1GB * 5
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                        expect(res.contextSize).to.toMatchInlineSnapshot("6492");
                    }
                    {
                        const res = await resolveGpuLayers("auto", {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 6,
                            totalRam: s1GB * 5,
                            freeRam: s1GB * 5
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("33");
                        expect(res.contextSize).to.toMatchInlineSnapshot("7562");
                    }
                });
            });

            describe("attempts to resolve {min?: number, max?: number}", () => {
                test("8GB RAM", async () => {
                    {
                        const res = await resolveGpuLayers({max: 4}, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 0,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    }
                    {
                        const res = await resolveGpuLayers({min: 0, max: 4}, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 0,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    }
                    try {
                        await resolveGpuLayers({min: 2}, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 0,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect.unreachable("Should have thrown an error");
                    } catch (err) {
                        expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                    }
                    try {
                        await resolveGpuLayers({min: 2, max: 4}, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 0,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect.unreachable("Should have thrown an error");
                    } catch (err) {
                        expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                    }

                    {
                        const res = await resolveGpuLayers({max: 16}, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 3.8,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.eql(16);
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    }
                    try {
                        await resolveGpuLayers({min: 16}, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 2,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect.unreachable("Should have thrown an error");
                    } catch (err) {
                        expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                    }
                    {
                        const res = await resolveGpuLayers({min: 16}, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 4,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.be.gte(16);
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("17");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    }
                    {
                        const res = await resolveGpuLayers({min: 16, max: 24}, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 4,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.be.gte(16);
                        expect(res.gpuLayers).to.be.lte(24);
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("17");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    }
                    {
                        const res = await resolveGpuLayers({min: 16, max: 24}, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 3,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.be.gte(16);
                        expect(res.gpuLayers).to.be.lte(24);
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("16");
                        expect(res.contextSize).to.toMatchInlineSnapshot("1924");
                    }
                });

                test("5GB RAM", async () => {
                    {
                        const res = await resolveGpuLayers({max: 4}, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 0,
                            totalRam: s1GB * 5,
                            freeRam: s1GB * 5
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("2213");
                    }
                    {
                        const res = await resolveGpuLayers({min: 0, max: 4}, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 0,
                            totalRam: s1GB * 5,
                            freeRam: s1GB * 5
                        });
                        expect(res.gpuLayers).to.eql(0);
                        expect(res.contextSize).to.toMatchInlineSnapshot("2213");
                    }
                    try {
                        await resolveGpuLayers({min: 2}, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 0,
                            totalRam: s1GB * 5,
                            freeRam: s1GB * 5
                        });
                        expect.unreachable("Should have thrown an error");
                    } catch (err) {
                        expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                    }
                    try {
                        await resolveGpuLayers({min: 2, max: 4}, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 0,
                            totalRam: s1GB * 5,
                            freeRam: s1GB * 5
                        });
                        expect.unreachable("Should have thrown an error");
                    } catch (err) {
                        expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                    }

                    {
                        const res = await resolveGpuLayers({max: 16}, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 3.8,
                            totalRam: s1GB * 5,
                            freeRam: s1GB * 5
                        });
                        expect(res.gpuLayers).to.eql(16);
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    }
                    try {
                        await resolveGpuLayers({min: 16}, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 2,
                            totalRam: s1GB * 5,
                            freeRam: s1GB * 5
                        });
                        expect.unreachable("Should have thrown an error");
                    } catch (err) {
                        expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                    }
                    {
                        const res = await resolveGpuLayers({min: 16}, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 4,
                            totalRam: s1GB * 5,
                            freeRam: s1GB * 5
                        });
                        expect(res.gpuLayers).to.be.gte(16);
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("17");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    }
                    {
                        const res = await resolveGpuLayers({min: 16, max: 24}, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 4,
                            totalRam: s1GB * 5,
                            freeRam: s1GB * 5
                        });
                        expect(res.gpuLayers).to.be.gte(16);
                        expect(res.gpuLayers).to.be.lte(24);
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("17");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                    }
                    {
                        const res = await resolveGpuLayers({min: 16, max: 24}, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 3,
                            totalRam: s1GB * 5,
                            freeRam: s1GB * 5
                        });
                        expect(res.gpuLayers).to.be.gte(16);
                        expect(res.gpuLayers).to.be.lte(24);
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("16");
                        expect(res.contextSize).to.toMatchInlineSnapshot("1924");
                    }
                });
            });

            describe("attempts to resolve {fitContext?: {contextSize?: number}}", () => {
                test("8GB RAM", async () => {
                    {
                        const contextSize = 4096;
                        const res = await resolveGpuLayers({fitContext: {contextSize}}, {
                            totalVram: 0,
                            freeVram: 0,
                            llamaGpu: false,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("0");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                        expect(res.contextSize).to.be.gte(contextSize);
                    }
                    {
                        const contextSize = 4096;
                        const res = await resolveGpuLayers({fitContext: {contextSize}}, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 4,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("20");
                        expect(res.contextSize).to.toMatchInlineSnapshot("5561");
                        expect(res.contextSize).to.be.gte(contextSize);
                    }
                    {
                        const contextSize = 4096;
                        const res = await resolveGpuLayers({fitContext: {contextSize}}, {
                            totalVram: s1GB * 2,
                            freeVram: s1GB * 1.8,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("4");
                        expect(res.contextSize).to.toMatchInlineSnapshot("5164");
                        expect(res.contextSize).to.be.gte(contextSize);
                    }
                    {
                        const contextSize = 8192;
                        const res = await resolveGpuLayers({fitContext: {contextSize}}, {
                            totalVram: s1GB * 6,
                            freeVram: s1GB * 4,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("16");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                        expect(res.contextSize).to.be.gte(contextSize);
                    }
                    {
                        const contextSize = 8192;
                        const res = await resolveGpuLayers({fitContext: {contextSize}}, {
                            totalVram: s1GB * 2,
                            freeVram: s1GB * 1.9,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("2");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                        expect(res.contextSize).to.be.gte(contextSize);
                    }
                    {
                        const contextSize = 8192;
                        const res = await resolveGpuLayers({fitContext: {contextSize}}, {
                            totalVram: s1GB * 0,
                            freeVram: s1GB * 0,
                            totalRam: s1GB * 8,
                            freeRam: s1GB * 8
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("0");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                        expect(res.contextSize).to.be.gte(contextSize);
                    }
                    {
                        try {
                            await resolveGpuLayers({min: 1, fitContext: {contextSize: 8192}}, {
                                totalVram: s1GB * 0.2,
                                freeVram: s1GB * 0,
                                totalRam: s1GB * 8,
                                freeRam: s1GB * 8
                            });
                            expect.unreachable("Should have thrown an error");
                        } catch (err) {
                            expect(err).toMatchInlineSnapshot("[Error: Not enough VRAM to fit the model with the specified settings]");
                        }
                    }
                });

                test("7GB RAM", async () => {
                    {
                        const contextSize = 4096;
                        const res = await resolveGpuLayers({fitContext: {contextSize}}, {
                            totalVram: 0,
                            freeVram: 0,
                            llamaGpu: false,
                            totalRam: s1GB * 7,
                            freeRam: s1GB * 7
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("0");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                        expect(res.contextSize).to.be.gte(contextSize);
                    }
                    {
                        const contextSize = 4096;
                        const res = await resolveGpuLayers({fitContext: {contextSize}}, {
                            totalVram: s1GB * 7,
                            freeVram: s1GB * 4,
                            totalRam: s1GB * 7,
                            freeRam: s1GB * 7
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("19");
                        expect(res.contextSize).to.toMatchInlineSnapshot("6548");
                        expect(res.contextSize).to.be.gte(contextSize);
                    }
                    {
                        const contextSize = 4096;
                        const res = await resolveGpuLayers({fitContext: {contextSize}}, {
                            totalVram: s1GB * 2,
                            freeVram: s1GB * 1.8,
                            totalRam: s1GB * 7,
                            freeRam: s1GB * 7
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("4");
                        expect(res.contextSize).to.toMatchInlineSnapshot("5164");
                        expect(res.contextSize).to.be.gte(contextSize);
                    }
                    {
                        const contextSize = 8192;
                        const res = await resolveGpuLayers({fitContext: {contextSize}}, {
                            totalVram: s1GB * 7,
                            freeVram: s1GB * 4,
                            totalRam: s1GB * 7,
                            freeRam: s1GB * 7
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("16");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                        expect(res.contextSize).to.be.gte(contextSize);
                    }
                    {
                        const contextSize = 8192;
                        const res = await resolveGpuLayers({fitContext: {contextSize}}, {
                            totalVram: s1GB * 2,
                            freeVram: s1GB * 1.9,
                            totalRam: s1GB * 7,
                            freeRam: s1GB * 7
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("2");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                        expect(res.contextSize).to.be.gte(contextSize);
                    }
                    {
                        const contextSize = 8192;
                        const res = await resolveGpuLayers({fitContext: {contextSize}}, {
                            totalVram: s1GB * 0,
                            freeVram: s1GB * 0,
                            totalRam: s1GB * 7,
                            freeRam: s1GB * 7
                        });
                        expect(res.gpuLayers).to.toMatchInlineSnapshot("0");
                        expect(res.contextSize).to.toMatchInlineSnapshot("8192");
                        expect(res.contextSize).to.be.gte(contextSize);
                    }
                    {
                        try {
                            await resolveGpuLayers({min: 1, fitContext: {contextSize: 8192}}, {
                                totalVram: s1GB * 0.2,
                                freeVram: s1GB * 0,
                                totalRam: s1GB * 7,
                                freeRam: s1GB * 7
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
});
