import path from "path";
import process from "process";
import chalk from "chalk";
import fs from "fs-extra";
import {cliModelsDirectory} from "../../config.js";
import {normalizeGgufDownloadUrl} from "../../gguf/utils/normalizeGgufDownloadUrl.js";
import {Llama} from "../../bindings/Llama.js";
import {isUrl} from "../../utils/isUrl.js";
import {createModelDownloader} from "../../utils/createModelDownloader.js";
import {ConsoleInteraction, ConsoleInteractionKey} from "./ConsoleInteraction.js";
import {getReadablePath} from "./getReadablePath.js";
import {interactivelyAskForModel} from "./interactivelyAskForModel.js";

export async function resolveCommandGgufPath(ggufPath: string | undefined, llama: Llama, fetchHeaders?: Record<string, string>, {
    targetDirectory = cliModelsDirectory, flashAttention = false
}: {
    targetDirectory?: string, flashAttention?: boolean
} = {}) {
    let resolvedGgufPath = ggufPath;

    if (resolvedGgufPath == null)
        resolvedGgufPath = await interactivelyAskForModel({
            llama,
            modelsDirectory: targetDirectory,
            allowLocalModels: true,
            downloadIntent: true,
            flashAttention
        });

    if (!isUrl(resolvedGgufPath)) {
        try {
            const resolvedPath = path.resolve(process.cwd(), resolvedGgufPath);

            if (await fs.pathExists(resolvedPath))
                return resolvedPath;
        } catch (err) {
            throw new Error(`Invalid path: ${resolvedGgufPath}`);
        }

        throw new Error(`File does not exist: ${path.resolve(process.cwd(), resolvedGgufPath)}`);
    }

    resolvedGgufPath = normalizeGgufDownloadUrl(resolvedGgufPath);

    const downloader = await createModelDownloader({
        modelUrl: resolvedGgufPath,
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

