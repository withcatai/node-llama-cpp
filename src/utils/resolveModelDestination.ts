import path from "path";
import {normalizeGgufDownloadUrl} from "../gguf/utils/normalizeGgufDownloadUrl.js";
import {ParseModelUri, parseModelUri} from "./parseModelUri.js";
import {isUrl} from "./isUrl.js";

export type ResolveModelDestination = {
    type: "url",
    url: string
} | {
    type: "uri",
    url: string,
    uri: string,
    parsedUri: ParseModelUri
} | {
    type: "file",
    path: string
};

export function resolveModelDestination(modelDestination: string, convertUrlToUri: boolean = false): ResolveModelDestination {
    const parsedUri = parseModelUri(modelDestination, convertUrlToUri);

    if (parsedUri != null) {
        return {
            type: "uri",
            url: parsedUri.resolvedUrl,
            uri: parsedUri.uri,
            parsedUri
        };
    } else if (isUrl(modelDestination)) {
        return {
            type: "url",
            url: normalizeGgufDownloadUrl(modelDestination)
        };
    }

    try {
        return {
            type: "file",
            path: path.resolve(process.cwd(), modelDestination)
        };
    } catch (err) {
        throw new Error(`Invalid path: ${modelDestination}`);
    }
}
