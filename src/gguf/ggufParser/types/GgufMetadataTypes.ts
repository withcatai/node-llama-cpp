export const enum GgufArchitectureType {
    llama = "llama",
    falcon = "falcon",
    gpt2 = "gpt2",
    gptj = "gptj",
    gptneox = "gptneox",
    mpt = "mpt",
    baichuan = "baichuan",
    starcoder = "starcoder",
    persimmon = "persimmon",
    refact = "refact",
    bert = "bert",
    nomicBert = "nomic-bert",
    bloom = "bloom",
    stablelm = "stablelm",
    qwen = "qwen",
    qwen2 = "qwen2",
    phi2 = "phi2",
    plamo = "plamo",
    codeshell = "codeshell",
    orion = "orion",
    internlm2 = "internlm2",
    minicpm = "minicpm",
    gemma = "gemma",
    starcoder2 = "starcoder2",
    mamba = "mamba",
    commandR = "command-r",
    rwkv = "rwkv"
}

export type GgufMetadata<A extends GgufArchitectureType = GgufArchitectureType> = {
    general: GgufMetadataGeneral<A>,
    tokenizer: GgufMetadataTokenizer
} & (
    GgufArchitectureType extends A ? {
        [key in GgufArchitectureType]?: key extends keyof GgufMetadataLlmToType
            ? GgufMetadataLlmToType[key]
            : GgufMetadataLlmDefaultArchitectureType
    }
    : {
        [key in A]: key extends keyof GgufMetadataLlmToType
            ? GgufMetadataLlmToType[key]
            : GgufMetadataLlmDefaultArchitectureType
    }
);


export type GgufMetadataLlmToType = {
    [GgufArchitectureType.llama]: GgufMetadataLlmLLaMA,
    [GgufArchitectureType.mpt]: GgufMetadataMPT,
    [GgufArchitectureType.gptneox]: GgufMetadataGPTNeoX,
    [GgufArchitectureType.gptj]: GgufMetadataGPTJ,
    [GgufArchitectureType.gpt2]: GgufMetadataGPT2,
    [GgufArchitectureType.bloom]: GgufMetadataBloom,
    [GgufArchitectureType.falcon]: GgufMetadataFalcon,
    [GgufArchitectureType.mamba]: GgufMetadataMamba,
    [GgufArchitectureType.rwkv]: GgufMetadataRWKV
};

// source: `enum llama_ftype` in `llama.h` in the `llama.cpp` source code
export enum GgufFileType {
    ALL_F32 = 0,
    MOSTLY_F16 = 1,
    MOSTLY_Q4_0 = 2,
    MOSTLY_Q4_1 = 3,
    MOSTLY_Q4_1_SOME_F16 = 4,
    MOSTLY_Q4_2 = 5,
    MOSTLY_Q4_3 = 6,
    MOSTLY_Q8_0 = 7,
    MOSTLY_Q5_0 = 8,
    MOSTLY_Q5_1 = 9,
    MOSTLY_Q2_K = 10,
    MOSTLY_Q3_K_S = 11,
    MOSTLY_Q3_K_M = 12,
    MOSTLY_Q3_K_L = 13,
    MOSTLY_Q4_K_S = 14,
    MOSTLY_Q4_K_M = 15,
    MOSTLY_Q5_K_S = 16,
    MOSTLY_Q5_K_M = 17,
    MOSTLY_Q6_K = 18,
    MOSTLY_IQ2_XXS = 19,
    MOSTLY_IQ2_XS = 20,
    MOSTLY_Q2_K_S = 21,
    MOSTLY_IQ3_XS = 22,
    MOSTLY_IQ3_XXS = 23,
    MOSTLY_IQ1_S = 24,
    MOSTLY_IQ4_NL = 25,
    MOSTLY_IQ3_S = 26,
    MOSTLY_IQ3_M = 27,
    MOSTLY_IQ2_S = 28,
    MOSTLY_IQ2_M = 29,
    MOSTLY_IQ4_XS = 30
}


export type GgufMetadataGeneral<A extends GgufArchitectureType = GgufArchitectureType> = {
    architecture: A,

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
    alignment?: string,

    /**
     * The name of the model. This should be a human-readable name that can be
     * used to identify the model. It should be unique within the community
     * that the model is defined in.
     */
    name?: string,
    author?: string,

    /**
     * URL to the model's homepage. This can be a GitHub repo, a paper, etc.
     */
    url?: string,

    /**
     * free-form description of the model including anything that isn't
     * covered by the other fields
     */
    description?: string,

    /**
     * License of the model, expressed as a SPDX license expression
     * (e.g. `MIT OR Apache-2.0`). *Should not* include any other information,
     * such as the license text or the URL to the license.
     */
    license?: string,

    /**
     * Information about where this model came from. This is useful for tracking
     * the provenance of the model, and for finding the original source if the
     * model is modified. For a model that was converted from GGML, for
     * example, these keys would point to the model that was converted from.
     */
    source?: {
        /**
         * URL to the source of the model. Can be a GitHub repo, a paper, etc.
         */
        url?: string,
        huggingface?: {
            repository?: string
        }
    },

    /**
     * An enumerated value describing the type of the majority of the tensors
     * in the file. Optional; can be inferred from the tensor types.
     */
    file_type?: GgufFileType | undefined
};

export const enum GgufMetadataTokenizerTokenType {
    undefined = 0,
    normal = 1,
    unknown = 2,
    control = 3,
    userDefined = 4,
    unused = 5,
    byte = 6
}

export type GgufMetadataTokenizer = {
    ggml: {
        model: "no_vocab" | "llama" | "gpt2" | "bert" | "replit" | "rwkv" | string,
        tokens: string[],
        token_type: GgufMetadataTokenizerTokenType[],
        token_type_count?: number,
        scores?: number[],
        merges?: string[],
        bos_token_id?: number,
        eos_token_id?: number,
        unknown_token_id?: number,
        separator_token_id?: number,
        padding_token_id?: number,
        add_bos_token?: boolean,
        add_eos_token?: boolean,
        add_space_prefix?: boolean,
        added_tokens?: string[]
    },
    huggingface?: {
        json?: string
    },
    chat_template?: string
};

export const enum GgufMetadataLlmPoolingType {
    unspecified = -1,
    none = 0,
    mean = 1,
    max = 2,
}

export type GgufMetadataLlmDefaultArchitectureType = {
    vocab_size?: number,
    context_length?: number,
    embedding_length?: number,
    block_count?: number,
    feed_forward_length?: number,
    use_parallel_residual?: boolean,
    tensor_data_layout?: string,
    expert_count?: number,
    expert_used_count?: number,
    pooling_type?: GgufMetadataLlmPoolingType,
    logit_scale?: number,

    attention?: {
        head_count?: number,
        head_count_kv?: number,
        max_alibi_bias?: number,
        clamp_kqv?: number,
        layer_norm_epsilon?: number,
        layer_norm_rms_epsilon?: number,
        key_length?: number,
        value_length?: number,
        causal?: boolean
    },

    rope?: {
        dimension_count?: number,
        freq_base?: number,
        scale_linear?: number,
        scaling?: {
            type?: "none" | "linear" | "yarn" | string,
            factor?: number,
            original_context_length?: number,
            finetuned?: boolean
        }
    },

    ssm?: {
        conv_kernel?: number,
        inner_size?: number,
        state_size?: number,
        time_step_rank?: number
    }
};

// export type GgufMetadataLlmKeyTypes = {
//     context_length: number,
//     embedding_length: number,
//     block_count: number,
//     feed_forward_length: number,
//     use_parallel_residual: boolean,
//     tensor_data_layout: string,
//     expert_count: number,
//     expert_used_count: number,
//
//     attention: {
//         head_count: number,
//         head_count_kv: number,
//         max_alibi_bias: number,
//         clamp_kqv: number,
//         layer_norm_epsilon: number,
//         layer_norm_rms_epsilon: number,
//         key_length: number,
//         value_length: number
//     },
//
//     rope: {
//         dimension_count: number,
//         freq_base: number,
//         scaling: {
//             type: "none" | "linear" | "yarn" | string,
//             factor: number,
//             original_context_length: number,
//             finetuned: boolean,
//             scale_linear?: number
//         }
//     },
//
//     ssm: {
//         conv_kernel: number,
//         inner_size: number,
//         state_size: number,
//         time_step_rank: number
//     }
// };

// source: https://github.com/ggerganov/ggml/blob/master/docs/gguf.md#llama
export type GgufMetadataLlmLLaMA = {
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
};

// source: https://github.com/ggerganov/ggml/blob/master/docs/gguf.md#mpt
export type GgufMetadataMPT = {
    context_length: number,
    embedding_length: number,
    block_count: number,
    attention: {
        head_count: number,
        alibi_bias_max: number,
        clip_kqv: number,
        layer_norm_epsilon: number
    }
};

// source: https://github.com/ggerganov/ggml/blob/master/docs/gguf.md#gpt-neox
export type GgufMetadataGPTNeoX = {
    context_length: number,
    embedding_length: number,
    block_count: number,
    use_parallel_residual: boolean,
    rope: {
        dimension_count: number,
        // freq_base: number,
        scale?: number
    },
    attention: {
        head_count: number,
        layer_norm_epsilon: number
    }
};

// source: https://github.com/ggerganov/ggml/blob/master/docs/gguf.md#gpt-j
export type GgufMetadataGPTJ = {
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
};

// source: https://github.com/ggerganov/ggml/blob/master/docs/gguf.md#gpt-2
export type GgufMetadataGPT2 = {
    context_length: number,
    embedding_length: number,
    block_count: number,
    attention: {
        head_count: number,
        layer_norm_epsilon: number
    }
};

// source: https://github.com/ggerganov/ggml/blob/master/docs/gguf.md#bloom
export type GgufMetadataBloom = {
    context_length: number,
    embedding_length: number,
    block_count: number,
    feed_forward_length: number,
    attention: {
        head_count: number,
        layer_norm_epsilon: number
    }
};

// source: https://github.com/ggerganov/ggml/blob/master/docs/gguf.md#falcon
export type GgufMetadataFalcon = {
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
};

// source: https://github.com/ggerganov/ggml/blob/master/docs/gguf.md#mamba
export type GgufMetadataMamba = {
    context_length: number,
    embedding_length: number,
    block_count: number,
    ssm: {
        conv_kernel: number,
        inner_size: number,
        state_size: number,
        time_step_rank: number
    },
    attention: {
        layer_norm_rms_epsilon: number
    }
};

// source: https://github.com/ggerganov/ggml/blob/master/docs/gguf.md#rwkv
export type GgufMetadataRWKV = {
    architecture_version: 4 | number,
    context_length: number,
    block_count: number,
    embedding_length: number,
    feed_forward_length: number
};

export function isGgufMetadataOfArchitectureType<A extends GgufArchitectureType>(
    metadata: GgufMetadata, type: A
): metadata is GgufMetadata<A> {
    return metadata?.general?.architecture === type;
}
