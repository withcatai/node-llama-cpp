import process from "process";
import {CommandModule} from "yargs";
import {Octokit} from "octokit";
import fs from "fs-extra";
import chalk from "chalk";
import {
    defaultLlamaCppCudaSupport, defaultLlamaCppGitHubRepo, defaultLlamaCppMetalSupport, defaultLlamaCppRelease, isCI,
    llamaCppDirectory, llamaCppDirectoryTagFilePath
} from "../../config.js";
import {compileLlamaCpp} from "../../utils/compileLLamaCpp.js";
import withOra from "../../utils/withOra.js";
import {clearTempFolder} from "../../utils/clearTempFolder.js";
import {setBinariesGithubRelease} from "../../utils/binariesGithubRelease.js";
import {downloadCmakeIfNeeded} from "../../utils/cmake.js";
import withStatusLogs from "../../utils/withStatusLogs.js";
import {getIsInDocumentationMode} from "../../state.js";
import {
    getGitBundlePathForRelease,
    unshallowAndSquashCurrentRepoAndSaveItAsReleaseBundle
} from "../../utils/gitReleaseBundles.js";
import {cloneLlamaCppRepo} from "../../utils/cloneLlamaCppRepo.js";

type DownloadCommandArgs = {
    repo?: string,
    release?: "latest" | string,
    arch?: string,
    nodeTarget?: string,
    metal?: boolean,
    cuda?: boolean,
    skipBuild?: boolean,
    noBundle?: boolean,

    /** @internal */
    updateBinariesReleaseMetadataAndSaveGitBundle?: boolean
};

export const DownloadCommand: CommandModule<object, DownloadCommandArgs> = {
    command: "download",
    describe: "Download a release of llama.cpp and compile it",
    builder(yargs) {
        const isInDocumentationMode = getIsInDocumentationMode();

        return yargs
            .option("repo", {
                type: "string",
                default: defaultLlamaCppGitHubRepo,
                description: "The GitHub repository to download a release of llama.cpp from. Can also be set via the NODE_LLAMA_CPP_REPO environment variable"
            })
            .option("release", {
                type: "string",
                default: isInDocumentationMode ? "<current build>" : defaultLlamaCppRelease,
                description: "The tag of the llama.cpp release to download. Set to \"latest\" to download the latest release. Can also be set via the NODE_LLAMA_CPP_REPO_RELEASE environment variable"
            })
            .option("arch", {
                alias: "a",
                type: "string",
                description: "The architecture to compile llama.cpp for"
            })
            .option("nodeTarget", {
                alias: "t",
                type: "string",
                description: "The Node.js version to compile llama.cpp for. Example: v18.0.0"
            })
            .option("metal", {
                type: "boolean",
                default: defaultLlamaCppMetalSupport || isInDocumentationMode,
                hidden: process.platform !== "darwin" && !isInDocumentationMode,
                description: "Compile llama.cpp with Metal support. Enabled by default on macOS. Can be disabled with \"--no-metal\". Can also be set via the NODE_LLAMA_CPP_METAL environment variable"
            })
            .option("cuda", {
                type: "boolean",
                default: defaultLlamaCppCudaSupport,
                description: "Compile llama.cpp with CUDA support. Can also be set via the NODE_LLAMA_CPP_CUDA environment variable"
            })
            .option("skipBuild", {
                alias: "sb",
                type: "boolean",
                default: false,
                description: "Skip building llama.cpp after downloading it"
            })
            .option("noBundle", {
                alias: "nb",
                type: "boolean",
                default: false,
                description: "Download a llama.cpp release only from GitHub, even if a local git bundle exists for the release"
            })
            .option("updateBinariesReleaseMetadataAndSaveGitBundle", {
                type: "boolean",
                hidden: true, // this for the CI to use
                default: false,
                description: "Update the binariesGithubRelease.json file with the release of llama.cpp that was downloaded"
            });
    },
    handler: DownloadLlamaCppCommand
};

export async function DownloadLlamaCppCommand({
    repo = defaultLlamaCppGitHubRepo,
    release = defaultLlamaCppRelease,
    arch = undefined,
    nodeTarget = undefined,
    metal = defaultLlamaCppMetalSupport,
    cuda = defaultLlamaCppCudaSupport,
    skipBuild = false,
    noBundle = false,
    updateBinariesReleaseMetadataAndSaveGitBundle = false
}: DownloadCommandArgs) {
    const useBundle = noBundle != true;
    const octokit = new Octokit();
    const [githubOwner, githubRepo] = repo.split("/");

    console.log(`${chalk.yellow("Repo:")} ${repo}`);
    console.log(`${chalk.yellow("Release:")} ${release}`);
    if (!skipBuild) {
        if (metal && process.platform === "darwin") {
            console.log(`${chalk.yellow("Metal:")} enabled`);
        }

        if (cuda) {
            console.log(`${chalk.yellow("CUDA:")} enabled`);
        }
    }
    console.log();

    type GithubReleaseType = Awaited<ReturnType<typeof octokit.rest.repos.getLatestRelease>> |
        Awaited<ReturnType<typeof octokit.rest.repos.getReleaseByTag>>;

    let githubReleaseTag: string | null = (useBundle && (await getGitBundlePathForRelease(githubOwner, githubRepo, release)) != null)
        ? release
        : null;

    if (githubReleaseTag == null)
        await withOra({
            loading: chalk.blue("Fetching llama.cpp info"),
            success: chalk.blue("Fetched llama.cpp info"),
            fail: chalk.blue("Failed to fetch llama.cpp info")
        }, async () => {
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
                console.error("Failed to fetch llama.cpp release info", err);
            }

            if (githubRelease == null) {
                throw new Error(`Failed to find release "${release}" of "${repo}"`);
            }

            if (githubRelease.data.tag_name == null) {
                throw new Error(`Failed to find tag of release "${release}" of "${repo}"`);
            }

            githubReleaseTag = githubRelease.data.tag_name;
        });

    await clearTempFolder();

    await withOra({
        loading: chalk.blue("Removing existing llama.cpp directory"),
        success: chalk.blue("Removed existing llama.cpp directory"),
        fail: chalk.blue("Failed to remove existing llama.cpp directory")
    }, async () => {
        await fs.remove(llamaCppDirectory);
        await fs.remove(llamaCppDirectoryTagFilePath);
    });

    console.log(chalk.blue("Cloning llama.cpp"));
    await cloneLlamaCppRepo(githubOwner, githubRepo, githubReleaseTag!, useBundle);

    if (!skipBuild) {
        await downloadCmakeIfNeeded(true);

        await withStatusLogs({
            loading: chalk.blue("Compiling llama.cpp"),
            success: chalk.blue("Compiled llama.cpp"),
            fail: chalk.blue("Failed to compile llama.cpp")
        }, async () => {
            await compileLlamaCpp({
                arch: arch ? arch : undefined,
                nodeTarget: nodeTarget ? nodeTarget : undefined,
                setUsedBinFlag: true,
                metal,
                cuda
            });
        });
    }

    if (isCI && updateBinariesReleaseMetadataAndSaveGitBundle) {
        await setBinariesGithubRelease(githubReleaseTag!);
        await unshallowAndSquashCurrentRepoAndSaveItAsReleaseBundle();
    }

    console.log();
    console.log();
    console.log(`${chalk.yellow("Repo:")} ${repo}`);
    console.log(`${chalk.yellow("Release:")} ${release}`);
    console.log();
    console.log(chalk.green("Done"));
}
