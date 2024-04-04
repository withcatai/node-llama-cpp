import path from "path";
import process from "process";
import {CommandModule} from "yargs";
import chalk from "chalk";
import bytes from "bytes";
import fs from "fs-extra";
import {readGgufFileInfo} from "../../../../gguf/readGgufFileInfo.js";
import {prettyPrintObject, PrettyPrintObjectOptions} from "../../../../utils/prettyPrintObject.js";
import {getGgufFileTypeName} from "../../../../gguf/utils/getGgufFileTypeName.js";
import {normalizeGgufDownloadUrl} from "../../../../gguf/utils/normalizeGgufDownloadUrl.js";

type InspectGgufCommand = {
    path: string,
    fullTensorInfo: boolean,
    fullMetadataArrays: boolean,
    plainJson: boolean,
    outputToJsonFile?: string
};

export const InspectGgufCommand: CommandModule<object, InspectGgufCommand> = {
    command: "gguf [path]",
    describe: "Inspect a GGUF file",
    builder(yargs) {
        return yargs
            .option("path", {
                type: "string",
                demandOption: true,
                description: "The path or URL of the GGUF file to inspect. If a URL is provided, the metadata will be read from the remote file without downloading the entire file."
            })
            .option("fullTensorInfo", {
                alias: "t",
                type: "boolean",
                default: false,
                description: "Show the full tensor info",
                group: "Optional:"
            })
            .option("fullMetadataArrays", {
                alias: "m",
                type: "boolean",
                default: false,
                description: "Print the full arrays in the metadata. Caution: those arrays can be extremely large and cover the entire terminal screen. Use with caution.",
                group: "Optional:"
            })
            .option("plainJson", {
                type: "boolean",
                default: false,
                description: "Print the output as plain JSON with no formatting. Useful for piping the output to other commands. The output won't truncate any values, so it may be extremely large. Use with caution.",
                group: "Optional:"
            })
            .option("outputToJsonFile", {
                type: "string",
                description: "Path to a file to write the output to as JSON. The output won't truncate any values. The output won't be printed to the console",
                group: "Optional:"
            });
    },
    async handler({path: ggufPath, fullTensorInfo, fullMetadataArrays, plainJson, outputToJsonFile}: InspectGgufCommand) {
        const isPathUrl = ggufPath.startsWith("http://") || ggufPath.startsWith("https://");
        const resolvedGgufPath = isPathUrl
            ? normalizeGgufDownloadUrl(ggufPath)
            : path.resolve(ggufPath);

        if (!plainJson) {
            if (isPathUrl)
                console.info(`${chalk.yellow("URL:")} ${resolvedGgufPath}`);
            else
                console.info(`${chalk.yellow("File:")} ${resolvedGgufPath}`);
        }

        const parsedMetadata = await readGgufFileInfo(ggufPath);
        const fileTypeName = getGgufFileTypeName(parsedMetadata.metadata.general?.file_type);

        if (plainJson || outputToJsonFile != null) {
            const outputJson = JSON.stringify({
                version: parsedMetadata.version,
                fileType: fileTypeName,
                tensorCount: parsedMetadata.tensorCount,
                metadataSize: parsedMetadata.metadataSize,
                tensorInfoSize: parsedMetadata.tensorInfoSize,
                metadata: parsedMetadata.metadata,
                tensorInfo: parsedMetadata.tensorInfo
            }, undefined, 4);

            if (outputToJsonFile != null) {
                const filePath = path.resolve(process.cwd(), outputToJsonFile);
                await fs.writeFile(filePath, outputJson, "utf8");
                console.info(`${chalk.yellow("JSON written to file:")} ${filePath}`);
            } else {
                console.info(outputJson);
            }
        } else {
            const metadataPrettyPrintOptions: PrettyPrintObjectOptions = {
                maxArrayValues: fullMetadataArrays
                    ? undefined
                    : 10,
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
    }
};
