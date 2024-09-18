import {BuildGpu} from "./types.js";

const prettyBuildGpuNames: Record<Exclude<BuildGpu, false>, string> = {
    metal: "Metal",
    cuda: "CUDA",
    vulkan: "Vulkan"
};

export function getPrettyBuildGpuName(gpu: BuildGpu | undefined) {
    if (gpu == null)
        return "unknown GPU";

    if (gpu == false)
        return "no GPU";

    return prettyBuildGpuNames[gpu] ?? ('"' + gpu + '"');
}
