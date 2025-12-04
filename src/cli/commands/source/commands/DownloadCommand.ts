import process from "process";
import {CommandModule} from "yargs";
import fs from "fs-extra";
import chalk from "chalk";
import {
    defaultLlamaCppGitHubRepo, defaultLlamaCppRelease, isCI, llamaCppDirectory, llamaCppDirectoryInfoFilePath,
    defaultLlamaCppGpuSupport, documentationPageUrls
} from "../../../../config.js";
import {compileLlamaCpp} from "../../../../bindings/utils/compileLLamaCpp.js";
import withOra from "../../../../utils/withOra.js";
import {clearTempFolder} from "../../../../utils/clearTempFolder.js";
import {setBinariesGithubRelease} from "../../../../bindings/utils/binariesGithubRelease.js";
import {downloadCmakeIfNeeded} from "../../../../utils/cmake.js";
import withStatusLogs from "../../../../utils/withStatusLogs.js";
import {getIsInDocumentationMode} from "../../../../state.js";
import {getGitBundlePathForRelease, unshallowAndSquashCurrentRepoAndSaveItAsReleaseBundle} from "../../../../utils/gitReleaseBundles.js";
import {cloneLlamaCppRepo} from "../../../../bindings/utils/cloneLlamaCppRepo.js";
import {getPlatform} from "../../../../bindings/utils/getPlatform.js";
import {resolveCustomCmakeOptions} from "../../../../bindings/utils/resolveCustomCmakeOptions.js";
import {logBinaryUsageExampleToConsole} from "../../../../bindings/utils/logBinaryUsageExampleToConsole.js";
import {resolveGithubRelease} from "../../../../utils/resolveGithubRelease.js";
import {BuildGpu, BuildOptions, nodeLlamaCppGpuOptions, parseNodeLlamaCppGpuOption} from "../../../../bindings/types.js";
import {logUsedGpuTypeOption} from "../../../utils/logUsedGpuTypeOption.js";
import {getGpuTypesToUseForOption} from "../../../../bindings/utils/getGpuTypesToUseForOption.js";
import {getConsoleLogPrefix} from "../../../../utils/getConsoleLogPrefix.js";
import {getPrettyBuildGpuName} from "../../../../bindings/consts.js";
import {getPlatformInfo} from "../../../../bindings/utils/getPlatformInfo.js";
import {withCliCommandDescriptionDocsUrl} from "../../../utils/withCliCommandDescriptionDocsUrl.js";

type DownloadCommandArgs = {
    repo?: string,
    release?: "latest" | string,
    arch?: typeof process.arch,
    nodeTarget?: string,
    gpu?: BuildGpu | "auto",
    skipBuild?: boolean,
    noBundle?: boolean,
    noUsageExample?: boolean,

    /** @internal */
    updateBinariesReleaseMetadataAndSaveGitBundle?: boolean
};

export const DownloadCommand: CommandModule<object, DownloadCommandArgs> = {
    command: "download",
    describe: withCliCommandDescriptionDocsUrl(
        "Download a release of `llama.cpp` and compile it",
        documentationPageUrls.CLI.Source.Download
    ),
    builder(yargs) {
        const isInDocumentationMode = getIsInDocumentationMode();

        return yargs
            .option("repo", {
                type: "string",
                default: defaultLlamaCppGitHubRepo,
                description: "The GitHub repository to download a release of llama.cpp from. Can also be set via the `NODE_LLAMA_CPP_REPO` environment variable"
            })
            .option("release", {
                type: "string",
                default: isInDocumentationMode ? "<current build>" : defaultLlamaCppRelease,
                description: "The tag of the llama.cpp release to download. Set to `latest` to download the latest release. Can also be set via the `NODE_LLAMA_CPP_REPO_RELEASE` environment variable"
            })
            .option("arch", {
                alias: "a",
                type: "string",
                coerce: (value) => value,
                description: "The architecture to compile llama.cpp for"
            })
            .option("nodeTarget", {
                alias: "t",
                type: "string",
                description: "The Node.js version to compile llama.cpp for. Example: `v18.0.0`"
            })
            .option("gpu", {
                type: "string",
                default: defaultLlamaCppGpuSupport,

                // yargs types don't support passing `false` as a choice, although it is supported by yargs
                choices: nodeLlamaCppGpuOptions as any as Exclude<typeof nodeLlamaCppGpuOptions[number], false>[],
                coerce: parseNodeLlamaCppGpuOption,
                description: "Compute layer implementation type to use for llama.cpp"
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
                hidden: true, // this is only for the CI to use
                default: false,
                description: "Update the binariesGithubRelease.json file with the release of llama.cpp that was downloaded"
            });
    },
    handler: DownloadLlamaCppCommand
};


export async function DownloadLlamaCppCommand(args: DownloadCommandArgs) {
    const {
        repo = defaultLlamaCppGitHubRepo,
        release = defaultLlamaCppRelease,
        arch = undefined,
        nodeTarget = undefined,
        gpu = defaultLlamaCppGpuSupport,
        skipBuild = false,
        noBundle = false,
        noUsageExample = false,

        updateBinariesReleaseMetadataAndSaveGitBundle = false
    } = args;

    const useBundle = noBundle != true;
    const platform = getPlatform();
    const platformInfo = await getPlatformInfo();
    const customCmakeOptions = resolveCustomCmakeOptions();
    const buildGpusToTry: BuildGpu[] = skipBuild
        ? []
        : await getGpuTypesToUseForOption(gpu, {platform, arch});
    const [githubOwner, githubRepo] = repo.split("/");
    if (githubOwner == null || githubRepo == null)
        throw new Error(`Invalid GitHub repository: ${repo}`);

    let downloadedCmake = false;

    console.log(`${chalk.yellow("Repo:")} ${repo}`);
    console.log(`${chalk.yellow("Release:")} ${release}`);
    if (!skipBuild) {
        logUsedGpuTypeOption(buildGpusToTry[0]!);
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

    await cloneLlamaCppRepo(githubOwner, githubRepo, githubReleaseTag!, useBundle);

    if (!skipBuild) {
        for (let i = 0; i < buildGpusToTry.length; i++) {
            const gpuToTry = buildGpusToTry[i];
            const isLastItem = i === buildGpusToTry.length - 1;

            if (gpuToTry == null)
                continue;

            if (i > 0) // we already logged the first gpu before
                logUsedGpuTypeOption(gpuToTry);

            if (!downloadedCmake) {
                await downloadCmakeIfNeeded(true);
                downloadedCmake = true;
            }

            const buildOptions: BuildOptions = {
                customCmakeOptions,
                progressLogs: true,
                platform,
                platformInfo,
                arch: arch
                    ? arch as typeof process.arch
                    : process.arch,
                gpu: gpuToTry,
                llamaCpp: {
                    repo,
                    release: githubReleaseTag!
                }
            };

            try {
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
            } catch (err) {
                console.error(
                    getConsoleLogPrefix() +
                    `Failed to build llama.cpp with ${getPrettyBuildGpuName(gpuToTry)} support. ` +
                    (
                        !isLastItem
                            ? `falling back to building llama.cpp with ${getPrettyBuildGpuName(buildGpusToTry[i + 1])} support. `
                            : ""
                    ) +
                    "Error:",
                    err
                );

                if (isLastItem)
                    throw err;

                continue;
            }

            if (!noUsageExample) {
                console.log();
                console.log();
                logBinaryUsageExampleToConsole(buildOptions, gpu !== "auto", true);
            }

            break;
        }
    } else if (!noUsageExample) {
        const buildOptions: BuildOptions = {
            customCmakeOptions,
            progressLogs: true,
            platform,
            platformInfo,
            arch: arch
                ? arch as typeof process.arch
                : process.arch,
            gpu: buildGpusToTry[0]!,
            llamaCpp: {
                repo,
                release: githubReleaseTag!
            }
        };

        console.log();
        console.log();
        logBinaryUsageExampleToConsole(buildOptions, gpu !== "auto", true);
    }

    if (isCI && updateBinariesReleaseMetadataAndSaveGitBundle) {
        await setBinariesGithubRelease(githubReleaseTag!);
        await unshallowAndSquashCurrentRepoAndSaveItAsReleaseBundle();
    }

    console.log();
    console.log();
    console.log(`${chalk.yellow("Repo:")} ${repo}`);
    console.log(
        chalk.yellow("Release:") + " " + release + (
            release === "latest"
                ? (" " + chalk.gray("(" + githubReleaseTag + ")"))
                : ""
        )
    );
    console.log();
    console.log(chalk.green("Done"));
}

