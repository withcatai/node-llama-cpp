import path from "path";
import {fileURLToPath} from "url";
import process from "process";
import fs from "fs-extra";
import chalk from "chalk";
import which from "which";
import {
    buildMetadataFileName, documentationPageUrls, llamaCppDirectory, llamaDirectory, llamaLocalBuildBinsDirectory,
    llamaPrebuiltBinsDirectory, llamaToolchainsDirectory
} from "../../config.js";
import {BuildMetadataFile, BuildOptions, convertBuildOptionsToBuildOptionsJSON} from "../types.js";
import {spawnCommand, SpawnError} from "../../utils/spawnCommand.js";
import {downloadCmakeIfNeeded, fixXpackPermissions, getCmakePath, hasBuiltinCmake} from "../../utils/cmake.js";
import {getConsoleLogPrefix} from "../../utils/getConsoleLogPrefix.js";
import {withLockfile} from "../../utils/withLockfile.js";
import {getModuleVersion} from "../../utils/getModuleVersion.js";
import {ensureLlamaCppRepoIsCloned, isLlamaCppRepoCloned} from "./cloneLlamaCppRepo.js";
import {getBuildFolderNameForBuildOptions} from "./getBuildFolderNameForBuildOptions.js";
import {setLastBuildInfo} from "./lastBuildInfo.js";
import {getPlatform} from "./getPlatform.js";
import {logDistroInstallInstruction} from "./logDistroInstallInstruction.js";
import {testCmakeBinary} from "./testCmakeBinary.js";
import {getCudaNvccPaths} from "./detectAvailableComputeLayers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function compileLlamaCpp(buildOptions: BuildOptions, compileOptions: {
    nodeTarget?: string,
    updateLastBuildInfo?: boolean,
    includeBuildOptionsInBinaryFolderName?: boolean,
    ensureLlamaCppRepoIsCloned?: boolean,
    downloadCmakeIfNeeded?: boolean,
    ignoreWorkarounds?: ("cudaArchitecture")[],
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

    const buildFolderName = await getBuildFolderNameForBuildOptions(buildOptions);
    const finalBuildFolderName = includeBuildOptionsInBinaryFolderName
        ? buildFolderName.withCustomCmakeOptions
        : buildFolderName.withoutCustomCmakeOptions;

    const outDirectory = path.join(llamaLocalBuildBinsDirectory, finalBuildFolderName);

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
                const toolchainFile = await getToolchainFileForArch(buildOptions.arch);
                const runtimeVersion = nodeTarget.startsWith("v") ? nodeTarget.slice("v".length) : nodeTarget;
                const cmakeCustomOptions = new Map(buildOptions.customCmakeOptions);

                if (buildOptions.gpu === "metal" && process.platform === "darwin" && !cmakeCustomOptions.has("GGML_METAL"))
                    cmakeCustomOptions.set("GGML_METAL", "1");
                else if (!cmakeCustomOptions.has("GGML_METAL"))
                    cmakeCustomOptions.set("GGML_METAL", "OFF");

                // if (cmakeCustomOptions.get("GGML_METAL") === "1" && !cmakeCustomOptions.has("GGML_METAL_EMBED_LIBRARY"))
                //     cmakeCustomOptions.set("GGML_METAL_EMBED_LIBRARY", "1");

                if (buildOptions.gpu === "cuda" && !cmakeCustomOptions.has("GGML_CUDA"))
                    cmakeCustomOptions.set("GGML_CUDA", "1");

                if (buildOptions.gpu === "vulkan" && !cmakeCustomOptions.has("GGML_VULKAN"))
                    cmakeCustomOptions.set("GGML_VULKAN", "1");

                if (!cmakeCustomOptions.has("LLAMA_CCACHE"))
                    cmakeCustomOptions.set("LLAMA_CCACHE", "OFF");

                if (toolchainFile != null && !cmakeCustomOptions.has("CMAKE_TOOLCHAIN_FILE"))
                    cmakeCustomOptions.set("CMAKE_TOOLCHAIN_FILE", toolchainFile);

                if (ciMode) {
                    if (!cmakeCustomOptions.has("GGML_OPENMP"))
                        cmakeCustomOptions.set("GGML_OPENMP", "OFF");
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
                        "--config", "Release",
                        "--arch=" + buildOptions.arch,
                        "--out", path.relative(llamaDirectory, outDirectory),
                        "--runtime-version=" + runtimeVersion,
                        ...cmakePathArgs,
                        ...(
                            [...cmakeCustomOptions].map(([key, value]) => "--CD" + key + "=" + value)
                        )
                    ],
                    __dirname,
                    envVars,
                    buildOptions.progressLogs
                );

                const binFilesDirPaths = [
                    path.join(outDirectory, "bin"),
                    path.join(outDirectory, "llama.cpp", "bin")
                ];
                const compiledResultDirPath = path.join(outDirectory, "Release");

                if (!await fs.pathExists(compiledResultDirPath))
                    throw new Error("Could not find Release directory");

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
        const platform = getPlatform();
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
        } else if (platform === "mac" && await which("clang", {nothrow: true}) == null)
            console.info("\n" +
                getConsoleLogPrefix(true) +
                chalk.yellow("It seems that Xcode command line tools are not installed in your system. Install it to resolve build issues\n") +
                getConsoleLogPrefix(true) +
                chalk.yellow('To install Xcode command line tools, run "xcode-select --install"')
            );
        else if (buildOptions.gpu === "cuda") {
            if (!ignoreWorkarounds.includes("cudaArchitecture") && (platform === "win" || platform === "linux") &&
                err instanceof SpawnError && (
                err.combinedStd.toLowerCase().includes("Failed to detect a default CUDA architecture".toLowerCase()) || (
                    err.combinedStd.toLowerCase().includes(
                        "Tell CMake where to find the compiler by setting either the environment".toLowerCase()
                    ) &&
                    err.combinedStd.toLowerCase().includes(
                        'variable "CUDACXX" or the CMake cache entry CMAKE_CUDA_COMPILER to the full'.toLowerCase()
                    )
                )
            )) {
                for (const nvccPath of await getCudaNvccPaths()) {
                    if (buildOptions.progressLogs)
                        console.info(
                            getConsoleLogPrefix(true) + `Trying to compile again with "CUDACXX=${nvccPath}" environment variable`
                        );

                    try {
                        return await compileLlamaCpp(buildOptions, {
                            ...compileOptions,
                            envVars: {
                                ...envVars,
                                CUDACXX: nvccPath
                            },
                            ignoreWorkarounds: [...ignoreWorkarounds, "cudaArchitecture"]
                        });
                    } catch (err) {
                        if (buildOptions.progressLogs)
                            console.error(getConsoleLogPrefix(true, false), err);
                    }
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

        throw err;
    }
}

export async function getLocalBuildBinaryPath(folderName: string) {
    const binaryPath = path.join(llamaLocalBuildBinsDirectory, folderName, "Release", "llama-addon.node");
    const buildMetadataFilePath = path.join(llamaLocalBuildBinsDirectory, folderName, "Release", buildMetadataFileName);
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
    const buildMetadataFilePath = path.join(llamaLocalBuildBinsDirectory, folderName, "Release", buildMetadataFileName);

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
            folderPath: localPrebuiltBinaryDirectoryPath
        };

    const packagePrebuiltBinariesDirectoryPath = await getPrebuiltBinariesPackageDirectoryForBuildOptions(buildOptions);
    if (packagePrebuiltBinariesDirectoryPath == null)
        return null;

    const packagePrebuiltBinaryDirectoryPath = path.join(packagePrebuiltBinariesDirectoryPath, folderName);
    const binaryPathFromPackage = await resolvePrebuiltBinaryPath(packagePrebuiltBinaryDirectoryPath);

    if (binaryPathFromPackage != null)
        return {
            binaryPath: binaryPathFromPackage,
            folderName,
            folderPath: packagePrebuiltBinaryDirectoryPath
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

async function applyResultDirFixes(resultDirPath: string, tempDirPath: string) {
    const releaseDirPath = path.join(resultDirPath, "Release");

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
            const {binsDir, packageVersion} =  binariesModule?.getBinsDir?.() ?? {};

            if (binsDir == null || packageVersion !== currentModuleVersion)
                return null;

            return binsDir;
        } catch (err) {
            return null;
        }
    }

    if (buildOptions.platform === "win" && buildOptions.arch === "x64" && buildOptions.gpu === "cuda")
        // @ts-ignore
        return getBinariesPathFromModules(() => import("@node-llama-cpp/win-x64-cuda"));
    else if (buildOptions.platform === "linux" && buildOptions.arch === "x64" && buildOptions.gpu === "cuda")
        // @ts-ignore
        return getBinariesPathFromModules(() => import("@node-llama-cpp/linux-x64-cuda"));

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

async function getToolchainFileForArch(targetArch: string) {
    if (process.arch === targetArch)
        return null;

    const platform = process.platform;
    const hostArch = process.arch;

    const toolchainFilename = `${platform}.host-${hostArch}.target-${targetArch}.cmake`;

    const filePath = path.join(llamaToolchainsDirectory, toolchainFilename);

    if (await fs.pathExists(filePath))
        return filePath;

    return null;
}
