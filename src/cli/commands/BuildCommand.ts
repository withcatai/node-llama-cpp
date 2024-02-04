import process from "process";
import {CommandModule} from "yargs";
import chalk from "chalk";
import {compileLlamaCpp} from "../../utils/compileLLamaCpp.js";
import withOra from "../../utils/withOra.js";
import {clearTempFolder} from "../../utils/clearTempFolder.js";
import {
    builtinLlamaCppGitHubRepo, builtinLlamaCppRelease, defaultLlamaCppCudaSupport, defaultLlamaCppMetalSupport
} from "../../config.js";
import {downloadCmakeIfNeeded} from "../../utils/cmake.js";
import withStatusLogs from "../../utils/withStatusLogs.js";
import {getIsInDocumentationMode} from "../../state.js";
import {logBinaryUsageExampleToConsole} from "../../llamaBin/utils/logBinaryUsageExampleToConsole.js";
import {getPlatform} from "../../llamaBin/utils/getPlatform.js";
import {resolveCustomCmakeOptions} from "../../llamaBin/utils/resolveCustomCmakeOptions.js";
import {getClonedLlamaCppRepoReleaseInfo, isLlamaCppRepoCloned} from "../../utils/cloneLlamaCppRepo.js";
import {BuildOptions} from "../../llamaBin/types.js";

type BuildCommand = {
    arch?: string,
    nodeTarget?: string,
    metal?: boolean,
    cuda?: boolean,
    noUsageExample?: boolean
};

export const BuildCommand: CommandModule<object, BuildCommand> = {
    command: "build",
    describe: "Compile the currently downloaded llama.cpp",
    builder(yargs) {
        const isInDocumentationMode = getIsInDocumentationMode();

        return yargs
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
                description: "Compile llama.cpp with Metal support. Enabled by default on macOS. Can be disabled with \"--no-metal\". Can also be set via the NODE_LLAMA_CPP_METAL environment variable"
            })
            .option("cuda", {
                type: "boolean",
                default: defaultLlamaCppCudaSupport,
                description: "Compile llama.cpp with CUDA support. Can also be set via the NODE_LLAMA_CPP_CUDA environment variable"
            })
            .option("noUsageExample", {
                alias: "nu",
                type: "boolean",
                default: false,
                description: "Don't print code usage example after building"
            });
    },
    handler: BuildLlamaCppCommand
};

export async function BuildLlamaCppCommand({
    arch = undefined,
    nodeTarget = undefined,
    metal = defaultLlamaCppMetalSupport,
    cuda = defaultLlamaCppCudaSupport,
    noUsageExample = false
}: BuildCommand) {
    if (!(await isLlamaCppRepoCloned())) {
        console.log(chalk.red('llama.cpp is not downloaded. Please run "node-llama-cpp download" first'));
        process.exit(1);
    }

    const clonedLlamaCppRepoReleaseInfo = await getClonedLlamaCppRepoReleaseInfo();

    const platform = getPlatform();
    const customCmakeOptions = resolveCustomCmakeOptions();

    if (metal && process.platform === "darwin") {
        console.log(`${chalk.yellow("Metal:")} enabled`);
    }

    if (cuda) {
        console.log(`${chalk.yellow("CUDA:")} enabled`);
    }

    await downloadCmakeIfNeeded(true);

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
            repo: clonedLlamaCppRepoReleaseInfo?.llamaCppGithubRepo ?? builtinLlamaCppGitHubRepo,
            release: clonedLlamaCppRepoReleaseInfo?.tag ?? builtinLlamaCppRelease
        }
    };

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

    await withOra({
        loading: chalk.blue("Removing temporary files"),
        success: chalk.blue("Removed temporary files"),
        fail: chalk.blue("Failed to remove temporary files")
    }, async () => {
        await clearTempFolder();
    });

    if (!noUsageExample) {
        console.log();
        logBinaryUsageExampleToConsole(buildOptions, true);
        console.log();
    }
}
