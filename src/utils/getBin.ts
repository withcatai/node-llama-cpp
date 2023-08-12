import {createRequire} from "module";
import * as console from "console";
import path from "path";
import process from "process";
import fs from "fs-extra";
import {defaultLlamaCppGitHubRepo, defaultLlamaCppRelease, defaultSkipDownload, llamaBinsDirectory} from "../config.js";
import {DownloadLlamaCppCommand} from "../cli/commands/DownloadCommand.js";
import {getUsedBinFlag} from "./usedBinFlag.js";
import {getCompiledLlamaCppBinaryPath} from "./compileLLamaCpp.js";

const require = createRequire(import.meta.url);

export async function getPrebuildBinPath(): Promise<string | null> {
    const majorNodeVersion = parseInt(process.version.slice("v".length));
    const supportedVersions = [majorNodeVersion, majorNodeVersion - 1];

    function createPath(platform: string, arch: string, nodeVersion: number) {
        return path.join(llamaBinsDirectory, `${platform}-${arch}-${nodeVersion}.node`);
    }

    async function resolvePath(platform: string, arch: string, nodeVersions: number[]) {
        for (const nodeVersion of nodeVersions) {
            const binPath = createPath(platform, arch, nodeVersion);

            if (await fs.exists(binPath))
                return binPath;
        }

        return null;
    }

    async function getPath() {
        switch (process.platform) {
            case "win32":
            case "cygwin":
                return resolvePath("win", process.arch, supportedVersions);

            case "linux":
            case "android":
                return resolvePath("linux", process.arch, supportedVersions);

            case "darwin":
                return resolvePath("mac", process.arch, supportedVersions);
        }

        return null;
    }

    return await getPath();
}

export async function loadBin(): Promise<LlamaCppNodeModule> {
    const usedBingFlag = await getUsedBinFlag();

    if (usedBingFlag === "prebuiltBinaries") {
        const prebuildBinPath = await getPrebuildBinPath();

        if (prebuildBinPath == null) {
            console.warn("Prebuild binaries not found, falling back to to locally built binaries");
        } else {
            return require(prebuildBinPath);
        }
    }

    const modulePath = await getCompiledLlamaCppBinaryPath();

    if (modulePath == null) {
        if (defaultSkipDownload) {
            throw new Error("No prebuild binaries found and NODE_LLAMA_CPP_SKIP_DOWNLOAD env var is set to true");
        } else {
            await DownloadLlamaCppCommand({
                repo: defaultLlamaCppGitHubRepo,
                release: defaultLlamaCppRelease
            });

            const modulePath = await getCompiledLlamaCppBinaryPath();

            if (modulePath == null) {
                throw new Error("Failed to download and compile llama.cpp");
            }

            return require(modulePath);
        }
    }

    return require(modulePath);
}

export type LlamaCppNodeModule = {
    LLAMAModel: LLAMAModel,
    LLAMAContext: LLAMAContext,
    tokenBos(): number,
    systemInfo(): string,
    tokenEos(): number,
};

export type LLAMAModel = {
    new (modelPath: string): LLAMAModel
};

export type LLAMAContext = {
    new (model: LLAMAModel): LLAMAContext,
    encode(text: string): Uint32Array,
    // restrictions used to guide the model towards a specific topic,
    // to only allow the given tokens to be returned, or at least to be more likely to be returned
    eval(tokens: Uint32Array, restrictions?: Uint32Array): Promise<number>,
    decode(tokens: Uint32Array): string
};
