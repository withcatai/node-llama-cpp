import path from "path";
import {fileURLToPath} from "url";
import process from "process";
import fs from "fs-extra";
import chalk from "chalk";
import {
    buildMetadataFileName, documentationPageUrls, llamaCppDirectory, llamaDirectory, llamaLocalBuildBinsDirectory,
    llamaPrebuiltBinsDirectory, llamaToolchainsDirectory
} from "../../config.js";
import {BuildMetadataFile, BuildOptions, convertBuildOptionsToBuildOptionsJSON} from "../types.js";
import {spawnCommand} from "../../utils/spawnCommand.js";
import {downloadCmakeIfNeeded, fixXpackPermissions, getCmakePath, hasBuiltinCmake} from "../../utils/cmake.js";
import {getConsoleLogPrefix} from "../../utils/getConsoleLogPrefix.js";
import {withLockfile} from "../../utils/withLockfile.js";
import {ensureLlamaCppRepoIsCloned, isLlamaCppRepoCloned} from "./cloneLlamaCppRepo.js";
import {getBuildFolderNameForBuildOptions} from "./getBuildFolderNameForBuildOptions.js";
import {setLastBuildInfo} from "./lastBuildInfo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function compileLlamaCpp(buildOptions: BuildOptions, {
    nodeTarget = process.version,
    updateLastBuildInfo: updateLastBuildInfoArg = true,
    includeBuildOptionsInBinaryFolderName = true,
    ensureLlamaCppRepoIsCloned: ensureLlamaCppRepoIsClonedArg = false,
    downloadCmakeIfNeeded: downloadCmakeIfNeededArg = false
}: {
    nodeTarget?: string,
    updateLastBuildInfo?: boolean,
    includeBuildOptionsInBinaryFolderName?: boolean,
    ensureLlamaCppRepoIsCloned?: boolean,
    downloadCmakeIfNeeded?: boolean
}) {
    const buildFolderName = await getBuildFolderNameForBuildOptions(buildOptions);
    const finalBuildFolderName = includeBuildOptionsInBinaryFolderName
        ? buildFolderName.withCustomCmakeOptions
        : buildFolderName.withoutCustomCmakeOptions;

    const outDirectory = path.join(llamaLocalBuildBinsDirectory, finalBuildFolderName);

    await fs.mkdirp(llamaLocalBuildBinsDirectory);
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

            if (buildOptions.computeLayers.metal && process.platform === "darwin" && !cmakeCustomOptions.has("LLAMA_METAL"))
                cmakeCustomOptions.set("LLAMA_METAL", "1");
            else if (!cmakeCustomOptions.has("LLAMA_METAL"))
                cmakeCustomOptions.set("LLAMA_METAL", "OFF");

            if (buildOptions.computeLayers.cuda && !cmakeCustomOptions.has("LLAMA_CUBLAS"))
                cmakeCustomOptions.set("LLAMA_CUBLAS", "1");

            if (toolchainFile != null && !cmakeCustomOptions.has("CMAKE_TOOLCHAIN_FILE"))
                cmakeCustomOptions.set("CMAKE_TOOLCHAIN_FILE", toolchainFile);

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
                process.env,
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
                process.env,
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
                    const files = await fs.readdir(binFilesDirPath);

                    await Promise.all(
                        files.map((fileName) => (
                            fs.copy(path.join(binFilesDirPath, fileName), path.join(compiledResultDirPath, fileName), {
                                overwrite: false
                            })
                        ))
                    );
                }
            }
            await fs.writeFile(path.join(compiledResultDirPath, buildMetadataFileName), JSON.stringify({
                buildOptions: convertBuildOptionsToBuildOptionsJSON(buildOptions)
            } satisfies BuildMetadataFile), "utf8");

            await fs.writeFile(path.join(outDirectory, "buildDone.status"), "", "utf8");

            if (updateLastBuildInfoArg) {
                await setLastBuildInfo({
                    folderName: finalBuildFolderName
                });
            }
        } catch (err) {
            if (buildOptions.computeLayers.cuda)
                console.info("\n" +
                    getConsoleLogPrefix(true) +
                    chalk.yellow("To resolve errors related to CUDA compilation, see the CUDA guide: ") +
                    documentationPageUrls.CUDA
                );

            throw err;
        } finally {
            await fixXpackPermissions();
        }
    });
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

export async function getPrebuiltBinaryPath(folderName: string) {
    const binaryPath = path.join(llamaPrebuiltBinsDirectory, folderName, "llama-addon.node");
    const buildMetadataFilePath = path.join(llamaPrebuiltBinsDirectory, folderName, buildMetadataFileName);

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

export async function getPrebuiltBinaryBuildMetadata(folderName: string) {
    const buildMetadataFilePath = path.join(llamaPrebuiltBinsDirectory, folderName, buildMetadataFileName);

    if (!(await fs.pathExists(buildMetadataFilePath)))
        throw new Error(`Could not find build metadata file for prebuilt build "${folderName}"`);

    const buildMetadata: BuildMetadataFile = await fs.readJson(buildMetadataFilePath);
    return buildMetadata;
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