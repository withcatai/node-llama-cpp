import process from "process";
import {CommandModule} from "yargs";
import fs from "fs-extra";
import chalk from "chalk";
import {cliModelsDirectory, documentationPageUrls} from "../../config.js";
import {combineModelDownloaders, createModelDownloader} from "../../utils/createModelDownloader.js";
import {getReadablePath} from "../utils/getReadablePath.js";
import {ConsoleInteraction, ConsoleInteractionKey} from "../utils/ConsoleInteraction.js";
import {getIsInDocumentationMode} from "../../state.js";
import {resolveHeaderFlag} from "../utils/resolveHeaderFlag.js";
import {withCliCommandDescriptionDocsUrl} from "../utils/withCliCommandDescriptionDocsUrl.js";

type PullCommand = {
    urls: string[],
    header?: string[],
    override: boolean,
    noProgress: boolean,
    noTempFile: boolean,
    directory: string,
    filename?: string,
    parallel?: number
};

export const PullCommand: CommandModule<object, PullCommand> = {
    command: "pull [urls..]",
    aliases: ["get"],
    describe: withCliCommandDescriptionDocsUrl(
        "Download models from URLs",
        documentationPageUrls.CLI.Pull
    ),
    builder(yargs) {
        const isInDocumentationMode = getIsInDocumentationMode();

        return yargs
            .option("urls", {
                type: "string",
                alias: ["url", "uris", "uri"],
                array: true,
                description: [
                    "A `.gguf` model URI to pull.",
                    !isInDocumentationMode && "Automatically handles split and binary-split models files, so only pass the URI to the first file of a model.",
                    !isInDocumentationMode && "If a file already exists and its size matches the expected size, it will not be downloaded again unless the `--override` flag is used.",
                    "Pass multiple URIs to download multiple models at once."
                ].filter(Boolean).join(
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
                description: "Override existing model files",
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
                description: "Filename to save the model as. Can only be used if a single URL is passed",
                group: "Optional:"
            })
            .option("parallel", {
                alias: ["p"],
                type: "number",
                description: "Maximum parallel downloads",
                default: 4,
                group: "Optional:"
            });
    },
    async handler({urls, header: headerArg, override, noProgress, noTempFile, directory, filename, parallel}: PullCommand) {
        const headers = resolveHeaderFlag(headerArg);

        if (urls.length === 0)
            throw new Error("At least one URI must be provided");
        else if (urls.length > 1 && filename != null)
            throw new Error("The `--filename` flag can only be used when a single URI is passed");

        if (urls.length === 1) {
            const downloader = await createModelDownloader({
                modelUri: urls[0]!,
                dirPath: directory,
                headers,
                showCliProgress: !noProgress,
                deleteTempFileOnCancel: noTempFile,
                skipExisting: !override,
                fileName: filename || undefined,
                parallelDownloads: parallel
            });

            if (!override && downloader.totalFiles === 1 && await fs.pathExists(downloader.entrypointFilePath)) {
                const fileStats = await fs.stat(downloader.entrypointFilePath);

                if (downloader.totalSize === fileStats.size) {
                    console.info(`${chalk.yellow("File:")} ${getReadablePath(downloader.entrypointFilePath)}`);
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

            console.info(`Downloaded to ${chalk.yellow(getReadablePath(downloader.entrypointFilePath))}`);
        } else {
            const downloader = await combineModelDownloaders(
                urls.map((uri) => createModelDownloader({
                    modelUri: uri,
                    dirPath: directory,
                    headers,
                    showCliProgress: false,
                    deleteTempFileOnCancel: noTempFile,
                    skipExisting: !override
                })),
                {
                    showCliProgress: !noProgress,
                    parallelDownloads: parallel
                }
            );

            const consoleInteraction = new ConsoleInteraction();
            consoleInteraction.onKey(ConsoleInteractionKey.ctrlC, async () => {
                await downloader.cancel();
                consoleInteraction.stop();
                process.exit(0);
            });

            if (!noProgress) {
                console.info(`Downloading to ${chalk.yellow(getReadablePath(directory))}`);
                consoleInteraction.start();
            }

            await downloader.download();

            if (!noProgress)
                consoleInteraction.stop();

            console.info(
                `Downloaded ${downloader.modelDownloaders.length} models to ${chalk.yellow(getReadablePath(directory))}\n${chalk.gray("*")} ` +
                downloader.modelDownloaders.map((downloader) => chalk.yellow(downloader.entrypointFilename))
                    .join(`\n${chalk.gray("*")} `)
            );
        }
    }
};
