import {
    defaultLlamaCppCudaSupport, defaultLlamaCppGitHubRepo, defaultLlamaCppMetalSupport, defaultLlamaCppRelease, defaultLlamaCppVulkanSupport
} from "../config.js";

export async function getBuildDefaults() {
    return {
        repo: defaultLlamaCppGitHubRepo,
        release: defaultLlamaCppRelease,
        metalSupport: defaultLlamaCppMetalSupport,
        cudaSupport: defaultLlamaCppCudaSupport,
        vulkanSupport: defaultLlamaCppVulkanSupport
    };
}
