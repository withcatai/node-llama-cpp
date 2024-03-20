import path from "path";
import {CommandModule} from "yargs";
import chalk from "chalk";
import bytes from "bytes";
import {getGgufFileInfo} from "../../../../gguf/getGgufFileInfo.js";
import {prettyPrintObject, PrettyPrintObjectOptions} from "../../../../utils/prettyPrintObject.js";
import {getGgufFileTypeName} from "../../../../gguf/utils/getGgufFileTypeName.js";

type InspectGgufCommand = {
    path: string,
    fullTensorInfo: boolean
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
            })
            .option("fullTensorInfo", {
                alias: "t",
                type: "boolean",
                default: false,
                description: "Show the full tensor info"
            });
    },
    async handler({path: ggufPath, fullTensorInfo}: InspectGgufCommand) {
        const isPathUrl = ggufPath.startsWith("http://") || ggufPath.startsWith("https://");
        const resolvedGgufPath = isPathUrl
            ? ggufPath
            : path.resolve(ggufPath);

        if (isPathUrl)
            console.info(`${chalk.yellow("URL:")} ${resolvedGgufPath}`);
        else
            console.info(`${chalk.yellow("File:")} ${resolvedGgufPath}`);

        const parsedMetadata = await getGgufFileInfo(ggufPath, {ignoreKeys: []});
        const fileTypeName = getGgufFileTypeName(parsedMetadata.metadata.general?.file_type);
        const metadataPrettyPrintOptions: PrettyPrintObjectOptions = {
            maxArrayValues: 10,
            useNumberGrouping: true,
            maxArrayItemsWidth: process.stdout.columns - 1
        };
        const tensorInfoPrettyPrintOptions: PrettyPrintObjectOptions = {
            maxArrayValues: fullTensorInfo
                ? undefined
                : 4,
            useNumberGrouping: true,
            maxArrayItemsWidth: process.stdout.columns - 1,
            multilineObjects: false
        };
        const numberLocaleFormattingOptions = {
            style: "decimal",
            useGrouping: true
        } as const;

        console.info(`${chalk.yellow("GGUF version:")} ${parsedMetadata.version}`);
        console.info(`${chalk.yellow("Tensor count:")} ${parsedMetadata.tensorCount.toLocaleString("en-US", numberLocaleFormattingOptions)}`);
        console.info(`${chalk.yellow("Metadata size:")} ${bytes(parsedMetadata.metadataSize)}`);
        console.info(`${chalk.yellow("Tensor info size:")} ${bytes(parsedMetadata.tensorInfoSize!)}`);
        console.info(`${chalk.yellow("File type:")} ${fileTypeName ?? ""} ${chalk.white(`(${parsedMetadata.metadata.general?.file_type})`)}`);
        console.info(`${chalk.yellow("Metadata:")} ${prettyPrintObject(parsedMetadata.metadata, undefined, metadataPrettyPrintOptions)}`);
        console.info(`${chalk.yellow("Tensor info:")} ${prettyPrintObject(parsedMetadata.tensorInfo, undefined, tensorInfoPrettyPrintOptions)}`);
    }
};
