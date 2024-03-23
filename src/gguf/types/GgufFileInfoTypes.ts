import {GgufReadOffset} from "../utils/GgufReadOffset.js";
import {GgufFileReader} from "../fileReaders/GgufFileReader.js";
import {MergeOptionalUnionTypes} from "../../utils/mergeUnionTypes.js";
import {GgufArchitectureType, GgufMetadata} from "./GgufMetadataTypes.js";
import {GgufTensorInfo} from "./GgufTensorInfoTypes.js";

export type MetadataValue = string | number | bigint | boolean | MetadataValue[];
export type MetadataKeyValueRecord = Record<string, MetadataValue>;
export type MetadataNestedObject = {
    [key: string]: MetadataValue | MetadataNestedObject
};

export type GgufFileInfo = {
    version: 2 | 3 | number,
    tensorCount: number | bigint,
    metadata: GgufMetadata,
    metadataSize: number,

    /** Same value as `metadata[metadata.general.architecture]`, but with merged types for convenience */
    architectureMetadata: MergeOptionalUnionTypes<Exclude<GgufMetadata[GgufArchitectureType], undefined>>,

    /** can be null if `readTensorInfo` is set to `false` */
    tensorInfo?: GgufTensorInfo[],

    /** can be null if `readTensorInfo` is set to `false` */
    tensorInfoSize?: number
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
    tensorInfoSize?: number
};
