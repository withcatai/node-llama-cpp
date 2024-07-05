import process from "process";
import {BinaryPlatform} from "./utils/getPlatform.js";
import {BinaryPlatformInfo} from "./utils/getPlatformInfo.js";

export const buildGpuOptions = ["metal", "cuda", "vulkan", false] as const;
export type LlamaGpuType = "metal" | "cuda" | "vulkan" | false;
export const nodeLlamaCppGpuOptions = [
    "auto",
    ...buildGpuOptions
] as const;
export const nodeLlamaCppGpuOffStringOptions = ["false", "off", "none", "disable", "disabled"] as const;
export type BuildGpu = (typeof buildGpuOptions)[number];
export type BuildOptions = {
    customCmakeOptions: Map<string, string>,
    progressLogs: boolean,
    platform: BinaryPlatform,
    platformInfo: BinaryPlatformInfo,
    arch: typeof process.arch,
    gpu: BuildGpu,
    llamaCpp: {
        repo: string,
        release: string
    }
};

export type BuildOptionsJSON = Omit<BuildOptions, "customCmakeOptions"> & {
    customCmakeOptions: Record<string, string>
};

export function parseNodeLlamaCppGpuOption(option: (typeof nodeLlamaCppGpuOptions)[number] | (typeof nodeLlamaCppGpuOffStringOptions)[number]): BuildGpu | "auto" {
    function optionIsGpuOff(opt: typeof option): opt is (typeof nodeLlamaCppGpuOffStringOptions)[number] {
        return nodeLlamaCppGpuOffStringOptions.includes(opt as (typeof nodeLlamaCppGpuOffStringOptions)[number]);
    }

    if (optionIsGpuOff(option))
        return false;
    else if (option === "auto")
        return "auto";

    if (buildGpuOptions.includes(option))
        return option;

    return "auto";
}


export function convertBuildOptionsJSONToBuildOptions(buildOptionsJSON: BuildOptionsJSON): BuildOptions {
    return {
        ...buildOptionsJSON,
        customCmakeOptions: new Map(Object.entries(buildOptionsJSON.customCmakeOptions))
    };
}

export function convertBuildOptionsToBuildOptionsJSON(buildOptions: BuildOptions): BuildOptionsJSON {
    return {
        ...buildOptions,
        customCmakeOptions: Object.fromEntries(buildOptions.customCmakeOptions)
    };
}

export type BuildMetadataFile = {
    buildOptions: BuildOptionsJSON
};

export enum LlamaLogLevel {
    disabled = "disabled",
    fatal = "fatal",
    error = "error",
    warn = "warn",
    info = "info",
    debug = "debug"
}
export const LlamaLogLevelValues = Object.freeze([
    LlamaLogLevel.disabled,
    LlamaLogLevel.fatal,
    LlamaLogLevel.error,
    LlamaLogLevel.warn,
    LlamaLogLevel.info,
    LlamaLogLevel.debug
] as const);

export enum LlamaVocabularyType {
    none = "none",
    spm = "spm",
    bpe = "bpe",
    wpm = "wpm",
}
export const LlamaVocabularyTypeValues = Object.freeze([
    LlamaVocabularyType.none,
    LlamaVocabularyType.spm,
    LlamaVocabularyType.bpe,
    LlamaVocabularyType.wpm
] as const);

/**
 *Check if a log level is higher than another log level
 */
export function LlamaLogLevelGreaterThan(a: LlamaLogLevel, b: LlamaLogLevel): boolean {
    return LlamaLogLevelValues.indexOf(a) < LlamaLogLevelValues.indexOf(b);
}

/**
 *Check if a log level is higher than or equal to another log level
 */
export function LlamaLogLevelGreaterThanOrEqual(a: LlamaLogLevel, b: LlamaLogLevel): boolean {
    return LlamaLogLevelValues.indexOf(a) <= LlamaLogLevelValues.indexOf(b);
}

export const enum LlamaLocks {
    loadToMemory = "loadToMemory"
}
