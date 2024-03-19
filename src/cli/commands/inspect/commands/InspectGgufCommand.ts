import path from "path";
import {CommandModule} from "yargs";
import chalk from "chalk";
import bytes from "bytes";
import {parseGgufMetadata} from "../../../../gguf/parseGgufMetadata.js";
import {prettyPrintObject} from "../../../../utils/prettyPrintObject.js";

type InspectGgufCommand = {
    path: string
};

export const InspectGgufCommand: CommandModule<object, InspectGgufCommand> = {
    command: "gguf [path]",
    describe: "Inspect a GGUF file",
    builder(yargs) {
        return yargs
            .option("path", {
                type: "string",
                demandOption: true,
                description: "The path to the GGUF file to inspect"
            });
    },
    async handler({path: ggufPath}: InspectGgufCommand) {
        const isPathUrl = ggufPath.startsWith("http://") || ggufPath.startsWith("https://");
        const resolvedGgufPath = isPathUrl
            ? ggufPath
            : path.resolve(ggufPath);

        if (isPathUrl)
            console.info(`${chalk.yellow("URL:")} ${resolvedGgufPath}`);
        else
            console.info(`${chalk.yellow("File:")} ${resolvedGgufPath}`);

        const parsedMetadata = await parseGgufMetadata(ggufPath, {ignoreKeys: []});
        console.info(`${chalk.yellow("GGUF metadata size:")} ${bytes(parsedMetadata.metadataSize)}`);
        console.info(`${chalk.yellow("GGUF metadata:")} ${prettyPrintObject(parsedMetadata.metadata, undefined, {maxArrayValues: 10, useNumberGrouping: true})}`);
    }
};
