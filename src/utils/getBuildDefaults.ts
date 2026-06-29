import {defaultLlamaCppRelease} from "../bindings/utils/binariesGithubRelease.js";
import {defaultLlamaCppGitHubRepo, defaultLlamaCppGpuSupport} from "../config.js";

export async function getBuildDefaults() {
    return {
        repo: defaultLlamaCppGitHubRepo,
        release: defaultLlamaCppRelease,
        gpuSupport: defaultLlamaCppGpuSupport
    };
}
