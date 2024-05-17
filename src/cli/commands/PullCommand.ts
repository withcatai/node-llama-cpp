import process from "process";
import {CommandModule} from "yargs";
import fs from "fs-extra";
import chalk from "chalk";
import {cliModelsDirectory, documentationPageUrls} from "../../config.js";
import {createModelDownloader} from "../../utils/createModelDownloader.js";
import {getReadablePath} from "../utils/getReadablePath.js";
import {ConsoleInteraction, ConsoleInteractionKey} from "../utils/ConsoleInteraction.js";
import {getIsInDocumentationMode} from "../../state.js";
import {resolveHeaderFlag} from "../utils/resolveHeaderFlag.js";
import {withCliCommandDescriptionDocsUrl} from "../utils/withCliCommandDescriptionDocsUrl.js";

type PullCommand = {
    url: string,
    header?: string[],
    override: boolean,
    noProgress: boolean,
    noTempFile: boolean,
    directory: string,
    filename?: string
};

export const PullCommand: CommandModule<object, PullCommand> = {
    command: "pull [url]",
    aliases: ["get"],
    describe: withCliCommandDescriptionDocsUrl(
        "Download a model from a URL",
        documentationPageUrls.CLI.Pull
    ),
    builder(yargs) {
        const isInDocumentationMode = getIsInDocumentationMode();

        return yargs
            .option("url", {
                type: "string",
                description: [
                    "A `.gguf` model URL to pull.",
                    "Automatically handles split and binary-split models files.",
                    "If a file already exists and its size matches the expected size, it will not be downloaded again unless the `--override` flag is used."
                ].join(
                    isInDocumentationMode
                        ? "\n"
                        : " "
                ),
                demandOption: true,
                group: "Required:"
            })
            .option("header", {
                alias: ["H"],
                type: "string",
                array: true,
                description: "Headers to use when downloading a model from a URL, in the format `key: value`. You can pass this option multiple times to add multiple headers.",
                group: "Optional:"
            })
            .option("override", {
                alias: ["o"],
                type: "boolean",
                description: "Override the model file if it already exists",
                default: false,
                group: "Optional:"
            })
            .option("noProgress", {
                type: "boolean",
                description: "Do not show a progress bar while downloading",
                default: false,
                group: "Optional:"
            })
            .option("noTempFile", {
                alias: ["noTemp"],
                type: "boolean",
                description: "Delete the temporary file when canceling the download",
                default: false,
                group: "Optional:"
            })
            .option("directory", {
                alias: ["d", "dir"],
                type: "string",
                description: "Directory to save the model to",
                default: cliModelsDirectory,
                defaultDescription: isInDocumentationMode
                    ? "`" + getReadablePath(cliModelsDirectory) + "`"
                    : getReadablePath(cliModelsDirectory),
                group: "Optional:"
            })
            .option("filename", {
                alias: ["n", "name"],
                type: "string",
                description: "Filename to save the model as",
                group: "Optional:"
            });
    },
    async handler({url, header: headerArg, override, noProgress, noTempFile, directory, filename}: PullCommand) {
        const headers = resolveHeaderFlag(headerArg);

        const downloader = await createModelDownloader({
            modelUrl: url,
            dirPath: directory,
            headers,
            showCliProgress: !noProgress,
            deleteTempFileOnCancel: noTempFile,
            skipExisting: !override,
            fileName: filename || undefined
        });

        if (downloader.totalFiles === 1 && await fs.pathExists(downloader.entrypointFilePath)) {
            const fileStats = await fs.stat(downloader.entrypointFilePath);

            if (downloader.totalSize === fileStats.size) {
                console.info(`${chalk.yellow("File:")} ${getReadablePath(downloader.entrypointFilePath)}`);

                if (noProgress)
                    console.info(downloader.entrypointFilePath);
                else
                    console.info("Skipping download of an existing file: " + chalk.yellow(getReadablePath(downloader.entrypointFilePath)));

                process.exit(0);
            }
        }

        const consoleInteraction = new ConsoleInteraction();
        consoleInteraction.onKey(ConsoleInteractionKey.ctrlC, async () => {
            await downloader.cancel();
            consoleInteraction.stop();
            process.exit(0);
        });

        if (!noProgress) {
            console.info(`Downloading to ${chalk.yellow(getReadablePath(directory))}${
                downloader.splitBinaryParts != null
                    ? chalk.gray(` (combining ${downloader.splitBinaryParts} parts into a single file)`)
                    : ""
            }`);
            consoleInteraction.start();
        }

        await downloader.download();

        if (!noProgress)
            consoleInteraction.stop();

        if (noProgress)
            console.info(downloader.entrypointFilePath);
        else
            console.info(`Downloaded to ${chalk.yellow(getReadablePath(downloader.entrypointFilePath))}`);
    }
};
