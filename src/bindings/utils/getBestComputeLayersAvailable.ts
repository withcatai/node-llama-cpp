import process from "process";
import {BuildGpu} from "../types.js";
import {BinaryPlatform, getPlatform} from "./getPlatform.js";
import {detectAvailableComputeLayers} from "./detectAvailableComputeLayers.js";

let bestComputeLayersAvailablePromise: ReturnType<typeof detectBestComputeLayersAvailable> | null = null;
export async function getBestComputeLayersAvailable() {
    if (bestComputeLayersAvailablePromise != null) {
        try {
            return await bestComputeLayersAvailablePromise;
        } catch (err) {}
    }

    bestComputeLayersAvailablePromise = detectBestComputeLayersAvailable();
    return await bestComputeLayersAvailablePromise;
}

export async function detectBestComputeLayersAvailable({
    platform = getPlatform(),
    arch = process.arch,
    hasCudaWithStaticBinaryBuild = false
}: {
    platform?: BinaryPlatform,
    arch?: typeof process.arch,
    hasCudaWithStaticBinaryBuild?: boolean
} = {}): Promise<BuildGpu[]> {
    if (platform === "mac" && arch === "arm64")
        return ["metal"];

    const res: BuildGpu[] = [];
    const availableComputeLayers = await detectAvailableComputeLayers({
        platform
    });

    if (availableComputeLayers.cuda.hasNvidiaDriver && (availableComputeLayers.cuda.hasCudaRuntime || hasCudaWithStaticBinaryBuild))
        res.push("cuda");

    if (availableComputeLayers.vulkan)
        res.push("vulkan");

    res.push(false);

    return res;
}
