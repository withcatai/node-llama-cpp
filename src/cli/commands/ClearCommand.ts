import {CommandModule} from "yargs";
import fs from "fs-extra";
import chalk from "chalk";
import {llamaCppDirectory, llamaCppDirectoryTagFilePath} from "../../config.js";
import withOra from "../../utils/withOra.js";
import {clearLlamaBuild} from "../../utils/clearLlamaBuild.js";
import {setUsedBinFlag} from "../../utils/usedBinFlag.js";
import {clearLocalCmake, fixXpackPermissions} from "../../utils/cmake.js";

type ClearCommand = {
    type: "source" | "build" | "cmake" | "all"
};

export const ClearCommand: CommandModule<object, ClearCommand> = {
    command: "clear [type]",
    aliases: ["clean"],
    describe: "Clear files created by node-llama-cpp",
    builder(yargs) {
        return yargs
            .option("type", {
                type: "string",
                choices: ["source", "build", "cmake", "all"] satisfies ClearCommand["type"][],
                default: "all" as ClearCommand["type"],
                description: "Files to clear"
            });
    },
    handler: ClearLlamaCppBuildCommand
};

export async function ClearLlamaCppBuildCommand({type}: ClearCommand) {
    if (type === "source" || type === "all") {
        await withOra({
            loading: chalk.blue("Clearing source"),
            success: chalk.blue("Cleared source"),
            fail: chalk.blue("Failed to clear source")
        }, async () => {
            await fs.remove(llamaCppDirectory);
            await fs.remove(llamaCppDirectoryTagFilePath);
        });
    }

    if (type === "build" || type === "all") {
        await withOra({
            loading: chalk.blue("Clearing build"),
            success: chalk.blue("Cleared build"),
            fail: chalk.blue("Failed to clear build")
        }, async () => {
            await clearLlamaBuild();
        });
    }

    if (type === "cmake" || type === "all") {
        await withOra({
            loading: chalk.blue("Clearing internal cmake"),
            success: chalk.blue("Cleared internal cmake"),
            fail: chalk.blue("Failed to clear internal cmake")
        }, async () => {
            await fixXpackPermissions();
            await clearLocalCmake();
        });
    }

    await setUsedBinFlag("prebuiltBinaries");
}
