import process from "process";
import path from "path";
import {CommandModule} from "yargs";
import {Octokit} from "octokit";
import fs from "fs-extra";
import chalk from "chalk";
import cliProgress from "cli-progress";
import simpleGit from "simple-git";
import {
    defaultLlamaCppCudaSupport, defaultLlamaCppGitHubRepo, defaultLlamaCppMetalSupport, defaultLlamaCppRelease, llamaCppDirectory
} from "../../config.js";
import {compileLlamaCpp} from "../../utils/compileLLamaCpp.js";
import withOra from "../../utils/withOra.js";
import {clearTempFolder} from "../../utils/clearTempFolder.js";
import {setBinariesGithubRelease} from "../../utils/binariesGithubRelease.js";

type DownloadCommandArgs = {
    repo: string,
    release: "latest" | string,
    arch?: string,
    nodeTarget?: string,
    metal: boolean,
    cuda: boolean,
    skipBuild?: boolean,
    updateBinariesReleaseMetadata?: boolean
};

export const DownloadCommand: CommandModule<object, DownloadCommandArgs> = {
    command: "download",
    describe: "Download a release of llama.cpp and compile it",
    builder(yargs) {
        return yargs
            .option("repo", {
                type: "string",
                default: defaultLlamaCppGitHubRepo,
                description: "The GitHub repository to download a release of llama.cpp from. Can also be set via the NODE_LLAMA_CPP_REPO environment variable"
            })
            .option("release", {
                type: "string",
                default: defaultLlamaCppRelease,
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
                default: defaultLlamaCppMetalSupport,
                hidden: process.platform !== "darwin",
                description: "Compile llama.cpp with Metal support. Can also be set via the NODE_LLAMA_CPP_METAL environment variable"
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
            .option("updateBinariesReleaseMetadata", {
                type: "boolean",
                hidden: true, // this for the CI to use
                default: false,
                description: "Update the binariesGithubRelease.json file with the release of llama.cpp that was downloaded"
            });
    },
    handler: DownloadLlamaCppCommand
};

export async function DownloadLlamaCppCommand({
    repo, release, arch, nodeTarget, metal, cuda, skipBuild, updateBinariesReleaseMetadata
}: DownloadCommandArgs) {
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

    let githubRelease: GithubReleaseType | null = null;
    await withOra({
        loading: chalk.blue("Fetching llama.cpp info"),
        success: chalk.blue("Fetched llama.cpp info"),
        fail: chalk.blue("Failed to fetch llama.cpp info")
    }, async () => {
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

        if (githubRelease!.data.tag_name == null) {
            throw new Error(`Failed to find tag of release "${release}" of "${repo}"`);
        }
    });

    await clearTempFolder();

    await withOra({
        loading: chalk.blue("Removing existing llama.cpp directory"),
        success: chalk.blue("Removed existing llama.cpp directory"),
        fail: chalk.blue("Failed to remove existing llama.cpp directory")
    }, async () => {
        await fs.remove(llamaCppDirectory);
    });

    console.log(chalk.blue("Cloning llama.cpp"));
    await cloneTag(githubOwner, githubRepo, githubRelease!.data.tag_name, llamaCppDirectory);

    await withOra({
        loading: chalk.blue("Generating required files"),
        success: chalk.blue("Generated required files"),
        fail: chalk.blue("Failed to generate required files")
    }, async () => {
        const buildInfoTemplateFilePath = path.join(llamaCppDirectory, "scripts", "build-info.h.in");
        const buildInfoResultFilePath = path.join(llamaCppDirectory, "build-info.h");
        const buildInfoTemplateFile = await fs.readFile(buildInfoTemplateFilePath, "utf8");

        const finalFile = buildInfoTemplateFile
            .replaceAll("@BUILD_NUMBER@", "1")
            .replaceAll("@BUILD_COMMIT@", githubRelease!.data.tag_name);

        await fs.writeFile(buildInfoResultFilePath, finalFile, "utf8");
    });

    if (!skipBuild) {
        console.log(chalk.blue("Compiling llama.cpp"));
        await compileLlamaCpp({
            arch: arch ? arch : undefined,
            nodeTarget: nodeTarget ? nodeTarget : undefined,
            setUsedBinFlag: true,
            metal,
            cuda
        });
    }

    if (updateBinariesReleaseMetadata) {
        await setBinariesGithubRelease(githubRelease!.data.tag_name);
    }

    console.log();
    console.log();
    console.log(`${chalk.yellow("Repo:")} ${repo}`);
    console.log(`${chalk.yellow("Release:")} ${release}`);
    console.log();
    console.log(chalk.green("Done"));
}


async function cloneTag(githubOwner: string, githubRepo: string, tag: string, directory: string) {
    const progressBar = new cliProgress.Bar({
        clearOnComplete: false,
        hideCursor: true,
        autopadding: true,
        format: `${chalk.bold("Clone {repo}")}  ${chalk.yellow("{percentage}%")} ${chalk.cyan("{bar}")} ${chalk.grey("{eta_formatted}")}`
    }, cliProgress.Presets.shades_classic);

    progressBar.start(100, 0, {
        speed: "",
        repo: `${githubOwner}/${githubRepo}`
    });

    try {
        await simpleGit({
            progress({progress, total, processed}) {
                const totalProgress = (processed / 100) + (progress / total);

                progressBar.update(Math.floor(totalProgress * 10000) / 100);
            }
        }).clone(`https://github.com/${githubOwner}/${githubRepo}.git`, directory, {
            "--depth": 1,
            "--branch": tag,
            "--quiet": null
        });
    } finally {
        progressBar.update(100);
        progressBar.stop();
    }
}
