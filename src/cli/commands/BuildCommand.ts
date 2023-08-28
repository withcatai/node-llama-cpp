import {CommandModule} from "yargs";
import chalk from "chalk";
import {compileLlamaCpp} from "../../utils/compileLLamaCpp.js";
import withOra from "../../utils/withOra.js";
import {clearTempFolder} from "../../utils/clearTempFolder.js";

type BuildCommand = {
    arch?: string,
    nodeTarget?: string
};

export const BuildCommand: CommandModule<object, BuildCommand> = {
    command: "build",
    describe: "Compile the currently downloaded llama.cpp",
    builder(yargs) {
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
            });
    },
    handler: BuildLlamaCppCommand
};

export async function BuildLlamaCppCommand({arch, nodeTarget}: BuildCommand) {
    await withOra({
        loading: chalk.blue("Compiling llama.cpp"),
        success: chalk.blue("Compiled llama.cpp"),
        fail: chalk.blue("Failed to compile llama.cpp")
    }, async () => {
        await compileLlamaCpp({
            arch: arch ? arch : undefined,
            nodeTarget: nodeTarget ? nodeTarget : undefined,
            setUsedBingFlag: true
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
