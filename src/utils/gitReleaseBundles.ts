import fs from "fs-extra";
import simpleGit from "simple-git";
import {currentReleaseGitBundlePath, defaultLlamaCppGitHubRepo, llamaCppDirectory} from "../config.js";
import {getBinariesGithubRelease} from "./binariesGithubRelease.js";


export async function saveCurrentRepoAsReleaseBundle() {
    if (!(await fs.pathExists(llamaCppDirectory)))
        throw new Error("llama.cpp directory does not exist");

    if (await fs.pathExists(currentReleaseGitBundlePath))
        await fs.remove(currentReleaseGitBundlePath);

    await simpleGit(llamaCppDirectory).raw(["bundle", "create", currentReleaseGitBundlePath, "HEAD"]);
}

export async function getGitBundlePathForRelease(githubOwner: string, githubRepo: string, release: string) {
    const [defaultGithubOwner, defaultGithubRepo] = defaultLlamaCppGitHubRepo.split("/");
    if (githubOwner !== defaultGithubOwner || githubRepo !== defaultGithubRepo)
        return null;

    const currentBundleRelease = await getBinariesGithubRelease();

    if (currentBundleRelease === "latest")
        return null;

    if (currentBundleRelease !== release)
        return null;

    if (!(await fs.pathExists(currentReleaseGitBundlePath)))
        return null;

    return currentReleaseGitBundlePath;
}
