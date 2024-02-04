import process from "process";
import {BinaryPlatform} from "./utils/getPlatform.js";

export type BuildOptions = {
    customCmakeOptions: Map<string, string>,
    progressLogs: boolean,
    platform: BinaryPlatform,
    arch: typeof process.arch,
    computeLayers: {
        metal: boolean,
        cuda: boolean
    },
    llamaCpp: {
        repo: string,
        release: string
    }
};

export type BuildOptionsJSON = Omit<BuildOptions, "customCmakeOptions"> & {
    customCmakeOptions: Record<string, string>
};

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
export const LlamaLogLevelValues = [
    LlamaLogLevel.disabled,
    LlamaLogLevel.fatal,
    LlamaLogLevel.error,
    LlamaLogLevel.warn,
    LlamaLogLevel.info,
    LlamaLogLevel.debug
] as const;
