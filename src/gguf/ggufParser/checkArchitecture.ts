import {
    GGUFMetadata,
    GGUFMetadataBloom, GGUFMetadataFalcon,
    GGUFMetadataGPT2,
    GGUFMetadataGPTJ,
    GGUFMetadataGPTNeoX,
    GGUFMetadataLLAMA,
    GGUFMetadataMPT, GGUFMetadataRWKV
} from "./GGUFTypes.js";


export function isLlamaMetadata (metadata: GGUFMetadata): metadata is GGUFMetadataLLAMA {
    return metadata.general.architecture === "llama";
}

export function isMPTMetadata (metadata: GGUFMetadata): metadata is GGUFMetadataMPT {
    return metadata.general.architecture === "mpt";
}

export function isGPTNeoXMetadata (metadata: GGUFMetadata): metadata is GGUFMetadataGPTNeoX {
    return metadata.general.architecture === "gptneox";
}

export function isGPTJMetadata (metadata: GGUFMetadata): metadata is GGUFMetadataGPTJ {
    return metadata.general.architecture === "gptj";
}

export function isGPT2Metadata (metadata: GGUFMetadata): metadata is GGUFMetadataGPT2 {
    return metadata.general.architecture === "gpt2";
}

export function isBloomMetadata (metadata: GGUFMetadata): metadata is GGUFMetadataBloom {
    return metadata.general.architecture === "bloom";
}

export function isFalconMetadata (metadata: GGUFMetadata): metadata is GGUFMetadataFalcon {
    return metadata.general.architecture === "falcon";
}

export function isRWKVMetadata (metadata: GGUFMetadata): metadata is GGUFMetadataRWKV {
    return metadata.general.architecture === "rwkv";
}


/**
 * https://github.com/ggerganov/ggml/blob/master/docs/gguf.md#general-metadata
 * Convert file type from string to int
 */
export function fileTypeIntToString(fileType?: number) {
    if (fileType == null) return;
    switch (fileType) {
        case 0:
            return "ALL_F32";
        case 1:
            return "MOSTLY_F16";
        case 2:
            return "MOSTLY_Q4_0";
        case 3:
            return "MOSTLY_Q4_1";
        case 4:
            return "MOSTLY_Q4_1_SOME_F16";
        case 5:
            return "MOSTLY_Q4_2";
        case 6:
            return "MOSTLY_Q4_3";
        case 7:
            return "MOSTLY_Q8_0";
        case 8:
            return "MOSTLY_Q5_0";
        case 9:
            return "MOSTLY_Q5_1";
        case 10:
            return "MOSTLY_Q2_K";
        case 11:
            return "MOSTLY_Q3_K_S";
        case 12:
            return "MOSTLY_Q3_K_M";
        case 13:
            return "MOSTLY_Q3_K_L";
        case 14:
            return "MOSTLY_Q4_K_S";
        case 15:
            return "MOSTLY_Q4_K_M";
        case 16:
            return "MOSTLY_Q5_K_S";
        case 17:
            return "MOSTLY_Q5_K_M";
        case 18:
            return "MOSTLY_Q6_K";
    }

    return;
}
