import path from "path";
import {fileURLToPath} from "url";
import process from "process";
import fs from "fs-extra";
import chalk from "chalk";
import {
    customCmakeOptionsEnvVarPrefix, documentationPageUrls, llamaCppDirectory, llamaDirectory, llamaToolchainsDirectory
} from "../config.js";
import {clearLlamaBuild} from "./clearLlamaBuild.js";
import {setUsedBinFlag} from "./usedBinFlag.js";
import {spawnCommand} from "./spawnCommand.js";
import {fixXpackPermissions, getCmakePath, hasBuiltinCmake} from "./cmake.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function compileLlamaCpp({
    arch = process.arch, nodeTarget = process.version, setUsedBinFlag: setUsedBinFlagArg = true, metal = process.platform === "darwin",
    cuda = false
}: {
    arch?: string, nodeTarget?: string, setUsedBinFlag?: boolean, metal?: boolean, cuda?: boolean
}) {
    try {
        if (!(await fs.pathExists(llamaCppDirectory))) {
            throw new Error(`"${llamaCppDirectory}" directory does not exist`);
        }

        const cmakePathArgs = await getCmakePathArgs();
        const toolchainFile = await getToolchainFileForArch(arch);
        const runtimeVersion = nodeTarget.startsWith("v") ? nodeTarget.slice("v".length) : nodeTarget;
        const cmakeCustomOptions = new Map<string, string>();

        if ((metal && process.platform === "darwin") || process.env.GGML_METAL === "1") cmakeCustomOptions.set("GGML_METAL", "1");
        else cmakeCustomOptions.set("GGML_METAL", "OFF");

        if (cuda || process.env.GGML_CUDA === "1") cmakeCustomOptions.set("GGML_CUDA", "1");

        if (process.env.GGML_OPENBLAS === "1") cmakeCustomOptions.set("GGML_OPENBLAS", "1");
        if (process.env.GGML_BLAS_VENDOR != null) cmakeCustomOptions.set("GGML_BLAS_VENDOR", process.env.GGML_BLAS_VENDOR);
        if (process.env.GGML_CUDA_FORCE_DMMV != null) cmakeCustomOptions.set("GGML_CUDA_FORCE_DMMV", process.env.GGML_CUDA_FORCE_DMMV);
        if (process.env.GGML_CUDA_DMMV_X != null) cmakeCustomOptions.set("GGML_CUDA_DMMV_X", process.env.GGML_CUDA_DMMV_X);
        if (process.env.GGML_CUDA_MMV_Y != null) cmakeCustomOptions.set("GGML_CUDA_MMV_Y", process.env.GGML_CUDA_MMV_Y);
        if (process.env.GGML_CUDA_F16 != null) cmakeCustomOptions.set("GGML_CUDA_F16", process.env.GGML_CUDA_F16);
        if (process.env.GGML_CUDA_KQUANTS_ITER != null) cmakeCustomOptions.set("GGML_CUDA_KQUANTS_ITER", process.env.GGML_CUDA_KQUANTS_ITER);
        if (process.env.GGML_CUDA_PEER_MAX_BATCH_SIZE != null) cmakeCustomOptions.set("GGML_CUDA_PEER_MAX_BATCH_SIZE", process.env.GGML_CUDA_PEER_MAX_BATCH_SIZE);
        if (process.env.GGML_HIPBLAS === "1") cmakeCustomOptions.set("GGML_HIPBLAS", "1");

        if (toolchainFile != null)
            cmakeCustomOptions.set("CMAKE_TOOLCHAIN_FILE", toolchainFile);

        for (const key in process.env) {
            if (key.startsWith(customCmakeOptionsEnvVarPrefix)) {
                const option = key.slice(customCmakeOptionsEnvVarPrefix.length);
                const value = process.env[key];
                cmakeCustomOptions.set(option, value!);
            }
        }

        await clearLlamaBuild();

        await spawnCommand("npm", ["run", "-s", "cmake-js-llama", "--", "clean", "--log-level", "warn", ...cmakePathArgs], __dirname);

        await spawnCommand(
            "npm",
            ["run", "-s", "cmake-js-llama", "--", "compile", "--log-level", "warn", "--arch=" + arch, "--runtime-version=" + runtimeVersion, ...cmakePathArgs]
                .concat([...cmakeCustomOptions].map(([key, value]) => "--CD" + key + "=" + value)),
            __dirname
        );

        const binFilesDirPaths = [
            path.join(llamaDirectory, "build", "bin"),
            path.join(llamaDirectory, "build", "llama.cpp", "bin")
        ];
        const compiledResultDirPath = await getCompiledResultDir(true);

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

        applyResultDirFixes(compiledResultDirPath, path.join(compiledResultDirPath, "__temp"));

        if (setUsedBinFlagArg) {
            await setUsedBinFlag("localBuildFromSource");
        }
    } catch (err) {
        if (setUsedBinFlagArg)
            await setUsedBinFlag("prebuiltBinaries");

        if (cuda)
            console.info("\n" +
                chalk.grey("[node-llama-cpp] ") +
                chalk.yellow("To resolve errors related to CUDA compilation, see the CUDA guide: ") +
                documentationPageUrls.CUDA
            );

        throw err;
    } finally {
        await fixXpackPermissions();
    }
}

export async function getCompiledLlamaCppBinaryPath() {
    const compiledResultDirPath = await getCompiledResultDir(false);

    if (compiledResultDirPath == null)
        return null;

    const modulePath = path.join(compiledResultDirPath, "llama-addon.node");

    if (await fs.pathExists(modulePath))
        return modulePath;

    return null;
}

async function getCompiledResultDir(failIfNotFound?: false): Promise<string | null>;
async function getCompiledResultDir(failIfNotFound: true): Promise<string>;
async function getCompiledResultDir(failIfNotFound: boolean = false) {
    if (await fs.pathExists(path.join(llamaDirectory, "build", "Release"))) {
        return path.join(llamaDirectory, "build", "Release");
    } else if (await fs.pathExists(path.join(llamaDirectory, "build", "Debug"))) {
        return path.join(llamaDirectory, "build", "Debug");
    }

    if (failIfNotFound)
        throw new Error("Could not find Release or Debug directory");

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
