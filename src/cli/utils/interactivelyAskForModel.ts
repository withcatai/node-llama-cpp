import path from "path";
import process from "process";
import chalk from "chalk";
import bytes from "bytes";
import fs from "fs-extra";
import stripAnsi from "strip-ansi";
import logSymbols from "log-symbols";
import {getReadableContextSize} from "../../utils/getReadableContextSize.js";
import {arrowChar} from "../../consts.js";
import {Llama} from "../../bindings/Llama.js";
import {getGgufSplitPartsInfo} from "../../gguf/utils/resolveSplitGgufParts.js";
import {withProgressLog} from "../../utils/withProgressLog.js";
import {GgufInsights} from "../../gguf/insights/GgufInsights.js";
import {readGgufFileInfo} from "../../gguf/readGgufFileInfo.js";
import {getPrettyBuildGpuName} from "../../bindings/consts.js";
import {GgufInsightsConfigurationResolver} from "../../gguf/insights/GgufInsightsConfigurationResolver.js";
import {isUrl} from "../../utils/isUrl.js";
import {resolveModelRecommendationFileOptions} from "./resolveModelRecommendationFileOptions.js";
import {getReadablePath} from "./getReadablePath.js";
import {basicChooseFromListConsoleInteraction} from "./basicChooseFromListConsoleInteraction.js";
import {splitAnsiToLines} from "./splitAnsiToLines.js";
import {consolePromptQuestion} from "./consolePromptQuestion.js";
import {renderInfoLine} from "./printInfoLine.js";

type ModelOption = {
    type: "localModel",
    title: string | (() => string),
    path: string,
    addedDate: number,
    ggufInsights?: GgufInsights,
    compatibilityScore?: number,
    compatibilityContextSize?: number,
    compatibilityBonusScore?: number
} | {
    type: "recommendedModel",
    title: string | (() => string),
    description?: string,
    potentialUrls: string[],
    selectedUrl?: {
        url: string,
        ggufInsights: GgufInsights,
        compatibilityScore: Awaited<ReturnType<typeof GgufInsightsConfigurationResolver.prototype.scoreModelConfigurationCompatibility>>
    },
    urlSelectionLoadingState?: "done" | "loading"
} | {
    type: "separator",
    text: string | (() => string)
} | {
    type: "action",
    text: string | (() => string),
    key: string
};
const vramStateUpdateInterval = 1000;

export async function interactivelyAskForModel({
    llama,
    modelsDirectory,
    allowLocalModels = true,
    downloadIntent = true,
    flashAttention = false
}: {
    llama: Llama,
    modelsDirectory?: string,
    allowLocalModels?: boolean,
    downloadIntent?: boolean,
    flashAttention?: boolean
}): Promise<string> {
    let localModelFileOptions: (ModelOption & { type: "localModel" })[] = [];
    const recommendedModelOptions: (ModelOption & { type: "recommendedModel" })[] = [];
    const activeInteractionController = new AbortController();
    let scheduledTitleRerenderTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
    let vramState = await llama.getVramState();
    const canUseGpu = vramState.total > 0;

    if (allowLocalModels && modelsDirectory != null && await fs.existsSync(modelsDirectory)) {
        const ggufFileNames = (await fs.readdir(modelsDirectory))
            .filter((fileName) => {
                if (!fileName.endsWith(".gguf"))
                    return false;

                const partsInfo = getGgufSplitPartsInfo(fileName);

                return partsInfo == null || partsInfo.part === 1;
            });
        let readItems = 0;
        const renderProgress = () => (
            "(" + String(readItems)
                .padStart(String(ggufFileNames.length).length, "0") + "/" + ggufFileNames.length + ")"
        );

        if (ggufFileNames.length > 0)
            await withProgressLog({
                loadingText: "Reading local models directory",
                failText: "Failed to read local models directory",
                successText: "Read local models directory",
                noSuccessLiveStatus: true,
                initialProgressBarText: renderProgress()
            }, async (progressUpdater) => {
                localModelFileOptions = await Promise.all(
                    ggufFileNames.map(async (fileName) => {
                        const filePath = path.join(modelsDirectory, fileName);

                        let ggufInsights: GgufInsights | undefined = undefined;
                        try {
                            const ggufFileInfo = await readGgufFileInfo(filePath, {
                                sourceType: "filesystem",
                                signal: activeInteractionController.signal
                            });
                            ggufInsights = await GgufInsights.from(ggufFileInfo, llama);
                        } catch (err) {
                            // do nothing
                        }

                        readItems++;
                        progressUpdater.setProgress(readItems / ggufFileNames.length, renderProgress());

                        const compatibilityScore = await ggufInsights?.configurationResolver.scoreModelConfigurationCompatibility({
                            flashAttention: flashAttention && ggufInsights?.flashAttentionSupported
                        });

                        return {
                            type: "localModel",
                            title: fileName,
                            path: filePath,
                            addedDate: (await fs.stat(filePath)).birthtimeMs,
                            ggufInsights: ggufInsights,
                            compatibilityScore: compatibilityScore?.compatibilityScore,
                            compatibilityBonusScore: compatibilityScore?.bonusScore,
                            compatibilityContextSize: compatibilityScore?.resolvedValues.contextSize
                        } satisfies ModelOption;
                    })
                );

                localModelFileOptions = localModelFileOptions.sort((a, b) => {
                    if (a.compatibilityScore == null && b.compatibilityScore == null)
                        return b.addedDate - a.addedDate;
                    else if (a.compatibilityScore == null)
                        return -1;
                    else if (b.compatibilityScore == null)
                        return 1;
                    else if (b.compatibilityScore === a.compatibilityScore &&
                        b.compatibilityBonusScore != null && a.compatibilityBonusScore != null
                    )
                        return b.compatibilityBonusScore - a.compatibilityBonusScore;

                    return b.compatibilityScore - a.compatibilityScore;
                });
            });
    }

    try {
        // if this file gets very big, we don't want to load it on every CLI usage
        const {recommendedModels} = await import("../recommendedModels.js");

        for (const recommendedModel of recommendedModels) {
            const potentialUrls = resolveModelRecommendationFileOptions(recommendedModel);

            if (potentialUrls.length > 0)
                recommendedModelOptions.push({
                    type: "recommendedModel",
                    title: recommendedModel.name,
                    potentialUrls,
                    description: recommendedModel.description
                });
        }
    } catch (err) {
        // do nothing
    }

    let initialFocusIndex = 3; // first model option
    const options: ModelOption[] = [
        {
            type: "action",
            text: allowLocalModels
                ? "Enter a model URL or file path..."
                : "Enter a model URL...",
            key: "getPath"
        },
        ...(
            (localModelFileOptions.length === 0 || modelsDirectory == null)
                ? []
                : [
                    {
                        type: "separator",
                        text: () => "   " + chalk.gray("-".repeat(4))
                    },
                    {
                        type: "separator",
                        text: "   " + chalk.bold("Downloaded models") + " " + chalk.dim(`(${getReadablePath(modelsDirectory)})`)
                    },
                    ...localModelFileOptions
                ] satisfies ModelOption[]
        ),
        ...(
            recommendedModelOptions.length === 0
                ? []
                : [
                    {
                        type: "separator",
                        text: () => "   " + chalk.gray("-".repeat(4))
                    },
                    {
                        type: "separator",
                        text: "   " + chalk.bold("Recommended models") + (
                            downloadIntent
                                ? (" " + chalk.dim("(select to download)"))
                                : ""
                        )
                    },
                    ...recommendedModelOptions
                ] satisfies ModelOption[]
        )
    ];

    try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const minWidth = Math.min(80 + (flashAttention ? 26 : 0), process.stdout.columns - 1);
            const selectedItem = await basicChooseFromListConsoleInteraction({
                title(item, rerender) {
                    const title = chalk.bold("Select a model:") + "  ";

                    const vramStateText = vramState.total === 0
                        ? chalk.bgGray(
                            " " +
                            "No GPU" +
                            " "
                        )
                        : (
                            chalk.bgGray(
                                " " +
                                chalk.yellow("GPU:") + " " + getPrettyBuildGpuName(llama.gpu) +
                                " "
                            ) +
                            " " +
                            chalk.bgGray(
                                " " +
                                chalk.yellow("VRAM usage:") + " " +
                                (String(Math.floor((vramState.used / vramState.total) * 100 * 100) / 100) + "%") + " " +
                                chalk.dim("(" + bytes(vramState.used) + "/" + bytes(vramState.total) + ")") +
                                " "
                            ) + (
                                !flashAttention
                                    ? ""
                                    : (
                                        " " +
                                        chalk.bgGray(
                                            " " +
                                            chalk.yellow("Flash attention:") + " " + "enabled" +
                                            " "
                                        )
                                    )
                            )
                        );

                    const pad = Math.max(0, minWidth - (stripAnsi(title).length + stripAnsi(vramStateText).length));

                    clearTimeout(scheduledTitleRerenderTimeout);
                    scheduledTitleRerenderTimeout = setTimeout(async () => {
                        const newVramState = await llama.getVramState();
                        if (vramState.used !== newVramState.used || vramState.total !== newVramState.total) {
                            vramState = newVramState;
                            rerender();
                        }
                    }, vramStateUpdateInterval);

                    return [
                        title,
                        " ".repeat(pad),
                        vramStateText
                    ].join("");
                },
                footer(item) {
                    if (item.type !== "recommendedModel" || item.description == null)
                        return undefined;

                    const leftPad = 3;
                    const maxWidth = Math.max(1, process.stdout.columns - 2 - leftPad);
                    const lines = splitAnsiToLines(item.description, maxWidth);

                    return " \n" +
                        " ".repeat(leftPad) + chalk.bold.gray("Model description") + "\n" +
                        lines.map((line) => (" ".repeat(leftPad) + line))
                            .join("\n") + "\n" +
                        splitAnsiToLines(renderRecommendedModelTechnicalInfo(item.selectedUrl, maxWidth, canUseGpu), maxWidth)
                            .map((line) => (" ".repeat(leftPad) + line))
                            .join("\n");
                },
                items: options,
                renderItem(item, focused, rerender) {
                    return renderSelectionItem(item, focused, rerender, activeInteractionController.signal, llama, flashAttention);
                },
                canFocusItem(item) {
                    return item.type === "recommendedModel" || item.type === "localModel" || item.type === "action";
                },
                canSelectItem(item) {
                    if (item.type === "recommendedModel")
                        return item.selectedUrl != null;

                    return item.type === "localModel" || item.type === "action";
                },
                initialFocusIndex: Math.min(initialFocusIndex, options.length - 1),
                aboveItemsPadding: 1,
                belowItemsPadding: 1,
                renderSummaryOnExit(item) {
                    if (item == null || item.type === "action" || item.type === "separator")
                        return "";
                    else if (item.type === "localModel") {
                        const modelTitle = item.title instanceof Function
                            ? item.title()
                            : item.title;

                        return logSymbols.success + " Selected model " + chalk.blue(modelTitle);
                    } else if (item.type === "recommendedModel") {
                        const modelTitle = item.title instanceof Function
                            ? item.title()
                            : item.title;

                        return logSymbols.success + " Selected model " + chalk.blue(modelTitle);
                    }

                    void (item satisfies never);
                    return "";
                },
                exitOnCtrlC: true
            });

            if (selectedItem == null || selectedItem.type === "separator")
                continue;
            else if (selectedItem.type === "localModel")
                return selectedItem.path;
            else if (selectedItem.type === "recommendedModel" && selectedItem.selectedUrl != null)
                return selectedItem.selectedUrl.url;
            else if (selectedItem.type === "action") {
                if (selectedItem.key === "getPath") {
                    initialFocusIndex = 0;
                    const selectedModelUrlOrPath = await askForModelUrlOrPath(allowLocalModels);

                    if (selectedModelUrlOrPath == null)
                        continue;

                    return selectedModelUrlOrPath;
                }
            }
        }
    } finally {
        activeInteractionController.abort();
    }
}

async function askForModelUrlOrPath(allowLocalModels: boolean): Promise<string | null> {
    return await consolePromptQuestion(
        allowLocalModels
            ? chalk.bold("Enter a model URL or file path: ")
            : chalk.bold("Enter a model URL: "),
        {
            exitOnCtrlC: false,
            async validate(input) {
                if (isUrl(input, false)) {
                    try {
                        new URL(input);
                    } catch (err) {
                        return "Invalid URL";
                    }

                    return null;
                } else if (!allowLocalModels)
                    return "Only URLs are allowed";

                try {
                    if (await fs.pathExists(input))
                        return null;

                    return "File does not exist";
                } catch (err) {
                    return "Invalid path";
                }
            },
            renderSummaryOnExit(item) {
                if (item == null)
                    return "";

                if (isUrl(item, false))
                    return logSymbols.success + " Entered model URL " + chalk.blue(item);
                else
                    return logSymbols.success + " Entered model path " + chalk.blue(item);
            }
        }
    );
}

function renderSelectionItem(
    item: ModelOption, focused: boolean, rerender: () => void, abortSignal: AbortSignal, llama: Llama, flashAttention: boolean
) {
    if (item.type === "localModel") {
        let modelText = item.title instanceof Function
            ? item.title()
            : item.title;

        if (item.ggufInsights != null)
            modelText += "  " + renderModelCompatibility(item.ggufInsights, item.compatibilityScore, item.compatibilityContextSize);
        else
            modelText += " " + chalk.bgGray.yellow(" Cannot read metadata ");

        return renderSelectableItem(modelText, focused);
    } else if (item.type === "recommendedModel") {
        let modelText = item.title instanceof Function
            ? item.title()
            : item.title;

        if (item.selectedUrl == null) {
            if (item.urlSelectionLoadingState == null) {
                item.urlSelectionLoadingState = "loading";
                void selectFileForModelRecommendation({
                    recommendedModelOption: item,
                    abortSignal,
                    rerenderOption: rerender,
                    llama,
                    flashAttention
                });
            }

            if (item.urlSelectionLoadingState === "loading")
                modelText += " " + chalk.bgGray.yellow(" Loading info ");
            else if (item.urlSelectionLoadingState === "done")
                modelText += " " + chalk.bgGray.yellow(" Failed to load info ");
            else
                void (item.urlSelectionLoadingState satisfies never);
        } else
            modelText += "  " + renderModelCompatibility(
                item.selectedUrl.ggufInsights,
                item.selectedUrl.compatibilityScore.compatibilityScore,
                item.selectedUrl.compatibilityScore.resolvedValues.contextSize
            );

        return renderSelectableItem(modelText, focused);
    } else if (item.type === "separator") {
        return item.text instanceof Function
            ? item.text()
            : item.text;
    } else if (item.type === "action") {
        const actionText = item.text instanceof Function
            ? item.text()
            : item.text;

        return renderSelectableItem(actionText, focused);
    }

    void (item satisfies never);
    return "";
}

function renderSelectableItem(text: string, focused: boolean) {
    if (focused)
        return " " + chalk.cyan(arrowChar) + " " + chalk.cyan(text);

    return " * " + text;
}

function renderModelCompatibility(
    ggufInsights: GgufInsights, compatibilityScore: number | undefined, compatibilityContextSize: number | undefined
) {
    const info: string[] = [];

    if (compatibilityScore != null)
        info.push(
            renderCompatibilityPercentageWithColors(compatibilityScore * 100) + chalk.whiteBright(" compatibility")
            + (
                compatibilityContextSize == null
                    ? ""
                    : (chalk.gray(" | ") + chalk.yellow(getReadableContextSize(compatibilityContextSize)) + chalk.whiteBright(" context"))
            )
        );

    info.push(chalk.yellow("Size:") + " " + chalk.whiteBright(bytes(ggufInsights.modelSize)));

    return info
        .map((item) => chalk.bgGray(" " + item + " "))
        .join(" ");
}

function renderRecommendedModelTechnicalInfo(
    modelSelectedUrl: (ModelOption & { type: "recommendedModel" })["selectedUrl"],
    maxWidth: number,
    canUseGpu: boolean
) {
    if (modelSelectedUrl == null)
        return " \n" + chalk.bgGray.yellow(" Loading info ") + "\n ";

    const ggufInsights = modelSelectedUrl.ggufInsights;
    const compatibilityScore = modelSelectedUrl.compatibilityScore;

    const longestTitle = Math.max("Model info".length, "Resolved config".length) + 1;
    return " \n" + [
        renderInfoLine({
            title: "Model info",
            padTitle: longestTitle,
            separateLines: false,
            maxWidth,
            info: [{
                title: "Size",
                value: bytes(ggufInsights.modelSize)
            }, {
                show: ggufInsights.trainContextSize != null,
                title: "Train context size",
                value: () => getReadableContextSize(ggufInsights.trainContextSize ?? 0)
            }]
        }),
        renderInfoLine({
            title: "Resolved config",
            padTitle: longestTitle,
            separateLines: false,
            maxWidth,
            info: [{
                title: "",
                value: renderCompatibilityPercentageWithColors(compatibilityScore.compatibilityScore * 100) + " compatibility"
            }, {
                show: ggufInsights.trainContextSize != null,
                title: "Context size",
                value: getReadableContextSize(compatibilityScore.resolvedValues.contextSize)
            }, {
                show: canUseGpu,
                title: "GPU layers",
                value: () => (
                    compatibilityScore.resolvedValues.gpuLayers + "/" + ggufInsights.totalLayers + " " +
                    chalk.dim(`(${Math.floor((compatibilityScore.resolvedValues.gpuLayers / ggufInsights.totalLayers) * 100)}%)`)
                )
            }, {
                show: canUseGpu,
                title: "VRAM usage",
                value: () => bytes(compatibilityScore.resolvedValues.totalVramUsage)
            }]
        })
    ].join("\n");
}

function renderCompatibilityPercentageWithColors(percentage: number, {
    greenBright = 100,
    green = 95,
    yellow = 85,
    yellowBright = 75
}: {
    greenBright?: number,
    green?: number,
    yellow?: number,
    yellowBright?: number
} = {}): string {
    const percentageText = String(Math.floor(percentage)) + "%";

    if (percentage >= greenBright)
        return chalk.greenBright(percentageText);
    else if (percentage >= green)
        return chalk.green(percentageText);
    else if (percentage >= yellow)
        return chalk.yellow(percentageText);
    else if (percentage >= yellowBright)
        return chalk.yellowBright(percentageText);

    return chalk.red(percentageText);
}

async function selectFileForModelRecommendation({
    recommendedModelOption, llama, abortSignal, rerenderOption, flashAttention
}: {
    recommendedModelOption: ModelOption & { type: "recommendedModel" },
    llama: Llama,
    abortSignal: AbortSignal,
    rerenderOption(): void,
    flashAttention: boolean
}) {
    try {
        let bestScore: number | undefined = undefined;
        let bestScoreSelectedUrl: (ModelOption & { type: "recommendedModel" })["selectedUrl"] | undefined = undefined;

        for (const potentialUrl of recommendedModelOption.potentialUrls) {
            if (abortSignal.aborted)
                return;

            try {
                const ggufFileInfo = await readGgufFileInfo(potentialUrl, {
                    sourceType: "network",
                    signal: abortSignal
                });
                const ggufInsights = await GgufInsights.from(ggufFileInfo, llama);

                if (abortSignal.aborted)
                    return;

                const compatibilityScore = await ggufInsights.configurationResolver.scoreModelConfigurationCompatibility({
                    flashAttention
                });

                if (bestScore == null || compatibilityScore.compatibilityScore > bestScore) {
                    bestScore = compatibilityScore.compatibilityScore;
                    bestScoreSelectedUrl = {
                        url: potentialUrl,
                        ggufInsights,
                        compatibilityScore
                    };

                    if (bestScore === 1)
                        break;
                }
            } catch (err) {
                // do nothing
            }
        }

        recommendedModelOption.selectedUrl = bestScoreSelectedUrl;
        recommendedModelOption.urlSelectionLoadingState = "done";
        rerenderOption();
    } catch (err) {
        recommendedModelOption.urlSelectionLoadingState = "done";
        rerenderOption();
    }
}
