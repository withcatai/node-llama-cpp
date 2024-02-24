import process from "process";
import path from "path";
import console from "console";
import {createRequire} from "module";
import {
    builtinLlamaCppGitHubRepo, builtinLlamaCppRelease, defaultLlamaCppCudaSupport, defaultLlamaCppDebugLogs, defaultLlamaCppGitHubRepo,
    defaultLlamaCppMetalSupport, defaultLlamaCppRelease, defaultLlamaCppVulkanSupport, defaultSkipDownload, llamaLocalBuildBinsDirectory
} from "../config.js";
import {getConsoleLogPrefix} from "../utils/getConsoleLogPrefix.js";
import {waitForLockfileRelease} from "../utils/waitForLockfileRelease.js";
import {isGithubReleaseNeedsResolving, resolveGithubRelease} from "../utils/resolveGithubRelease.js";
import {BindingModule} from "./AddonTypes.js";
import {
    compileLlamaCpp, getLocalBuildBinaryBuildMetadata, getLocalBuildBinaryPath, getPrebuiltBinaryBuildMetadata, getPrebuiltBinaryPath
} from "./utils/compileLLamaCpp.js";
import {getLastBuildInfo} from "./utils/lastBuildInfo.js";
import {getClonedLlamaCppRepoReleaseInfo, isLlamaCppRepoCloned} from "./utils/cloneLlamaCppRepo.js";
import {BuildOptions, LlamaLogLevel} from "./types.js";
import {getPlatform} from "./utils/getPlatform.js";
import {getBuildFolderNameForBuildOptions} from "./utils/getBuildFolderNameForBuildOptions.js";
import {resolveCustomCmakeOptions} from "./utils/resolveCustomCmakeOptions.js";
import {getCanUsePrebuiltBinaries} from "./utils/getCanUsePrebuiltBinaries.js";
import {NoBinaryFoundError} from "./utils/NoBinaryFoundError.js";
import {Llama} from "./Llama.js";

const require = createRequire(import.meta.url);

export type LlamaOptions = {
    /**
     * Toggle Metal support in llama.cpp.
     * Only supported on macOS.
     * Enabled by default on Apple Silicon Macs.
     */
    metal?: boolean,

    /**
     * Toggle CUDA support on llama.cpp.
     * Disabled by default.
     */
    cuda?: boolean,

    /**
     * Toggle Vulkan support on llama.cpp.
     * Disabled by default.
     */
    vulkan?: boolean,

    /**
     * Set the minimum log level for llama.cpp.
     * Defaults to "debug".
     */
    logLevel?: LlamaLogLevel,

    /**
     * Set a custom logger for llama.cpp logs.
     */
    logger?: (level: LlamaLogLevel, message: string) => void,

    /**
     * Set what build method to use.
     * - **`"auto"`**: If a local build is found, use it.
     * Otherwise, if a prebuilt binary is found, use it.
     * Otherwise, build from source.
     * - **`"never"`**: If a local build is found, use it.
     * Otherwise, if a prebuilt binary is found, use it.
     * Otherwise, throw a `NoBinaryFoundError` error.
     * - **`"forceRebuild"`**: Always build from source.
     * Be cautious with this option, as it will cause the build to fail on Windows when the binaries are in use by another process.
     *
     * Defaults to "auto".
     */
    build?: "auto" | "never" | "forceRebuild",

    /**
     * Set custom CMake options for llama.cpp
     */
    cmakeOptions?: Record<string, string>,

    /**
     * When a prebuilt binary is found, only use it if it was built with the same build options as the ones specified in `buildOptions`.
     * Disabled by default.
     */
    existingPrebuiltBinaryMustMatchBuildOptions?: boolean,

    /**
     * Use prebuilt binaries if they match the build options.
     * Enabled by default.
     */
    usePrebuiltBinaries?: boolean,

    /**
     * Print binary compilation progress logs.
     * Enabled by default.
     */
    progressLogs?: boolean,

    /**
     * Don't download llama.cpp source if it's not found.
     * When set to `true`, and llama.cpp source is not found, a `NoBinaryFoundError` error will be thrown.
     * Disabled by default.
     */
    skipDownload?: boolean
};

export type LastBuildOptions = {
    /**
     * Set the minimum log level for llama.cpp.
     * Defaults to "debug".
     */
    logLevel?: LlamaLogLevel,

    /**
     * Set a custom logger for llama.cpp logs.
     */
    logger?: (level: LlamaLogLevel, message: string) => void,

    /**
     * If a local build is not found, use prebuilt binaries.
     * Enabled by default.
     */
    usePrebuiltBinaries?: boolean,

    /**
     * If a local build is not found, and prebuilt binaries are not found, when building from source,
     * print binary compilation progress logs.
     * Enabled by default.
     */
    progressLogs?: boolean,

    /**
     * If a local build is not found, and prebuilt binaries are not found, don't download llama.cpp source if it's not found.
     * When set to `true`, and llama.cpp source is needed but is not found, a `NoBinaryFoundError` error will be thrown.
     * Disabled by default.
     */
    skipDownload?: boolean
};

export const getLlamaFunctionName = "getLlama";

/**
 * Get a llama.cpp binding.
 * Defaults to prefer a prebuilt binary, and fallbacks to building from source if a prebuilt binary is not found.
 * Pass `"lastCliBuild"` to default to use the last successful build created using the `download` or `build` CLI commands if one exists.
 */
export async function getLlama(): Promise<Llama>;
export async function getLlama(options: LlamaOptions, lastBuildOptions?: never): Promise<Llama>;
export async function getLlama(type: "lastBuild", lastBuildOptions?: LastBuildOptions): Promise<Llama>;
export async function getLlama(options?: LlamaOptions | "lastBuild", lastBuildOptions?: LastBuildOptions) {
    if (options === "lastBuild") {
        const lastBuildInfo = await getLastBuildInfo();
        const getLlamaOptions: LlamaOptions = {
            logLevel: lastBuildOptions?.logLevel ?? defaultLlamaCppDebugLogs,
            logger: lastBuildOptions?.logger ?? Llama.defaultConsoleLogger,
            usePrebuiltBinaries: lastBuildOptions?.usePrebuiltBinaries ?? true,
            progressLogs: lastBuildOptions?.progressLogs ?? true,
            skipDownload: lastBuildOptions?.skipDownload ?? defaultSkipDownload
        };

        if (lastBuildInfo == null)
            return getLlamaForOptions(getLlamaOptions);

        const localBuildFolder = path.join(llamaLocalBuildBinsDirectory, lastBuildInfo.folderName);
        const localBuildBinPath = await getLocalBuildBinaryPath(lastBuildInfo.folderName);

        await waitForLockfileRelease({resourcePath: localBuildFolder});
        if (localBuildBinPath != null) {
            try {
                const binding = loadBindingModule(localBuildBinPath);
                const buildMetadata = await getLocalBuildBinaryBuildMetadata(lastBuildInfo.folderName);

                return await Llama._create({
                    bindings: binding,
                    buildType: "localBuild",
                    buildMetadata,
                    logger: lastBuildOptions?.logger ?? Llama.defaultConsoleLogger,
                    logLevel: lastBuildOptions?.logLevel ?? defaultLlamaCppDebugLogs
                });
            } catch (err) {
                console.error(getConsoleLogPrefix() + "Failed to load last build. Error:", err);
                console.info(getConsoleLogPrefix() + "Falling back to default binaries");
            }
        }

        return getLlamaForOptions(getLlamaOptions);
    }

    return getLlamaForOptions(options ?? {});
}

export async function getLlamaForOptions({
    metal = defaultLlamaCppMetalSupport,
    cuda = defaultLlamaCppCudaSupport,
    vulkan = defaultLlamaCppVulkanSupport,
    logLevel = defaultLlamaCppDebugLogs,
    logger = Llama.defaultConsoleLogger,
    build = "auto",
    cmakeOptions = {},
    existingPrebuiltBinaryMustMatchBuildOptions = false,
    usePrebuiltBinaries = true,
    progressLogs = true,
    skipDownload = defaultSkipDownload
}: LlamaOptions, {
    updateLastBuildInfoOnCompile = false
}: {
    updateLastBuildInfoOnCompile?: boolean
} = {}): Promise<Llama> {
    const platform = getPlatform();
    const arch = process.arch;

    if (platform !== "mac") metal = false;
    else if (platform === "mac" && arch === "arm64") cuda = false;
    if (logLevel == null) logLevel = defaultLlamaCppDebugLogs;
    if (logger == null) logger = Llama.defaultConsoleLogger;
    if (build == null) build = "auto";
    if (cmakeOptions == null) cmakeOptions = {};
    if (existingPrebuiltBinaryMustMatchBuildOptions == null) existingPrebuiltBinaryMustMatchBuildOptions = false;
    if (usePrebuiltBinaries == null) usePrebuiltBinaries = true;
    if (progressLogs == null) progressLogs = true;
    if (skipDownload == null) skipDownload = defaultSkipDownload;

    const clonedLlamaCppRepoReleaseInfo = await getClonedLlamaCppRepoReleaseInfo();

    const buildOptions: BuildOptions = {
        customCmakeOptions: resolveCustomCmakeOptions(cmakeOptions),
        progressLogs,
        platform,
        arch,
        computeLayers: {
            metal,
            cuda,
            vulkan
        },
        llamaCpp: {
            repo: clonedLlamaCppRepoReleaseInfo?.llamaCppGithubRepo ?? builtinLlamaCppGitHubRepo,
            release: clonedLlamaCppRepoReleaseInfo?.tag ?? builtinLlamaCppRelease
        }
    };

    const canUsePrebuiltBinaries = (build === "forceRebuild" || !usePrebuiltBinaries)
        ? false
        : await getCanUsePrebuiltBinaries();
    let buildFolderName = await getBuildFolderNameForBuildOptions(buildOptions);

    if (build === "auto" || build === "never") {
        const localBuildFolder = path.join(llamaLocalBuildBinsDirectory, buildFolderName.withCustomCmakeOptions);
        const localBuildBinPath = await getLocalBuildBinaryPath(buildFolderName.withCustomCmakeOptions);

        await waitForLockfileRelease({resourcePath: localBuildFolder});
        if (localBuildBinPath != null) {
            try {
                const binding = loadBindingModule(localBuildBinPath);
                const buildMetadata = await getLocalBuildBinaryBuildMetadata(buildFolderName.withCustomCmakeOptions);

                return await Llama._create({
                    bindings: binding,
                    buildType: "localBuild",
                    buildMetadata,
                    logLevel,
                    logger
                });
            } catch (err) {
                const binaryDescription = describeBinary(buildOptions);
                console.error(getConsoleLogPrefix() + `Failed to load a local build ${binaryDescription}. Error:`, err);
                console.info(getConsoleLogPrefix() + "Falling back to prebuilt binaries");
            }
        }

        if (canUsePrebuiltBinaries) {
            const prebuiltBinPath = await getPrebuiltBinaryPath(
                existingPrebuiltBinaryMustMatchBuildOptions
                    ? buildFolderName.withCustomCmakeOptions
                    : buildFolderName.withoutCustomCmakeOptions
            );

            if (prebuiltBinPath != null) {
                try {
                    const binding = loadBindingModule(prebuiltBinPath);
                    const buildMetadata = await getPrebuiltBinaryBuildMetadata(buildFolderName.withCustomCmakeOptions);

                    return await Llama._create({
                        bindings: binding,
                        buildType: "prebuilt",
                        buildMetadata,
                        logLevel,
                        logger
                    });
                } catch (err) {
                    const binaryDescription = describeBinary({
                        ...buildOptions,
                        customCmakeOptions: existingPrebuiltBinaryMustMatchBuildOptions
                            ? buildOptions.customCmakeOptions
                            : new Map()
                    });
                    console.error(
                        getConsoleLogPrefix() + `Failed to load a prebuilt ${binaryDescription}` + (
                            build !== "never"
                                ? ", falling back to building from source"
                                : ""
                        ) + ". Error:", err);
                }
            } else if (progressLogs)
                console.warn(
                    getConsoleLogPrefix() + "A prebuilt binary was not found" + (
                        build !== "never"
                            ? ", falling back to building from source"
                            : ""
                    )
                );
        }
    }

    if (build === "never")
        throw new NoBinaryFoundError();

    const llamaCppRepoCloned = await isLlamaCppRepoCloned();
    if (!llamaCppRepoCloned) {
        if (skipDownload)
            throw new NoBinaryFoundError("No prebuilt binaries found, no llama.cpp source found and `skipDownload` or NODE_LLAMA_CPP_SKIP_DOWNLOAD env var is set to true, so llama.cpp cannot be built from source");

        buildOptions.llamaCpp.repo = defaultLlamaCppGitHubRepo;
        buildOptions.llamaCpp.release = defaultLlamaCppRelease;

        if (isGithubReleaseNeedsResolving(buildOptions.llamaCpp.release)) {
            const [owner, name] = defaultLlamaCppGitHubRepo.split("/");
            buildOptions.llamaCpp.release = await resolveGithubRelease(owner, name, buildOptions.llamaCpp.release);
            buildFolderName = await getBuildFolderNameForBuildOptions(buildOptions);
        }
    }

    await compileLlamaCpp(buildOptions, {
        ensureLlamaCppRepoIsCloned: !skipDownload,
        downloadCmakeIfNeeded: true,
        updateLastBuildInfo: updateLastBuildInfoOnCompile
    });

    const localBuildFolder = path.join(llamaLocalBuildBinsDirectory, buildFolderName.withCustomCmakeOptions);
    await waitForLockfileRelease({resourcePath: localBuildFolder});

    const localBuildBinPath = await getLocalBuildBinaryPath(buildFolderName.withCustomCmakeOptions);

    if (localBuildBinPath == null) {
        throw new Error("Failed to build llama.cpp");
    }

    const binding = loadBindingModule(localBuildBinPath);
    const buildMetadata = await getLocalBuildBinaryBuildMetadata(buildFolderName.withCustomCmakeOptions);

    return await Llama._create({
        bindings: binding,
        buildType: "localBuild",
        buildMetadata,
        logLevel,
        logger
    });
}

function describeBinary(binaryOptions: BuildOptions) {
    let res = `binary for platform "${binaryOptions.platform}" "${binaryOptions.arch}"`;
    const additions: string[] = [];

    if (binaryOptions.computeLayers.metal)
        additions.push("with Metal support");

    if (binaryOptions.computeLayers.cuda)
        additions.push("with CUDA support");

    if (binaryOptions.computeLayers.vulkan)
        additions.push("with Vulkan support");

    if (binaryOptions.customCmakeOptions.size > 0)
        additions.push("with custom build options");

    res += additions
        .map((addition, index) => {
            if (index === 0)
                return " " + addition;

            if (additions.length === 2)
                return " and " + addition;

            if (index === additions.length - 1)
                return " and " + addition;

            return ", " + addition;
        })
        .join("");

    return res;
}

function loadBindingModule(bindingModulePath: string) {
    // each llama instance has its own settings, such as a different logger, so we have to make sure we load a new instance every time
    try {
        delete require.cache[require.resolve(bindingModulePath)];
    } catch (err) {}

    try {
        const binding: BindingModule = require(bindingModulePath);

        return binding;
    } finally {
        try {
            delete require.cache[require.resolve(bindingModulePath)];
        } catch (err) {}
    }
}
