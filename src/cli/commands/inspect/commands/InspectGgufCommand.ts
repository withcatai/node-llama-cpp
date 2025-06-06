import path from "path";
import process from "process";
import {CommandModule} from "yargs";
import chalk from "chalk";
import fs from "fs-extra";
import {Template} from "@huggingface/jinja";
import {readGgufFileInfo} from "../../../../gguf/readGgufFileInfo.js";
import {prettyPrintObject, PrettyPrintObjectOptions} from "../../../../utils/prettyPrintObject.js";
import {getGgufFileTypeName} from "../../../../gguf/utils/getGgufFileTypeName.js";
import {resolveHeaderFlag} from "../../../utils/resolveHeaderFlag.js";
import {withCliCommandDescriptionDocsUrl} from "../../../utils/withCliCommandDescriptionDocsUrl.js";
import {documentationPageUrls} from "../../../../config.js";
import withOra from "../../../../utils/withOra.js";
import {resolveModelArgToFilePathOrUrl} from "../../../../utils/resolveModelDestination.js";
import {printModelDestination} from "../../../utils/printModelDestination.js";
import {getGgufMetadataKeyValue} from "../../../../gguf/utils/getGgufMetadataKeyValue.js";
import {GgufTensorInfo} from "../../../../gguf/types/GgufTensorInfoTypes.js";
import {toBytes} from "../../../utils/toBytes.js";
import {printDidYouMeanUri} from "../../../utils/resolveCommandGgufPath.js";
import {isModelUri} from "../../../../utils/parseModelUri.js";

const chatTemplateKey = ".chatTemplate";

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
                description: "A single metadata key to print the value of. If not provided, all metadata will be printed. " +
                    "If the key is `" + chatTemplateKey + "` then the chat template of the model will be formatted and printed.",
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
        const headers = resolveHeaderFlag(headerArg);

        const [resolvedModelDestination, resolvedGgufPath] = (!plainJson && isModelUri(ggufPath))
            ? await withOra({
                loading: chalk.blue("Resolving model URI"),
                success: chalk.blue("Resolved model URI"),
                fail: chalk.blue("Failed to resolve model URI"),
                noSuccessLiveStatus: true
            }, () => resolveModelArgToFilePathOrUrl(ggufPath, headers))
            : await resolveModelArgToFilePathOrUrl(ggufPath, headers);

        if (resolvedModelDestination.type === "file" && !await fs.pathExists(resolvedGgufPath)) {
            console.error(`${chalk.red("File does not exist:")} ${resolvedGgufPath}`);
            printDidYouMeanUri(ggufPath);
            process.exit(1);
        }

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

        removeAdditionalTensorInfoFields(parsedMetadata.fullTensorInfo);

        const fileTypeName = getGgufFileTypeName(parsedMetadata.metadata.general?.file_type);

        if (plainJson || outputToJsonFile != null) {
            const getOutputJson = () => {
                if (key != null) {
                    const keyValue = key === chatTemplateKey
                        ? tryFormattingJinja(getGgufMetadataKeyValue(parsedMetadata.metadata, "tokenizer.chat_template"))
                        : getGgufMetadataKeyValue(parsedMetadata.metadata, key);
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
            const keyValue = key === chatTemplateKey
                ? tryFormattingJinja(getGgufMetadataKeyValue(parsedMetadata.metadata, "tokenizer.chat_template"))
                : getGgufMetadataKeyValue(parsedMetadata.metadata, key);
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
            console.info(`${chalk.yellow("Metadata size:")} ${toBytes(parsedMetadata.totalMetadataSize)}`);
            console.info(`${chalk.yellow("Tensor info size:")} ${toBytes(parsedMetadata.totalTensorInfoSize!)}`);
            console.info(`${chalk.yellow("File type:")} ${fileTypeName ?? ""} ${chalk.white(`(${parsedMetadata.metadata.general?.file_type})`)}`);
            console.info(`${chalk.yellow("Metadata:")} ${prettyPrintObject(parsedMetadata.metadata, undefined, metadataPrettyPrintOptions)}`);
            console.info(`${chalk.yellow("Tensor info:")} ${prettyPrintObject(parsedMetadata.fullTensorInfo, undefined, tensorInfoPrettyPrintOptions)}`);
        }
    }
};

// these fields are added by the parser for ease of use and are not found in the gguf file itself
function removeAdditionalTensorInfoFields(tensorInfo?: GgufTensorInfo[]) {
    if (tensorInfo == null)
        return;

    for (const tensor of tensorInfo) {
        delete (tensor as {fileOffset?: GgufTensorInfo["fileOffset"]}).fileOffset;
        delete (tensor as {filePart?: GgufTensorInfo["filePart"]}).filePart;
    }
}

function tryFormattingJinja(template?: string) {
    if (typeof template !== "string")
        return template;

    try {
        const parsedTemplate = new Template(template);
        return parsedTemplate.format({
            indent: 4
        }) ?? template;
    } catch (err) {
        return template;
    }
}
