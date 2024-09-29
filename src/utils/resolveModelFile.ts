import path from "path";
import fs from "fs-extra";
import chalk from "chalk";
import {cliModelsDirectory} from "../config.js";
import {getReadablePath} from "../cli/utils/getReadablePath.js";
import {resolveSplitGgufParts} from "../gguf/utils/resolveSplitGgufParts.js";
import {resolveModelDestination} from "./resolveModelDestination.js";
import {ModelFileAccessTokens} from "./modelFileAccesTokens.js";
import {createModelDownloader} from "./createModelDownloader.js";

export type ResolveModelFileOptions = {
    /**
     * The directory to resolve models from, and download models to.
     *
     * Default to `node-llama-cpp`'s default global models directory (`~/.node-llama-cpp/models`).
     */
    directory?: string,

    /**
     * When downloading a model file, whether to download the file if it doesn't exist.
     *
     * - `"auto"`: Download the file if it doesn't exist
     * - `false`: Don't download the file if it doesn't exist. Implies `verify: false` even if `verify` is set to `true`.
     *
     * Defaults to `"auto"`.
     */
    download?: "auto" | false,

    /**
     * When an existing model file that corresponds to the URI is found,
     * verify that it matches the expected size of the remote file.
     *
     * Defaults to `false`.
     */
    verify?: boolean,

    /**
     * The name of the file to be resolved.
     *
     * If provided and existing file is found with the same name, it will be returned.
     *
     * If provided and no existing file is found with the same name, the file will be downloaded with the provided name.
     */
    fileName?: string,

    /**
     * Additional headers to use when downloading a model file.
     */
    headers?: Record<string, string>,

    /**
     * When downloading a model file, show the download progress.
     *
     * Defaults to `true`.
     */
    cli?: boolean,

    /**
     * When downloading a model file, called on download progress
     */
    onProgress?: (status: {totalSize: number, downloadedSize: number}) => void,

    /**
     * If true, the temporary file will be deleted if the download is canceled.
     *
     * Defaults to `true`.
     */
    deleteTempFileOnCancel?: boolean,

    /**
     * The number of parallel downloads to use when downloading split files.
     *
     * Defaults to `4`.
     */
    parallel?: number,

    /**
     * Tokens to use to access the remote model file when downloading.
     */
    tokens?: ModelFileAccessTokens,

    /**
     * The signal to use to cancel a download.
     */
    signal?: AbortSignal
};

/**
 * Resolves a local model file path from a URI or file path, and downloads the necessary files first if needed.
 *
 * If a URL or a URI is given, it'll be resolved to the corresponding file path.
 * If the file path exists, it will be returned, otherwise it will be downloaded and then be returned.
 *
 * If a file path is given, and the path exists, it will be returned, otherwise an error will be thrown.
 *
 * Files are resolved from and downloaded to the `directory` option,
 * which defaults to `node-llama-cpp`'s default global models directory (`~/.node-llama-cpp/models`).
 *
 * Set the `cli` option to `false` to hide the download progress from the console.
 * @example
 * ```typescript
 * import {fileURLToPath} from "url";
 * import path from "path";
 * import {getLlama, resolveModelFile} from "node-llama-cpp";
 *
 * const __dirname = path.dirname(fileURLToPath(import.meta.url));
 *
 * // resolve a model from Hugging Face to the models directory
 * const modelPath = await resolveModelFile(
 *     "hf:user/model/model-file.gguf",
 *     path.join(__dirname, "models")
 * );
 *
 * const llama = await getLlama();
 * const model = await llama.loadModel({modelPath});
 * ```
 * @example
 * ```typescript
 * import {fileURLToPath} from "url";
 * import path from "path";
 * import {getLlama, resolveModelFile} from "node-llama-cpp";
 *
 * const __dirname = path.dirname(fileURLToPath(import.meta.url));
 *
 * // resolve a model from a URL to the models directory
 * const modelPath = await resolveModelFile(
 *     "https://example.com/model.gguf",
 *     path.join(__dirname, "models")
 * );
 *
 * const llama = await getLlama();
 * const model = await llama.loadModel({modelPath});
 * ```
 * @example
 * ```typescript
 * import {fileURLToPath} from "url";
 * import path from "path";
 * import {getLlama, resolveModelFile} from "node-llama-cpp";
 *
 * const __dirname = path.dirname(fileURLToPath(import.meta.url));
 *
 * // resolve a local model that is in the models directory
 * const modelPath = await resolveModelFile(
 *     "model.gguf",
 *     path.join(__dirname, "models")
 * );
 *
 * const llama = await getLlama();
 * const model = await llama.loadModel({modelPath});
 * ```
 * @returns The resolved model file path
 */
export async function resolveModelFile(
    uriOrPath: string,
    optionsOrDirectory?: ResolveModelFileOptions | string
): Promise<string> {
    const {
        directory,
        download = "auto",
        verify = false,
        fileName,
        headers,
        cli = true,
        onProgress,
        deleteTempFileOnCancel = true,
        parallel = 4,
        tokens,
        signal
    } = typeof optionsOrDirectory === "string"
        ? {directory: optionsOrDirectory}
        : (optionsOrDirectory ?? {});

    const resolvedDirectory = directory || cliModelsDirectory;
    const resolvedCli = cli == null ? true : cli;
    let resolvedVerify = verify ?? false;

    if (download === false)
        resolvedVerify = false;

    const resolvedModelDestination = resolveModelDestination(uriOrPath);

    if (resolvedModelDestination.type === "file") {
        const resolvedFilePath = path.resolve(resolvedDirectory, uriOrPath);

        if (await fs.pathExists(resolvedFilePath))
            return resolvedFilePath;

        throw new Error(`No model file found at "${resolvedFilePath}"`);
    }

    let expectedFilePath: string | undefined = fileName != null
        ? path.join(resolvedDirectory, fileName)
        : undefined;

    if (expectedFilePath == null && resolvedModelDestination.type === "uri")
        expectedFilePath = path.join(resolvedDirectory, resolvedModelDestination.parsedUri.fullFilename);
    else if (expectedFilePath == null && resolvedModelDestination.type === "url") {
        const enforcedParsedUrl = resolveModelDestination(uriOrPath, true);
        if (enforcedParsedUrl != null && enforcedParsedUrl.type === "uri")
            expectedFilePath = path.join(resolvedDirectory, enforcedParsedUrl.parsedUri.filename);
    }

    if (expectedFilePath != null && !resolvedVerify && await fs.pathExists(expectedFilePath)) {
        const allGgufParts = resolveSplitGgufParts(expectedFilePath);
        if (allGgufParts.length === 1 && allGgufParts[0] === expectedFilePath)
            return expectedFilePath;

        const allPartsExist = await Promise.all(allGgufParts.map((part) => fs.pathExists(part)));
        if (allGgufParts.length > 0) {
            if (allPartsExist.every((exists) => exists))
                return allGgufParts[0]!;
            else if (download === false)
                throw new Error(`Not all split parts of the model file "${allGgufParts[0]}" are present in the same directory`);
        }
    }

    if (download === false) {
        if (expectedFilePath != null)
            throw new Error(`No model file found at "${expectedFilePath}" and download is disabled`);

        throw new Error(`No model file found for "${uriOrPath}" and download is disabled`);
    }

    const downloader = await createModelDownloader({
        modelUri: resolvedModelDestination.type === "uri"
            ? resolvedModelDestination.uri
            : resolvedModelDestination.url,
        dirPath: resolvedDirectory,
        headers,
        showCliProgress: resolvedCli,
        deleteTempFileOnCancel,
        skipExisting: true,
        fileName: fileName || undefined,
        parallelDownloads: parallel,
        onProgress,
        tokens
    });

    if (expectedFilePath != null && downloader.totalFiles === 1 && await fs.pathExists(downloader.entrypointFilePath)) {
        const fileStats = await fs.stat(expectedFilePath);

        if (downloader.totalSize === fileStats.size) {
            await downloader.cancel({deleteTempFile: false});
            console.log("download canceled");
            return expectedFilePath;
        }
    }

    if (resolvedCli)
        console.info(`Downloading to ${chalk.yellow(getReadablePath(resolvedDirectory))}${
            downloader.splitBinaryParts != null
                ? chalk.gray(` (combining ${downloader.splitBinaryParts} parts into a single file)`)
                : ""
        }`);

    await downloader.download({signal});

    if (resolvedCli)
        console.info(`Downloaded to ${chalk.yellow(getReadablePath(downloader.entrypointFilePath))}`);

    return downloader.entrypointFilePath;
}
