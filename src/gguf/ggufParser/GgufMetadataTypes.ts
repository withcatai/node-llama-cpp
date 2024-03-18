export const enum GgufArchitectureType {
    llama = "llama",
    falcon = "falcon",
    mpt = "mpt",
    gptneox = "gptneox",
    gptj = "gptj",
    gpt2 = "gpt2",
    bloom = "bloom",
    rwkv = "rwkv",
    whisper = "whisper"
}

export const enum GgufFileType {
    ALL_F32 = "ALL_F32",
    MOSTLY_F16 = "MOSTLY_F16",
    MOSTLY_Q4_0 = "MOSTLY_Q4_0",
    MOSTLY_Q4_1 = "MOSTLY_Q4_1",
    MOSTLY_Q4_1_SOME_F16 = "MOSTLY_Q4_1_SOME_F16",
    MOSTLY_Q4_2 = "MOSTLY_Q4_2",
    MOSTLY_Q4_3 = "MOSTLY_Q4_3",
    MOSTLY_Q8_0 = "MOSTLY_Q8_0",
    MOSTLY_Q5_0 = "MOSTLY_Q5_0",
    MOSTLY_Q5_1 = "MOSTLY_Q5_1",
    MOSTLY_Q2_K = "MOSTLY_Q2_K",
    MOSTLY_Q3_K_S = "MOSTLY_Q3_K_S",
    MOSTLY_Q3_K_M = "MOSTLY_Q3_K_M",
    MOSTLY_Q3_K_L = "MOSTLY_Q3_K_L",
    MOSTLY_Q4_K_S = "MOSTLY_Q4_K_S",
    MOSTLY_Q4_K_M = "MOSTLY_Q4_K_M",
    MOSTLY_Q5_K_S = "MOSTLY_Q5_K_S",
    MOSTLY_Q5_K_M = "MOSTLY_Q5_K_M",
    MOSTLY_Q6_K = "MOSTLY_Q6_K"
}


export type GgufMetadataArchitectureProperties = {
    context_length: number,
    embedding_length: number,
    block_count: number,
    feed_forward_length: number,
    use_parallel_residual: boolean,
    tensor_data_layout: string,
    expert_count: number,
    expert_used_count: number,

    attention: {
        head_count: number,
        head_count_kv: number,
        max_alibi_bias: number,
        clamp_kqv: number,
        key_length: number,
        value_length: number,
        layer_norm_epsilon: number,
        layer_norm_rms_epsilon: number
    },

    rope: {
        dimension_count: number,
        freq_base: number,
        scaling: {
            type: string,
            factor: number,
            original_context_length: number,
            finetuned: boolean
        }
    }
};

export type GgufMetadataGeneralProperties = {
    architecture: GgufArchitectureType,

    /**
     * The version of the quantization format. Not required if the model is not
     * quantized (i.e. no tensors are quantized). If any tensors are quantized,
     * this must be present. This is separate to the quantization scheme of the
     * tensors itself; the quantization version may change without changing the
     * scheme's name (e.g. the quantization scheme is Q5_K, and the quantization
     * version is 4).
     */
    quantization_version: string,

    /**
     * the global alignment to use, as described above. This can vary to allow
     * for different alignment schemes, but it must be a multiple of 8. Some
     * writers may not write the alignment. If the alignment is not specified,
     * assume it is `32`.
     */
    alignment: string,

    /**
     * The name of the model. This should be a human-readable name that can be
     * used to identify the model. It should be unique within the community
     * that the model is defined in.
     */
    name: string,
    author: string,

    /**
     * URL to the model's homepage. This can be a GitHub repo, a paper, etc.
     */
    url: string,

    /**
     * free-form description of the model including anything that isn't
     * covered by the other fields
     */
    description: string,

    /**
     * License of the model, expressed as a SPDX license expression
     * (e.g. `MIT OR Apache-2.0`). *Should not* include any other information,
     * such as the license text or the URL to the license.
     */
    license: string,

    /**
     * Information about where this model came from. This is useful for tracking
     * the provenance of the model, and for finding the original source if the
     * model is modified. For a model that was converted from GGML, for
     * example, these keys would point to the model that was converted from.
     */
    source: {
        /**
         * URL to the source of the model. Can be a GitHub repo, a paper, etc.
         */
        url: string,
        huggingface: {
            repository: string
        }
    },

    /**
     * An enumerated value describing the type of the majority of the tensors
     * in the file. Optional; can be inferred from the tensor types.
     */
    file_type?: GgufFileType | undefined
};

export type GgufMetadataAny = {
    general: GgufMetadataGeneralProperties
} & {
    [key in GgufArchitectureType]: GgufMetadataArchitectureProperties
};

export type GgufMetadataLLAMA = {
    general: GgufMetadataGeneralProperties & {
        architecture: GgufArchitectureType.llama
    },

    llama: {
        context_length: number,
        embedding_length: number,
        block_count: number,
        feed_forward_length: number,
        attention: {
            head_count: number,
            layer_norm_rms_epsilon: number,
            head_count_kv?: number
        },
        rope: {
            dimension_count: number,
            scale?: number
        },
        expert_count?: number,
        expert_used_count?: number,
        tensor_data_layout?: string
    }
};

export type GgufMetadataFalcon = {
    general: GgufMetadataGeneralProperties & {
        architecture: GgufArchitectureType.falcon
    },

    falcon: {
        context_length: number,
        embedding_length: number,
        block_count: number,
        attention: {
            head_count: number,
            head_count_kv: number,
            use_norm: boolean,
            layer_norm_epsilon: number
        },
        tensor_data_layout?: string
    }
};

export type GgufMetadataMPT = {
    general: GgufMetadataGeneralProperties & {
        architecture: GgufArchitectureType.mpt
    },

    mpt: {
        context_length: number,
        embedding_length: number,
        block_count: number,
        attention: {
            head_count: number,
            alibi_bias_max: number,
            clip_kqv: number,
            layer_norm_epsilon: number
        }
    }
};

export type GgufMetadataGPTNeoX = {
    general: GgufMetadataGeneralProperties & {
        architecture: GgufArchitectureType.gptneox
    },

    gptneox: {
        context_length: number,
        embedding_length: number,
        block_count: number,
        use_parallel_residual: boolean,
        rope: {
            dimension_count: number,
            freq_base: number,
            scale?: number
        },
        attention: {
            head_count: number,
            layer_norm_epsilon: number
        }
    }
};

export type GgufMetadataGPTJ = {
    general: GgufMetadataGeneralProperties & {
        architecture: GgufArchitectureType.gptj
    },

    gptj: {
        context_length: number,
        embedding_length: number,
        block_count: number,
        rope: {
            dimension_count: number,
            scale?: number
        },
        attention: {
            head_count: number,
            layer_norm_epsilon: number
        }
    }
};

export type GgufMetadataGPT2 = {
    general: GgufMetadataGeneralProperties & {
        architecture: GgufArchitectureType.gpt2
    },

    gpt2: {
        context_length: number,
        embedding_length: number,
        block_count: number,
        attention: {
            head_count: number,
            layer_norm_epsilon: number
        }
    }
};

export type GgufMetadataBloom = {
    general: GgufMetadataGeneralProperties & {
        architecture: GgufArchitectureType.bloom
    },

    bloom: {
        context_length: number,
        embedding_length: number,
        block_count: number,
        feed_forward_length: number,
        attention: {
            head_count: number,
            layer_norm_epsilon: number
        }
    }
};

export type GgufMetadataRWKV = {
    general: GgufMetadataGeneralProperties & {
        architecture: GgufArchitectureType.rwkv
    },

    rwkv: {
        context_length: number,
        block_count: number,
        embedding_length: number,
        feed_forward_length: number
    }
};

export type GgufMetadataWhisper = {
    general: GgufMetadataGeneralProperties & {
        architecture: GgufArchitectureType.whisper
    },
    whisper: {
        encoder: {
            context_length: number,
            embedding_length: number,
            block_count: number,
            mels_count: number,
            attention: {
                head_count: number
            }
        },
        decoder: {
            context_length: number,
            embedding_length: number,
            block_count: number,
            attention: {
                head_count: number
            }
        }
    }
};

export type GgufMetadata =
    | GgufMetadataLLAMA
    | GgufMetadataFalcon
    | GgufMetadataMPT
    | GgufMetadataGPTNeoX
    | GgufMetadataGPTJ
    | GgufMetadataGPT2
    | GgufMetadataBloom
    | GgufMetadataRWKV
    | GgufMetadataWhisper;


export function isLlamaMetadata(metadata: GgufMetadata): metadata is GgufMetadataLLAMA {
    return metadata.general.architecture === GgufArchitectureType.llama;
}

export function isMPTMetadata(metadata: GgufMetadata): metadata is GgufMetadataMPT {
    return metadata.general.architecture === GgufArchitectureType.mpt;
}

export function isGPTNeoXMetadata(metadata: GgufMetadata): metadata is GgufMetadataGPTNeoX {
    return metadata.general.architecture === GgufArchitectureType.gptneox;
}

export function isGPTJMetadata(metadata: GgufMetadata): metadata is GgufMetadataGPTJ {
    return metadata.general.architecture === GgufArchitectureType.gptj;
}

export function isGPT2Metadata(metadata: GgufMetadata): metadata is GgufMetadataGPT2 {
    return metadata.general.architecture === GgufArchitectureType.gpt2;
}

export function isBloomMetadata(metadata: GgufMetadata): metadata is GgufMetadataBloom {
    return metadata.general.architecture === GgufArchitectureType.bloom;
}

export function isFalconMetadata(metadata: GgufMetadata): metadata is GgufMetadataFalcon {
    return metadata.general.architecture === GgufArchitectureType.falcon;
}

export function isRWKVMetadata(metadata: GgufMetadata): metadata is GgufMetadataRWKV {
    return metadata.general.architecture === GgufArchitectureType.rwkv;
}
