import fs from "fs-extra";
import simpleGit from "simple-git";
import {currentReleaseGitBundlePath, defaultLlamaCppGitHubRepo, llamaCppDirectory} from "../config.js";
import {getBinariesGithubRelease} from "./binariesGithubRelease.js";


export async function unshallowAndSquashCurrentRepoAndSaveItAsReleaseBundle() {
    if (!(await fs.pathExists(llamaCppDirectory)))
        throw new Error("llama.cpp directory does not exist");

    if (await fs.pathExists(currentReleaseGitBundlePath))
        await fs.remove(currentReleaseGitBundlePath);

    await simpleGit(llamaCppDirectory).addConfig("user.name", "node-llama-cpp-ci");
    await simpleGit(llamaCppDirectory).addConfig("user.email", "node-llama-cpp-ci@node-llama-cpp-ci.node-llama-cpp-ci");

    const currentBranch = await getCurrentTagOrBranch();

    await simpleGit(llamaCppDirectory).fetch(["--unshallow"]);

    const lastCommit = await simpleGit(llamaCppDirectory).log(["-1"]);
    const lastCommitMessage: string | null = lastCommit?.all?.[0]?.message;
    const newCommitMessage = "## SQUASHED ##\n\n" + (lastCommitMessage ?? "");

    const newCommitSha = await simpleGit(llamaCppDirectory).raw(["commit-tree", "HEAD^{tree}", "-m", newCommitMessage]);
    await simpleGit(llamaCppDirectory).reset(["--hard", newCommitSha.trim()]);

    const tags = await simpleGit(llamaCppDirectory).tags();
    for (const tag of tags.all) {
        await simpleGit(llamaCppDirectory).tag(["--delete", tag]);
    }

    const branches = await simpleGit(llamaCppDirectory).branch();
    for (const branch of branches.all) {
        try {
            await simpleGit(llamaCppDirectory).branch(["--delete", branch]);
        } catch (err) {
            // If the branch is not found, it's fine
            // this happens as when there are no branches git returnes an output saying so, and `simpleGit` parses it as a branch,
            // so the list may contain branches that do not exist.
            // Right now, the non-existent branch name returned called `(no`, but I wouldn't want to rely on this specific text,
            // as this is a bug in `simpleGit`.
        }
    }

    if (currentBranch != null)
        await simpleGit(llamaCppDirectory).tag([currentBranch]);

    await simpleGit(llamaCppDirectory).raw(["gc", "--aggressive", "--prune=all"]);

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

async function getCurrentTagOrBranch() {
    const branch = await simpleGit(llamaCppDirectory).revparse(["--abbrev-ref", "HEAD"]);

    if (branch !== "HEAD")
        return branch;

    const tags = await simpleGit(llamaCppDirectory).tag(["--points-at", "HEAD"]);
    const tagArray = tags.split("\n").filter(Boolean);

    if (tagArray.length > 0)
        return tagArray[0];

    return null;
}
