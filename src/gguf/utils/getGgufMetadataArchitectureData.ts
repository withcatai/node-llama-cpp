import {GgufArchitectureType, GgufMetadata} from "../types/GgufMetadataTypes.js";
import {MergeOptionalUnionTypes} from "../../utils/mergeUnionTypes.js";

export function getGgufMetadataArchitectureData<const T extends GgufArchitectureType>(ggufMetadata: GgufMetadata<T>): (
    GgufArchitectureType extends T
        ? MergeOptionalUnionTypes<Exclude<GgufMetadata[T], undefined>>
        : GgufMetadata<T>[T]
) {
    return ggufMetadata[ggufMetadata.general?.architecture] ?? {} as any;
}
