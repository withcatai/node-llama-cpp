import path from "path";
import {fileURLToPath} from "url";
import process from "process";
import os from "os";
import fs from "fs-extra";
import chalk from "chalk";
import which from "which";
import {
    buildMetadataFileName, documentationPageUrls, llamaCppDirectory, llamaDirectory, llamaLocalBuildBinsDirectory,
    llamaPrebuiltBinsDirectory, llamaToolchainsDirectory
} from "../../config.js";
import {BuildGpu, BuildMetadataFile, BuildOptions, convertBuildOptionsToBuildOptionsJSON} from "../types.js";
import {spawnCommand, SpawnError} from "../../utils/spawnCommand.js";
import {downloadCmakeIfNeeded, fixXpackPermissions, getCmakePath, hasBuiltinCmake} from "../../utils/cmake.js";
import {getConsoleLogPrefix} from "../../utils/getConsoleLogPrefix.js";
import {withLockfile} from "../../utils/withLockfile.js";
import {getModuleVersion} from "../../utils/getModuleVersion.js";
import {ensureLlamaCppRepoIsCloned, isLlamaCppRepoCloned} from "./cloneLlamaCppRepo.js";
import {getBuildFolderNameForBuildOptions} from "./getBuildFolderNameForBuildOptions.js";
import {setLastBuildInfo} from "./lastBuildInfo.js";
import {BinaryPlatform, getPlatform} from "./getPlatform.js";
import {logDistroInstallInstruction} from "./logDistroInstallInstruction.js";
import {testCmakeBinary} from "./testCmakeBinary.js";
import {getCudaNvccPaths} from "./detectAvailableComputeLayers.js";
import {detectWindowsBuildTools} from "./detectBuildTools.js";
import {asyncSome} from "./asyncSome.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildConfigType: "Release" | "RelWithDebInfo" | "Debug" = "Release";

const requiresMsvcOnWindowsFlags = ["blas", "cann", "cuda", "hip", "kompute", "musa", "sycl", "opencl"]
    .map((backend) => ("GGML_" + backend.toUpperCase()));

export async function compileLlamaCpp(buildOptions: BuildOptions, compileOptions: {
    nodeTarget?: string,
    updateLastBuildInfo?: boolean,
    includeBuildOptionsInBinaryFolderName?: boolean,
    ensureLlamaCppRepoIsCloned?: boolean,
    downloadCmakeIfNeeded?: boolean,
    ignoreWorkarounds?: ("cudaArchitecture" | "reduceParallelBuildThreads" | "singleBuildThread" | "avoidWindowsLlvm")[],
    envVars?: typeof process.env,
    ciMode?: boolean
}): Promise<void> {
    const {
        nodeTarget = process.version,
        updateLastBuildInfo: updateLastBuildInfoArg = true,
        includeBuildOptionsInBinaryFolderName = true,
        ensureLlamaCppRepoIsCloned: ensureLlamaCppRepoIsClonedArg = false,
        downloadCmakeIfNeeded: downloadCmakeIfNeededArg = false,
        ignoreWorkarounds = [],
        envVars = process.env,
        ciMode = false
    } = compileOptions;

    const platform = getPlatform();
    const buildFolderName = await getBuildFolderNameForBuildOptions(buildOptions);
    const finalBuildFolderName = includeBuildOptionsInBinaryFolderName
        ? buildFolderName.withCustomCmakeOptions
        : buildFolderName.withoutCustomCmakeOptions;
    const useWindowsLlvm = (
        platform === "win" &&
        (
            buildOptions.gpu === false ||
            buildOptions.gpu === "vulkan"
        ) &&
        !ignoreWorkarounds.includes("avoidWindowsLlvm") &&
        !buildOptions.customCmakeOptions.has("CMAKE_TOOLCHAIN_FILE") &&
        !requiresMsvcOnWindowsFlags.some((flag) => buildOptions.customCmakeOptions.has(flag))
    )
        ? areWindowsBuildToolsCapableForLlvmBuild(await detectWindowsBuildTools())
        : false;

    const outDirectory = path.join(llamaLocalBuildBinsDirectory, finalBuildFolderName);

    let parallelBuildThreads = getParallelBuildThreadsToUse(platform, buildOptions.gpu, ciMode);
    if (ignoreWorkarounds.includes("singleBuildThread"))
        parallelBuildThreads = 1;
    else if (ignoreWorkarounds.includes("reduceParallelBuildThreads"))
        parallelBuildThreads = reduceParallelBuildThreads(parallelBuildThreads);

    await fs.mkdirp(llamaLocalBuildBinsDirectory);
    try {
        await withLockfile({
            resourcePath: outDirectory
        }, async () => {
            try {
                if (ensureLlamaCppRepoIsClonedArg)
                    await ensureLlamaCppRepoIsCloned({progressLogs: buildOptions.progressLogs});
                else if (!(await isLlamaCppRepoCloned()))
                    throw new Error(`"${llamaCppDirectory}" directory does not exist`);

                if (downloadCmakeIfNeededArg)
                    await downloadCmakeIfNeeded(buildOptions.progressLogs);

                const cmakePathArgs = await getCmakePathArgs();
                const cmakeGeneratorArgs = getCmakeGeneratorArgs(buildOptions.platform, buildOptions.arch, useWindowsLlvm);
                const toolchainFile = await getToolchainFileForArch(buildOptions.arch, useWindowsLlvm);
                const runtimeVersion = nodeTarget.startsWith("v") ? nodeTarget.slice("v".length) : nodeTarget;
                const cmakeCustomOptions = new Map(buildOptions.customCmakeOptions);
                const cmakeToolchainOptions = new Map<string, string>();

                if (!cmakeCustomOptions.has("GGML_BUILD_NUMBER"))
                    cmakeCustomOptions.set("GGML_BUILD_NUMBER", "1");

                cmakeCustomOptions.set("CMAKE_CONFIGURATION_TYPES", buildConfigType);
                cmakeCustomOptions.set("NLC_CURRENT_PLATFORM", platform + "-" + process.arch);
                cmakeCustomOptions.set("NLC_TARGET_PLATFORM", buildOptions.platform + "-" + buildOptions.arch);
                cmakeCustomOptions.set("NLC_VARIANT", buildFolderName.binVariant);

                if (toolchainFile != null && !cmakeCustomOptions.has("CMAKE_TOOLCHAIN_FILE"))
                    cmakeToolchainOptions.set("CMAKE_TOOLCHAIN_FILE", toolchainFile);

                if (toolchainFile != null &&
                    buildOptions.gpu === "vulkan" &&
                    (useWindowsLlvm || (platform === "win" && buildOptions.arch === "arm64")) &&
                    !cmakeCustomOptions.has("GGML_VULKAN_SHADERS_GEN_TOOLCHAIN")
                )
                    cmakeToolchainOptions.set("GGML_VULKAN_SHADERS_GEN_TOOLCHAIN", toolchainFile);

                if (buildOptions.gpu === "metal" && process.platform === "darwin" && !cmakeCustomOptions.has("GGML_METAL"))
                    cmakeCustomOptions.set("GGML_METAL", "1");
                else if (!cmakeCustomOptions.has("GGML_METAL"))
                    cmakeCustomOptions.set("GGML_METAL", "OFF");

                if (buildOptions.gpu === "cuda" && !cmakeCustomOptions.has("GGML_CUDA"))
                    cmakeCustomOptions.set("GGML_CUDA", "1");

                if (buildOptions.gpu === "vulkan" && !cmakeCustomOptions.has("GGML_VULKAN"))
                    cmakeCustomOptions.set("GGML_VULKAN", "1");

                if (!cmakeCustomOptions.has("GGML_CCACHE"))
                    cmakeCustomOptions.set("GGML_CCACHE", "OFF");

                if (!cmakeCustomOptions.has("LLAMA_CURL") || isCmakeValueOff(cmakeCustomOptions.get("LLAMA_CURL"))) {
                    cmakeCustomOptions.set("LLAMA_CURL", "OFF");

                    // avoid linking to extra libraries that we don't use
                    if (!cmakeCustomOptions.has("LLAMA_OPENSSL"))
                        cmakeCustomOptions.set("LLAMA_OPENSSL", "OFF");
                }

                if (buildOptions.platform === "win" && buildOptions.arch === "arm64" && !cmakeCustomOptions.has("GGML_OPENMP"))
                    cmakeCustomOptions.set("GGML_OPENMP", "OFF");

                if (useWindowsLlvm)
                    cmakeCustomOptions.set("GGML_OPENMP", "OFF");

                if (ciMode) {
                    if (!cmakeCustomOptions.has("GGML_OPENMP"))
                        cmakeCustomOptions.set("GGML_OPENMP", "OFF");

                    if (!cmakeCustomOptions.has("GGML_NATIVE") || isCmakeValueOff(cmakeCustomOptions.get("GGML_NATIVE"))) {
                        cmakeCustomOptions.set("GGML_NATIVE", "OFF");

                        if (buildOptions.arch === "x64" && !cmakeCustomOptions.has("GGML_CPU_ALL_VARIANTS")) {
                            cmakeCustomOptions.set("GGML_CPU_ALL_VARIANTS", "ON");
                            cmakeCustomOptions.set("GGML_BACKEND_DL", "ON");
                        } else if (!cmakeCustomOptions.has("GGML_BACKEND_DL"))
                            cmakeCustomOptions.set("GGML_BACKEND_DL", "ON");
                    }
                }

                await fs.remove(outDirectory);

                await spawnCommand(
                    "npm",
                    [
                        "run", "-s", "cmake-js-llama", "--", "clean",
                        "--log-level", "warn",
                        "--out", path.relative(llamaDirectory, outDirectory),
                        ...cmakePathArgs
                    ],
                    __dirname,
                    envVars,
                    buildOptions.progressLogs
                );

                await spawnCommand(
                    "npm",
                    [
                        "run", "-s", "cmake-js-llama", "--", "compile",
                        "--log-level", "warn",
                        "--config", buildConfigType,
                        "--arch=" + buildOptions.arch,
                        "--out", path.relative(llamaDirectory, outDirectory),
                        "--runtime-version=" + runtimeVersion,
                        "--parallel=" + parallelBuildThreads,
                        ...cmakeGeneratorArgs,
                        ...cmakePathArgs,
                        ...(
                            [
                                ...cmakeCustomOptions,
                                ...cmakeToolchainOptions
                            ].map(([key, value]) => "--CD" + key + "=" + value)
                        )
                    ],
                    __dirname,
                    envVars,
                    buildOptions.progressLogs
                );

                const compiledResultDirPath = await moveBuildFilesToResultDir(outDirectory);

                await fs.writeFile(path.join(compiledResultDirPath, buildMetadataFileName), JSON.stringify({
                    buildOptions: convertBuildOptionsToBuildOptionsJSON(buildOptions)
                } satisfies BuildMetadataFile), "utf8");

                await fs.writeFile(path.join(outDirectory, "buildDone.status"), "", "utf8");

                if (updateLastBuildInfoArg) {
                    await setLastBuildInfo({
                        folderName: finalBuildFolderName
                    });
                }
            } finally {
                await fixXpackPermissions();
            }
        });
    } catch (err) {
        if (platform === "linux" && await which("make", {nothrow: true}) == null) {
            console.info("\n" +
                getConsoleLogPrefix(true) +
                chalk.yellow('It seems that "make" is not installed in your system. Install it to resolve build issues')
            );
            await logDistroInstallInstruction('To install "make", ', {
                linuxPackages: {apt: ["make"], apk: ["make"]},
                macOsPackages: {brew: ["make"]}
            });
        } else if (platform === "linux" && !(await testCmakeBinary(await getCmakePath()))) {
            console.info("\n" +
                getConsoleLogPrefix(true) +
                chalk.yellow('It seems that the used "cmake" doesn\'t work properly. Install it on your system to resolve build issues')
            );
            await logDistroInstallInstruction('To install "cmake", ', {
                linuxPackages: {apt: ["cmake"], apk: ["cmake"]},
                macOsPackages: {brew: ["cmake"]}
            });
        } else if (platform === "mac" && (
            (await which("clang", {nothrow: true})) == null || (
                err instanceof SpawnError &&
                err.combinedStd.toLowerCase().includes('"/usr/bin/cc" is not able to compile a simple test program')
            )
        ))
            console.info("\n" +
                getConsoleLogPrefix(true) +
                chalk.yellow("It seems that Xcode command line tools are not installed in your system. Install it to resolve build issues\n") +
                getConsoleLogPrefix(true) +
                chalk.yellow('To install Xcode command line tools, run "xcode-select --install"')
            );
        else if (buildOptions.gpu === "cuda") {
            if (!ignoreWorkarounds.includes("cudaArchitecture") && (platform === "win" || platform === "linux") &&
                err instanceof SpawnError && (
                err.combinedStd.toLowerCase().includes("CUDA Toolkit not found".toLowerCase()) ||
                err.combinedStd.toLowerCase().includes("Failed to detect a default CUDA architecture".toLowerCase()) ||
                err.combinedStd.toLowerCase().includes("CMAKE_CUDA_COMPILER-NOTFOUND".toLowerCase()) || (
                    err.combinedStd.toLowerCase().includes(
                        "Tell CMake where to find the compiler by setting either the environment".toLowerCase()
                    ) &&
                    err.combinedStd.toLowerCase().includes(
                        'variable "CUDACXX" or the CMake cache entry CMAKE_CUDA_COMPILER to the full'.toLowerCase()
                    )
                ) || (
                    err.combinedStd.toLowerCase().includes("The CUDA compiler".toLowerCase()) &&
                    err.combinedStd.toLowerCase().includes("is not able to compile a simple test program".toLowerCase()) &&
                    err.combinedStd.toLowerCase().includes("nvcc fatal".toLowerCase())
                )
            )) {
                for (const {nvccPath, cudaHomePath} of await getCudaNvccPaths()) {
                    if (buildOptions.progressLogs)
                        console.info(
                            getConsoleLogPrefix(true) +
                            `Trying to compile again with "CUDACXX=${nvccPath}" and "CUDA_PATH=${cudaHomePath}" environment variables`
                        );

                    try {
                        return await compileLlamaCpp(buildOptions, {
                            ...compileOptions,
                            envVars: {
                                ...envVars,
                                CUDACXX: nvccPath,
                                "CUDA_PATH": cudaHomePath
                            },
                            ignoreWorkarounds: [...ignoreWorkarounds, "cudaArchitecture"]
                        });
                    } catch (err) {
                        if (buildOptions.progressLogs)
                            console.error(getConsoleLogPrefix(true, false), err);
                    }
                }
            } else if (
                (!ignoreWorkarounds.includes("reduceParallelBuildThreads") || !ignoreWorkarounds.includes("singleBuildThread")) &&
                (platform === "win" || platform === "linux") &&
                err instanceof SpawnError &&
                reduceParallelBuildThreads(parallelBuildThreads) !== parallelBuildThreads && (
                    err.combinedStd.toLowerCase().includes("LLVM error : out of memory".toLowerCase()) ||
                    err.combinedStd.toLowerCase().includes("compiler is out of heap space".toLowerCase())
                )
            ) {
                if (buildOptions.progressLogs) {
                    if (ignoreWorkarounds.includes("reduceParallelBuildThreads"))
                        console.info(
                            getConsoleLogPrefix(true) + "Trying to compile again with a single build thread"
                        );
                    else
                        console.info(
                            getConsoleLogPrefix(true) + "Trying to compile again with reduced parallel build threads"
                        );
                }

                try {
                    return await compileLlamaCpp(buildOptions, {
                        ...compileOptions,
                        ignoreWorkarounds: [
                            ...ignoreWorkarounds,
                            ignoreWorkarounds.includes("reduceParallelBuildThreads")
                                ? "singleBuildThread"
                                : "reduceParallelBuildThreads"
                        ]
                    });
                } catch (err) {
                    if (buildOptions.progressLogs)
                        console.error(getConsoleLogPrefix(true, false), err);
                }
            }

            console.info("\n" +
                getConsoleLogPrefix(true) +
                chalk.yellow("To resolve errors related to CUDA compilation, see the CUDA guide: ") +
                documentationPageUrls.CUDA
            );
        } else if (buildOptions.gpu === "vulkan")
            console.info("\n" +
                getConsoleLogPrefix(true) +
                chalk.yellow("To resolve errors related to Vulkan compilation, see the Vulkan guide: ") +
                documentationPageUrls.Vulkan
            );
        else if (useWindowsLlvm && !ciMode) {
            if (buildOptions.progressLogs)
                console.info(getConsoleLogPrefix(true) + "Trying to compile again without LLVM");

            try {
                return await compileLlamaCpp(buildOptions, {
                    ...compileOptions,
                    ignoreWorkarounds: [...ignoreWorkarounds, "avoidWindowsLlvm"]
                });
            } catch (err) {
                if (buildOptions.progressLogs)
                    console.error(getConsoleLogPrefix(true, false), err);
            }
        }

        throw err;
    }
}

export async function getLocalBuildBinaryPath(folderName: string) {
    const binaryPath = path.join(llamaLocalBuildBinsDirectory, folderName, buildConfigType, "llama-addon.node");
    const buildMetadataFilePath = path.join(llamaLocalBuildBinsDirectory, folderName, buildConfigType, buildMetadataFileName);
    const buildDoneStatusPath = path.join(llamaLocalBuildBinsDirectory, folderName, "buildDone.status");

    const [
        binaryExists,
        buildMetadataExists,
        buildDoneStatusExists
    ] = await Promise.all([
        fs.pathExists(binaryPath),
        fs.pathExists(buildMetadataFilePath),
        fs.pathExists(buildDoneStatusPath)
    ]);

    if (binaryExists && buildMetadataExists && buildDoneStatusExists)
        return binaryPath;

    return null;
}

export async function getLocalBuildBinaryBuildMetadata(folderName: string) {
    const buildMetadataFilePath = path.join(llamaLocalBuildBinsDirectory, folderName, buildConfigType, buildMetadataFileName);

    if (!(await fs.pathExists(buildMetadataFilePath)))
        throw new Error(`Could not find build metadata file for local build "${folderName}"`);

    const buildMetadata: BuildMetadataFile = await fs.readJson(buildMetadataFilePath);
    return buildMetadata;
}

export async function getPrebuiltBinaryPath(buildOptions: BuildOptions, folderName: string) {
    const localPrebuiltBinaryDirectoryPath = path.join(llamaPrebuiltBinsDirectory, folderName);

    const binaryPath = await resolvePrebuiltBinaryPath(localPrebuiltBinaryDirectoryPath);

    if (binaryPath != null)
        return {
            binaryPath,
            folderName,
            folderPath: localPrebuiltBinaryDirectoryPath,
            extBackendsPath: undefined
        };

    const packagePrebuiltBinariesDirectoryPath = await getPrebuiltBinariesPackageDirectoryForBuildOptions(buildOptions);
    if (packagePrebuiltBinariesDirectoryPath == null)
        return null;

    const prebuiltBinariesDirPath = typeof packagePrebuiltBinariesDirectoryPath === "string"
        ? packagePrebuiltBinariesDirectoryPath
        : packagePrebuiltBinariesDirectoryPath.binsDir;
    const prebuiltBinariesExtDirPath = typeof packagePrebuiltBinariesDirectoryPath === "string"
        ? undefined
        : packagePrebuiltBinariesDirectoryPath.extBinsDir;

    const packagePrebuiltBinaryDirectoryPath = path.join(prebuiltBinariesDirPath, folderName);
    const extPackagePrebuiltBinaryDirectoryPath = prebuiltBinariesExtDirPath == null
        ? undefined
        : path.join(prebuiltBinariesExtDirPath, folderName);

    const binaryPathFromPackage = await resolvePrebuiltBinaryPath(packagePrebuiltBinaryDirectoryPath);

    if (binaryPathFromPackage != null)
        return {
            binaryPath: binaryPathFromPackage,
            folderName,
            folderPath: packagePrebuiltBinaryDirectoryPath,
            extBackendsPath: extPackagePrebuiltBinaryDirectoryPath
        };

    return null;
}

export async function getPrebuiltBinaryBuildMetadata(folderPath: string, folderName: string) {
    const buildMetadataFilePath = path.join(folderPath, buildMetadataFileName);

    if (!(await fs.pathExists(buildMetadataFilePath)))
        throw new Error(`Could not find build metadata file for prebuilt build "${folderName}"`);

    const buildMetadata: BuildMetadataFile = await fs.readJson(buildMetadataFilePath);
    return buildMetadata;
}

async function moveBuildFilesToResultDir(outDirectory: string, canCreateReleaseDir: boolean = false) {
    const binFilesDirPaths = [
        path.join(outDirectory, "bin"),
        path.join(outDirectory, "llama.cpp", "bin")
    ];
    const compiledResultDirPath = path.join(outDirectory, buildConfigType);

    if (!await fs.pathExists(compiledResultDirPath)) {
        if (canCreateReleaseDir) {
            if (await asyncSome(binFilesDirPaths.map((dirPath) => fs.pathExists(dirPath))))
                await fs.ensureDir(compiledResultDirPath);
            else
                throw new Error(`Could not find ${buildConfigType} directory or any other output directory`);
        } else
            throw new Error(`Could not find ${buildConfigType} directory`);
    }

    for (const binFilesDirPath of binFilesDirPaths) {
        if (await fs.pathExists(binFilesDirPath)) {
            const itemNames = await fs.readdir(binFilesDirPath);

            await Promise.all(
                itemNames.map((itemName) => (
                    fs.copy(path.join(binFilesDirPath, itemName), path.join(compiledResultDirPath, itemName), {
                        overwrite: false
                    })
                ))
            );
        }
    }

    await applyResultDirFixes(compiledResultDirPath, path.join(outDirectory, "_temp"));

    return compiledResultDirPath;
}

async function applyResultDirFixes(resultDirPath: string, tempDirPath: string) {
    const releaseDirPath = path.join(resultDirPath, buildConfigType);

    if (await fs.pathExists(releaseDirPath)) {
        await fs.remove(tempDirPath);
        await fs.move(releaseDirPath, tempDirPath);

        const itemNames = await fs.readdir(tempDirPath);

        await Promise.all(
            itemNames.map((itemName) => (
                fs.move(path.join(tempDirPath, itemName), path.join(resultDirPath, itemName), {
                    overwrite: true
                })
            ))
        );

        await fs.remove(tempDirPath);
    }

    // the vulkan-shaders-gen binary is not needed at runtime
    const vulkanShadersGenBinary = path.join(
        resultDirPath,
        getPlatform() === "win"
            ? "vulkan-shaders-gen.exe"
            : "vulkan-shaders-gen"
    );
    await fs.remove(vulkanShadersGenBinary);
}

async function resolvePrebuiltBinaryPath(prebuiltBinaryDirectoryPath: string) {
    const binaryPath = path.join(prebuiltBinaryDirectoryPath, "llama-addon.node");
    const buildMetadataFilePath = path.join(prebuiltBinaryDirectoryPath, buildMetadataFileName);

    const [
        binaryExists,
        buildMetadataExists
    ] = await Promise.all([
        fs.pathExists(binaryPath),
        fs.pathExists(buildMetadataFilePath)
    ]);

    if (binaryExists && buildMetadataExists)
        return binaryPath;

    return null;
}

function getPrebuiltBinariesPackageDirectoryForBuildOptions(buildOptions: BuildOptions) {
    async function getBinariesPathFromModules(moduleImport: () => Promise<{getBinsDir(): {binsDir: string, packageVersion: string}}>) {
        try {
            const [
                binariesModule,
                currentModuleVersion
            ] = await Promise.all([
                moduleImport(),
                getModuleVersion()
            ]);
            const {binsDir, packageVersion} = binariesModule?.getBinsDir?.() ?? {};

            if (binsDir == null || packageVersion !== currentModuleVersion)
                return null;

            return binsDir;
        } catch (err) {
            return null;
        }
    }

    async function getBinariesPathFromModulesWithExtModule(
        moduleImport: () => Promise<{getBinsDir(): {binsDir: string, packageVersion: string}}>,
        extModuleImport: () => Promise<{getBinsDir(): {binsDir: string, packageVersion: string}}>
    ) {
        const [
            moduleBinsDir,
            extModuleBinsDir
        ] = await Promise.all([
            getBinariesPathFromModules(moduleImport),
            getBinariesPathFromModules(extModuleImport)
        ]);

        if (moduleBinsDir == null)
            return null;
        else if (extModuleBinsDir == null)
            return moduleBinsDir;

        return {
            binsDir: moduleBinsDir,
            extBinsDir: extModuleBinsDir
        };
    }

    /* eslint-disable import/no-unresolved */
    if (buildOptions.platform === "mac") {
        if (buildOptions.arch === "arm64" && buildOptions.gpu === "metal")
            // @ts-ignore
            return getBinariesPathFromModules(() => import("@node-llama-cpp/mac-arm64-metal"));
        else if (buildOptions.arch === "x64" && buildOptions.gpu === false)
            // @ts-ignore
            return getBinariesPathFromModules(() => import("@node-llama-cpp/mac-x64"));
    } else if (buildOptions.platform === "linux") {
        if (buildOptions.arch === "x64") {
            if (buildOptions.gpu === "cuda")
                return getBinariesPathFromModulesWithExtModule(
                    // @ts-ignore
                    () => import("@node-llama-cpp/linux-x64-cuda"),
                    // @ts-ignore
                    () => import("@node-llama-cpp/linux-x64-cuda-ext")
                );
            else if (buildOptions.gpu === "vulkan")
                // @ts-ignore
                return getBinariesPathFromModules(() => import("@node-llama-cpp/linux-x64-vulkan"));
            else if (buildOptions.gpu === false)
                // @ts-ignore
                return getBinariesPathFromModules(() => import("@node-llama-cpp/linux-x64"));
        } else if (buildOptions.arch === "arm64")
            // @ts-ignore
            return getBinariesPathFromModules(() => import("@node-llama-cpp/linux-arm64"));
        else if (buildOptions.arch === "arm")
            // @ts-ignore
            return getBinariesPathFromModules(() => import("@node-llama-cpp/linux-armv7l"));
    } else if (buildOptions.platform === "win") {
        if (buildOptions.arch === "x64") {
            if (buildOptions.gpu === "cuda")
                return getBinariesPathFromModulesWithExtModule(
                    // @ts-ignore
                    () => import("@node-llama-cpp/win-x64-cuda"),
                    // @ts-ignore
                    () => import("@node-llama-cpp/win-x64-cuda-ext")
                );
            else if (buildOptions.gpu === "vulkan")
                // @ts-ignore
                return getBinariesPathFromModules(() => import("@node-llama-cpp/win-x64-vulkan"));
            else if (buildOptions.gpu === false)
                // @ts-ignore
                return getBinariesPathFromModules(() => import("@node-llama-cpp/win-x64"));
        } else if (buildOptions.arch === "arm64")
            // @ts-ignore
            return getBinariesPathFromModules(() => import("@node-llama-cpp/win-arm64"));
    }
    /* eslint-enable import/no-unresolved */

    return null;
}

async function getCmakePathArgs() {
    if (await hasBuiltinCmake())
        return [];

    const cmakePath = await getCmakePath();

    if (cmakePath == null)
        return [];

    return ["--cmake-path", cmakePath];
}

async function getToolchainFileForArch(targetArch: string, windowsLlvmSupport: boolean = false) {
    let toolchainPrefix = "";

    if (process.platform === "win32" && process.arch === "arm64") {
        // a toolchain is needed to cross-compile to arm64 on Windows, and to compile on arm64 on Windows
    } else if (process.platform === "win32" && process.arch === "x64" && targetArch === "x64" && windowsLlvmSupport) {
        toolchainPrefix = "llvm.";
    } else if (process.arch === targetArch)
        return null;

    const platform = process.platform;
    const hostArch = process.arch;

    const toolchainFilename = `${toolchainPrefix}${platform}.host-${hostArch}.target-${targetArch}.cmake`;

    const filePath = path.join(llamaToolchainsDirectory, toolchainFilename);

    if (await fs.pathExists(filePath))
        return path.resolve(filePath);

    return null;
}

function getCmakeGeneratorArgs(targetPlatform: BinaryPlatform, targetArch: string, windowsLlvmSupport: boolean) {
    if (targetPlatform === "win" && targetArch === "arm64")
        return ["--generator", "Ninja Multi-Config"];
    else if (windowsLlvmSupport && targetPlatform === "win" && process.arch === "x64" && targetArch === "x64")
        return ["--generator", "Ninja Multi-Config"];

    return [];
}

function getParallelBuildThreadsToUse(platform: BinaryPlatform, gpu?: BuildGpu, ciMode: boolean = false) {
    const cpuCount = os.cpus().length;

    if (ciMode && platform === "win" && gpu === "cuda" && cpuCount === 4)
        return 3; // workaround for `compiler is out of heap space` error on GitHub Actions on Windows when building with CUDA

    if (cpuCount <= 4)
        return cpuCount;

    if (platform === "mac" && process.arch === "arm64")
        return cpuCount - 1;

    return cpuCount - 2;
}

function reduceParallelBuildThreads(originalParallelBuildThreads: number) {
    return Math.max(1, Math.round(originalParallelBuildThreads / 2));
}

function isCmakeValueOff(value?: string) {
    return value === "OFF" || value === "0";
}

function areWindowsBuildToolsCapableForLlvmBuild(detectedBuildTools: Awaited<ReturnType<typeof detectWindowsBuildTools>>) {
    return detectedBuildTools.hasLlvm && detectedBuildTools.hasNinja && detectedBuildTools.hasLibExe;
}
