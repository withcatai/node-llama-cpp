import process from "process";
import {CommandModule} from "yargs";
import chalk from "chalk";
import fs from "fs-extra";
import {readGgufFileInfo} from "../../../../gguf/readGgufFileInfo.js";
import {resolveHeaderFlag} from "../../../utils/resolveHeaderFlag.js";
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
import {resolveModelArgToFilePathOrUrl} from "../../../../utils/resolveModelDestination.js";
import {printModelDestination} from "../../../utils/printModelDestination.js";
import {toBytes} from "../../../utils/toBytes.js";
import {printDidYouMeanUri} from "../../../utils/resolveCommandGgufPath.js";
import {isModelUri} from "../../../../utils/parseModelUri.js";

type InspectEstimateCommand = {
    modelPath: string,
    header?: string[],
    gpu?: BuildGpu | "auto",
    gpuLayers?: number | "max",
    contextSize?: number | "train",
    embedding?: boolean,
    noMmap?: boolean,
    swaFullCache?: boolean
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
                alias: ["m", "model", "path", "url", "uri"],
                type: "string",
                demandOption: true,
                description: "The path or URI of the GGUF file to use. If a URI is provided, the metadata will be read from the remote file without downloading the entire file.",
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
                description: "number of layers to store in VRAM. Set to `max` to use all the layers the model has",
                string: true,
                coerce: (value): InspectEstimateCommand["gpuLayers"] => {
                    if (value === "max")
                        return -2;

                    return parseInt(value);
                },
                default: -1,
                defaultDescription: "Automatically determined based on the available VRAM",
                group: "Optional:"
            })
            .option("contextSize", {
                alias: "c",
                type: "number",
                description: "Context size to use for the model context. Set to `max` or `train` to use the training context size. " +
                    "Note that the train context size is not necessarily what you should use for inference, " +
                    "and a big context size will use a lot of memory",
                string: true,
                coerce: (value): InspectEstimateCommand["contextSize"] => {
                    if (value === "max" || value === "train")
                        return -2;

                    return parseInt(value);
                },
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
            })
            .option("noMmap", {
                type: "boolean",
                default: false,
                description: "Disable mmap (memory-mapped file) usage"
            })
            .option("swaFullCache", {
                alias: "noSwa",
                type: "boolean",
                default: false,
                description: "Disable SWA (Sliding Window Attention) on supported models"
            });
    },
    async handler({
        modelPath: ggufPath, header: headerArg, gpu, gpuLayers, contextSize: contextSizeArg, embedding, noMmap, swaFullCache
    }: InspectEstimateCommand) {
        if (gpuLayers === -1) gpuLayers = undefined;
        if (gpuLayers === -2) gpuLayers = "max";
        if (contextSizeArg === -1) contextSizeArg = undefined;
        if (contextSizeArg === -2) contextSizeArg = "train";

        const headers = resolveHeaderFlag(headerArg);

        const [resolvedModelDestination, resolvedGgufPath] = isModelUri(ggufPath)
            ? await withOra({
                loading: chalk.blue("Resolving model URI"),
                success: chalk.blue("Resolved model URI"),
                fail: chalk.blue("Failed to resolve model URI"),
                noSuccessLiveStatus: true
            }, () => resolveModelArgToFilePathOrUrl(ggufPath, headers))
            : await resolveModelArgToFilePathOrUrl(ggufPath, headers);

        if (resolvedModelDestination.type === "file" && !await fs.pathExists(resolvedGgufPath)) {
            console.error(`${chalk.red("File does not exist:")} ${resolvedGgufPath}`);
            printDidYouMeanUri(ggufPath);
            process.exit(1);
        }

        const llama = gpu == null
            ? await getLlama("lastBuild", {
                logLevel: LlamaLogLevel.error
            })
            : await getLlama({
                gpu,
                logLevel: LlamaLogLevel.error
            });

        const useMmap = !noMmap && llama.supportsMmap;
        printModelDestination(resolvedModelDestination);

        if (embedding)
            console.info(`${chalk.yellow("Estimating for an embedding context")}`);

        const ggufFileInfo = await withOra({
            loading: chalk.blue("Reading model metadata"),
            success: chalk.blue("Read model metadata"),
            fail: chalk.blue("Failed to read model metadata"),
            noSuccessLiveStatus: true
        }, async () => {
            return await readGgufFileInfo(resolvedGgufPath, {
                fetchHeaders: resolvedModelDestination.type === "file"
                    ? undefined
                    : headers
            });
        });
        const ggufInsights = await GgufInsights.from(ggufFileInfo, llama);

        const contextSize = contextSizeArg === "train"
            ? ggufInsights.trainContextSize ?? defaultTrainContextSizeForEstimationPurposes
            : contextSizeArg;

        async function resolveCompatibilityScore(flashAttention: boolean) {
            return await ggufInsights.configurationResolver.resolveAndScoreConfig({
                flashAttention,
                targetContextSize: contextSize,
                targetGpuLayers: gpuLayers,
                embeddingContext: embedding,
                useMmap,
                swaFullCache
            });
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
                    value: toBytes(vramState.total)
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
                value: toBytes(ggufInsights.modelSize)
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
            value: () => toBytes(compatibilityScore.resolvedValues.totalVramUsage)
        }, {
            title: "RAM usage",
            value: () => toBytes(compatibilityScore.resolvedValues.totalRamUsage)
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
