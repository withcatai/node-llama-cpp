import path from "path";
import {fileURLToPath} from "url";
import process from "process";
import fs from "fs-extra";
import {llamaCppDirectory, llamaDirectory} from "../config.js";
import {clearLlamaBuild} from "./clearLlamaBuild.js";
import {setUsedBinFlag} from "./usedBinFlag.js";
import {spawnCommand} from "./spawnCommand.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function compileLlamaCpp({
    arch = process.arch, nodeTarget = process.version, setUsedBinFlag: setUsedBinFlagArg = true, metal = false, cuda = false
}: {
    arch?: string, nodeTarget?: string, setUsedBinFlag?: boolean, metal?: boolean, cuda?: boolean
}) {
    try {
        if (!(await fs.pathExists(llamaCppDirectory))) {
            throw new Error(`"${llamaCppDirectory}" directory does not exist`);
        }

        const gypDefines = ["GGML_USE_K_QUANTS", "NAPI_CPP_EXCEPTIONS"];

        if ((metal && process.platform === "darwin") || process.env.LLAMA_METAL === "1") gypDefines.push("LLAMA_METAL=1");
        if (cuda || process.env.LLAMA_CUBLAS === "1") gypDefines.push("LLAMA_CUBLAS=1");
        if (process.env.LLAMA_MPI === "1") gypDefines.push("LLAMA_MPI=1");
        if (process.env.LLAMA_OPENBLAS === "1") gypDefines.push("LLAMA_OPENBLAS=1");
        if (process.env.LLAMA_BLAS_VENDOR != null) gypDefines.push("LLAMA_BLAS_VENDOR=" + process.env.LLAMA_BLAS_VENDOR);
        if (process.env.LLAMA_CUDA_FORCE_DMMV != null) gypDefines.push("LLAMA_CUDA_FORCE_DMMV=" + process.env.LLAMA_CUDA_FORCE_DMMV);
        if (process.env.LLAMA_CUDA_DMMV_X != null) gypDefines.push("LLAMA_CUDA_DMMV_X=" + process.env.LLAMA_CUDA_DMMV_X);
        if (process.env.LLAMA_CUDA_MMV_Y != null) gypDefines.push("LLAMA_CUDA_MMV_Y=" + process.env.LLAMA_CUDA_MMV_Y);
        if (process.env.LLAMA_CUDA_F16 != null) gypDefines.push("LLAMA_CUDA_F16=" + process.env.LLAMA_CUDA_F16);
        if (process.env.LLAMA_CUDA_KQUANTS_ITER != null) gypDefines.push("LLAMA_CUDA_KQUANTS_ITER=" + process.env.LLAMA_CUDA_KQUANTS_ITER);
        if (process.env.LLAMA_HIPBLAS === "1") gypDefines.push("LLAMA_HIPBLAS=1");
        if (process.env.LLAMA_CLBLAST === "1") gypDefines.push("LLAMA_CLBLAST=1");

        const nodeGypEnv: NodeJS.ProcessEnv = {
            ...process.env,
            "CMAKE_CURRENT_SOURCE_DIR": llamaCppDirectory,
            "GYP_DEFINES": gypDefines.join(" ")
        };

        await clearLlamaBuild();

        await spawnCommand("npm", ["run", "-s", "node-gyp-llama", "--", "configure", "--arch=" + arch, "--target=" + nodeTarget], __dirname, nodeGypEnv);

        await spawnCommand("npm", ["run", "-s", "node-gyp-llama", "--", "configure", "--arch=" + arch, "--target=" + nodeTarget, "--", "-f", "compile_commands_json"], __dirname, nodeGypEnv);

        if (await fs.pathExists(path.join(llamaDirectory, "Release", "compile_commands.json"))) {
            await fs.move(
                path.join(llamaDirectory, "Release", "compile_commands.json"),
                path.join(llamaDirectory, "compile_commands.json")
            );
        } else if (await fs.pathExists(path.join(llamaDirectory, "Debug", "compile_commands.json"))) {
            await fs.move(
                path.join(llamaDirectory, "Debug", "compile_commands.json"),
                path.join(llamaDirectory, "compile_commands.json")
            );
        }

        await fs.remove(path.join(llamaDirectory, "Release"));
        await fs.remove(path.join(llamaDirectory, "Debug"));


        await spawnCommand("npm", ["run", "-s", "node-gyp-llama-build", "--", "--arch=" + arch, "--target=" + nodeTarget], __dirname, nodeGypEnv);

        if (setUsedBinFlagArg) {
            await setUsedBinFlag("localBuildFromSource");
        }
    } catch (err) {
        if (setUsedBinFlagArg)
            await setUsedBinFlag("prebuiltBinaries");

        throw err;
    }
}

export async function getCompiledLlamaCppBinaryPath() {
    const modulePath = path.join(__dirname, "..", "..", "llama", "build", "Release", "llama.node");

    if (await fs.pathExists(modulePath))
        return modulePath;

    return null;
}
