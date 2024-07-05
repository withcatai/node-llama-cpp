import process from "process";
import path from "path";
import console from "console";
import {createRequire} from "module";
import {
    builtinLlamaCppGitHubRepo, builtinLlamaCppRelease, defaultLlamaCppLogLevel, defaultLlamaCppGitHubRepo, defaultLlamaCppGpuSupport,
    defaultLlamaCppRelease, defaultSkipDownload, llamaLocalBuildBinsDirectory, recommendedBaseDockerImage, defaultLlamaCppDebugMode
} from "../config.js";
import {getConsoleLogPrefix} from "../utils/getConsoleLogPrefix.js";
import {waitForLockfileRelease} from "../utils/waitForLockfileRelease.js";
import {isGithubReleaseNeedsResolving, resolveGithubRelease} from "../utils/resolveGithubRelease.js";
import {runningInsideAsar, runningInElectron} from "../utils/runtime.js";
import {BindingModule} from "./AddonTypes.js";
import {
    compileLlamaCpp, getLocalBuildBinaryBuildMetadata, getLocalBuildBinaryPath, getPrebuiltBinaryBuildMetadata, getPrebuiltBinaryPath
} from "./utils/compileLLamaCpp.js";
import {getLastBuildInfo} from "./utils/lastBuildInfo.js";
import {getClonedLlamaCppRepoReleaseInfo, isLlamaCppRepoCloned} from "./utils/cloneLlamaCppRepo.js";
import {BuildGpu, BuildMetadataFile, BuildOptions, LlamaGpuType, LlamaLogLevel} from "./types.js";
import {BinaryPlatform, getPlatform} from "./utils/getPlatform.js";
import {getBuildFolderNameForBuildOptions} from "./utils/getBuildFolderNameForBuildOptions.js";
import {resolveCustomCmakeOptions} from "./utils/resolveCustomCmakeOptions.js";
import {getCanUsePrebuiltBinaries} from "./utils/getCanUsePrebuiltBinaries.js";
import {NoBinaryFoundError} from "./utils/NoBinaryFoundError.js";
import {Llama} from "./Llama.js";
import {getGpuTypesToUseForOption} from "./utils/getGpuTypesToUseForOption.js";
import {getPrettyBuildGpuName} from "./consts.js";
import {detectGlibc} from "./utils/detectGlibc.js";
import {getLinuxDistroInfo, isDistroAlpineLinux} from "./utils/getLinuxDistroInfo.js";
import {testBindingBinary} from "./utils/testBindingBinary.js";
import {BinaryPlatformInfo, getPlatformInfo} from "./utils/getPlatformInfo.js";
import {hasBuildingFromSourceDependenciesInstalled} from "./utils/hasBuildingFromSourceDependenciesInstalled.js";

const require = createRequire(import.meta.url);

export type LlamaOptions = {
    /**
     * The compute layer implementation type to use for llama.cpp.
     * - **`"auto"`**: Automatically detect and use the best GPU available (Metal on macOS, and CUDA or Vulkan on Windows and Linux)
     * - **`"metal"`**: Use Metal.
     *   Only supported on macOS.
     *   Enabled by default on Apple Silicon Macs.
     * - **`"cuda"`**: Use CUDA.
     * - **`"vulkan"`**: Use Vulkan.
     * - **`false`**: Disable any GPU support and only use the CPU.
     *
     * `"auto"` by default.
     */
    gpu?: "auto" | LlamaGpuType | {
        type: "auto",
        exclude?: LlamaGpuType[]
    },

    /**
     * Set the minimum log level for llama.cpp.
     * Defaults to `"warn"`.
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
     * If running from inside an Asar archive in Electron, building from source is not possible, so it'll never build from source.
     * To allow building from source in Electron apps, make sure you ship `node-llama-cpp` as an unpacked module.
     *
     * Defaults to `"auto"`.
     * On Electron, defaults to `"never"`.
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
    skipDownload?: boolean,

    /**
     * Pad the available VRAM for the memory size calculations, as these calculations are not always accurate.
     * Recommended to ensure stability.
     *
     * Defaults to `1.5%` of the total VRAM or 300MB, whichever is lower.
     * Set to `0` to disable.
     */
    vramPadding?: number | ((totalVram: number) => number),

    /**
     * Enable debug mode to find issues with llama.cpp.
     * Makes logs print directly to the console from `llama.cpp` and not through the provided logger.
     *
     * Defaults to `false`.
     *
     * The default can be set using the `NODE_LLAMA_CPP_DEBUG` environment variable.
     */
    debug?: boolean
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
    skipDownload?: boolean,

    /**
     * Pad the available VRAM for the memory size calculations, as these calculations are not always accurate.
     * Recommended to ensure stability.
     * This only affects the calculations of `"auto"` in function options and is not reflected in the `getVramState` function.
     *
     * Defaults to `6%` of the total VRAM or 300MB, whichever is lower.
     * Set to `0` to disable.
     */
    vramPadding?: number | ((totalVram: number) => number),

    /**
     * Enable debug mode to find issues with llama.cpp.
     * Makes logs print directly to the console from `llama.cpp` and not through the provided logger.
     *
     * Defaults to `false`.
     *
     * The default can be set using the `NODE_LLAMA_CPP_DEBUG` environment variable.
     */
    debug?: boolean
};

export const getLlamaFunctionName = "getLlama";

export const defaultLlamaVramPadding = (totalVram: number) => Math.floor(Math.min(totalVram * 0.06, 300 * 1024 * 1024));
const defaultBuildOption: Exclude<LlamaOptions["build"], undefined> = runningInElectron
    ? "never"
    : "auto";

/**
 * Get a `llama.cpp` binding.
 *
 * Defaults to use a local binary built using the `download` or `build` CLI commands if one exists,
 * otherwise, uses a prebuilt binary, and fallbacks to building from source if a prebuilt binary is not found.
 *
 * Pass `"lastBuild"` to default to use the last successful build created using the `download` or `build` CLI commands if one exists.
 */
export async function getLlama(options?: LlamaOptions): Promise<Llama>;
export async function getLlama(type: "lastBuild", lastBuildOptions?: LastBuildOptions): Promise<Llama>;
export async function getLlama(options?: LlamaOptions | "lastBuild", lastBuildOptions?: LastBuildOptions) {
    if (options === "lastBuild") {
        const lastBuildInfo = await getLastBuildInfo();
        const getLlamaOptions: LlamaOptions = {
            logLevel: lastBuildOptions?.logLevel ?? defaultLlamaCppLogLevel,
            logger: lastBuildOptions?.logger ?? Llama.defaultConsoleLogger,
            usePrebuiltBinaries: lastBuildOptions?.usePrebuiltBinaries ?? true,
            progressLogs: lastBuildOptions?.progressLogs ?? true,
            skipDownload: lastBuildOptions?.skipDownload ?? defaultSkipDownload,
            vramPadding: lastBuildOptions?.vramPadding ?? defaultLlamaVramPadding,
            debug: lastBuildOptions?.debug ?? defaultLlamaCppDebugMode
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
                    logLevel: lastBuildOptions?.logLevel ?? defaultLlamaCppLogLevel,
                    vramPadding: lastBuildOptions?.vramPadding ?? defaultLlamaVramPadding,
                    debug: lastBuildOptions?.debug ?? defaultLlamaCppDebugMode
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
    gpu = defaultLlamaCppGpuSupport,
    logLevel = defaultLlamaCppLogLevel,
    logger = Llama.defaultConsoleLogger,
    build = defaultBuildOption,
    cmakeOptions = {},
    existingPrebuiltBinaryMustMatchBuildOptions = false,
    usePrebuiltBinaries = true,
    progressLogs = true,
    skipDownload = defaultSkipDownload,
    vramPadding = defaultLlamaVramPadding,
    debug = defaultLlamaCppDebugMode
}: LlamaOptions, {
    updateLastBuildInfoOnCompile = false,
    skipLlamaInit = false
}: {
    updateLastBuildInfoOnCompile?: boolean,
    skipLlamaInit?: boolean
} = {}): Promise<Llama> {
    const platform = getPlatform();
    const arch = process.arch;

    if (logLevel == null) logLevel = defaultLlamaCppLogLevel;
    if (logger == null) logger = Llama.defaultConsoleLogger;
    if (build == null) build = defaultBuildOption;
    if (cmakeOptions == null) cmakeOptions = {};
    if (existingPrebuiltBinaryMustMatchBuildOptions == null) existingPrebuiltBinaryMustMatchBuildOptions = false;
    if (usePrebuiltBinaries == null) usePrebuiltBinaries = true;
    if (progressLogs == null) progressLogs = true;
    if (skipDownload == null) skipDownload = defaultSkipDownload;
    if (vramPadding == null) vramPadding = defaultLlamaVramPadding;
    if (debug == null) debug = defaultLlamaCppDebugMode;

    const clonedLlamaCppRepoReleaseInfo = await getClonedLlamaCppRepoReleaseInfo();
    let canUsePrebuiltBinaries = (build === "forceRebuild" || !usePrebuiltBinaries)
        ? false
        : await getCanUsePrebuiltBinaries();
    const buildGpusToTry: BuildGpu[] = await getGpuTypesToUseForOption(gpu, {platform, arch});
    const platformInfo = await getPlatformInfo();
    const llamaCppInfo: BuildOptions["llamaCpp"] = {
        repo: clonedLlamaCppRepoReleaseInfo?.llamaCppGithubRepo ?? builtinLlamaCppGitHubRepo,
        release: clonedLlamaCppRepoReleaseInfo?.tag ?? builtinLlamaCppRelease
    };
    let shouldLogNoGlibcWarningIfNoBuildIsAvailable = false;
    const canBuild = build !== "never" && !runningInsideAsar &&
        (!runningInElectron || await hasBuildingFromSourceDependenciesInstalled());

    if (canUsePrebuiltBinaries && platform === "linux") {
        if (!(await detectGlibc({platform}))) {
            canUsePrebuiltBinaries = false;
            shouldLogNoGlibcWarningIfNoBuildIsAvailable = true;
        }
    }

    if (buildGpusToTry.length === 0)
        throw new Error("No GPU types available to try building with");

    if (build === "auto" || build === "never") {
        for (let i = 0; i < buildGpusToTry.length; i++) {
            const gpu = buildGpusToTry[i];
            const isLastItem = i === buildGpusToTry.length - 1;

            const buildOptions: BuildOptions = {
                customCmakeOptions: resolveCustomCmakeOptions(cmakeOptions),
                progressLogs,
                platform,
                platformInfo,
                arch,
                gpu,
                llamaCpp: llamaCppInfo
            };

            const llama = await loadExistingLlamaBinary({
                buildOptions,
                canUsePrebuiltBinaries,
                logLevel,
                logger,
                existingPrebuiltBinaryMustMatchBuildOptions,
                progressLogs,
                platform,
                platformInfo,
                skipLlamaInit,
                vramPadding,
                fallbackMessage: !isLastItem
                    ? `falling back to using ${getPrettyBuildGpuName(buildGpusToTry[i + 1])}`
                    : (
                        canBuild
                            ? "falling back to building from source"
                            : null
                    ),
                debug
            });

            if (llama != null)
                return llama;
        }
    }

    if (shouldLogNoGlibcWarningIfNoBuildIsAvailable && progressLogs)
        await logNoGlibcWarning();

    if (!canBuild)
        throw new NoBinaryFoundError();

    const llamaCppRepoCloned = await isLlamaCppRepoCloned();
    if (!llamaCppRepoCloned) {
        if (skipDownload)
            throw new NoBinaryFoundError("No prebuilt binaries found, no llama.cpp source found and `skipDownload` or NODE_LLAMA_CPP_SKIP_DOWNLOAD env var is set to true, so llama.cpp cannot be built from source");

        llamaCppInfo.repo = defaultLlamaCppGitHubRepo;
        llamaCppInfo.release = defaultLlamaCppRelease;

        if (isGithubReleaseNeedsResolving(llamaCppInfo.release)) {
            const [owner, name] = defaultLlamaCppGitHubRepo.split("/");
            llamaCppInfo.release = await resolveGithubRelease(owner, name, llamaCppInfo.release);
        }
    }

    for (let i = 0; i < buildGpusToTry.length; i++) {
        const gpu = buildGpusToTry[i];
        const isLastItem = i === buildGpusToTry.length - 1;

        const buildOptions: BuildOptions = {
            customCmakeOptions: resolveCustomCmakeOptions(cmakeOptions),
            progressLogs,
            platform,
            platformInfo,
            arch,
            gpu,
            llamaCpp: llamaCppInfo
        };

        try {
            return await buildAndLoadLlamaBinary({
                buildOptions,
                skipDownload,
                logLevel,
                logger,
                updateLastBuildInfoOnCompile,
                vramPadding,
                skipLlamaInit,
                debug
            });
        } catch (err) {
            console.error(
                getConsoleLogPrefix() +
                `Failed to build llama.cpp with ${getPrettyBuildGpuName(gpu)} support. ` +
                (
                    !isLastItem
                        ? `falling back to building llama.cpp with ${getPrettyBuildGpuName(buildGpusToTry[i + 1])} support. `
                        : ""
                ) +
                "Error:",
                err
            );

            if (isLastItem)
                throw err;
        }
    }

    throw new Error("Failed to build llama.cpp");
}

async function loadExistingLlamaBinary({
    buildOptions,
    canUsePrebuiltBinaries,
    logLevel,
    logger,
    existingPrebuiltBinaryMustMatchBuildOptions,
    progressLogs,
    platform,
    platformInfo,
    skipLlamaInit,
    vramPadding,
    fallbackMessage,
    debug
}: {
    buildOptions: BuildOptions,
    canUsePrebuiltBinaries: boolean,
    logLevel: Required<LlamaOptions>["logLevel"],
    logger: Required<LlamaOptions>["logger"],
    existingPrebuiltBinaryMustMatchBuildOptions: boolean,
    progressLogs: boolean,
    platform: BinaryPlatform,
    platformInfo: BinaryPlatformInfo,
    skipLlamaInit: boolean,
    vramPadding: Required<LlamaOptions>["vramPadding"],
    fallbackMessage: string | null,
    debug: boolean
}) {
    const buildFolderName = await getBuildFolderNameForBuildOptions(buildOptions);

    const localBuildFolder = path.join(llamaLocalBuildBinsDirectory, buildFolderName.withCustomCmakeOptions);
    const localBuildBinPath = await getLocalBuildBinaryPath(buildFolderName.withCustomCmakeOptions);

    await waitForLockfileRelease({resourcePath: localBuildFolder});
    if (localBuildBinPath != null) {
        try {
            const buildMetadata = await getLocalBuildBinaryBuildMetadata(buildFolderName.withCustomCmakeOptions);
            const shouldTestBinaryBeforeLoading = getShouldTestBinaryBeforeLoading({
                isPrebuiltBinary: false,
                platform,
                platformInfo,
                buildMetadata
            });
            const binaryCompatible = shouldTestBinaryBeforeLoading
                ? await testBindingBinary(localBuildBinPath)
                : true;

            if (binaryCompatible) {
                const binding = loadBindingModule(localBuildBinPath);

                return await Llama._create({
                    bindings: binding,
                    buildType: "localBuild",
                    buildMetadata,
                    logLevel,
                    logger,
                    vramPadding,
                    skipLlamaInit,
                    debug
                });
            } else if (progressLogs) {
                console.warn(
                    getConsoleLogPrefix() + "The local build binary was not built in the current system and is incompatible with it"
                );

                if (canUsePrebuiltBinaries)
                    console.info(getConsoleLogPrefix() + "Falling back to prebuilt binaries");
                else if (fallbackMessage != null)
                    console.info(getConsoleLogPrefix() + fallbackMessage);
            }
        } catch (err) {
            const binaryDescription = describeBinary(buildOptions);
            console.error(getConsoleLogPrefix() + `Failed to load a local build ${binaryDescription}. Error:`, err);

            if (canUsePrebuiltBinaries)
                console.info(getConsoleLogPrefix() + "Falling back to prebuilt binaries");
            else if (fallbackMessage != null)
                console.info(getConsoleLogPrefix() + fallbackMessage);
        }
    }

    if (canUsePrebuiltBinaries) {
        const prebuiltBinDetails = await getPrebuiltBinaryPath(
            buildOptions,
            existingPrebuiltBinaryMustMatchBuildOptions
                ? buildFolderName.withCustomCmakeOptions
                : buildFolderName.withoutCustomCmakeOptions
        );

        if (prebuiltBinDetails != null) {
            try {
                const buildMetadata = await getPrebuiltBinaryBuildMetadata(prebuiltBinDetails.folderPath, prebuiltBinDetails.folderName);
                const shouldTestBinaryBeforeLoading = getShouldTestBinaryBeforeLoading({
                    isPrebuiltBinary: true,
                    platform,
                    platformInfo,
                    buildMetadata
                });
                const binaryCompatible = shouldTestBinaryBeforeLoading
                    ? await testBindingBinary(prebuiltBinDetails.binaryPath)
                    : true;

                if (binaryCompatible) {
                    const binding = loadBindingModule(prebuiltBinDetails.binaryPath);

                    return await Llama._create({
                        bindings: binding,
                        buildType: "prebuilt",
                        buildMetadata,
                        logLevel,
                        logger,
                        vramPadding,
                        skipLlamaInit,
                        debug
                    });
                } else if (progressLogs) {
                    const binaryDescription = describeBinary({
                        ...buildOptions,
                        customCmakeOptions: existingPrebuiltBinaryMustMatchBuildOptions
                            ? buildOptions.customCmakeOptions
                            : new Map()
                    });
                    console.warn(
                        getConsoleLogPrefix() +
                        `The prebuilt ${binaryDescription} is not compatible with the current system` + (
                            fallbackMessage != null
                                ? ", " + fallbackMessage
                                : ""
                        )
                    );
                }
            } catch (err) {
                const binaryDescription = describeBinary({
                    ...buildOptions,
                    customCmakeOptions: existingPrebuiltBinaryMustMatchBuildOptions
                        ? buildOptions.customCmakeOptions
                        : new Map()
                });
                console.error(
                    getConsoleLogPrefix() + `Failed to load a prebuilt ${binaryDescription}` + (
                        fallbackMessage != null
                            ? ", " + fallbackMessage
                            : ""
                    ) + ". Error:", err);
            }
        } else if (progressLogs)
            console.warn(
                getConsoleLogPrefix() + "A prebuilt binary was not found" + (
                    fallbackMessage != null
                        ? ", " + fallbackMessage
                        : ""
                )
            );
    }

    return null;
}

async function buildAndLoadLlamaBinary({
    buildOptions,
    skipDownload,
    logLevel,
    logger,
    updateLastBuildInfoOnCompile,
    vramPadding,
    skipLlamaInit,
    debug
}: {
    buildOptions: BuildOptions,
    skipDownload: boolean,
    logLevel: Required<LlamaOptions>["logLevel"],
    logger: Required<LlamaOptions>["logger"],
    updateLastBuildInfoOnCompile: boolean,
    vramPadding: Required<LlamaOptions>["vramPadding"],
    skipLlamaInit: boolean,
    debug: boolean
}) {
    const buildFolderName = await getBuildFolderNameForBuildOptions(buildOptions);

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
        logger,
        vramPadding,
        skipLlamaInit,
        debug
    });
}

async function logNoGlibcWarning() {
    console.warn(
        getConsoleLogPrefix() +
        "The prebuilt binaries cannot be used in this Linux distro, as `glibc` is not detected"
    );

    const linuxDistroInfo = await getLinuxDistroInfo();
    const isAlpineLinux = await isDistroAlpineLinux(linuxDistroInfo);

    if (isAlpineLinux) {
        console.warn(
            getConsoleLogPrefix() +
            "Using Alpine Linux is not recommended for running LLMs, " +
            "as using GPU drivers is complicated and suboptimal in this distro at the moment.\n" +
            getConsoleLogPrefix() +
            "Consider using a different Linux distro, such as Debian or Ubuntu.\n" +
            getConsoleLogPrefix() +
            `If you're trying to run this inside of a Docker container, consider using "${recommendedBaseDockerImage}" image`
        );
    }
}

function describeBinary(binaryOptions: BuildOptions) {
    let res = `binary for platform "${binaryOptions.platform}" "${binaryOptions.arch}"`;
    const additions: string[] = [];

    if (binaryOptions.gpu != false)
        additions.push(`with ${getPrettyBuildGpuName(binaryOptions.gpu)} support`);

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

function getShouldTestBinaryBeforeLoading({
    isPrebuiltBinary,
    platform,
    platformInfo,
    buildMetadata
}: {
    isPrebuiltBinary: boolean,
    platform: BinaryPlatform,
    platformInfo: BinaryPlatformInfo,
    buildMetadata: BuildMetadataFile
}) {
    if (platform === "linux") {
        if (isPrebuiltBinary)
            return true;

        if (platformInfo.name !== buildMetadata.buildOptions.platformInfo.name ||
            platformInfo.version !== buildMetadata.buildOptions.platformInfo.version
        )
            return true;
    } else if (platform === "win") {
        if (buildMetadata.buildOptions.gpu !== false)
            return true;
    }

    return false;
}
