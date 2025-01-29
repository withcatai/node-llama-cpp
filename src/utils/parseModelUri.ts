import filenamify from "filenamify";
import {normalizeGgufDownloadUrl} from "../gguf/utils/normalizeGgufDownloadUrl.js";
import {getFilenameForBinarySplitGgufPartUrls, resolveBinarySplitGgufPartUrls} from "../gguf/utils/resolveBinarySplitGgufPartUrls.js";
import {createSplitPartFilename, getGgufSplitPartsInfo} from "../gguf/utils/resolveSplitGgufParts.js";
import {ggufQuantNames} from "../gguf/utils/ggufQuantNames.js";
import {isUrl} from "./isUrl.js";
import {ModelFileAccessTokens, resolveModelFileAccessTokensTryHeaders} from "./modelFileAccesTokens.js";
import {parseModelFileName} from "./parseModelFileName.js";

const defaultHuggingFaceBranch = "main";
const defaultHuggingFaceFileQuantization = "Q4_K_M";

export const genericFilePartNumber = "{:\n{number}\n:}" as const;

export type ParsedModelUri = ResolvedParsedModelUri | UnresolvedParsedModelUri;
export type UnresolvedParsedModelUri = {
    type: "unresolved",
    uri: string,
    filePrefix: string,
    baseFilename: string,
    possibleFullFilenames: (string | `${string}${typeof genericFilePartNumber}${string}`)[],
    resolveDetails: {
        type: "hf",
        user: string,
        model: string,
        tag: string
    }
};

export type ResolvedParsedModelUri = {
    type: "resolved",
    uri: string,
    resolvedUrl: string,
    filePrefix: string,
    filename: string,
    fullFilename: string
};

export function parseModelUri(urlOrUri: string, convertUrlToSupportedUri: boolean = false): ParsedModelUri | null {
    if (urlOrUri.startsWith("hf://"))
        return parseHuggingFaceUriContent(urlOrUri.slice("hf://".length), urlOrUri);
    else if (urlOrUri.startsWith("huggingface://"))
        return parseHuggingFaceUriContent(urlOrUri.slice("huggingface://".length), urlOrUri);
    else if (urlOrUri.startsWith("hf:"))
        return parseHuggingFaceUriContent(urlOrUri.slice("hf:".length), urlOrUri);
    else if (urlOrUri.startsWith("huggingface:"))
        return parseHuggingFaceUriContent(urlOrUri.slice("huggingface:".length), urlOrUri);
    else if (urlOrUri.startsWith("hf.co/"))
        return parseHuggingFaceUriContent(urlOrUri.slice("hf.co/".length), urlOrUri);
    else if (urlOrUri.startsWith("huggingface.co/"))
        return parseHuggingFaceUriContent(urlOrUri.slice("huggingface.co/".length), urlOrUri);

    if (convertUrlToSupportedUri && isUrl(urlOrUri)) {
        const parsedUrl = new URL(normalizeGgufDownloadUrl(urlOrUri));
        if (parsedUrl.hostname === "huggingface.co" || parsedUrl.hostname === "hf.co") {
            const pathnameParts = parsedUrl.pathname.split("/");
            const [, user, model, resolve, branch, ...pathParts] = pathnameParts;
            const filePath = pathParts.join("/");

            if (user != null && model != null && resolve === "resolve" && branch != null && filePath !== "") {
                return parseHuggingFaceUriContent([
                    decodeURIComponent(user),
                    "/", decodeURIComponent(model), "/",
                    filePath
                        .split("/")
                        .map((part) => decodeURIComponent(part))
                        .join("/"),
                    branch !== defaultHuggingFaceBranch
                        ? `#${decodeURIComponent(branch)}`
                        : ""
                ].join(""), urlOrUri);
            }
        }
    }

    return null;
}

export function isModelUri(modelUri: string) {
    try {
        return parseModelUri(modelUri) != null;
    } catch {
        return false;
    }
}

export async function resolveParsedModelUri(
    modelUri: ParsedModelUri,
    options?: {tokens?: ModelFileAccessTokens, signal?: AbortSignal, authorizationHeader?: string}
): Promise<ResolvedParsedModelUri>;
export async function resolveParsedModelUri(
    modelUri: ParsedModelUri | undefined | null,
    options?: {tokens?: ModelFileAccessTokens, signal?: AbortSignal, authorizationHeader?: string}
): Promise<ResolvedParsedModelUri | undefined | null>;
export async function resolveParsedModelUri(
    modelUri: ParsedModelUri | undefined | null,
    {tokens, signal, authorizationHeader}: {
        tokens?: ModelFileAccessTokens,
        signal?: AbortSignal,
        authorizationHeader?: string
    } = {}
): Promise<ResolvedParsedModelUri | undefined | null> {
    if (modelUri == null)
        return modelUri;

    if (modelUri.type === "resolved")
        return modelUri;

    if (modelUri.resolveDetails.type !== "hf")
        throw new Error(`Unsupported model URI type: ${modelUri.resolveDetails.type}`);

    const modelTag = modelUri.resolveDetails.tag || "latest";
    const manifest = await fetchHuggingFaceModelManifest({
        user: modelUri.resolveDetails.user,
        model: modelUri.resolveDetails.model,
        modelTag,
        fullUri: modelUri.uri,
        tokens,
        signal,
        authorizationHeader
    });

    const filename = manifest.rfilename;
    const splitPartsInfo = getGgufSplitPartsInfo(filename);

    function resolveQuantizationText() {
        if (modelTag.toLowerCase() !== "latest")
            return modelTag.toUpperCase();

        if (filename.toLowerCase().includes(defaultHuggingFaceFileQuantization.toLowerCase()))
            return defaultHuggingFaceFileQuantization;

        const quantizationText = parseModelFileName(filename).quantization;
        if (quantizationText != null && ggufQuantNames.has(quantizationText))
            return quantizationText;

        return "";
    }

    const quantizationText = resolveQuantizationText();
    const resolvedBaseFilename = modelUri.baseFilename + (quantizationText !== "" ? ("." + quantizationText) : "") + ".gguf";
    const resolvedFilename = splitPartsInfo != null
        ? createSplitPartFilename(resolvedBaseFilename, splitPartsInfo.part, splitPartsInfo.parts)
        : resolvedBaseFilename;

    const resolvedUrl = normalizeGgufDownloadUrl([
        "https://huggingface.co/", encodeURIComponent(modelUri.resolveDetails.user),
        "/", encodeURIComponent(modelUri.resolveDetails.model),
        "/resolve/", encodeURIComponent(defaultHuggingFaceBranch), "/",
        filename
            .split("/")
            .map((item) => encodeURIComponent(item))
            .join("/"),
        "?download=true"
    ].join(""));

    return {
        type: "resolved",
        uri: modelUri.uri,
        filePrefix: modelUri.filePrefix,
        filename: resolvedFilename,
        fullFilename: `${modelUri.filePrefix}${resolvedFilename}`,
        resolvedUrl
    };
}

export function getAuthorizationHeader(headers?: Record<string, string>): string | undefined {
    return headers?.["Authorization"] || headers?.["authorization"];
}

async function fetchHuggingFaceModelManifest({
    user, model, modelTag, fullUri, tokens, signal, authorizationHeader
}: {
    user: string, model: string, modelTag: string,
    fullUri: string, tokens?: ModelFileAccessTokens, signal?: AbortSignal, authorizationHeader?: string
}): Promise<{
    rfilename: string,
    size: number
}> {
    const manifestUrl = [
        "https://huggingface.co/v2/", encodeURIComponent(user),
        "/", encodeURIComponent(model),
        "/manifests/", encodeURIComponent(modelTag)
    ].join("");
    const headersToTry = [
        {},
        await resolveModelFileAccessTokensTryHeaders(manifestUrl, tokens)
    ];

    while (headersToTry.length > 0) {
        const headers = headersToTry.shift();

        const response = await fetch(manifestUrl, {
            headers: {
                ...(authorizationHeader != null ? {"Authorization": authorizationHeader} : {}),
                ...headers,

                // we need this to get the `ggufFile` field in the response
                // https://github.com/ggerganov/llama.cpp/pull/11195
                "User-Agent": "llama-cpp"
            },
            signal
        });

        if ((response.status >= 500 || response.status === 429 || response.status === 401) && headersToTry.length > 0)
            continue;

        if (!response.ok)
            throw new Error(`Failed to fetch manifest for ${JSON.stringify(fullUri)}: ${response.status} ${response.statusText}`);

        try {
            const json = await response.json() as {
                ggufFile?: {
                    rfilename?: string,
                    size: number
                }
            };

            if (json?.ggufFile?.rfilename == null)
                throw new Error(`Invalid manifest for ${JSON.stringify(fullUri)}`);

            return json.ggufFile as {
                rfilename: string,
                size: number
            };
        } catch (err) {
            throw new Error(`Invalid manifest response for ${JSON.stringify(fullUri)}`);
        }
    }

    throw new Error(`Failed to fetch manifest for ${JSON.stringify(fullUri)}: no more headers to try`);
}

function parseHuggingFaceUriContent(uri: string, fullUri: string): ParsedModelUri {
    const [user, model, ...pathParts] = uri.split("/");
    let rest = pathParts.join("/");

    if (user != null && model != null && (rest === "" || model.includes(":"))) {
        const [actualModel, tag, ...tagParts] = model.split(":");
        const actualTag = tagParts.length > 0
            ? [tag, ...tagParts].join(":").trimEnd()
            : (tag ?? "").trimEnd();

        if (actualModel == null || actualModel === "" || user === "")
            throw new Error(`Invalid Hugging Face URI: ${fullUri}`);

        const baseFilename = actualModel.toLowerCase().endsWith("-gguf")
            ? filenamify(actualModel.slice(0, -"-gguf".length))
            : filenamify(actualModel);

        const filePrefix = buildHuggingFaceFilePrefix(user, actualModel, defaultHuggingFaceBranch, [], baseFilename + ".gguf");
        return {
            type: "unresolved",
            uri: `hf:${user}/${actualModel}${actualTag !== "" ? `:${actualTag}` : ""}`,
            filePrefix,
            baseFilename,
            possibleFullFilenames: [
                `${filePrefix}${baseFilename}.${defaultHuggingFaceFileQuantization}.gguf`,
                `${filePrefix}${baseFilename}.${defaultHuggingFaceFileQuantization}-00001-of-${genericFilePartNumber}.gguf`,
                `${filePrefix}${baseFilename}.gguf`,
                `${filePrefix}${baseFilename}-00001-of-${genericFilePartNumber}.gguf`
            ],
            resolveDetails: {
                type: "hf",
                user,
                model: actualModel,
                tag: actualTag
            }
        };
    }

    const hashIndex = rest.indexOf("#");
    let branch = defaultHuggingFaceBranch;

    if (hashIndex >= 0) {
        branch = rest.slice(hashIndex + "#".length);
        rest = rest.slice(0, hashIndex);

        if (branch === "")
            branch = defaultHuggingFaceBranch;
    }

    const filePathParts = rest.split("/");
    const filePath = filePathParts
        .map((part) => encodeURIComponent(part))
        .join("/");

    if (!user || !model || filePath === "")
        throw new Error(`Invalid Hugging Face URI: ${fullUri}`);

    const resolvedUrl = normalizeGgufDownloadUrl([
        "https://huggingface.co/", encodeURIComponent(user),
        "/", encodeURIComponent(model),
        "/resolve/", encodeURIComponent(branch),
        "/", filePath, "?download=true"
    ].join(""));

    const filename = resolveModelFilenameFromUrl(resolvedUrl)!;
    const filePrefix = buildHuggingFaceFilePrefix(user, model, branch, filePathParts.slice(0, -1), filename);
    return {
        type: "resolved",
        uri: `hf:${user}/${model}/${filePathParts.join("/")}${branch !== defaultHuggingFaceBranch ? `#${branch}` : ""}`,
        resolvedUrl,
        filePrefix,
        filename,
        fullFilename: `${filePrefix}${filename}`
    };
}

function buildHuggingFaceFilePrefix(user: string, model: string, branch: string, pathParts: string[], filename: string) {
    const res: string[] = ["hf"];

    res.push(filenamify(user));

    if (!doesFilenameMatchExactModelName(filename, model) || branch !== defaultHuggingFaceBranch)
        res.push(filenamify(model));

    if (branch !== defaultHuggingFaceBranch)
        res.push(filenamify(branch));

    if (pathParts.length > 0) {
        if (doesFilenameMatchExactFolderName(filename, pathParts.at(-1)!))
            pathParts = pathParts.slice(0, -1);

        if (pathParts.length > 0)
            res.push(filenamify(pathParts.join("__")));
    }

    return res.join("_") + "_";
}

function resolveModelFilenameFromUrl(modelUrl: string) {
    const binarySplitPartUrls = resolveBinarySplitGgufPartUrls(modelUrl);

    if (binarySplitPartUrls instanceof Array)
        return getFilenameForBinarySplitGgufPartUrls(binarySplitPartUrls);

    const parsedUrl = new URL(modelUrl);
    const ggufIndex = parsedUrl.pathname.toLowerCase().indexOf(".gguf");
    const urlWithoutPart = parsedUrl.pathname.slice(0, ggufIndex + ".gguf".length);

    const filename = decodeURIComponent(urlWithoutPart.split("/").pop()!);

    return filenamify(filename);
}

function doesFilenameMatchExactModelName(filename: string, modelName: string) {
    if (!modelName.toLowerCase().endsWith("-gguf") || !filename.toLowerCase().endsWith(".gguf"))
        return false;

    const modelNameWithoutGguf = modelName.slice(0, -"-gguf".length);
    const filenameWithoutGguf = filename.slice(0, -".gguf".length);

    if (filenameWithoutGguf.toLowerCase().startsWith(modelNameWithoutGguf.toLowerCase()))
        return true;

    const splitPartsInfo = getGgufSplitPartsInfo(filename);
    if (splitPartsInfo == null)
        return false;

    const {matchLength} = splitPartsInfo;
    const filenameWithoutGgufAndWithoutSplitParts = filename.slice(0, filename.length - matchLength);

    return filenameWithoutGgufAndWithoutSplitParts.toLowerCase().startsWith(modelNameWithoutGguf.toLowerCase());
}

function doesFilenameMatchExactFolderName(filename: string, folderName: string) {
    if (!filename.toLowerCase().endsWith(".gguf"))
        return false;

    const filenameWithoutGguf = filename.slice(0, -".gguf".length);

    if (folderName.toLowerCase() === filenameWithoutGguf.toLowerCase())
        return true;

    const splitPartsInfo = getGgufSplitPartsInfo(filename);
    if (splitPartsInfo == null)
        return false;

    const {matchLength} = splitPartsInfo;
    const filenameWithoutGgufAndWithoutSplitParts = filename.slice(0, filename.length - matchLength);

    return folderName.toLowerCase() === filenameWithoutGgufAndWithoutSplitParts.toLowerCase();
}
