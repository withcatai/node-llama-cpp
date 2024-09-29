import process from "process";
import chalk from "chalk";
import fs from "fs-extra";
import {cliModelsDirectory} from "../../config.js";
import {Llama} from "../../bindings/Llama.js";
import {createModelDownloader} from "../../utils/createModelDownloader.js";
import {resolveModelDestination} from "../../utils/resolveModelDestination.js";
import {ConsoleInteraction, ConsoleInteractionKey} from "./ConsoleInteraction.js";
import {getReadablePath} from "./getReadablePath.js";
import {interactivelyAskForModel} from "./interactivelyAskForModel.js";

export async function resolveCommandGgufPath(ggufPath: string | undefined, llama: Llama, fetchHeaders?: Record<string, string>, {
    targetDirectory = cliModelsDirectory, flashAttention = false
}: {
    targetDirectory?: string, flashAttention?: boolean
} = {}) {
    if (ggufPath == null)
        ggufPath = await interactivelyAskForModel({
            llama,
            modelsDirectory: targetDirectory,
            allowLocalModels: true,
            downloadIntent: true,
            flashAttention
        });

    const resolvedModelDestination = resolveModelDestination(ggufPath);
    if (resolvedModelDestination.type === "file") {
        try {
            if (await fs.pathExists(resolvedModelDestination.path))
                return resolvedModelDestination.path;
        } catch (err) {
            throw new Error(`Invalid path: ${resolvedModelDestination.path}`);
        }

        throw new Error(`File does not exist: ${resolvedModelDestination.path}`);
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
            console.info(`${chalk.yellow("File:")} ${getReadablePath(downloader.entrypointFilePath)}`);

            return downloader.entrypointFilePath;
        }

        const res = await ConsoleInteraction.yesNoQuestion(
            `There's already an local ${chalk.blue(downloader.entrypointFilePath)} file that's different from the remote one.\n` +
            "Download it and override the existing file?"
        );

        if (!res) {
            console.info("Loading the existing file");
            console.info(`${chalk.yellow("File:")} ${getReadablePath(downloader.entrypointFilePath)}`);

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

    console.info(`${chalk.yellow("File:")} ${getReadablePath(downloader.entrypointFilePath)}`);

    return downloader.entrypointFilePath;
}
