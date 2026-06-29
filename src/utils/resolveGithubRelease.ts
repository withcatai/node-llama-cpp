import {getConsoleLogPrefix} from "./getConsoleLogPrefix.js";
import {GitHubClient, GitHubRelease} from "./GitHubClient.js";

export async function resolveGithubRelease(githubOwner: string, githubRepo: string, release: string): Promise<{
    tag: string,
    date: Date
}> {
    const githubClient = new GitHubClient();
    const repo = githubOwner + "/" + githubRepo;

    type GithubReleaseType = GitHubRelease;

    let githubRelease: GithubReleaseType | null = null;

    try {
        if (release === "latest")
            githubRelease = await githubClient.getLatestRelease({
                owner: githubOwner,
                repo: githubRepo
            });
        else
            githubRelease = await githubClient.getReleaseByTag({
                owner: githubOwner,
                repo: githubRepo,
                tag: release
            });
    } catch (err) {
        console.error(getConsoleLogPrefix() + "Failed to fetch llama.cpp release info", err);
    }

    if (githubRelease == null)
        throw new Error(`Failed to find release "${release}" of "${repo}"`);

    if (githubRelease.tag_name == null)
        throw new Error(`Failed to find tag of release "${release}" of "${repo}"`);

    return {
        tag: githubRelease.tag_name,
        date: new Date(githubRelease.created_at)
    };
}

export function isGithubReleaseNeedsResolving(release: string) {
    return release === "latest";
}

