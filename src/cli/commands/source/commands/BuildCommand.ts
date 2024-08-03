import process from "process";
import {CommandModule} from "yargs";
import chalk from "chalk";
import {compileLlamaCpp} from "../../../../bindings/utils/compileLLamaCpp.js";
import withOra from "../../../../utils/withOra.js";
import {clearTempFolder} from "../../../../utils/clearTempFolder.js";
import {builtinLlamaCppGitHubRepo, builtinLlamaCppRelease, isCI, defaultLlamaCppGpuSupport, documentationPageUrls} from "../../../../config.js";
import {downloadCmakeIfNeeded} from "../../../../utils/cmake.js";
import withStatusLogs from "../../../../utils/withStatusLogs.js";
import {logBinaryUsageExampleToConsole} from "../../../../bindings/utils/logBinaryUsageExampleToConsole.js";
import {getPlatform} from "../../../../bindings/utils/getPlatform.js";
import {resolveCustomCmakeOptions} from "../../../../bindings/utils/resolveCustomCmakeOptions.js";
import {getClonedLlamaCppRepoReleaseInfo, isLlamaCppRepoCloned} from "../../../../bindings/utils/cloneLlamaCppRepo.js";
import {BuildGpu, BuildOptions, nodeLlamaCppGpuOptions, parseNodeLlamaCppGpuOption} from "../../../../bindings/types.js";
import {logUsedGpuTypeOption} from "../../../utils/logUsedGpuTypeOption.js";
import {getGpuTypesToUseForOption} from "../../../../bindings/utils/getGpuTypesToUseForOption.js";
import {getConsoleLogPrefix} from "../../../../utils/getConsoleLogPrefix.js";
import {getPrettyBuildGpuName} from "../../../../bindings/consts.js";
import {getPlatformInfo} from "../../../../bindings/utils/getPlatformInfo.js";
import {withCliCommandDescriptionDocsUrl} from "../../../utils/withCliCommandDescriptionDocsUrl.js";

type BuildCommand = {
    arch?: typeof process.arch,
    nodeTarget?: string,
    gpu?: BuildGpu | "auto",
    noUsageExample?: boolean,

    /** @internal */
    noCustomCmakeBuildOptionsInBinaryFolderName?: boolean,

    /** @internal */
    ciMode?: boolean
};

export const BuildCommand: CommandModule<object, BuildCommand> = {
    command: "build",
    aliases: ["compile"],
    describe: withCliCommandDescriptionDocsUrl(
        "Compile the currently downloaded `llama.cpp` source code",
        documentationPageUrls.CLI.Source.Build
    ),
    builder(yargs) {
        return yargs
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
            .option("noUsageExample", {
                alias: "nu",
                type: "boolean",
                default: false,
                description: "Don't print code usage example after building"
            })
            .option("noCustomCmakeBuildOptionsInBinaryFolderName", {
                type: "boolean",
                hidden: true, // this is only for the CI to use
                default: false,
                description: "Don't include custom CMake build options in build folder name"
            })
            .option("ciMode", {
                type: "boolean",
                hidden: true, // this is only for the CI to use
                default: false,
                description: "Enable CI only build options"
            });
    },
    handler: BuildLlamaCppCommand
};

export async function BuildLlamaCppCommand({
    arch = undefined,
    nodeTarget = undefined,
    gpu = defaultLlamaCppGpuSupport,
    noUsageExample = false,

    /** @internal */
    noCustomCmakeBuildOptionsInBinaryFolderName = false,

    /** @internal */
    ciMode = false
}: BuildCommand) {
    if (!(await isLlamaCppRepoCloned())) {
        console.log(chalk.red('llama.cpp is not downloaded. Please run "node-llama-cpp source download" first'));
        process.exit(1);
    }

    const includeBuildOptionsInBinaryFolderName = !noCustomCmakeBuildOptionsInBinaryFolderName || !isCI;

    const clonedLlamaCppRepoReleaseInfo = await getClonedLlamaCppRepoReleaseInfo();

    const platform = getPlatform();
    const platformInfo = await getPlatformInfo();
    const customCmakeOptions = resolveCustomCmakeOptions();
    const buildGpusToTry: BuildGpu[] = await getGpuTypesToUseForOption(gpu, {platform, arch});
    let downloadedCmake = false;

    for (let i = 0; i < buildGpusToTry.length; i++) {
        const gpuToTry = buildGpusToTry[i];
        const isLastItem = i === buildGpusToTry.length - 1;

        if (gpuToTry == null)
            continue;

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
                repo: clonedLlamaCppRepoReleaseInfo?.llamaCppGithubRepo ?? builtinLlamaCppGitHubRepo,
                release: clonedLlamaCppRepoReleaseInfo?.tag ?? builtinLlamaCppRelease
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
                    includeBuildOptionsInBinaryFolderName,
                    ciMode: isCI && ciMode
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

        await withOra({
            loading: chalk.blue("Removing temporary files"),
            success: chalk.blue("Removed temporary files"),
            fail: chalk.blue("Failed to remove temporary files")
        }, async () => {
            await clearTempFolder();
        });

        if (!noUsageExample) {
            console.log();
            logBinaryUsageExampleToConsole(buildOptions, gpu !== "auto", true);
            console.log();
        }

        break;
    }
}
