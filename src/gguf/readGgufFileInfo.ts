import retry from "async-retry";
import {parseGguf} from "./parser/parseGguf.js";
import {GgufNetworkFetchFileReader} from "./fileReaders/GgufNetworkFetchFileReader.js";
import {GgufFsFileReader} from "./fileReaders/GgufFsFileReader.js";
import {ggufDefaultFetchRetryOptions} from "./consts.js";
import {normalizeGgufDownloadUrl} from "./utils/normalizeGgufDownloadUrl.js";


/**
 * Read a GGUF file and return its metadata and tensor info (unless `readTensorInfo` is set to `false`).
 * Only the parts of the file required for the metadata and tensor info are read.
 */
export async function readGgufFileInfo(pathOrUrl: string, {
    readTensorInfo = true,
    sourceType,
    ignoreKeys = [],
    logWarnings = true,
    fetchRetryOptions = ggufDefaultFetchRetryOptions,
    fetchHeaders = {},
    signal
}: {
    /**
     * Whether to read the tensor info from the file's header
     * Enabled by default.
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

    /** Whether to log warnings */
    logWarnings?: boolean,

    /** Relevant only when fetching from a network */
    fetchRetryOptions?: retry.Options,

    /** Relevant only when fetching from a network */
    fetchHeaders?: Record<string, string>,

    signal?: AbortSignal
} = {}) {
    function createFileReader() {
        if (sourceType === "network" || (sourceType == null && (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")))) {
            return new GgufNetworkFetchFileReader({
                url: normalizeGgufDownloadUrl(pathOrUrl),
                retryOptions: fetchRetryOptions,
                headers: fetchHeaders,
                signal
            });
        } else if (sourceType === "filesystem" || sourceType == null) {
            return new GgufFsFileReader({
                filePath: pathOrUrl,
                signal
            });
        }

        void (sourceType satisfies never);
        throw new Error(`Unsupported sourceType: ${sourceType}`);
    }

    const fileReader = createFileReader();
    return await parseGguf({
        fileReader,
        ignoreKeys,
        readTensorInfo,
        logWarnings
    });
}
