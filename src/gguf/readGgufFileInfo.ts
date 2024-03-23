import retry from "async-retry";
import {parseGguf} from "./parser/parseGguf.js";
import {GgufNetworkFetchFileReader} from "./fileReaders/GgufNetworkFetchFileReader.js";
import {GgufFsFileReader} from "./fileReaders/GgufFsFileReader.js";
import {ggufDefaultRetryOptions} from "./consts.js";


/**
 * Read a GGUF file and return its metadata and tensor info (unless `readTensorInfo` is set to `false`).
 * Only the parts of the file required for the metadata and tensor info are read.
 */
export async function readGgufFileInfo(pathOrUrl: string, {
    readTensorInfo = true,
    sourceType,
    retryOptions = ggufDefaultRetryOptions,
    ignoreKeys = [],
    logWarnings = true
}: {
    readTensorInfo?: boolean,
    sourceType?: "network" | "filesystem",
    retryOptions?: retry.Options,
    ignoreKeys?: string[],
    logWarnings?: boolean
} = {}) {
    function createFileReader() {
        if (sourceType === "network" || (sourceType == null && (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")))) {
            return new GgufNetworkFetchFileReader({
                url: pathOrUrl,
                retryOptions: retryOptions
            });
        } else if (sourceType === "filesystem" || sourceType == null) {
            return new GgufFsFileReader({
                filePath: pathOrUrl,
                retryOptions: retryOptions
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
