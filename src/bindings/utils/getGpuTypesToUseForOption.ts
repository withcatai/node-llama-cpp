import process from "process";
import {BuildGpu, buildGpuOptions} from "../types.js";
import {LlamaOptions} from "../getLlama.js";
import {BinaryPlatform, getPlatform} from "./getPlatform.js";
import {getBestComputeLayersAvailable} from "./getBestComputeLayersAvailable.js";

export async function getGpuTypesToUseForOption(gpu: Required<LlamaOptions>["gpu"], {
    platform = getPlatform(),
    arch = process.arch
}: {
    platform?: BinaryPlatform,
    arch?: typeof process.arch
} = {}): Promise<BuildGpu[]> {
    const resolvedGpuOption = typeof gpu === "object"
        ? gpu.type
        : gpu;

    function withExcludedGpuTypesRemoved(gpuTypes: BuildGpu[]) {
        const resolvedExcludeTypes = typeof gpu === "object"
            ? new Set(gpu.exclude ?? [])
            : new Set();

        return gpuTypes.filter((gpuType) => !resolvedExcludeTypes.has(gpuType));
    }

    const resolvedGpu = resolveValidGpuOptionForPlatform(resolvedGpuOption, {
        platform,
        arch
    });

    if (resolvedGpu === "auto") {
        if (arch === process.arch)
            return withExcludedGpuTypesRemoved(await getBestComputeLayersAvailable());

        return withExcludedGpuTypesRemoved([false]);
    }

    return withExcludedGpuTypesRemoved([resolvedGpu]);
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
