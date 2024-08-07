import {CommandModule} from "yargs";
import {withCliCommandDescriptionDocsUrl} from "../../utils/withCliCommandDescriptionDocsUrl.js";
import {documentationPageUrls} from "../../../config.js";
import {InspectGgufCommand} from "./commands/InspectGgufCommand.js";
import {InspectGpuCommand} from "./commands/InspectGpuCommand.js";
import {InspectMeasureCommand} from "./commands/InspectMeasureCommand.js";
import {InspectEstimateCommand} from "./commands/InspectEstimateCommand.js";

type InspectCommand = {
    // no options for now
};

export const InspectCommand: CommandModule<object, InspectCommand> = {
    command: "inspect <command>",
    describe: withCliCommandDescriptionDocsUrl(
        "Inspect the inner workings of `node-llama-cpp`",
        documentationPageUrls.CLI.Inspect.index
    ),
    builder(yargs) {
        return yargs
            .command(InspectGpuCommand)
            .command(InspectGgufCommand)
            .command(InspectMeasureCommand)
            .command(InspectEstimateCommand);
    },
    async handler() {
        // this function must exist, even though we do nothing here
    }
};
