import {CommandModule} from "yargs";
import {InspectGgufCommand} from "./commands/InspectGgufCommand.js";
import {InspectGpuCommand} from "./commands/InspectGpuCommand.js";
import {InspectMeasureCommand} from "./commands/InspectMeasureCommand.js";

type InspectCommand = {
    // no options for now
};

export const InspectCommand: CommandModule<object, InspectCommand> = {
    command: "inspect <command>",
    describe: "Inspect the inner workings of node-llama-cpp",
    builder(yargs) {
        return yargs
            .command(InspectGpuCommand)
            .command(InspectGgufCommand)
            .command(InspectMeasureCommand);
    },
    async handler() {
        // this function must exit, even though we do nothing here
    }
};
