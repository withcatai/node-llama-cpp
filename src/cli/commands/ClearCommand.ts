import {CommandModule} from "yargs";
import * as fs from "fs-extra";
import chalk from "chalk";
import {llamaCppDirectory} from "../../config.js";
import withOra from "../../utils/withOra.js";
import {clearLlamaBuild} from "../../utils/clearLlamaBuild.js";
import {setUsedBinFlag} from "../../utils/usedBinFlag.js";

type ClearCommand = {
    type: "source" | "build" | "all"
};

export const ClearCommand: CommandModule<object, ClearCommand> = {
    command: "clear [type]",
    describe: "Clear files created by llama-cli",
    builder(yargs) {
        return yargs
            .option("type", {
                type: "string",
                choices: ["source", "build", "all"] as ClearCommand["type"][],
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

    await setUsedBinFlag("prebuiltBinaries");
}
