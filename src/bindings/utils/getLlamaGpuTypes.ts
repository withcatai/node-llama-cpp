import process from "process";
import {LlamaGpuType} from "../types.js";
import {getGpuTypesToUseForOption} from "./getGpuTypesToUseForOption.js";
import {getPlatform} from "./getPlatform.js";

/**
 * Get the list of GPU types that can be used with `getLlama` on the current machine.
 *
 * When passing `"supported"`, only the GPU types that have the
 * necessary libraries and drivers installed on the current machine will be returned.
 * All of these GPU types have prebuilt binaries for the current platform and architecture.
 *
 * When passing `"allValid"`, all GPU types that are compatible with the current OS and architecture will be returned.
 * Some of these GPU types may not have prebuilt binaries for the current platform and architecture,
 * as some of them are inadvisable for the current machine (like CUDA on an x64 Mac machine).
 */
export async function getLlamaGpuTypes(include: "supported" | "allValid"): Promise<LlamaGpuType[]> {
    if (include === "supported")
        return await getGpuTypesToUseForOption("auto");

    const platform = getPlatform();
    const arch = process.arch;

    const res: LlamaGpuType[] = [];

    // Metal is not properly supported by llama.cpp on x64 Mac machines
    if (platform === "mac" && arch === "arm64")
        res.push("metal");
    else
        res.push("cuda");

    res.push("vulkan");
    res.push(false);

    return res;
}
