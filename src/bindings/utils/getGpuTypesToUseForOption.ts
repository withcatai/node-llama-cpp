import process from "process";
import {BuildGpu, buildGpuOptions} from "../types.js";
import {BinaryPlatform, getPlatform} from "./getPlatform.js";
import {getBestComputeLayersAvailable} from "./getBestComputeLayersAvailable.js";

export async function getGpuTypesToUseForOption(gpu: BuildGpu | "auto", {
    platform = getPlatform(),
    arch = process.arch
}: {
    platform?: BinaryPlatform,
    arch?: typeof process.arch
} = {}): Promise<BuildGpu[]> {
    const resolvedGpu = resolveValidGpuOptionForPlatform(gpu, {
        platform,
        arch
    });

    if (resolvedGpu === "auto") {
        if (arch === process.arch)
            return await getBestComputeLayersAvailable();

        return [false];
    }

    return [resolvedGpu];
}

export function resolveValidGpuOptionForPlatform(gpu: BuildGpu | "auto", {
    platform,
    arch
}: {
    platform: BinaryPlatform,
    arch: typeof process.arch
}) {
    if (gpu == null)
        return "auto";
    else if (platform === "mac") {
        if (arch !== "x64" && gpu === "cuda")
            return "auto";
    } else if (gpu === "metal")
        return "auto";

    if (buildGpuOptions.includes(gpu as (typeof buildGpuOptions)[number]))
        return gpu;

    return "auto";
}
