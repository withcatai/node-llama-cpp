import process from "process";
import path from "path";
import {DownloadEngineMultiDownload, DownloadEngineNodejs, downloadFile, downloadSequence} from "ipull";
import fs from "fs-extra";
import chalk from "chalk";
import {createSplitPartFilename, resolveSplitGgufParts} from "../gguf/utils/resolveSplitGgufParts.js";
import {getFilenameForBinarySplitGgufPartUrls, resolveBinarySplitGgufPartUrls} from "../gguf/utils/resolveBinarySplitGgufPartUrls.js";
import {cliModelsDirectory, isCI} from "../config.js";
import {safeEventCallback} from "./safeEventCallback.js";
import {ModelFileAccessTokens, resolveModelFileAccessTokensTryHeaders} from "./modelFileAccessTokens.js";
import {ModelDownloadEndpoints} from "./modelDownloadEndpoints.js";
import {pushAll} from "./pushAll.js";
import {resolveModelDestination} from "./resolveModelDestination.js";
import {getAuthorizationHeader, resolveParsedModelUri} from "./parseModelUri.js";
import withOra from "./withOra.js";

export type ModelDownloaderOptions = ({
    /**
     * The URI to download the model from.
     *
     * The supported URI schemes are:
     * - **HTTP:** `https://`, `http://`
     * - **Hugging Face:** `hf:<user>/<model>:<quant>` (`:<quant>` is optional, but recommended)
     * - **Hugging Face:** `hf:<user>/<model>/<file-path>#<branch>` (`#<branch>` is optional)
     */
    modelUri: string
} | {
    /**
     * @hidden
     * @deprecated Use `modelUri` instead.
     */
    modelUrl: string
}) & {
    /**
     * The directory to save the model file to.
     * Default to `node-llama-cpp`'s default global models directory (`~/.node-llama-cpp/models`).
     */
    dirPath?: string,

    fileName?: string,
    headers?: Record<string, string>,

    /**
     * Defaults to `false`.
     */
    showCliProgress?: boolean,

    onProgress?: (status: {totalSize: number, downloadedSize: number}) => void,

    /**
     * If true, the downloader will skip the download if the file already exists, and its size matches the size of the remote file.
     *
     * Defaults to `true`.
     */
    skipExisting?: boolean,

    /**
     * If true, the temporary file will be deleted when the download is canceled.
     *
     * Defaults to `true`.
     */
    deleteTempFileOnCancel?: boolean,

    /**
     * The number of parallel downloads to use when downloading split files.
     *
     * Defaults to `4`.
     */
    parallelDownloads?: number,

    /**
     * Tokens to use to access the remote model file when downloading.
     */
    tokens?: ModelFileAccessTokens,

    /**
     * Configure the URLs used for resolving model URIs.
     * @see [Model URIs](https://node-llama-cpp.withcat.ai/guide/downloading-models#model-uris)
     */
    endpoints?: ModelDownloadEndpoints,

    /** @internal */
    _showUriResolvingProgress?: boolean
};

/**
 * Create a model downloader to download a model from a URI.
 * Uses [`ipull`](https://github.com/ido-pluto/ipull) to download a model file as fast as possible with parallel connections
 * and other optimizations.
 *
 * If the uri points to a `.gguf` file that is split into multiple parts (for example, `model-00001-of-00009.gguf`),
 * all the parts will be downloaded to the specified directory.
 *
 * If the uri points to a `.gguf` file that is binary split into multiple parts (for example, `model.gguf.part1of9`),
 * all the parts will be spliced into a single file and be downloaded to the specified directory.
 *
 * If the uri points to a `.gguf` file that is not split or binary spliced (for example, `model.gguf`),
 * the file will be downloaded to the specified directory.
 *
 * The supported URI schemes are:
 * - **HTTP:** `https://`, `http://`
 * - **Hugging Face:** `hf:<user>/<model>:<quant>` (`:<quant>` is optional, but recommended)
 * - **Hugging Face:** `hf:<user>/<model>/<file-path>#<branch>` (`#<branch>` is optional)
 * @example
 * ```typescript
 * import {fileURLToPath} from "url";
 * import path from "path";
 * import {createModelDownloader, getLlama} from "node-llama-cpp";
 *
 * const __dirname = path.dirname(fileURLToPath(import.meta.url));
 *
 * const downloader = await createModelDownloader({
 *     modelUri: "https://example.com/model.gguf",
 *     dirPath: path.join(__dirname, "models")
 * });
 * const modelPath = await downloader.download();
 *
 * const llama = await getLlama();
 * const model = await llama.loadModel({
 *     modelPath
 * });
 * ```
 * @example
 * ```typescript
 * import {fileURLToPath} from "url";
 * import path from "path";
 * import {createModelDownloader, getLlama} from "node-llama-cpp";
 *
 * const __dirname = path.dirname(fileURLToPath(import.meta.url));
 *
 * const downloader = await createModelDownloader({
 *     modelUri: "hf:user/model:quant",
 *     dirPath: path.join(__dirname, "models")
 * });
 * const modelPath = await downloader.download();
 *
 * const llama = await getLlama();
 * const model = await llama.loadModel({
 *     modelPath
 * });
 * ```
 */
export function createModelDownloader(options: ModelDownloaderOptions) {
    return ModelDownloader._create(options);
}

/**
 * Combine multiple models downloaders to a single downloader to download everything using as much parallelism as possible.
 *
 * You can check each individual model downloader for its download progress,
 * but only the `onProgress` passed to the combined downloader will be called during the download.
 *
 * When combining `ModelDownloader` instances, the following options on each individual `ModelDownloader` are ignored:
 * - `showCliProgress`
 * - `onProgress`
 * - `parallelDownloads`
 *
 * To set any of those options for the combined downloader, you have to pass them to the combined downloader instance.
 * @example
 * ```typescript
 * import {fileURLToPath} from "url";
 * import path from "path";
 * import {createModelDownloader, combineModelDownloaders, getLlama} from "node-llama-cpp";
 *
 * const __dirname = path.dirname(fileURLToPath(import.meta.url));
 *
 * const downloaders = [
 *     createModelDownloader({
 *         modelUri: "https://example.com/model1.gguf",
 *         dirPath: path.join(__dirname, "models")
 *     }),
 *     createModelDownloader({
 *         modelUri: "hf:user/model2:quant",
 *         dirPath: path.join(__dirname, "models")
 *     }),
 *     createModelDownloader({
 *         modelUri: "hf:user/model/model3.gguf",
 *         dirPath: path.join(__dirname, "models")
 *     })
 * ];
 * const combinedDownloader = await combineModelDownloaders(downloaders, {
 *     showCliProgress: true // show download progress in the CLI
 * });
 * const [
 *     model1Path,
 *     model2Path,
 *     model3Path
 * ] = await combinedDownloader.download();
 *
 * const llama = await getLlama();
 * const model1 = await llama.loadModel({
 *     modelPath: model1Path!
 * });
 * const model2 = await llama.loadModel({
 *     modelPath: model2Path!
 * });
 * const model3 = await llama.loadModel({
 *     modelPath: model3Path!
 * });
 * ```
 */
export async function combineModelDownloaders(
    downloaders: (ModelDownloader | Promise<ModelDownloader>)[],
    options?: CombinedModelDownloaderOptions
) {
    const downloader = CombinedModelDownloader._create(await Promise.all(downloaders), options);
    await downloader._init();
    return downloader;
}

export class ModelDownloader {
    /** @internal */ private readonly _modelUrl: string;
    /** @internal */ private readonly _dirPath: string;
    /** @internal */ private readonly _fileName?: string;
    /** @internal */ private readonly _headers?: Record<string, string>;
    /** @internal */ private readonly _showCliProgress: boolean;
    /** @internal */ private readonly _onProgress?: ModelDownloaderOptions["onProgress"];
    /** @internal */ private readonly _tokens?: ModelFileAccessTokens;
    /** @internal */ private readonly _endpoints?: ModelDownloadEndpoints;
    /** @internal */ public readonly _deleteTempFileOnCancel: boolean;
    /** @internal */ private readonly _skipExisting: boolean;
    /** @internal */ private readonly _parallelDownloads: number;

    /** @internal */ public _specificFileDownloaders: DownloadEngineNodejs[] = [];
    /** @internal */ private _downloader?: DownloadEngineMultiDownload | DownloadEngineNodejs;
    /** @internal */ private _entrypointFilename?: string;
    /** @internal */ private _splitBinaryParts?: number;
    /** @internal */ private _totalFiles?: number;
    /** @internal */ private _tryHeaders: Record<string, string>[] = [];

    private constructor(options: ModelDownloaderOptions, {resolvedModelUrl, resolvedFileName}: {
        resolvedModelUrl: string,
        resolvedFileName?: string
    }) {
        const {
            dirPath = cliModelsDirectory, headers, showCliProgress = false, onProgress, deleteTempFileOnCancel = true,
            skipExisting = true, parallelDownloads = 4, tokens, endpoints
        } = options;

        this._modelUrl = resolvedModelUrl;
        this._dirPath = path.resolve(process.cwd(), dirPath);
        this._fileName = resolvedFileName;
        this._headers = headers;
        this._showCliProgress = showCliProgress;
        this._onProgress = safeEventCallback(onProgress);
        this._deleteTempFileOnCancel = deleteTempFileOnCancel;
        this._skipExisting = skipExisting;
        this._parallelDownloads = parallelDownloads;
        this._tokens = tokens;
        this._endpoints = endpoints;

        this._onDownloadProgress = this._onDownloadProgress.bind(this);
    }

    /**
     * The filename of the entrypoint file that should be used to load the model.
     */
    public get entrypointFilename() {
        return this._entrypointFilename!;
    }

    /**
     * The full path to the entrypoint file that should be used to load the model.
     */
    public get entrypointFilePath() {
        return path.join(this._dirPath, this.entrypointFilename);
    }

    /**
     * If the model is binary spliced from multiple parts, this will return the number of those binary parts.
     */
    public get splitBinaryParts() {
        return this._splitBinaryParts;
    }

    /**
     * The total number of files that will be saved to the directory.
     * For split files, this will be the number of split parts, as multiple files will be saved.
     * For binary-split files, this will be 1, as the parts will be spliced into a single file.
     */
    public get totalFiles() {
        return this._totalFiles!;
    }

    public get totalSize() {
        return this._specificFileDownloaders
            .map((downloader) => downloader.status.totalBytes)
            .reduce((acc, totalBytes) => acc + totalBytes, 0);
    }

    public get downloadedSize() {
        return this._specificFileDownloaders
            .map((downloader) => downloader.status.transferredBytes)
            .reduce((acc, transferredBytes) => acc + transferredBytes, 0);
    }

    /**
     * @returns The path to the entrypoint file that should be used to load the model
     */
    public async download({
        signal
    }: {
        signal?: AbortSignal
    } = {}) {
        if (signal?.aborted)
            throw signal.reason;

        const onAbort = () => {
            signal?.removeEventListener("abort", onAbort);
            this.cancel();
        };

        if (signal != null)
            signal.addEventListener("abort", onAbort);

        try {
            if (this._onProgress)
                this._downloader!.on("progress", this._onDownloadProgress);

            await this._downloader!.download();
        } catch (err) {
            if (signal?.aborted)
                throw signal.reason;

            throw err;
        } finally {
            if (this._onProgress)
                this._downloader!.off("progress", this._onDownloadProgress);

            if (signal != null)
                signal.removeEventListener("abort", onAbort);
        }

        return this.entrypointFilePath;
    }

    public async cancel({
        deleteTempFile = this._deleteTempFileOnCancel
    }: {
        /**
         * Delete the temporary file that was created during the download.
         *
         * Defaults to the value of `deleteTempFileOnCancel` in the constructor.
         */
        deleteTempFile?: boolean
    } = {}) {
        for (const downloader of this._specificFileDownloaders)
            await downloader.close({deleteTempFile});

        if (this._downloader !== this._specificFileDownloaders[0])
            await this._downloader?.close({deleteTempFile});
    }

    /** @internal */
    private _onDownloadProgress() {
        this._onProgress?.({
            totalSize: this.totalSize,
            downloadedSize: this.downloadedSize
        });
    }

    /** @internal */
    private async resolveTryHeaders() {
        if (this._tokens == null)
            return;

        pushAll(
            this._tryHeaders,
            await resolveModelFileAccessTokensTryHeaders(this._modelUrl, this._tokens, this._endpoints, this._headers)
        );
    }

    /** @internal */
    public async _init() {
        await this.resolveTryHeaders();
        const binarySplitPartUrls = resolveBinarySplitGgufPartUrls(this._modelUrl);

        await fs.ensureDir(this._dirPath);
        if (binarySplitPartUrls instanceof Array) {
            this._downloader = await downloadFile({
                partURLs: binarySplitPartUrls,
                directory: this._dirPath,
                fileName: this._fileName ?? getFilenameForBinarySplitGgufPartUrls(binarySplitPartUrls),
                cliProgress: this._showCliProgress,
                cliStyle: isCI ? "ci" : "fancy",
                headers: this._headers ?? {},
                tryHeaders: this._tryHeaders.slice(),
                skipExisting: this._skipExisting
            });
            this._specificFileDownloaders.push(this._downloader);

            this._entrypointFilename = this._downloader.fileName;
            this._splitBinaryParts = binarySplitPartUrls.length;
            this._totalFiles = 1;

            if (this._downloader.fileName == null || this._downloader.fileName === "")
                throw new Error("Failed to get the file name from the given URL");

            return;
        }

        const splitGgufPartUrls = resolveSplitGgufParts(this._modelUrl);
        if (splitGgufPartUrls.length === 1) {
            this._downloader = await downloadFile({
                url: splitGgufPartUrls[0]!,
                directory: this._dirPath,
                fileName: this._fileName ?? undefined,
                cliProgress: this._showCliProgress,
                cliStyle: isCI ? "ci" : "fancy",
                headers: this._headers ?? {},
                tryHeaders: this._tryHeaders.slice(),
                skipExisting: this._skipExisting
            });
            this._specificFileDownloaders.push(this._downloader);

            this._entrypointFilename = this._downloader.fileName;
            this._totalFiles = 1;

            if (this._downloader.fileName == null || this._downloader.fileName === "")
                throw new Error("Failed to get the file name from the given URL");

            return;
        }

        const partDownloads = splitGgufPartUrls.map((url, index) => downloadFile({
            url,
            directory: this._dirPath,
            fileName: this._fileName != null
                ? createSplitPartFilename(this._fileName, index + 1, splitGgufPartUrls.length)
                : undefined,
            headers: this._headers ?? {},
            tryHeaders: this._tryHeaders.slice(),
            skipExisting: this._skipExisting
        }));

        this._downloader = await downloadSequence(
            {
                cliProgress: this._showCliProgress,
                cliStyle: isCI ? "ci" : "fancy",
                parallelDownloads: this._parallelDownloads
            },
            ...partDownloads
        );
        const firstDownload = await partDownloads[0]!;
        this._specificFileDownloaders = await Promise.all(partDownloads);

        this._entrypointFilename = firstDownload.fileName;
        this._totalFiles = partDownloads.length;

        if (this._entrypointFilename == null || this._entrypointFilename === "")
            throw new Error("Failed to get the file name from the given URL");

        return;
    }

    /** @internal */
    public static async _create(options: ModelDownloaderOptions) {
        const {
            modelUri, modelUrl, dirPath = cliModelsDirectory, fileName, _showUriResolvingProgress = false
        } = options as ModelDownloaderOptions & {
            modelUri?: string,
            modelUrl?: string
        };
        const resolvedModelUri = modelUri || modelUrl;

        if (resolvedModelUri == null || dirPath == null)
            throw new Error("modelUri and dirPath cannot be null");

        async function getModelUrlAndFilename(): Promise<{
            resolvedModelUrl: string,
            resolvedFileName?: string
        }> {
            const resolvedModelDestination = resolveModelDestination(resolvedModelUri!, undefined, options.endpoints);

            if (resolvedModelDestination.type == "file")
                return {
                    resolvedModelUrl: path.resolve(dirPath, resolvedModelDestination.path),
                    resolvedFileName: fileName
                };
            else if (resolvedModelDestination.type === "url")
                return {
                    resolvedModelUrl: resolvedModelDestination.url,
                    resolvedFileName: fileName
                };
            else if (resolvedModelDestination.parsedUri.type === "resolved")
                return {
                    resolvedModelUrl: resolvedModelDestination.parsedUri.resolvedUrl,
                    resolvedFileName: fileName || resolvedModelDestination.parsedUri.fullFilename
                };

            const resolvedUri = _showUriResolvingProgress
                ? await withOra({
                    loading: chalk.blue("Resolving model URI"),
                    success: chalk.blue("Resolved model URI"),
                    fail: chalk.blue("Failed to resolve model URI"),
                    noSuccessLiveStatus: true
                }, () => {
                    return resolveParsedModelUri(resolvedModelDestination.parsedUri, {
                        tokens: options.tokens,
                        endpoints: options.endpoints,
                        authorizationHeader: getAuthorizationHeader(options.headers)
                    });
                })
                : await resolveParsedModelUri(resolvedModelDestination.parsedUri, {
                    tokens: options.tokens,
                    endpoints: options.endpoints,
                    authorizationHeader: getAuthorizationHeader(options.headers)
                });

            return {
                resolvedModelUrl: resolvedUri.resolvedUrl,
                resolvedFileName: fileName || resolvedUri.fullFilename
            };
        }

        const modelDownloader = new ModelDownloader(options, await getModelUrlAndFilename());
        await modelDownloader._init();
        return modelDownloader;
    }
}

export type CombinedModelDownloaderOptions = {
    /**
     * Defaults to `false`.
     */
    showCliProgress?: boolean,

    onProgress?: (status: {totalSize: number, downloadedSize: number}) => void,

    /**
     * The number of parallel downloads to use fo files.
     *
     * Defaults to `4`.
     */
    parallelDownloads?: number
};

export class CombinedModelDownloader {
    /** @internal */ private readonly _downloaders: readonly ModelDownloader[];
    /** @internal */ private readonly _showCliProgress: boolean;
    /** @internal */ private readonly _onProgress?: CombinedModelDownloaderOptions["onProgress"];
    /** @internal */ private readonly _parallelDownloads: number;
    /** @internal */ private readonly _lock = {};
    /** @internal */ private _downloader?: DownloadEngineMultiDownload;

    /**
     * When combining `ModelDownloader` instances, the following options on each individual `ModelDownloader` are ignored:
     * - `showCliProgress`
     * - `onProgress`
     * - `parallelDownloads`
     *
     * To set any of those options for the combined downloader, you have to pass them to the combined downloader instance
     */
    private constructor(downloaders: ModelDownloader[], options?: CombinedModelDownloaderOptions) {
        const {
            showCliProgress = false,
            onProgress,
            parallelDownloads = 4
        } = options ?? {};

        this._downloaders = Object.freeze(downloaders);
        this._showCliProgress = showCliProgress;
        this._onProgress = onProgress;
        this._parallelDownloads = parallelDownloads;

        this._onDownloadProgress = this._onDownloadProgress.bind(this);
    }

    public async cancel() {
        for (const modelDownloader of this._downloaders) {
            if (modelDownloader._specificFileDownloaders.every(
                (downloader) => downloader.status.downloadStatus === "Finished"
            ))
                continue;

            for (const downloader of modelDownloader._specificFileDownloaders)
                await downloader.close({
                    deleteTempFile: modelDownloader._deleteTempFileOnCancel
                });
        }
    }

    /**
     * @returns The paths to the entrypoint files that should be used to load the models
     */
    public async download({
        signal
    }: {
        signal?: AbortSignal
    } = {}) {
        if (signal?.aborted)
            throw signal.reason;

        const onAbort = () => {
            signal?.removeEventListener("abort", onAbort);
            this.cancel();
        };

        if (signal != null)
            signal.addEventListener("abort", onAbort);

        try {
            if (this._onProgress)
                this._downloader!.on("progress", this._onDownloadProgress);

            await this._downloader!.download();
        } catch (err) {
            if (signal?.aborted)
                throw signal.reason;

            throw err;
        } finally {
            if (this._onProgress)
                this._downloader!.off("progress", this._onDownloadProgress);

            if (signal != null)
                signal.removeEventListener("abort", onAbort);
        }

        return this.entrypointFilePaths;
    }

    public get modelDownloaders(): readonly ModelDownloader[] {
        return this._downloaders;
    }

    /**
     * The filename of the entrypoint files that should be used to load the models.
     */
    public get entrypointFilenames() {
        return this._downloaders.map((downloader) => downloader.entrypointFilename);
    }

    /**
     * The full paths to the entrypoint files that should be used to load the models.
     */
    public get entrypointFilePaths() {
        return this._downloaders.map((downloader) => downloader.entrypointFilePath);
    }

    /**
     * The accumulation of `totalFiles` of all the model downloaders
     */
    public get totalFiles() {
        return this._downloaders
            .map((downloader) => downloader.totalFiles)
            .reduce((acc, totalFiles) => acc + totalFiles, 0);
    }

    public get totalSize() {
        return this._downloaders
            .map((downloader) => downloader.totalSize)
            .reduce((acc, totalBytes) => acc + totalBytes, 0);
    }

    public get downloadedSize() {
        return this._downloaders
            .map((downloader) => downloader.downloadedSize)
            .reduce((acc, transferredBytes) => acc + transferredBytes, 0);
    }

    /** @internal */
    private _onDownloadProgress() {
        this._onProgress?.({
            totalSize: this.totalSize,
            downloadedSize: this.downloadedSize
        });
    }

    /** @internal */
    public async _init() {
        this._downloader = await downloadSequence(
            {
                cliProgress: this._showCliProgress,
                cliStyle: isCI ? "ci" : "fancy",
                parallelDownloads: this._parallelDownloads
            },
            ...this._downloaders.flatMap((downloader) => downloader._specificFileDownloaders)
        );
    }

    /** @internal */
    public static _create(downloaders: ModelDownloader[], options?: CombinedModelDownloaderOptions) {
        return new CombinedModelDownloader(downloaders, options);
    }
}
