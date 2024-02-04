import process from "process";
import {CommandModule} from "yargs";
import fs from "fs-extra";
import chalk from "chalk";
import {
    defaultLlamaCppCudaSupport, defaultLlamaCppGitHubRepo, defaultLlamaCppMetalSupport, defaultLlamaCppRelease, isCI, llamaCppDirectory,
    llamaCppDirectoryInfoFilePath
} from "../../config.js";
import {compileLlamaCpp} from "../../bindings/utils/compileLLamaCpp.js";
import withOra from "../../utils/withOra.js";
import {clearTempFolder} from "../../utils/clearTempFolder.js";
import {setBinariesGithubRelease} from "../../bindings/utils/binariesGithubRelease.js";
import {downloadCmakeIfNeeded} from "../../utils/cmake.js";
import withStatusLogs from "../../utils/withStatusLogs.js";
import {getIsInDocumentationMode} from "../../state.js";
import {getGitBundlePathForRelease, unshallowAndSquashCurrentRepoAndSaveItAsReleaseBundle} from "../../utils/gitReleaseBundles.js";
import {cloneLlamaCppRepo} from "../../bindings/utils/cloneLlamaCppRepo.js";
import {getPlatform} from "../../bindings/utils/getPlatform.js";
import {resolveCustomCmakeOptions} from "../../bindings/utils/resolveCustomCmakeOptions.js";
import {logBinaryUsageExampleToConsole} from "../../bindings/utils/logBinaryUsageExampleToConsole.js";
import {resolveGithubRelease} from "../../utils/resolveGithubRelease.js";
import {BuildOptions} from "../../bindings/types.js";

type DownloadCommandArgs = {
    repo?: string,
    release?: "latest" | string,
    arch?: string,
    nodeTarget?: string,
    metal?: boolean,
    cuda?: boolean,
    skipBuild?: boolean,
    noBundle?: boolean,
    noUsageExample?: boolean,

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
            .option("noUsageExample", {
                alias: "nu",
                type: "boolean",
                default: false,
                description: "Don't print code usage example after building"
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

// TODO: clear the builds folder
export async function DownloadLlamaCppCommand({
    repo = defaultLlamaCppGitHubRepo,
    release = defaultLlamaCppRelease,
    arch = undefined,
    nodeTarget = undefined,
    metal = defaultLlamaCppMetalSupport,
    cuda = defaultLlamaCppCudaSupport,
    skipBuild = false,
    noBundle = false,
    noUsageExample = false,
    updateBinariesReleaseMetadataAndSaveGitBundle = false
}: DownloadCommandArgs) {
    const useBundle = noBundle != true;
    const platform = getPlatform();
    const customCmakeOptions = resolveCustomCmakeOptions();
    const [githubOwner, githubRepo] = repo.split("/");

    console.log(`${chalk.yellow("Repo:")} ${repo}`);
    console.log(`${chalk.yellow("Release:")} ${release}`);
    if (!skipBuild) {
        if (metal && platform === "mac") {
            console.log(`${chalk.yellow("Metal:")} enabled`);
        }

        if (cuda) {
            console.log(`${chalk.yellow("CUDA:")} enabled`);
        }
    }
    console.log();

    let githubReleaseTag: string | null = (useBundle && (await getGitBundlePathForRelease(githubOwner, githubRepo, release)) != null)
        ? release
        : null;

    if (githubReleaseTag == null)
        await withOra({
            loading: chalk.blue("Fetching llama.cpp info"),
            success: chalk.blue("Fetched llama.cpp info"),
            fail: chalk.blue("Failed to fetch llama.cpp info")
        }, async () => {
            githubReleaseTag = await resolveGithubRelease(githubOwner, githubRepo, release);
        });

    await clearTempFolder();

    await withOra({
        loading: chalk.blue("Removing existing llama.cpp directory"),
        success: chalk.blue("Removed existing llama.cpp directory"),
        fail: chalk.blue("Failed to remove existing llama.cpp directory")
    }, async () => {
        await fs.remove(llamaCppDirectory);
        await fs.remove(llamaCppDirectoryInfoFilePath);
    });

    console.log(chalk.blue("Cloning llama.cpp"));
    await cloneLlamaCppRepo(githubOwner, githubRepo, githubReleaseTag!, useBundle);

    const buildOptions: BuildOptions = {
        customCmakeOptions,
        progressLogs: true,
        platform,
        arch: arch
            ? arch as typeof process.arch
            : process.arch,
        computeLayers: {
            metal,
            cuda
        },
        llamaCpp: {
            repo,
            release: githubReleaseTag!
        }
    };

    if (!skipBuild) {
        await downloadCmakeIfNeeded(true);

        await withStatusLogs({
            loading: chalk.blue("Compiling llama.cpp"),
            success: chalk.blue("Compiled llama.cpp"),
            fail: chalk.blue("Failed to compile llama.cpp")
        }, async () => {
            await compileLlamaCpp(buildOptions, {
                nodeTarget: nodeTarget ? nodeTarget : undefined,
                updateLastBuildInfo: true,
                downloadCmakeIfNeeded: false,
                ensureLlamaCppRepoIsCloned: false,
                includeBuildOptionsInBinaryFolderName: true
            });
        });
    }

    if (isCI && updateBinariesReleaseMetadataAndSaveGitBundle) {
        await setBinariesGithubRelease(githubReleaseTag!);
        await unshallowAndSquashCurrentRepoAndSaveItAsReleaseBundle();
    }

    if (!noUsageExample) {
        console.log();
        console.log();
        logBinaryUsageExampleToConsole(buildOptions, true);
    }

    console.log();
    console.log();
    console.log(`${chalk.yellow("Repo:")} ${repo}`);
    console.log(`${chalk.yellow("Release:")} ${release}`);
    console.log();
    console.log(chalk.green("Done"));
}

