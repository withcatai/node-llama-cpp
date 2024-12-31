import type {GgufReadOffset} from "../utils/GgufReadOffset.js";
import type {GgufFileReader} from "../fileReaders/GgufFileReader.js";
import type {MergeOptionalUnionTypes} from "../../utils/mergeUnionTypes.js";
import type {GgufArchitectureType, GgufMetadata} from "./GgufMetadataTypes.js";
import type {GgufTensorInfo} from "./GgufTensorInfoTypes.js";

export type MetadataValue = string | number | bigint | boolean | MetadataValue[];
export type MetadataKeyValueRecord = Record<string, MetadataValue>;
export type MetadataNestedObject = {
    [key: string]: MetadataValue | MetadataNestedObject
};

export type GgufFileInfo = {
    readonly version: 2 | 3 | number,
    readonly tensorCount: number | bigint,
    readonly metadata: GgufMetadata,
    readonly metadataSize: number,

    /** Same value as `metadata[metadata.general.architecture]`, but with merged types for convenience */
    readonly architectureMetadata: MergeOptionalUnionTypes<Exclude<GgufMetadata[GgufArchitectureType], undefined>>,

    /** can be null if `readTensorInfo` is set to `false` */
    readonly tensorInfo?: GgufTensorInfo[],

    /** can be null if `readTensorInfo` is set to `false` */
    readonly tensorInfoSize?: number,

    /**
     * For spliced metadata of multiple file parts,
     * this will be the number of files parts read and spliced into this metadata.
     *
     * Whe no splicing is done, this will be `1`.
     */
    readonly splicedParts: number,

    /**
     * For spliced metadata of multiple file parts, this will be the total tensor count from all the parts
     *
     * When no splicing is done, this will be the same as `tensorCount`.
     */
    readonly totalTensorCount: number | bigint,

    /**
     * For spliced metadata of multiple file parts, this will be the total metadata size from all the parts
     *
     * When no splicing is done, this will be the same as `metadataSize`.
     */
    readonly totalMetadataSize: number,

    /**
     * For spliced metadata of multiple file parts, this will be the spliced tensorInfo from all the parts.
     * Can be null if `readTensorInfo` is set to `false`
     *
     * When no splicing is done, this will be the same as `tensorInfo`.
     */
    readonly fullTensorInfo?: GgufTensorInfo[],

    /**
     * For spliced metadata of multiple file parts, this will be the total tensor info size from all the parts
     *
     * When no splicing is done, this will be the same as `tensorInfoSize`.
     */
    readonly totalTensorInfoSize?: number
};


// source: `enum gguf_type` in `ggml.h` in the `llama.cpp` source code
export const enum GgufValueType {
    Uint8 = 0,
    Int8 = 1,
    Uint16 = 2,
    Int16 = 3,
    Uint32 = 4,
    Int32 = 5,
    Float32 = 6,
    Bool = 7,
    String = 8,
    Array = 9,
    Uint64 = 10,
    Int64 = 11,
    Float64 = 12
}

export type GgufVersionParserOptions = {
    fileReader: GgufFileReader,
    readTensorInfo?: boolean,
    ignoreKeys?: string[],

    version: number,
    readOffset: GgufReadOffset,
    logWarnings: boolean
};

export type GgufVersionParserResult = {
    tensorCount: number | bigint,
    metadata: GgufMetadata,
    tensorInfo?: GgufTensorInfo[],
    metadataSize: number,
    tensorInfoSize?: number,
    tensorDataOffset?: number
};
