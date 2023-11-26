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
import {Token} from "../types.js";
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

export async function loadBin(): Promise<BindingModule> {
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

export type BindingModule = {
    AddonModel: {
        new (modelPath: string, params: {
            gpuLayers?: number,
            vocabOnly?: boolean,
            useMmap?: boolean,
            useMlock?: boolean
        }): AddonModel
    },
    AddonContext: {
        new (model: AddonModel, params: {
            seed?: number,
            contextSize?: number,
            batchSize?: number,
            f16Kv?: boolean,
            logitsAll?: boolean,
            embedding?: boolean,
            threads?: number,
        }): AddonContext,
    },
    AddonGrammar: {
        new (grammarPath: string, params?: {
            printGrammar?: boolean,
        }): AddonGrammar
    },
    AddonGrammarEvaluationState: {
        new (grammar: AddonGrammar): AddonGrammarEvaluationState
    },
    systemInfo(): string
};

export type AddonModel = {
    dispose(): void,
    tokenize(text: string): Uint32Array,
    detokenize(tokens: Uint32Array): string,
    getTrainContextSize(): number,
    getTotalSize(): number,
    getTotalParameters(): number,
    getModelDescription(): ModelTypeDescription,
    tokenBos(): Token,
    tokenEos(): Token,
    tokenNl(): Token,
    prefixToken(): Token,
    middleToken(): Token,
    suffixToken(): Token,
    eotToken(): Token,
    getTokenString(token: number): string
};

export type AddonContext = {
    dispose(): void,
    getContextSize(): number
    initBatch(size: number): void, // size must be less or equal to batchSize
    addToBatch(
        sequenceId: number,
        firstTokenSequenceIndex: number,
        tokens: Uint32Array,
        generateLogitAtTheEnd: boolean
    ): BatchLogitIndex | undefined, // returns batchLogitIndex if `generateLogitAtTheEnd` is true
    decodeBatch(): Promise<void>,
    sampleToken(batchLogitIndex: BatchLogitIndex, options?: {
        temperature?: number,
        topK?: number,
        topP?: number,
        repeatPenalty?: number,
        repeatPenaltyTokens?: Uint32Array,
        repeatPenaltyPresencePenalty?: number, // alpha_presence
        repeatPenaltyFrequencyPenalty?: number, // alpha_frequency
        grammarEvaluationState?: AddonGrammarEvaluationState
    }): Promise<Token>,
    disposeSequence(sequenceId: number): void,

    // startPos in inclusive, endPos is exclusive
    removeTokenCellsFromSequence(sequenceId: number, startPos: number, endPos: number): void,

    // startPos in inclusive, endPos is exclusive
    shiftSequenceTokenCells(sequenceId: number, startPos: number, endPos: number, shiftDelta: number): void
};

export type BatchLogitIndex = number & {
    __batchLogitIndex: never
};

export type AddonGrammar = "AddonGrammar" & {
    __brand: never
};

export type AddonGrammarEvaluationState = "AddonGrammarEvaluationState" & {
    __brand: never
};

export type ModelTypeDescription = `${AddonModelArchName} ${AddonModelTypeName} ${AddonModelFileTypeName}`;
export type AddonModelArchName = "unknown" | "llama" | "falcon" | "gpt2" | "gptj" | "gptneox" | "mpt" | "baichuan" | "starcoder" | "persimmon" |
    "refact" | "bloom" | "stablelm";
export type AddonModelTypeName = "1B" | "3B" | "7B" | "8B" | "13B" | "15B" | "30B" | "34B" | "40B" | "65B" | "70B" | "?B";
export type AddonModelFileTypeName = _AddonModelFileTypeName | `${_AddonModelFileTypeName} (guessed)`;
type _AddonModelFileTypeName = "all F32" | "mostly F16" | "mostly Q4_0" | "mostly Q4_1" | "mostly Q4_1, some F16" | "mostly Q5_0" |
    "mostly Q5_1" | "mostly Q8_0" | "mostly Q2_K" | "mostly Q3_K - Small" | "mostly Q3_K - Medium" | "mostly Q3_K - Large" |
    "mostly Q4_K - Small" | "mostly Q4_K - Medium" | "mostly Q5_K - Small" | "mostly Q5_K - Medium" | "mostly Q6_K" |
    "unknown, may not work";
