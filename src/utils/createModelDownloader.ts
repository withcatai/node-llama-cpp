import process from "process";
import path from "path";
import {DownloadEngineMultiDownload, DownloadEngineNodejs, downloadFile, downloadSequence} from "ipull";
import fs from "fs-extra";
import {normalizeGgufDownloadUrl} from "../gguf/utils/normalizeGgufDownloadUrl.js";
import {createSplitPartFilename, resolveSplitGgufParts} from "../gguf/utils/resolveSplitGgufParts.js";
import {getFilenameForBinarySplitGgufPartUrls, resolveBinarySplitGgufPartUrls} from "../gguf/utils/resolveBinarySplitGgufPartUrls.js";
import {cliModelsDirectory} from "../config.js";
import {safeEventCallback} from "./safeEventCallback.js";

export type ModelDownloaderOptions = {
    modelUrl: string,

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
    parallelDownloads?: number
};

/**
 * Create a model downloader to download a model from a URL.
 * Uses [`ipull`](https://github.com/ido-pluto/ipull) to download a model file as fast as possible with parallel connections
 * and other optimizations.
 *
 * If the url points to a `.gguf` file that is split into multiple parts (for example, `model-00001-of-00009.gguf`),
 * all the parts will be downloaded to the specified directory.
 *
 * If the url points to a `.gguf` file that is binary spliced into multiple parts (for example, `model.gguf.part1of9`),
 * all the parts will be spliced into a single file and be downloaded to the specified directory.
 *
 * If the url points to a `.gguf` file that is not split or binary spliced (for example, `model.gguf`),
 * the file will be downloaded to the specified directory.
 * @example
 * ```typescript
 * import {fileURLToPath} from "url";
 * import path from "path";
 * import {createModelDownloader, getLlama} from "node-llama-cpp";
 *
 * const __dirname = path.dirname(fileURLToPath(import.meta.url));
 *
 * const downloader = await createModelDownloader({
 *     modelUrl: "https://example.com/model.gguf",
 *     dirPath: path.join(__dirname, "models")
 * });
 * const modelPath = await downloader.download();
 *
 * const llama = await getLlama();
 * const model = llama.loadModel({
 *     modelPath
 * });
 * ```
 */
export async function createModelDownloader(options: ModelDownloaderOptions) {
    const downloader = ModelDownloader._create(options);
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
    /** @internal */ private readonly _deleteTempFileOnCancel: boolean;
    /** @internal */ private readonly _skipExisting: boolean;
    /** @internal */ private readonly _parallelDownloads: number;

    /** @internal */ private _downloader?: DownloadEngineMultiDownload | DownloadEngineNodejs;
    /** @internal */ private _specificFileDownloaders: DownloadEngineNodejs[] = [];
    /** @internal */ private _entrypointFilename?: string;
    /** @internal */ private _splitBinaryParts?: number;
    /** @internal */ private _totalFiles?: number;

    private constructor({
        modelUrl, dirPath = cliModelsDirectory, fileName, headers, showCliProgress = false, onProgress, deleteTempFileOnCancel = true,
        skipExisting = true, parallelDownloads = 4
    }: ModelDownloaderOptions) {
        if (modelUrl == null || dirPath == null)
            throw new Error("modelUrl and dirPath cannot be null");

        this._modelUrl = normalizeGgufDownloadUrl(modelUrl);
        this._dirPath = path.resolve(process.cwd(), dirPath);
        this._fileName = fileName;
        this._headers = headers;
        this._showCliProgress = showCliProgress;
        this._onProgress = safeEventCallback(onProgress);
        this._deleteTempFileOnCancel = deleteTempFileOnCancel;
        this._skipExisting = skipExisting;
        this._parallelDownloads = parallelDownloads;

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
        return this._downloader!.downloadStatues
            .map(status => status.totalBytes)
            .reduce((acc, totalBytes) => acc + totalBytes, 0);
    }

    public get downloadedSize() {
        return this._downloader!.downloadStatues
            .map(status => status.transferredBytes)
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

        if (this._skipExisting) {
            if (this._specificFileDownloaders.length === 1 && await fs.pathExists(this.entrypointFilePath)) {
                const fileStat = await fs.stat(this.entrypointFilePath);

                if (this._specificFileDownloaders[0].status.totalBytes === fileStat.size)
                    return this.entrypointFilePath;
            } else {
                // TODO: skip existing split files
            }
        }

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
        for (const downloader of this._specificFileDownloaders) {
            if (deleteTempFile)
                await downloader.closeAndDeleteFile();
            else
                await downloader.close();
        }

        if (this._downloader !== this._specificFileDownloaders[0])
            await this._downloader?.close();
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
        const binarySplitPartUrls = resolveBinarySplitGgufPartUrls(this._modelUrl);

        await fs.ensureDir(this._dirPath);
        if (binarySplitPartUrls instanceof Array) {
            this._downloader = await downloadFile({
                partURLs: binarySplitPartUrls,
                directory: this._dirPath,
                fileName: this._fileName ?? getFilenameForBinarySplitGgufPartUrls(binarySplitPartUrls),
                cliProgress: this._showCliProgress,
                headers: this._headers ?? {}
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
                url: splitGgufPartUrls[0],
                directory: this._dirPath,
                fileName: this._fileName ?? undefined,
                cliProgress: this._showCliProgress,
                headers: this._headers ?? {}
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
            headers: this._headers ?? {}
        }));

        this._downloader = await downloadSequence(
            {
                cliProgress: this._showCliProgress,
                parallelDownloads: this._parallelDownloads
            },
            ...partDownloads
        );
        const firstDownload = await partDownloads[0];
        this._specificFileDownloaders = await Promise.all(partDownloads);

        this._entrypointFilename = firstDownload.fileName;
        this._totalFiles = partDownloads.length;

        if (this._entrypointFilename == null || this._entrypointFilename === "")
            throw new Error("Failed to get the file name from the given URL");

        return;
    }

    /** @internal */
    public static _create(options: ModelDownloaderOptions) {
        return new ModelDownloader(options);
    }
}
