import {
    defaultLlamaCppCudaSupport, defaultLlamaCppGitHubRepo, defaultLlamaCppMetalSupport, defaultLlamaCppRelease
} from "../config.js";

export async function getBuildDefaults() {
    return {
        repo: defaultLlamaCppGitHubRepo,
        release: defaultLlamaCppRelease,
        metalSupport: defaultLlamaCppMetalSupport,
        cudaSupport: defaultLlamaCppCudaSupport
    };
}
