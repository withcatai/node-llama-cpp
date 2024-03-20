import {InvalidGgufMagicError} from "../errors/InvalidGgufMagicError.js";
import {getConsoleLogPrefix} from "../../utils/getConsoleLogPrefix.js";
import {UnsupportedError} from "../../utils/UnsupportedError.js";
import {GgufReadOffset} from "../utils/GgufReadOffset.js";
import {GgufFileReader, valueTypeToBytesToRead} from "../fileReaders/GgufFileReader.js";
import {GgufFileInfo, GgufVersionParserOptions, GgufVersionParserResult} from "../types/GgufFileInfoTypes.js";
import {GgufV2Parser} from "./GgufV2Parser.js";

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
    const gguifInfo = await parseGgufUsingASpecificVersionParser({
        fileReader,
        readTensorInfo,
        ignoreKeys,

        version: magicAndVersion.version,
        readOffset,
        logWarnings
    });

    return {
        version: magicAndVersion.version,
        tensorCount: gguifInfo.tensorCount,
        metadata: gguifInfo.metadata,
        tensorInfo: gguifInfo.tensorInfo,
        metadataSize: gguifInfo.metadataSize,
        tensorInfoSize: gguifInfo.tensorInfoSize
    };
}

async function parseMagicAndVersion(fileReader: GgufFileReader, readOffset: GgufReadOffset) {
    const fileMagicBytes = await fileReader.readByteRange(readOffset, valueTypeToBytesToRead.uint8 * ggufMagic.length);
    const fileMagicText = String.fromCharCode(...fileMagicBytes);

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
        case 3:
            return await (new GgufV2Parser(specificVersionParserOptions)).parse();

        default:
            if (specificVersionParserOptions.logWarnings)
                console.warn(
                    getConsoleLogPrefix() +
                    `Unsupported GGUF version: ${specificVersionParserOptions.version}. Parsing it as version 3`
                );

            return await (new GgufV2Parser(specificVersionParserOptions)).parse();
    }
}
