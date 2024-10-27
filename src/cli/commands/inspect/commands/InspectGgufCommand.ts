import path from "path";
import process from "process";
import {CommandModule} from "yargs";
import chalk from "chalk";
import bytes from "bytes";
import fs from "fs-extra";
import {readGgufFileInfo} from "../../../../gguf/readGgufFileInfo.js";
import {prettyPrintObject, PrettyPrintObjectOptions} from "../../../../utils/prettyPrintObject.js";
import {getGgufFileTypeName} from "../../../../gguf/utils/getGgufFileTypeName.js";
import {resolveHeaderFlag} from "../../../utils/resolveHeaderFlag.js";
import {withCliCommandDescriptionDocsUrl} from "../../../utils/withCliCommandDescriptionDocsUrl.js";
import {documentationPageUrls} from "../../../../config.js";
import withOra from "../../../../utils/withOra.js";
import {resolveModelDestination} from "../../../../utils/resolveModelDestination.js";
import {printModelDestination} from "../../../utils/printModelDestination.js";
import {getGgufMetadataKeyValue} from "../../../../gguf/utils/getGgufMetadataKeyValue.js";

type InspectGgufCommand = {
    modelPath: string,
    header?: string[],
    key?: string,
    noSplice: boolean,
    fullTensorInfo: boolean,
    fullMetadataArrays: boolean,
    plainJson: boolean,
    outputToJsonFile?: string
};

export const InspectGgufCommand: CommandModule<object, InspectGgufCommand> = {
    command: "gguf [modelPath]",
    describe: withCliCommandDescriptionDocsUrl(
        "Inspect a GGUF file",
        documentationPageUrls.CLI.Inspect.GGUF
    ),
    builder(yargs) {
        return yargs
            .option("modelPath", {
                alias: ["m", "model", "path", "url", "uri"],
                type: "string",
                demandOption: true,
                description: "The path or URI of the GGUF file to inspect. If a URI is provided, the metadata will be read from the remote file without downloading the entire file.",
                group: "Required:"
            })
            .option("header", {
                alias: ["H"],
                type: "string",
                array: true,
                description: "Headers to use when reading a model file from a URL, in the format `key: value`. You can pass this option multiple times to add multiple headers.",
                group: "Optional:"
            })
            .option("key", {
                alias: ["k"],
                type: "string",
                description: "A single metadata key to print the value of. If not provided, all metadata will be printed",
                group: "Optional:"
            })
            .option("noSplice", {
                alias: "s",
                type: "boolean",
                default: false,
                description: "When split files are detected, it reads the metadata of the first file and splices the tensorInfo from all the parts. Use this flag to disable that behavior and read only the given file",
                group: "Optional:"
            })
            .option("fullTensorInfo", {
                alias: "t",
                type: "boolean",
                default: false,
                description: "Show the full tensor info",
                group: "Optional:"
            })
            .option("fullMetadataArrays", {
                alias: "ma",
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
    async handler({
        modelPath: ggufPath, header: headerArg, key, noSplice, fullTensorInfo, fullMetadataArrays, plainJson, outputToJsonFile
    }: InspectGgufCommand) {
        const resolvedModelDestination = resolveModelDestination(ggufPath);
        const resolvedGgufPath = resolvedModelDestination.type == "file"
            ? resolvedModelDestination.path
            : resolvedModelDestination.url;

        const headers = resolveHeaderFlag(headerArg);

        if (!plainJson)
            printModelDestination(resolvedModelDestination);

        const parsedMetadata = plainJson
            ? await readGgufFileInfo(resolvedGgufPath, {
                fetchHeaders: resolvedModelDestination.type === "file"
                    ? undefined
                    : headers,
                spliceSplitFiles: !noSplice
            })
            : await withOra({
                loading: chalk.blue("Reading model metadata"),
                success: chalk.blue("Read model metadata"),
                fail: chalk.blue("Failed to read model metadata"),
                noSuccessLiveStatus: true
            }, async () => {
                return await readGgufFileInfo(resolvedGgufPath, {
                    fetchHeaders: resolvedModelDestination.type === "file"
                        ? undefined
                        : headers,
                    spliceSplitFiles: !noSplice
                });
            });

        const fileTypeName = getGgufFileTypeName(parsedMetadata.metadata.general?.file_type);

        if (plainJson || outputToJsonFile != null) {
            const getOutputJson = () => {
                if (key != null) {
                    const keyValue = getGgufMetadataKeyValue(parsedMetadata.metadata, key);
                    if (keyValue === undefined) {
                        console.log(`Key not found: ${key}`);
                        process.exit(1);
                    }

                    return JSON.stringify(keyValue, undefined, 4);
                }

                return JSON.stringify({
                    splicedParts: parsedMetadata.splicedParts,
                    version: parsedMetadata.version,
                    fileType: fileTypeName,
                    tensorCount: parsedMetadata.totalTensorCount,
                    metadataSize: parsedMetadata.totalMetadataSize,
                    tensorInfoSize: parsedMetadata.totalTensorInfoSize,
                    metadata: parsedMetadata.metadata,
                    tensorInfo: parsedMetadata.fullTensorInfo
                }, undefined, 4);
            };

            const outputJson = getOutputJson();

            if (outputToJsonFile != null) {
                const filePath = path.resolve(process.cwd(), outputToJsonFile);
                await fs.writeFile(filePath, outputJson, "utf8");
                console.info(`${chalk.yellow("JSON written to file:")} ${filePath}`);
            } else {
                console.info(outputJson);
            }
        } else if (key != null) {
            const keyValue = getGgufMetadataKeyValue(parsedMetadata.metadata, key);
            if (keyValue === undefined) {
                console.log(`${chalk.red("Metadata key not found:")} ${key}`);
                process.exit(1);
            }

            const metadataPrettyPrintOptions: PrettyPrintObjectOptions = {
                maxArrayValues: fullMetadataArrays
                    ? undefined
                    : 10,
                useNumberGrouping: true,
                maxArrayItemsWidth: process.stdout.columns - 1
            };

            console.info(`${chalk.yellow("Metadata key:")} ${prettyPrintObject(key)}`);
            console.info(`${chalk.yellow("Metadata:")} ${
                typeof keyValue === "string"
                    ? keyValue
                    : prettyPrintObject(keyValue, undefined, metadataPrettyPrintOptions)
            }`);
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

            if (parsedMetadata.splicedParts > 1)
                console.info(`${chalk.yellow("Spliced parts:")} ${parsedMetadata.splicedParts}`);

            console.info(`${chalk.yellow("GGUF version:")} ${parsedMetadata.version}`);
            console.info(`${chalk.yellow("Tensor count:")} ${parsedMetadata.totalTensorCount.toLocaleString("en-US", numberLocaleFormattingOptions)}`);
            console.info(`${chalk.yellow("Metadata size:")} ${bytes(parsedMetadata.totalMetadataSize)}`);
            console.info(`${chalk.yellow("Tensor info size:")} ${bytes(parsedMetadata.totalTensorInfoSize!)}`);
            console.info(`${chalk.yellow("File type:")} ${fileTypeName ?? ""} ${chalk.white(`(${parsedMetadata.metadata.general?.file_type})`)}`);
            console.info(`${chalk.yellow("Metadata:")} ${prettyPrintObject(parsedMetadata.metadata, undefined, metadataPrettyPrintOptions)}`);
            console.info(`${chalk.yellow("Tensor info:")} ${prettyPrintObject(parsedMetadata.fullTensorInfo, undefined, tensorInfoPrettyPrintOptions)}`);
        }
    }
};
