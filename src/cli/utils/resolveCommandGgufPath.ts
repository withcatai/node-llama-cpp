import path from "path";
import process from "process";
import chalk from "chalk";
import {downloadFile} from "ipull";
import fs from "fs-extra";
import bytes from "bytes";
import logSymbols from "log-symbols";
import {cliModelsDirectory} from "../../config.js";
import {normalizeGgufDownloadUrl} from "../../gguf/utils/normalizeGgufDownloadUrl.js";
import {GgufInsights} from "../../gguf/insights/GgufInsights.js";
import {readGgufFileInfo} from "../../gguf/readGgufFileInfo.js";
import {Llama} from "../../bindings/Llama.js";
import {isUrl} from "../../utils/isUrl.js";
import {arrowChar} from "../../consts.js";
import {withProgressLog} from "../../utils/withProgressLog.js";
import {getReadableContextSize} from "../../utils/getReadableContextSize.js";
import {ConsoleInteraction, ConsoleInteractionKey} from "./ConsoleInteraction.js";
import {getReadablePath} from "./getReadablePath.js";
import {basicChooseFromListConsoleInteraction} from "./basicChooseFromListConsoleInteraction.js";
import {consolePromptQuestion} from "./consolePromptQuestion.js";
import {resolveModelRecommendationFileOptions} from "./resolveModelRecommendationFileOptions.js";
import {splitAnsiToLines} from "./splitAnsiToLines.js";

export async function resolveCommandGgufPath(ggufPath: string | undefined, llama: Llama) {
    if (ggufPath == null)
        ggufPath = await interactiveChooseModel(llama);

    const isPathUrl = isUrl(ggufPath);

    if (!isPathUrl) {
        try {
            const resolvedPath = path.resolve(process.cwd(), ggufPath);

            if (await fs.pathExists(resolvedPath))
                return resolvedPath;
        } catch (err) {
            throw new Error(`Invalid path: ${ggufPath}`);
        }

        throw new Error(`File does not exist: ${path.resolve(process.cwd(), ggufPath)}`);
    }

    ggufPath = normalizeGgufDownloadUrl(ggufPath);

    await fs.ensureDir(cliModelsDirectory);

    const downloader = await downloadFile({
        url: ggufPath,
        directory: cliModelsDirectory,
        cliProgress: true
    });

    const destFilePath = path.join(path.resolve(cliModelsDirectory), downloader.status.fileName);

    if (downloader.status.fileName == null || downloader.status.fileName === "")
        throw new Error("Failed to get the file name from the URL");

    if (await fs.pathExists(destFilePath)) {
        const fileStats = await fs.stat(destFilePath);

        if (downloader.status.totalBytes === fileStats.size) {
            console.info(`${chalk.yellow("File:")} ${getReadablePath(destFilePath)}`);
            downloader.pause();

            return destFilePath;
        }

        const res = await ConsoleInteraction.yesNoQuestion(
            `There's already an local ${chalk.blue(downloader.status.fileName)} file that's different from the remote one.\n` +
            "Download it and override the existing file?"
        );

        if (!res) {
            console.info("Loading the existing file");
            console.info(`${chalk.yellow("File:")} ${getReadablePath(destFilePath)}`);
            downloader.pause();

            return destFilePath;
        }

        await fs.remove(destFilePath);
    }

    const consoleInteraction = new ConsoleInteraction();
    consoleInteraction.onKey(ConsoleInteractionKey.ctrlC, async () => {
        downloader.pause();
        consoleInteraction.stop();
        process.exit(0);
    });

    console.info(`Downloading to ${chalk.yellow(getReadablePath(cliModelsDirectory))}`);
    consoleInteraction.start();
    await downloader.download();
    consoleInteraction.stop();

    console.info(`${chalk.yellow("File:")} ${getReadablePath(destFilePath)}`);

    return destFilePath;
}

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
        compatibilityScore: number,
        compatibilityContextSize: number
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

async function interactiveChooseModel(llama: Llama): Promise<string> {
    let localModelFileOptions: (ModelOption & {type: "localModel"})[] = [];
    const recommendedModelOptions: (ModelOption & {type: "recommendedModel"})[] = [];
    const activeInteractionController = new AbortController();

    if (await fs.existsSync(cliModelsDirectory)) {
        const ggufFileNames = (await fs.readdir(cliModelsDirectory)).filter((fileName) => fileName.endsWith(".gguf"));
        let readItems = 0;
        const renderProgress = () => (
            "(" + String(readItems).padStart(String(ggufFileNames.length).length, "0") + "/" + ggufFileNames.length + ")"
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
                        const filePath = path.join(cliModelsDirectory, fileName);

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

                        const compatibilityScore = ggufInsights?.configurationResolver.scoreModelConfigurationCompatibility();

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
            text: "Enter a model URL or file path...",
            key: "getPath"
        },
        ...(
            localModelFileOptions.length === 0
                ? []
                : [
                    {
                        type: "separator",
                        text: () => "   " + chalk.grey("-".repeat(4))
                    },
                    {
                        type: "separator",
                        text: "   " + chalk.bold("Downloaded models") + " " + chalk.dim(`(${getReadablePath(cliModelsDirectory)})`)
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
                        text: () => "   " + chalk.grey("-".repeat(4))
                    },
                    {
                        type: "separator",
                        text: "   " + chalk.bold("Recommended models") + " " + chalk.dim("(select to download)")
                    },
                    ...recommendedModelOptions
                ] satisfies ModelOption[]
        )
    ];

    try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const selectedItem = await basicChooseFromListConsoleInteraction({
                title: chalk.bold("Select a model:"),
                footer(item) {
                    if (item.type !== "recommendedModel" || item.description == null)
                        return undefined;

                    const leftPad = 3;
                    const lines = splitAnsiToLines(item.description, Math.max(1, process.stdout.columns - leftPad));

                    return " \n" +
                        " ".repeat(leftPad) + chalk.bold.grey("Model description") + "\n" +
                        lines.map((line) => (" ".repeat(leftPad) + line)).join("\n");
                },
                items: options,
                renderItem(item, focused, rerender) {
                    return renderSelectionItem(item, focused, rerender, activeInteractionController.signal, llama);
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
                    const selectedModelUrlOrPath = await askForModelUrlOrPath();

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

async function askForModelUrlOrPath(): Promise<string | null> {
    return await consolePromptQuestion(chalk.bold("Enter a model URL or file path: "), {
        exitOnCtrlC: false,
        async validate(input) {
            if (isUrl(input, false)) {
                try {
                    new URL(input);
                } catch (err) {
                    return "Invalid URL";
                }

                return null;
            }

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
    });
}

function renderSelectionItem(item: ModelOption, focused: boolean, rerender: () => void, abortSignal: AbortSignal, llama: Llama) {
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
                    llama
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
                item.selectedUrl.compatibilityScore,
                item.selectedUrl.compatibilityContextSize
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
                    : chalk.white(" (" + chalk.yellow(getReadableContextSize(compatibilityContextSize)) + " context)")
            )
        );

    if (ggufInsights.trainContextSize != null)
        info.push(chalk.yellow("Train context:") + " " + chalk.whiteBright(getReadableContextSize(ggufInsights.trainContextSize)));

    info.push(chalk.yellow("Size:") + " " + chalk.whiteBright(bytes(ggufInsights.modelSize)));

    return info
        .map((item) => chalk.bgGray(" " + item + " "))
        .join(" ");
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
    recommendedModelOption, llama, abortSignal, rerenderOption
}: {
    recommendedModelOption: ModelOption & {type: "recommendedModel"},
    llama: Llama,
    abortSignal: AbortSignal,
    rerenderOption(): void
}) {
    try {
        let bestScore: number | undefined = undefined;
        let bestScoreSelectedUrl: (ModelOption & {type: "recommendedModel"})["selectedUrl"] | undefined = undefined;

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

                const compatibilityScore = ggufInsights.configurationResolver.scoreModelConfigurationCompatibility();

                if (bestScore == null || compatibilityScore.compatibilityScore > bestScore) {
                    bestScore = compatibilityScore.compatibilityScore;
                    bestScoreSelectedUrl = {
                        url: potentialUrl,
                        ggufInsights,
                        compatibilityScore: compatibilityScore.compatibilityScore,
                        compatibilityContextSize: compatibilityScore.resolvedValues.contextSize
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
