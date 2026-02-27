import {getConsoleLogPrefix} from "./getConsoleLogPrefix.js";

export async function resolveGithubRelease(githubOwner: string, githubRepo: string, release: string) {
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

    return githubRelease.tag_name;
}

export function isGithubReleaseNeedsResolving(release: string) {
    return release === "latest";
}

const defaultGitHubApiBase = "https://api.github.com";
const defaultGitHubApiVersion: GitHubApiVersion = "2022-11-28";

type GitHubApiVersion = "2022-11-28" | (string & {});

type GitHubClientOptions = {
    token?: string,

    /**
     * GitHub REST API base URL.
     *
     * Defaults to `https://api.github.com`.
     */
    apiBase?: string,

    /**
     * GitHub REST API version header.
     *
     * Defaults to `"2022-11-28"`.
     */
    apiVersion?: GitHubApiVersion,

    userAgent?: string
};

type GitHubRelease = {
    url: string,
    "html_url": string,
    "assets_url": string,
    "upload_url": string,

    id: number,
    "node_id": string,

    "tag_name": string,
    "target_commitish": string,
    name: string | null,
    body: string | null,

    draft: boolean,
    prerelease: boolean,

    "created_at": string, // ISO date-time
    "published_at": string | null, // ISO date-time

    author: GitHubUser | null,

    assets: GitHubReleaseAsset[],

    "tarball_url": string | null,
    "zipball_url": string | null
};

type GitHubUser = {
    login: string,
    id: number,
    "node_id": string,
    "avatar_url": string,
    "html_url": string,
    type: string,
    "site_admin": boolean
};

type GitHubReleaseAsset = {
    url: string,
    id: number,
    "node_id": string,

    name: string,
    label: string | null,
    "content_type": string,
    state: string,
    size: number,
    "download_count": number,

    "browser_download_url": string,

    "created_at": string, // ISO date-time
    "updated_at": string, // ISO date-time

    uploader: GitHubUser | null
};

type GitHubApiError = Error & {
    status: number,
    url: string,
    bodyText?: string,
    headers?: Record<string, string>
};

class GitHubClient {
    private readonly _clientOptions: GitHubClientOptions;

    public constructor(clientOptions: GitHubClientOptions = {}) {
        this._clientOptions = clientOptions;
    }

    public async getLatestRelease({
        owner, repo
    }: {
        owner: string,
        repo: string
    }): Promise<GitHubRelease> {
        return this._fetchJson<GitHubRelease>(
            `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/latest`
        );
    }

    public async getReleaseByTag({
        owner, repo, tag
    }: {
        owner: string,
        repo: string,
        tag: string
    }): Promise<GitHubRelease> {
        return this._fetchJson<GitHubRelease>(
            `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/tags/${encodeURIComponent(tag)}`
        );
    }

    private async _fetchJson<T>(
        path: string
    ): Promise<T> {
        const url = this._getApiBase() + path;

        const headers: Record<string, string> = {
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": this._clientOptions.apiVersion ?? defaultGitHubApiVersion
        };

        if (this._clientOptions.token != null && this._clientOptions.token !== "")
            headers.Authorization = "Bearer " + this._clientOptions.token;

        if (this._clientOptions.userAgent != null && this._clientOptions.userAgent !== "")
            headers["User-Agent"] = this._clientOptions.userAgent;


        const res = await fetch(url, {
            method: "GET",
            headers
        });

        if (!res.ok) {
            const err = new Error(
                `GitHub API error ${res.status} ${res.statusText}`
            ) as GitHubApiError;

            err.status = res.status;
            err.url = url;
            err.headers = Object.fromEntries(res.headers.entries());
            try {
                err.bodyText = await res.text();
            } catch {
                err.bodyText = undefined;
            }

            throw err;
        }

        return (await res.json()) as T;
    }

    private _getApiBase() {
        return this._clientOptions?.apiBase ?? defaultGitHubApiBase;
    }
}
