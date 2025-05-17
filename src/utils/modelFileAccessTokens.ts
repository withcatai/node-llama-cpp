import process from "process";
import path from "path";
import os from "os";
import fs from "fs-extra";
import {isUrl} from "./isUrl.js";
import {isHuggingFaceUrl, ModelDownloadEndpoints} from "./modelDownloadEndpoints.js";

export type ModelFileAccessTokens = {
    huggingFace?: string
};

export async function resolveModelFileAccessTokensTryHeaders(
    modelUrl: string,
    tokens?: ModelFileAccessTokens,
    endpoints?: ModelDownloadEndpoints,
    baseHeaders?: Record<string, string>
) {
    const res: Record<string, string>[] = [];

    if (tokens == null || !isUrl(modelUrl))
        return res;

    const {huggingFace} = tokens;

    if (isHuggingFaceUrl(modelUrl, endpoints)) {
        const hfToken = resolveHfToken(huggingFace);

        res.push({
            ...(baseHeaders ?? {}),
            "Authorization": `Bearer ${hfToken}`
        });
    }

    return res;
}

async function resolveHfToken(providedToken?: string) {
    if (providedToken !== null)
        return providedToken;

    if (process.env.HF_TOKEN != null)
        return process.env.HF_TOKEN;

    const hfHomePath = process.env.HF_HOME ||
        path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), "huggingface");

    const hfTokenPath = process.env.HF_TOKEN_PATH || path.join(hfHomePath, "token");
    try {
        if (await fs.pathExists(hfTokenPath)) {
            const token = (await fs.readFile(hfTokenPath, "utf8")).trim();
            if (token !== "")
                return token;
        }
    } catch (err) {
        // do nothing
    }

    return undefined;
}
