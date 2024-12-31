import {InvalidGgufMagicError} from "../errors/InvalidGgufMagicError.js";
import {getConsoleLogPrefix} from "../../utils/getConsoleLogPrefix.js";
import {UnsupportedError} from "../../utils/UnsupportedError.js";
import {GgufReadOffset} from "../utils/GgufReadOffset.js";
import {GgufFileReader} from "../fileReaders/GgufFileReader.js";
import {GgufFileInfo, GgufVersionParserOptions, GgufVersionParserResult} from "../types/GgufFileInfoTypes.js";
import {getGgufMetadataArchitectureData} from "../utils/getGgufMetadataArchitectureData.js";
import {GgufV2Parser} from "./GgufV2Parser.js";
import {GgufV3Parser} from "./GgufV3Parser.js";

const ggufMagic = "GGUF";

export async function parseGguf({
    fileReader,
    readTensorInfo = true,
    ignoreKeys = [],
    logWarnings = true
}: {
    fileReader: GgufFileReader,
    readTensorInfo?: boolean,
    ignoreKeys?: string[],
    logWarnings?: boolean
}): Promise<GgufFileInfo> {
    const readOffset = new GgufReadOffset(0);
    const magicAndVersion = await parseMagicAndVersion(fileReader, readOffset);
    const ggufInfo = await parseGgufUsingASpecificVersionParser({
        fileReader,
        readTensorInfo,
        ignoreKeys,

        version: magicAndVersion.version,
        readOffset,
        logWarnings
    });
    const architectureMetadata = getGgufMetadataArchitectureData(ggufInfo.metadata);

    return {
        version: magicAndVersion.version,
        tensorCount: ggufInfo.tensorCount,
        metadata: ggufInfo.metadata,
        architectureMetadata: architectureMetadata,
        tensorInfo: ggufInfo.tensorInfo,
        metadataSize: ggufInfo.metadataSize,
        splicedParts: 1,
        totalTensorInfoSize: ggufInfo.tensorInfoSize,
        totalTensorCount: ggufInfo.tensorCount,
        totalMetadataSize: ggufInfo.metadataSize,
        fullTensorInfo: ggufInfo.tensorInfo,
        tensorInfoSize: ggufInfo.tensorInfoSize
    };
}

async function parseMagicAndVersion(fileReader: GgufFileReader, readOffset: GgufReadOffset) {
    const fileMagicText = await fileReader.readStringWithLength(readOffset, ggufMagic.length);

    if (fileMagicText !== ggufMagic)
        throw new InvalidGgufMagicError(ggufMagic, fileMagicText);

    const version = await fileReader.readUint32(readOffset);

    return {
        magic: ggufMagic,
        version
    };
}

async function parseGgufUsingASpecificVersionParser(
    specificVersionParserOptions: GgufVersionParserOptions
): Promise<GgufVersionParserResult> {
    switch (specificVersionParserOptions.version) {
        case 1:
            throw new UnsupportedError("GGUF version 1 is not supported by llama.cpp anymore");

        case 2:
            return await (new GgufV2Parser(specificVersionParserOptions)).parse();

        case 3:
            return await (new GgufV3Parser(specificVersionParserOptions)).parse();

        default:
            if (specificVersionParserOptions.logWarnings)
                console.warn(
                    getConsoleLogPrefix() +
                    `Unsupported GGUF version "${specificVersionParserOptions.version}". Reading the file as GGUF version 3`
                );

            return await (new GgufV3Parser(specificVersionParserOptions)).parse();
    }
}
