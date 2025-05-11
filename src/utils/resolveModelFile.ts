import path from "path";
import fs from "fs-extra";
import chalk from "chalk";
import {cliModelsDirectory} from "../config.js";
import {getReadablePath} from "../cli/utils/getReadablePath.js";
import {resolveSplitGgufParts} from "../gguf/utils/resolveSplitGgufParts.js";
import {resolveModelDestination} from "./resolveModelDestination.js";
import {ModelFileAccessTokens} from "./modelFileAccessTokens.js";
import {ModelDownloadEndpoints} from "./modelDownloadEndpoints.js";
import {createModelDownloader} from "./createModelDownloader.js";
import {genericFilePartNumber} from "./parseModelUri.js";
import {isFilePartText} from "./parseModelFileName.js";
import {pushAll} from "./pushAll.js";


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
     * Configure the URLs used for resolving model URIs.
     * @see [Model URIs](https://node-llama-cpp.withcat.ai/guide/downloading-models#model-uris)
     */
    endpoints?: ModelDownloadEndpoints,

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
 *     "hf:user/model:quant",
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
        endpoints,
        signal
    } = typeof optionsOrDirectory === "string"
        ? {directory: optionsOrDirectory}
        : (optionsOrDirectory ?? {});

    const resolvedDirectory = directory || cliModelsDirectory;
    const resolvedCli = cli == null ? true : cli;
    let resolvedVerify = verify ?? false;

    if (download === false)
        resolvedVerify = false;

    const resolvedModelDestination = resolveModelDestination(uriOrPath, undefined, endpoints);

    if (resolvedModelDestination.type === "file") {
        const resolvedFilePath = path.resolve(resolvedDirectory, uriOrPath);

        if (await fs.pathExists(resolvedFilePath))
            return resolvedFilePath;

        throw new Error(`No model file found at "${resolvedFilePath}"`);
    }

    const expectedFileNames: string[] = fileName != null
        ? [fileName]
        : [];

    if (expectedFileNames.length === 0 && resolvedModelDestination.type === "uri") {
        if (resolvedModelDestination.parsedUri.type === "resolved")
            expectedFileNames.push(resolvedModelDestination.parsedUri.fullFilename);
        else
            pushAll(expectedFileNames, resolvedModelDestination.parsedUri.possibleFullFilenames);
    } else if (expectedFileNames.length === 0 && resolvedModelDestination.type === "url") {
        const enforcedParsedUrl = resolveModelDestination(uriOrPath, true, endpoints);
        if (enforcedParsedUrl != null && enforcedParsedUrl.type === "uri") {
            if (enforcedParsedUrl.parsedUri.type === "resolved")
                expectedFileNames.push(enforcedParsedUrl.parsedUri.fullFilename);
            else
                pushAll(expectedFileNames, enforcedParsedUrl.parsedUri.possibleFullFilenames);
        }
    }

    const foundExpectedFilePath = await findMatchingFilesInDirectory(resolvedDirectory, expectedFileNames);

    if (foundExpectedFilePath != null && !resolvedVerify) {
        const allGgufParts = resolveSplitGgufParts(foundExpectedFilePath);
        if (allGgufParts.length === 1 && allGgufParts[0] === foundExpectedFilePath)
            return foundExpectedFilePath;

        const allPartsExist = await Promise.all(allGgufParts.map((part) => fs.pathExists(part)));
        if (allGgufParts.length > 0) {
            if (allPartsExist.every((exists) => exists))
                return allGgufParts[0]!;
            else if (download === false)
                throw new Error(`Not all split parts of the model file "${allGgufParts[0]}" are present in the same directory`);
        }
    }

    if (download === false) {
        if (expectedFileNames.length === 1)
            throw new Error(`No model file found at "${path.join(resolvedDirectory, expectedFileNames[0]!)}" and download is disabled`);

        throw new Error(`No model file found for "${uriOrPath}" at "${resolvedDirectory}" and download is disabled`);
    }

    if (signal?.aborted)
        throw signal.reason;

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
        tokens,
        endpoints
    });

    if (foundExpectedFilePath != null && downloader.totalFiles === 1 && await fs.pathExists(downloader.entrypointFilePath)) {
        const fileStats = await fs.stat(foundExpectedFilePath);

        if (downloader.totalSize === fileStats.size) {
            await downloader.cancel({deleteTempFile: false});
            return foundExpectedFilePath;
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

async function findMatchingFilesInDirectory(dirPath: string, fileNames: (string | `${string}${typeof genericFilePartNumber}${string}`)[]) {
    let directoryFileNames: string[] | undefined = undefined;

    if (!(await fs.pathExists(dirPath)) || !(await fs.stat(dirPath)).isDirectory())
        return undefined;

    for (const expectedFileName of fileNames) {
        if (expectedFileName.includes(genericFilePartNumber)) {
            const [firstPart, ...restParts] = expectedFileName.split(genericFilePartNumber);
            const resolvedFirstPart = firstPart || "";
            const resolvedLastParts = restParts.join(genericFilePartNumber);

            if (directoryFileNames == null)
                directoryFileNames = (await fs.readdir(dirPath, {withFileTypes: true}))
                    .filter((item) => item.isFile())
                    .map((item) => item.name);

            for (const directoryFileName of directoryFileNames) {
                if (directoryFileName.startsWith(resolvedFirstPart) && directoryFileName.endsWith(resolvedLastParts)) {
                    const numberPart = directoryFileName.slice(resolvedFirstPart.length, -resolvedLastParts.length);
                    if (isFilePartText(numberPart))
                        return path.join(dirPath, directoryFileName);
                }
            }

            continue;
        }

        const testPath = path.join(dirPath, expectedFileName);
        if (await fs.pathExists(testPath))
            return testPath;
    }

    return undefined;
}
