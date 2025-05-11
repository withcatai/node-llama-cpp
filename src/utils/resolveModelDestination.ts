import path from "path";
import {normalizeGgufDownloadUrl} from "../gguf/utils/normalizeGgufDownloadUrl.js";
import {parseModelUri, ParsedModelUri, resolveParsedModelUri, getAuthorizationHeader} from "./parseModelUri.js";
import {isUrl} from "./isUrl.js";
import {ModelDownloadEndpoints} from "./modelDownloadEndpoints.js";

export type ResolveModelDestination = {
    type: "url",
    url: string
} | {
    type: "uri",
    url?: string,
    uri: string,
    parsedUri: ParsedModelUri
} | {
    type: "file",
    path: string
};

export function resolveModelDestination(
    modelDestination: string, convertUrlToUri: boolean = false, endpoints?: ModelDownloadEndpoints
): ResolveModelDestination {
    const parsedUri = parseModelUri(modelDestination, convertUrlToUri, endpoints);

    if (parsedUri != null) {
        return {
            type: "uri",
            url: parsedUri.type === "resolved"
                ? parsedUri.resolvedUrl
                : undefined,
            uri: parsedUri.uri,
            parsedUri
        };
    } else if (isUrl(modelDestination)) {
        return {
            type: "url",
            url: normalizeGgufDownloadUrl(modelDestination, endpoints)
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

export async function resolveModelArgToFilePathOrUrl(
    modelDestination: string, optionHeaders?: Record<string, string>
): Promise<[resolvedModelDestination: ResolveModelDestination, filePathOrUrl: string]> {
    const resolvedModelDestination = resolveModelDestination(modelDestination);

    if (resolvedModelDestination.type == "file")
        return [resolvedModelDestination, resolvedModelDestination.path];
    else if (resolvedModelDestination.type === "url")
        return [resolvedModelDestination, resolvedModelDestination.url];
    else if (resolvedModelDestination.parsedUri.type === "resolved")
        return [resolvedModelDestination, resolvedModelDestination.parsedUri.resolvedUrl];

    const resolvedModelUri = await resolveParsedModelUri(resolvedModelDestination.parsedUri, {
        authorizationHeader: getAuthorizationHeader(optionHeaders)
    });
    return [
        {
            type: "uri",
            url: resolvedModelUri.resolvedUrl,
            uri: resolvedModelUri.uri,
            parsedUri: resolvedModelUri
        },
        resolvedModelUri.resolvedUrl
    ];
}
