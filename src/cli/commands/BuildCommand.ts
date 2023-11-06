import process from "process";
import {CommandModule} from "yargs";
import chalk from "chalk";
import fs from "fs-extra";
import {compileLlamaCpp} from "../../utils/compileLLamaCpp.js";
import withOra from "../../utils/withOra.js";
import {clearTempFolder} from "../../utils/clearTempFolder.js";
import {defaultLlamaCppCudaSupport, defaultLlamaCppMetalSupport, llamaCppDirectory} from "../../config.js";
import {downloadCmakeIfNeeded} from "../../utils/cmake.js";
import withStatusLogs from "../../utils/withStatusLogs.js";
import {getIsInDocumentationMode} from "../../state.js";

type BuildCommand = {
    arch?: string,
    nodeTarget?: string,
    metal?: boolean,
    cuda?: boolean
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
            });
    },
    handler: BuildLlamaCppCommand
};

export async function BuildLlamaCppCommand({
    arch = undefined,
    nodeTarget = undefined,
    metal = defaultLlamaCppMetalSupport,
    cuda = defaultLlamaCppCudaSupport
}: BuildCommand) {
    if (!(await fs.pathExists(llamaCppDirectory))) {
        console.log(chalk.red('llama.cpp is not downloaded. Please run "node-llama-cpp download" first'));
        process.exit(1);
    }

    if (metal && process.platform === "darwin") {
        console.log(`${chalk.yellow("Metal:")} enabled`);
    }

    if (cuda) {
        console.log(`${chalk.yellow("CUDA:")} enabled`);
    }

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

    await withOra({
        loading: chalk.blue("Removing temporary files"),
        success: chalk.blue("Removed temporary files"),
        fail: chalk.blue("Failed to remove temporary files")
    }, async () => {
        await clearTempFolder();
    });
}
