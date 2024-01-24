import {createRequire} from "module";
import * as console from "console";
import path from "path";
import process from "process";
import fs from "fs-extra";
import {
    defaultLlamaCppCudaSupport, defaultLlamaCppGitHubRepo, defaultLlamaCppMetalSupport, defaultLlamaCppRelease, defaultSkipDownload,
    llamaBinsDirectory
} from "../config.js";
import {DownloadLlamaCppCommand} from "../cli/commands/DownloadCommand.js";
import {getUsedBinFlag} from "./usedBinFlag.js";
import {getCompiledLlamaCppBinaryPath} from "./compileLLamaCpp.js";

const require = createRequire(import.meta.url);

export async function getPrebuildBinPath(): Promise<string | null> {
    function createPath(platform: string, arch: string) {
        return path.join(llamaBinsDirectory, `${platform}-${arch}/llama-addon.node`);
    }

    async function resolvePath(platform: string, arch: string) {
        const binPath = createPath(platform, arch);

        if (await fs.pathExists(binPath))
            return binPath;

        return null;
    }

    async function getPath() {
        switch (process.platform) {
            case "win32":
            case "cygwin":
                return resolvePath("win", process.arch);

            case "linux":
            case "android":
                return resolvePath("linux", process.arch);

            case "darwin":
                return resolvePath("mac", process.arch);
        }

        return null;
    }

    return await getPath();
}

export async function loadBin(): Promise<LlamaCppNodeModule> {
    const usedBinFlag = await getUsedBinFlag();

    if (usedBinFlag === "prebuiltBinaries") {
        const prebuildBinPath = await getPrebuildBinPath();

        if (prebuildBinPath == null) {
            console.warn("Prebuild binaries not found, falling back to to locally built binaries");
        } else {
            try {
                return require(prebuildBinPath);
            } catch (err) {
                console.error(`Failed to load prebuilt binary for platform "${process.platform}" "${process.arch}". Error:`, err);
                console.info("Falling back to locally built binaries");

                try {
                    delete require.cache[require.resolve(prebuildBinPath)];
                } catch (err) {}
            }
        }
    }

    const modulePath = await getCompiledLlamaCppBinaryPath();

    if (modulePath == null) {
        if (defaultSkipDownload) {
            throw new Error("No prebuild binaries found and NODE_LLAMA_CPP_SKIP_DOWNLOAD env var is set to true");
        } else {
            await DownloadLlamaCppCommand({
                repo: defaultLlamaCppGitHubRepo,
                release: defaultLlamaCppRelease,
                metal: defaultLlamaCppMetalSupport,
                cuda: defaultLlamaCppCudaSupport
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
    LLAMAGrammar: LLAMAGrammar,
    LLAMAGrammarEvaluationState: LLAMAGrammarEvaluationState,
    systemInfo(): string
};

export type LLAMAModel = {
    new (modelPath: string, params: {
        gpuLayers?: number,
        vocabOnly?: boolean,
        useMmap?: boolean,
        useMlock?: boolean
    }): LLAMAModel
};

export type LLAMAContext = {
    new (model: LLAMAModel, params: {
        seed?: number,
        contextSize?: number,
        batchSize?: number,
        logitsAll?: boolean,
        embedding?: boolean,
        threads?: number,
    }): LLAMAContext,
    encode(text: string): Uint32Array,
    eval(tokens: Uint32Array, options?: {
        temperature?: number,
        topK?: number,
        topP?: number,
        repeatPenalty?: number,
        repeatPenaltyTokens?: Uint32Array,
        repeatPenaltyPresencePenalty?: number, // alpha_presence
        repeatPenaltyFrequencyPenalty?: number, // alpha_frequency
        grammarEvaluationState?: LLAMAGrammarEvaluationState
    }): Promise<number>,
    decode(tokens: Uint32Array): string,
    tokenBos(): number,
    tokenEos(): number,
    tokenNl(): number,
    getContextSize(): number
    getTokenString(token: number): string
    printTimings(): void
};

export type LLAMAGrammar = {
    new (grammarPath: string, params?: {
        printGrammar?: boolean,
    }): LLAMAGrammar
};

export type LLAMAGrammarEvaluationState = {
    new (grammar: LLAMAGrammar): LLAMAGrammarEvaluationState
};
