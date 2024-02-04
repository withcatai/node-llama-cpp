import {Octokit} from "octokit";
import {getConsoleLogPrefix} from "./getConsoleLogPrefix.js";

export async function resolveGithubRelease(githubOwner: string, githubRepo: string, release: string) {
    const octokit = new Octokit();
    const repo = githubOwner + "/" + githubRepo;

    type GithubReleaseType = Awaited<ReturnType<typeof octokit.rest.repos.getLatestRelease>> |
        Awaited<ReturnType<typeof octokit.rest.repos.getReleaseByTag>>;

    let githubRelease: GithubReleaseType | null = null;

    try {
        if (release === "latest") {
            githubRelease = await octokit.rest.repos.getLatestRelease({
                owner: githubOwner,
                repo: githubRepo
            });
        } else {
            githubRelease = await octokit.rest.repos.getReleaseByTag({
                owner: githubOwner,
                repo: githubRepo,
                tag: release
            });
        }
    } catch (err) {
        console.error(getConsoleLogPrefix() + "Failed to fetch llama.cpp release info", err);
    }

    if (githubRelease == null) {
        throw new Error(`Failed to find release "${release}" of "${repo}"`);
    }

    if (githubRelease.data.tag_name == null) {
        throw new Error(`Failed to find tag of release "${release}" of "${repo}"`);
    }

    return githubRelease.data.tag_name;
}

export function isGithubReleaseNeedsResolving(release: string) {
    return release === "latest";
}
