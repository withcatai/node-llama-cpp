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
export const llamaNumaOptions = ["distribute", "isolate", "numactl", "mirror", false] as const satisfies LlamaNuma[];
export type LlamaNuma = false | "distribute" | "isolate" | "numactl" | "mirror";

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

export function parseNumaOption(option: (typeof llamaNumaOptions)[number] | (typeof nodeLlamaCppGpuOffStringOptions)[number]): LlamaNuma {
    function optionIsGpuOff(opt: typeof option): opt is (typeof nodeLlamaCppGpuOffStringOptions)[number] {
        return nodeLlamaCppGpuOffStringOptions.includes(opt as (typeof nodeLlamaCppGpuOffStringOptions)[number]);
    }

    if (optionIsGpuOff(option))
        return false;

    if (llamaNumaOptions.includes(option))
        return option;

    return false;
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
    log = "log",
    debug = "debug"
}
export const LlamaLogLevelValues = Object.freeze([
    LlamaLogLevel.disabled,
    LlamaLogLevel.fatal,
    LlamaLogLevel.error,
    LlamaLogLevel.warn,
    LlamaLogLevel.info,
    LlamaLogLevel.log,
    LlamaLogLevel.debug
] as const);

export enum LlamaVocabularyType {
    none = "none",
    spm = "spm",
    bpe = "bpe",
    wpm = "wpm",
    ugm = "ugm",
    rwkv = "rwkv",
    plamo2 = "plamo2"
}
export const LlamaVocabularyTypeValues = Object.freeze([
    LlamaVocabularyType.none,
    LlamaVocabularyType.spm,
    LlamaVocabularyType.bpe,
    LlamaVocabularyType.wpm,
    LlamaVocabularyType.ugm,
    LlamaVocabularyType.rwkv,
    LlamaVocabularyType.plamo2
] as const);

/**
 * Check if a log level is higher than another log level
 * @example
 * ```ts
 * LlamaLogLevelGreaterThan(LlamaLogLevel.error, LlamaLogLevel.info); // true
 * ```
 */
export function LlamaLogLevelGreaterThan(a: LlamaLogLevel, b: LlamaLogLevel): boolean {
    return LlamaLogLevelValues.indexOf(a) < LlamaLogLevelValues.indexOf(b);
}

/**
 * Check if a log level is higher than or equal to another log level
 * @example
 * ```ts
 * LlamaLogLevelGreaterThanOrEqual(LlamaLogLevel.error, LlamaLogLevel.info); // true
 * LlamaLogLevelGreaterThanOrEqual(LlamaLogLevel.error, LlamaLogLevel.error); // true
 * ```
 */
export function LlamaLogLevelGreaterThanOrEqual(a: LlamaLogLevel, b: LlamaLogLevel): boolean {
    return LlamaLogLevelValues.indexOf(a) <= LlamaLogLevelValues.indexOf(b);
}

export const enum LlamaLocks {
    loadToMemory = "loadToMemory"
}
