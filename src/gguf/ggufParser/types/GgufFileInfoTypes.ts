import {GgufMetadata} from "./GgufMetadataTypes.js";
import {GgufTensorInfo} from "./GgufTensorInfoTypes.js";

export type GgufFileInfo = {
    version: 3 | number,
    tensorCount: number | bigint,
    metadata: GgufMetadata,
    metadataSize: number,

    /** can be null if `readTensorInfo` is set to `false` */
    tensorInfo?: GgufTensorInfo[],

    /** can be null if `readTensorInfo` is set to `false` */
    tensorInfoSize?: number
};
