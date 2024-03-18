import retry from "async-retry";
import {GgufParser} from "./ggufParser/GgufParser.js";
import {GgufNetworkFetchFileReader} from "./ggufParser/fileReaders/GgufNetworkFetchFileReader.js";
import {GgufFsFileReader} from "./ggufParser/fileReaders/GgufFsFileReader.js";
import {ggufDefaultRetryOptions} from "./consts.js";


export async function parseGgufMetadata(pathOrUrl: string, {
    sourceType,
    retryOptions = ggufDefaultRetryOptions,
    ignoreKeys = []
}: {
    sourceType?: "network" | "filesystem",
    retryOptions?: retry.Options,
    ignoreKeys?: string[]
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
    const parser = new GgufParser({
        fileReader,
        ignoreKeys
    });

    return await parser.parseMetadata();
}
