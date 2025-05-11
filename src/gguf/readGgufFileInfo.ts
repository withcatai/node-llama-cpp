import retry from "async-retry";
import {isUrl} from "../utils/isUrl.js";
import {ModelFileAccessTokens} from "../utils/modelFileAccessTokens.js";
import {getAuthorizationHeader, isModelUri, parseModelUri, resolveParsedModelUri} from "../utils/parseModelUri.js";
import {Writable} from "../utils/utilTypes.js";
import {ModelDownloadEndpoints} from "../utils/modelDownloadEndpoints.js";
import {parseGguf} from "./parser/parseGguf.js";
import {GgufNetworkFetchFileReader} from "./fileReaders/GgufNetworkFetchFileReader.js";
import {GgufFsFileReader} from "./fileReaders/GgufFsFileReader.js";
import {ggufDefaultFetchRetryOptions} from "./consts.js";
import {normalizeGgufDownloadUrl} from "./utils/normalizeGgufDownloadUrl.js";
import {resolveSplitGgufParts} from "./utils/resolveSplitGgufParts.js";
import {GgufFileInfo} from "./types/GgufFileInfoTypes.js";
import {GgufTensorInfo} from "./types/GgufTensorInfoTypes.js";


/**
 * Read a GGUF file and return its metadata and tensor info (unless `readTensorInfo` is set to `false`).
 * Only the parts of the file required for the metadata and tensor info are read.
 * @param pathOrUri
 * @param options
 */
export async function readGgufFileInfo(pathOrUri: string, {
    readTensorInfo = true,
    sourceType,
    ignoreKeys = [],
    logWarnings = true,
    fetchRetryOptions = ggufDefaultFetchRetryOptions,
    fetchHeaders = {},
    spliceSplitFiles = true,
    signal,
    tokens,
    endpoints
}: {
    /**
     * Whether to read the tensor info from the file's header.
     *
     * Defaults to `true`.
     */
    readTensorInfo?: boolean,

    /**
     * Set to a specific value to force it to only use that source type.
     * By default, it detects whether the path is a network URL or a filesystem path and uses the appropriate reader accordingly.
     */
    sourceType?: "network" | "filesystem",

    /**
     * Metadata keys to ignore when parsing the metadata.
     * For example, `["tokenizer.ggml.tokens"]`
     */
    ignoreKeys?: string[],

    /**
     * Whether to log warnings
     *
     * Defaults to `true`.
     */
    logWarnings?: boolean,

    /** Relevant only when fetching from a network */
    fetchRetryOptions?: retry.Options,

    /** Relevant only when fetching from a network */
    fetchHeaders?: Record<string, string>,

    /**
     * When split files are detected, read the metadata of the first file and splice the tensor info from all the parts.
     *
     * Defaults to `true`.
     */
    spliceSplitFiles?: boolean,

    signal?: AbortSignal,

    /**
     * Tokens to use to access the remote model file.
     */
    tokens?: ModelFileAccessTokens,

    /**
     * Configure the URLs used for resolving model URIs.
     * @see [Model URIs](https://node-llama-cpp.withcat.ai/guide/downloading-models#model-uris)
     */
    endpoints?: ModelDownloadEndpoints
} = {}) {
    const useNetworkReader = sourceType === "network" || (sourceType == null && (isUrl(pathOrUri) || isModelUri(pathOrUri)));

    async function createFileReader(pathOrUri: string) {
        if (useNetworkReader) {
            const parsedModelUri = await resolveParsedModelUri(parseModelUri(pathOrUri, undefined, endpoints), {
                tokens, endpoints, signal,
                authorizationHeader: getAuthorizationHeader(fetchHeaders)
            });
            return new GgufNetworkFetchFileReader({
                url: parsedModelUri?.resolvedUrl ?? normalizeGgufDownloadUrl(pathOrUri, endpoints),
                retryOptions: fetchRetryOptions,
                headers: fetchHeaders,
                signal,
                tokens,
                endpoints
            });
        } else if (sourceType === "filesystem" || sourceType == null) {
            return new GgufFsFileReader({
                filePath: pathOrUri,
                signal
            });
        }

        void (sourceType satisfies never);
        throw new Error(`Unsupported sourceType: ${sourceType}`);
    }

    async function readSingleFile(pathOrUri: string, splitPartNumber: number = 1) {
        const fileReader = await createFileReader(pathOrUri);
        const res = await parseGguf({
            fileReader,
            ignoreKeys,
            readTensorInfo,
            logWarnings
        });

        if (splitPartNumber > 1) {
            for (const tensor of res.tensorInfo ?? [])
                (tensor as Writable<GgufTensorInfo>).filePart = splitPartNumber;
        }

        return res;
    }

    if (!spliceSplitFiles)
        return await readSingleFile(pathOrUri);

    const allSplitPartPaths = resolveSplitGgufParts(pathOrUri);

    if (allSplitPartPaths.length === 1)
        return await readSingleFile(allSplitPartPaths[0]!);

    const [first, ...rest] = await Promise.all(
        allSplitPartPaths.map((partPath, index) => readSingleFile(partPath, index + 1))
    );

    if (first == null)
        throw new Error("First part of the split GGUF file is missing");

    return {
        version: first.version,
        tensorCount: first.tensorCount,
        metadata: first.metadata,
        architectureMetadata: first.architectureMetadata,
        tensorInfo: first.tensorInfo,
        metadataSize: first.metadataSize,
        splicedParts: allSplitPartPaths.length,
        totalTensorInfoSize: first.totalTensorInfoSize == null
            ? undefined
            : (first.totalTensorInfoSize + rest.reduce((acc, part) => (acc + (part.totalTensorInfoSize ?? 0)), 0)),
        totalTensorCount: Number(first.totalTensorCount) + rest.reduce((acc, part) => acc + Number(part.totalTensorCount), 0),
        totalMetadataSize: first.totalMetadataSize + rest.reduce((acc, part) => acc + part.totalMetadataSize, 0),
        fullTensorInfo: first.fullTensorInfo == null
            ? undefined
            : [first, ...rest].flatMap((part) => (part.fullTensorInfo ?? [])),
        tensorInfoSize: first.tensorInfoSize
    } satisfies GgufFileInfo;
}
