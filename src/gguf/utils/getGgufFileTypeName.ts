import {GgufFileType} from "../types/GgufMetadataTypes.js";

const fileTypeNumberToNameMap = new Map<number, keyof typeof GgufFileType>();
for (const [key, value] of Object.entries(GgufFileType)) {
    if (typeof value === "number")
        fileTypeNumberToNameMap.set(value, key as keyof typeof GgufFileType);
}

/**
 * Convert a GGUF file type number to its corresponding type name
 */
export function getGgufFileTypeName(fileType?: number) {
    return fileTypeNumberToNameMap.get(fileType!) ?? undefined;
}
