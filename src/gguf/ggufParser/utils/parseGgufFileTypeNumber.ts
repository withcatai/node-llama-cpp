import {GgufFileType} from "../GgufMetadataTypes.js";

/**
 * https://github.com/ggerganov/ggml/blob/master/docs/gguf.md#general-metadata
 * Convert file type from string to int
 */
export function parseGgufFileTypeNumber(fileType?: number) {
    if (fileType == null)
        return undefined;

    switch (fileType) {
        case 0: return GgufFileType.ALL_F32;
        case 1: return GgufFileType.MOSTLY_F16;
        case 2: return GgufFileType.MOSTLY_Q4_0;
        case 3: return GgufFileType.MOSTLY_Q4_1;
        case 4: return GgufFileType.MOSTLY_Q4_1_SOME_F16;
        case 5: return GgufFileType.MOSTLY_Q4_2;
        case 6: return GgufFileType.MOSTLY_Q4_3;
        case 7: return GgufFileType.MOSTLY_Q8_0;
        case 8: return GgufFileType.MOSTLY_Q5_0;
        case 9: return GgufFileType.MOSTLY_Q5_1;
        case 10: return GgufFileType.MOSTLY_Q2_K;
        case 11: return GgufFileType.MOSTLY_Q3_K_S;
        case 12: return GgufFileType.MOSTLY_Q3_K_M;
        case 13: return GgufFileType.MOSTLY_Q3_K_L;
        case 14: return GgufFileType.MOSTLY_Q4_K_S;
        case 15: return GgufFileType.MOSTLY_Q4_K_M;
        case 16: return GgufFileType.MOSTLY_Q5_K_S;
        case 17: return GgufFileType.MOSTLY_Q5_K_M;
        case 18: return GgufFileType.MOSTLY_Q6_K;
    }

    return undefined;
}
