import {CommandModule} from "yargs";
import {withCliCommandDescriptionDocsUrl} from "../../utils/withCliCommandDescriptionDocsUrl.js";
import {documentationPageUrls} from "../../../config.js";
import {InspectGgufCommand} from "./commands/InspectGgufCommand.js";
import {InspectGpuCommand} from "./commands/InspectGpuCommand.js";
import {InspectMeasureCommand} from "./commands/InspectMeasureCommand.js";

type InspectCommand = {
    // no options for now
};

export const InspectCommand: CommandModule<object, InspectCommand> = {
    command: "inspect <command>",
    describe: withCliCommandDescriptionDocsUrl(
        "Inspect the inner workings of node-llama-cpp",
        documentationPageUrls.CLI.Inspect.index
    ),
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
