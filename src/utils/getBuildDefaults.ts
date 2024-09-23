import {defaultLlamaCppGitHubRepo, defaultLlamaCppGpuSupport, defaultLlamaCppRelease} from "../config.js";

export async function getBuildDefaults() {
    return {
        repo: defaultLlamaCppGitHubRepo,
        release: defaultLlamaCppRelease,
        gpuSupport: defaultLlamaCppGpuSupport
    };
}
