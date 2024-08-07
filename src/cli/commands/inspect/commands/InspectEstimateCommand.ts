import path from "path";
import {CommandModule} from "yargs";
import chalk from "chalk";
import bytes from "bytes";
import {readGgufFileInfo} from "../../../../gguf/readGgufFileInfo.js";
import {normalizeGgufDownloadUrl} from "../../../../gguf/utils/normalizeGgufDownloadUrl.js";
import {isUrl} from "../../../../utils/isUrl.js";
import {resolveHeaderFlag} from "../../../utils/resolveHeaderFlag.js";
import {getReadablePath} from "../../../utils/getReadablePath.js";
import {withCliCommandDescriptionDocsUrl} from "../../../utils/withCliCommandDescriptionDocsUrl.js";
import {documentationPageUrls} from "../../../../config.js";
import {printInfoLine} from "../../../utils/printInfoLine.js";
import {renderModelCompatibilityPercentageWithColors} from "../../../utils/renderModelCompatibilityPercentageWithColors.js";
import {getReadableContextSize} from "../../../../utils/getReadableContextSize.js";
import {GgufInsights} from "../../../../gguf/insights/GgufInsights.js";
import {getLlama} from "../../../../bindings/getLlama.js";
import {BuildGpu, LlamaLogLevel, nodeLlamaCppGpuOptions, parseNodeLlamaCppGpuOption} from "../../../../bindings/types.js";
import {
    defaultTrainContextSizeForEstimationPurposes, GgufInsightsConfigurationResolver
} from "../../../../gguf/insights/GgufInsightsConfigurationResolver.js";
import {Llama} from "../../../../bindings/Llama.js";
import {getGgufFileTypeName} from "../../../../gguf/utils/getGgufFileTypeName.js";
import {getPrettyBuildGpuName} from "../../../../bindings/consts.js";
import withOra from "../../../../utils/withOra.js";

type InspectEstimateCommand = {
    modelPath: string,
    header?: string[],
    gpu?: BuildGpu | "auto",
    gpuLayers?: number,
    contextSize?: number,
    embedding?: boolean
};

export const InspectEstimateCommand: CommandModule<object, InspectEstimateCommand> = {
    command: "estimate [modelPath]",
    describe: withCliCommandDescriptionDocsUrl(
        "Estimate the compatibility of a model with the current hardware",
        documentationPageUrls.CLI.Inspect.Estimate
    ),
    builder(yargs) {
        return yargs
            .option("modelPath", {
                alias: ["m", "model", "path", "url"],
                type: "string",
                demandOption: true,
                description: "The path or URL of the GGUF file to use. If a URL is provided, the metadata will be read from the remote file without downloading the entire file.",
                group: "Required:"
            })
            .option("header", {
                alias: ["H"],
                type: "string",
                array: true,
                description: "Headers to use when reading a model file from a URL, in the format `key: value`. You can pass this option multiple times to add multiple headers.",
                group: "Optional:"
            })
            .option("gpu", {
                type: "string",

                // yargs types don't support passing `false` as a choice, although it is supported by yargs
                choices: nodeLlamaCppGpuOptions as any as Exclude<typeof nodeLlamaCppGpuOptions[number], false>[],
                coerce: (value) => {
                    if (value == null || value == "")
                        return undefined;

                    return parseNodeLlamaCppGpuOption(value);
                },
                defaultDescription: "Uses the latest local build, and fallbacks to \"auto\"",
                description: "Compute layer implementation type to use for llama.cpp. If omitted, uses the latest local build, and fallbacks to \"auto\"",
                group: "Optional:"
            })
            .option("gpuLayers", {
                alias: "gl",
                type: "number",
                description: "number of layers to store in VRAM",
                default: -1,
                defaultDescription: "Automatically determined based on the available VRAM",
                group: "Optional:"
            })
            .option("contextSize", {
                alias: "c",
                type: "number",
                description: "Context size to use for the model context",
                default: -1,
                defaultDescription: "Automatically determined based on the available VRAM",
                group: "Optional:"
            })
            .option("embedding", {
                alias: "e",
                type: "boolean",
                description: "Whether to estimate for creating an embedding context",
                default: false,
                group: "Optional:"
            });
    },
    async handler({
        modelPath: ggufPath, header: headerArg, gpu, gpuLayers, contextSize, embedding
    }: InspectEstimateCommand) {
        if (contextSize === -1) contextSize = undefined;
        if (gpuLayers === -1) gpuLayers = undefined;

        const isPathUrl = isUrl(ggufPath);
        const resolvedGgufPath = isPathUrl
            ? normalizeGgufDownloadUrl(ggufPath)
            : path.resolve(ggufPath);

        const headers = resolveHeaderFlag(headerArg);

        const llama = gpu == null
            ? await getLlama("lastBuild", {
                logLevel: LlamaLogLevel.error
            })
            : await getLlama({
                gpu,
                logLevel: LlamaLogLevel.error
            });

        if (isPathUrl)
            console.info(`${chalk.yellow("URL:")} ${resolvedGgufPath}`);
        else
            console.info(`${chalk.yellow("File:")} ${getReadablePath(resolvedGgufPath)}`);

        if (embedding)
            console.info(`${chalk.yellow("Estimating for an embedding context")}`);

        const ggufFileInfo = await withOra({
            loading: chalk.blue("Reading model metadata"),
            success: chalk.blue("Read model metadata"),
            fail: chalk.blue("Failed to read model metadata"),
            noSuccessLiveStatus: true
        }, async () => {
            return await readGgufFileInfo(ggufPath, {
                fetchHeaders: isPathUrl ? headers : undefined
            });
        });
        const ggufInsights = await GgufInsights.from(ggufFileInfo, llama);

        async function resolveCompatibilityScore(flashAttention: boolean) {
            const compatibilityScore = await ggufInsights.configurationResolver.scoreModelConfigurationCompatibility({
                flashAttention,
                contextSize,
                embeddingContext: embedding
            });

            if (contextSize != null || gpuLayers != null) {
                const vramState = await llama._vramOrchestrator.getMemoryState();
                const resolvedGpuLayers = await ggufInsights.configurationResolver.resolveModelGpuLayers(
                    gpuLayers == null
                        ? {
                            fitContext: {
                                contextSize: contextSize,
                                embeddingContext: embedding
                            }
                        }
                        : gpuLayers,
                    {
                        getVramState: async () => vramState,
                        defaultContextFlashAttention: flashAttention,
                        ignoreMemorySafetyChecks: gpuLayers != null
                    }
                );
                const estimatedModelResourceUsage = ggufInsights.estimateModelResourceRequirements({
                    gpuLayers: resolvedGpuLayers
                });

                const resolvedContextSize = await ggufInsights.configurationResolver.resolveContextContextSize(contextSize ?? "auto", {
                    getVramState: async () => ({
                        total: vramState.total,
                        free: Math.max(0, vramState.free - estimatedModelResourceUsage.gpuVram)
                    }),
                    isEmbeddingContext: embedding,
                    modelGpuLayers: resolvedGpuLayers,
                    modelTrainContextSize: ggufInsights.trainContextSize ?? defaultTrainContextSizeForEstimationPurposes,
                    flashAttention,
                    ignoreMemorySafetyChecks: contextSize != null
                });
                const estimatedContextResourceUsage = ggufInsights.estimateContextResourceRequirements({
                    contextSize: resolvedContextSize,
                    isEmbeddingContext: embedding,
                    modelGpuLayers: resolvedGpuLayers,
                    flashAttention
                });

                compatibilityScore.resolvedValues = {
                    gpuLayers: resolvedGpuLayers,
                    contextSize: resolvedContextSize,

                    modelRamUsage: estimatedModelResourceUsage.cpuRam,
                    contextRamUsage: estimatedContextResourceUsage.cpuRam,
                    totalRamUsage: estimatedModelResourceUsage.cpuRam + estimatedContextResourceUsage.cpuRam,

                    modelVramUsage: estimatedModelResourceUsage.gpuVram,
                    contextVramUsage: estimatedContextResourceUsage.gpuVram,
                    totalVramUsage: estimatedModelResourceUsage.gpuVram + estimatedContextResourceUsage.gpuVram
                };

                if (compatibilityScore.resolvedValues.totalVramUsage > vramState.total) {
                    compatibilityScore.compatibilityScore = 0;
                    compatibilityScore.bonusScore = 0;
                    compatibilityScore.totalScore = 0;
                }
            }

            return compatibilityScore;
        }

        const [
            compatibilityScore,
            compatibilityScoreWithFlashAttention
        ] = await Promise.all([
            resolveCompatibilityScore(false),
            resolveCompatibilityScore(true)
        ]);

        const longestTitle = Math.max("GPU info".length, "Model info".length, "Resolved config".length, "With flash attention".length) + 1;

        if (llama.gpu !== false) {
            const [
                vramState,
                deviceNames
            ] = await Promise.all([
                llama.getVramState(),
                llama.getGpuDeviceNames()
            ]);

            printInfoLine({
                title: "GPU info",
                padTitle: longestTitle,
                info: [{
                    title: "Type",
                    value: getPrettyBuildGpuName(llama.gpu)
                }, {
                    title: "VRAM",
                    value: bytes(vramState.total)
                }, {
                    title: "Name",
                    value: toOneLine(deviceNames.join(", "))
                }]
            });
        }
        printInfoLine({
            title: "Model info",
            padTitle: longestTitle,
            info: [{
                title: "Type",
                value: toOneLine(
                    [
                        ggufFileInfo.metadata?.general?.architecture,
                        ggufFileInfo.metadata?.general?.size_label,
                        getGgufFileTypeName(ggufFileInfo.metadata.general?.file_type)
                    ].filter(Boolean).join(" ")
                )
            }, {
                title: "Size",
                value: bytes(ggufInsights.modelSize)
            }, {
                show: ggufInsights.trainContextSize != null,
                title: "Train context size",
                value: getReadableContextSize(ggufInsights.trainContextSize ?? 0)
            }]
        });

        console.info();
        logCompatibilityScore("Resolved config", longestTitle, compatibilityScore, ggufInsights, llama, false);
        logCompatibilityScore("With flash attention", longestTitle, compatibilityScoreWithFlashAttention, ggufInsights, llama, true);
    }
};

function logCompatibilityScore(
    title: string,
    padTitle: number,
    compatibilityScore: Awaited<ReturnType<typeof GgufInsightsConfigurationResolver.prototype.scoreModelConfigurationCompatibility>>,
    ggufInsights: GgufInsights,
    llama: Llama,
    flashAttention: boolean
) {
    printInfoLine({
        title,
        padTitle,
        separateLines: false,
        info: [{
            title: "",
            value: renderModelCompatibilityPercentageWithColors(compatibilityScore.compatibilityScore * 100) + " compatibility"
        }, {
            show: ggufInsights.trainContextSize != null,
            title: "Context size",
            value: getReadableContextSize(compatibilityScore.resolvedValues.contextSize)
        }, {
            show: llama.gpu !== false,
            title: "GPU layers",
            value: () => (
                compatibilityScore.resolvedValues.gpuLayers + "/" + ggufInsights.totalLayers + " " +
                chalk.dim(`(${Math.floor((compatibilityScore.resolvedValues.gpuLayers / ggufInsights.totalLayers) * 100)}%)`)
            )
        }, {
            show: llama.gpu !== false,
            title: "VRAM usage",
            value: () => bytes(compatibilityScore.resolvedValues.totalVramUsage)
        }, {
            show: compatibilityScore.resolvedValues.totalRamUsage > 0,
            title: "RAM usage",
            value: () => bytes(compatibilityScore.resolvedValues.totalRamUsage)
        }, {
            show: flashAttention,
            title: "Flash attention",
            value: "enabled"
        }]
    });
}

function toOneLine(text: string) {
    return text.replaceAll("\n", chalk.gray("\\n"));
}
