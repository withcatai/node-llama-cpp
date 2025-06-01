import process from "process";
import chalk from "chalk";
import fs from "fs-extra";
import {cliModelsDirectory} from "../../config.js";
import {Llama} from "../../bindings/Llama.js";
import {createModelDownloader} from "../../utils/createModelDownloader.js";
import {resolveModelDestination} from "../../utils/resolveModelDestination.js";
import {ggufQuantNames} from "../../gguf/utils/ggufQuantNames.js";
import {getConsoleLogPrefix} from "../../utils/getConsoleLogPrefix.js";
import {isModelUri} from "../../utils/parseModelUri.js";
import {ConsoleInteraction, ConsoleInteractionKey} from "./ConsoleInteraction.js";
import {getReadablePath} from "./getReadablePath.js";
import {interactivelyAskForModel} from "./interactivelyAskForModel.js";

export async function resolveCommandGgufPath(ggufPath: string | undefined, llama: Llama, fetchHeaders?: Record<string, string>, {
    targetDirectory = cliModelsDirectory, flashAttention = false, swaFullCache = false, useMmap, consoleTitle = "File"
}: {
    targetDirectory?: string, flashAttention?: boolean, swaFullCache?: boolean, useMmap?: boolean, consoleTitle?: string
} = {}) {
    if (ggufPath == null)
        ggufPath = await interactivelyAskForModel({
            llama,
            modelsDirectory: targetDirectory,
            allowLocalModels: true,
            downloadIntent: true,
            flashAttention,
            swaFullCache,
            useMmap
        });

    const resolvedModelDestination = resolveModelDestination(ggufPath);
    if (resolvedModelDestination.type === "file") {
        try {
            if (await fs.pathExists(resolvedModelDestination.path))
                return resolvedModelDestination.path;
        } catch (err) {
            throw new Error(`Invalid path: ${resolvedModelDestination.path}`);
        }

        console.error(`${chalk.red("File does not exist:")} ${resolvedModelDestination.path}`);
        printDidYouMeanUri(ggufPath);
        process.exit(1);
    }

    const downloader = await createModelDownloader({
        modelUri: resolvedModelDestination.type === "uri"
            ? resolvedModelDestination.uri
            : resolvedModelDestination.url,
        dirPath: targetDirectory,
        headers: fetchHeaders,
        showCliProgress: true,
        deleteTempFileOnCancel: false,
        skipExisting: false
    });

    if (downloader.totalFiles === 1 && await fs.pathExists(downloader.entrypointFilePath)) {
        const fileStats = await fs.stat(downloader.entrypointFilePath);

        if (downloader.totalSize === fileStats.size) {
            console.info(`${chalk.yellow(consoleTitle + ":")} ${getReadablePath(downloader.entrypointFilePath)}`);

            return downloader.entrypointFilePath;
        }

        const res = await ConsoleInteraction.yesNoQuestion(
            `There's already an local ${chalk.blue(downloader.entrypointFilePath)} file that's different from the remote one.\n` +
            "Download it and override the existing file?"
        );

        if (!res) {
            console.info("Loading the existing file");
            console.info(`${chalk.yellow(consoleTitle + ":")} ${getReadablePath(downloader.entrypointFilePath)}`);

            return downloader.entrypointFilePath;
        }

        await fs.remove(downloader.entrypointFilePath);
    }

    const consoleInteraction = new ConsoleInteraction();
    consoleInteraction.onKey(ConsoleInteractionKey.ctrlC, async () => {
        await downloader.cancel();
        consoleInteraction.stop();
        process.exit(0);
    });

    console.info(`Downloading to ${chalk.yellow(getReadablePath(targetDirectory))}${
        downloader.splitBinaryParts != null
            ? chalk.gray(` (combining ${downloader.splitBinaryParts} parts into a single file)`)
            : ""
    }`);
    consoleInteraction.start();
    await downloader.download();
    consoleInteraction.stop();

    console.info(`${chalk.yellow(consoleTitle + ":")} ${getReadablePath(downloader.entrypointFilePath)}`);

    return downloader.entrypointFilePath;
}

export function tryCoercingModelUri(ggufPath: string) {
    const modelNamePart = ggufPath.split("/").pop() ?? "";
    const possibleQuant = modelNamePart.includes(":")
        ? modelNamePart.split(":").pop()
        : undefined;
    const foundSlashes = ggufPath.split("/").filter((part) => part !== "").length - 1;

    if (ggufPath.startsWith("/") || ggufPath.startsWith("./") || ggufPath.startsWith("../") || ggufPath.slice(1, 3) === ":\\")
        return undefined;

    if (
        // <user>/<model>/<file-path>
        foundSlashes >= 2 ||
        (
            // <user>/<model>
            // <user>/<model>:<valid quant or "latest">
            foundSlashes === 1 &&
            (possibleQuant == null || possibleQuant === "latest" || ggufQuantNames.has(possibleQuant.toUpperCase()))
        )
    ) {
        const possibleUri = "hf:" + ggufPath;
        if (isModelUri(possibleUri)) {
            return {
                uri: possibleUri,
                modifiedRegion: {
                    start: 0,
                    end: "hf:".length
                }
            };
        }
    }

    return undefined;
}

export function printDidYouMeanUri(ggufPath: string) {
    const coercedUriRes = tryCoercingModelUri(ggufPath);
    if (coercedUriRes != null) {
        const uriText = styleTextRange(
            coercedUriRes.uri,
            coercedUriRes.modifiedRegion.start,
            coercedUriRes.modifiedRegion.end,
            (text) => chalk.underline(text)
        );

        console.info(getConsoleLogPrefix() + `Did you mean "${chalk.blue(uriText)}"?`);
    }
}

function styleTextRange(text: string, start: number, end: number, style: (text: string) => string) {
    return text.slice(0, start) + style(text.slice(start, end)) + text.slice(end);
}
