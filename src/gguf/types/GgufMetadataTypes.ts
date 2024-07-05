export const enum GgufArchitectureType {
    llama = "llama",
    falcon = "falcon",
    grok = "grok",
    gpt2 = "gpt2",
    gptj = "gptj",
    gptneox = "gptneox",
    mpt = "mpt",
    baichuan = "baichuan",
    starcoder = "starcoder",
    refact = "refact",
    bert = "bert",
    nomicBert = "nomic-bert",
    jinaBertV2 = "jina-bert-v2",
    bloom = "bloom",
    stablelm = "stablelm",
    qwen = "qwen",
    qwen2 = "qwen2",
    qwen2moe = "qwen2moe",
    phi2 = "phi2",
    phi3 = "phi3",
    plamo = "plamo",
    codeshell = "codeshell",
    orion = "orion",
    internlm2 = "internlm2",
    minicpm = "minicpm",
    gemma = "gemma",
    gemma2 = "gemma2",
    starcoder2 = "starcoder2",
    mamba = "mamba",
    xverse = "xverse",
    commandR = "command-r",
    dbrx = "dbrx",
    olmo = "olmo",
    openelm = "openelm",
    arctic = "arctic",
    deepseek2 = "deepseek2",
    bitnet = "bitnet",
    t5 = "t5",
    jais = "jais",
    unknown = "(unknown)"
}

export type GgufMetadata<A extends GgufArchitectureType = GgufArchitectureType> = {
    readonly general: GgufMetadataGeneral<A>,
    readonly tokenizer: GgufMetadataTokenizer
} & (
    GgufArchitectureType extends A ? {
        readonly [key in GgufArchitectureType]?: key extends keyof GgufMetadataLlmToType
            ? GgufMetadataLlmToType[key]
            : GgufMetadataDefaultArchitectureType
    }
    : {
        readonly [key in A]: key extends keyof GgufMetadataLlmToType
            ? GgufMetadataLlmToType[key]
            : GgufMetadataDefaultArchitectureType
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
    [GgufArchitectureType.mamba]: GgufMetadataMamba
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
    readonly architecture: A,

    /**
     * The version of the quantization format. Not required if the model is not
     * quantized (i.e. no tensors are quantized). If any tensors are quantized,
     * this must be present. This is separate to the quantization scheme of the
     * tensors itself; the quantization version may change without changing the
     * scheme's name (e.g. the quantization scheme is Q5_K, and the quantization
     * version is 4).
     */
    readonly quantization_version: string,

    /**
     * the global alignment to use, as described above. This can vary to allow
     * for different alignment schemes, but it must be a multiple of 8. Some
     * writers may not write the alignment. If the alignment is not specified,
     * assume it is `32`.
     */
    readonly alignment?: string,

    /**
     * The name of the model. This should be a human-readable name that can be
     * used to identify the model. It should be unique within the community
     * that the model is defined in.
     */
    readonly name?: string,
    readonly author?: string,

    /**
     * URL to the model's homepage. This can be a GitHub repo, a paper, etc.
     */
    readonly url?: string,

    /**
     * free-form description of the model including anything that isn't
     * covered by the other fields
     */
    readonly description?: string,

    /**
     * License of the model, expressed as a SPDX license expression
     * (e.g. `MIT OR Apache-2.0`). *Should not* include any other information,
     * such as the license text or the URL to the license.
     */
    readonly license?: string,

    /**
     * Information about where this model came from. This is useful for tracking
     * the provenance of the model, and for finding the original source if the
     * model is modified. For a model that was converted from GGML, for
     * example, these keys would point to the model that was converted from.
     */
    readonly source?: {
        /**
         * URL to the source of the model. Can be a GitHub repo, a paper, etc.
         */
        readonly url?: string,
        readonly huggingface?: {
            readonly repository?: string
        }
    },

    /**
     * An enumerated value describing the type of the majority of the tensors
     * in the file. Optional; can be inferred from the tensor types.
     */
    readonly file_type?: GgufFileType | undefined
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
    readonly ggml: {
        readonly model: "no_vocab" | "llama" | "gpt2" | "bert" | string,
        readonly pre?: "default" | "llama3" | "llama-v3" | "llama-bpe" | "deepseek-llm" | "deepseek-coder" | "falcon" | "mpt" |
            "starcoder" | "gpt-2" | "jina-es" | "jina-de" | "jina-v2-es" | "jina-v2-de" | "refact" | "command-r" | "qwen2" | "stablelm2" |
            "olmo" | "dbrx" | "smaug-bpe" | string,
        readonly tokens: readonly string[],
        readonly token_type: GgufMetadataTokenizerTokenType[],
        readonly token_type_count?: number,
        readonly scores?: readonly number[],
        readonly merges?: readonly string[],
        readonly bos_token_id?: number,
        readonly eos_token_id?: number,
        readonly unknown_token_id?: number,
        readonly separator_token_id?: number,
        readonly padding_token_id?: number,
        readonly add_bos_token?: boolean,
        readonly add_eos_token?: boolean,
        readonly add_space_prefix?: boolean,
        readonly added_tokens?: readonly string[],
        readonly prefix_token_id?: number,
        readonly suffix_token_id?: number,
        readonly middle_token_id?: number,
        readonly eot_token_id?: number
    },
    readonly huggingface?: {
        readonly json?: string
    },
    readonly chat_template?: string
};

export const enum GgufMetadataArchitecturePoolingType {
    unspecified = -1,
    none = 0,
    mean = 1,
    max = 2,
}

export type GgufMetadataDefaultArchitectureType = {
    readonly vocab_size?: number,
    readonly context_length?: number,
    readonly embedding_length?: number,
    readonly block_count?: number,
    readonly feed_forward_length?: number,
    readonly use_parallel_residual?: boolean,
    readonly tensor_data_layout?: string,
    readonly expert_count?: number,
    readonly expert_used_count?: number,
    readonly pooling_type?: GgufMetadataArchitecturePoolingType,
    readonly logit_scale?: number,

    readonly attention?: {
        readonly head_count?: number,
        readonly head_count_kv?: number,
        readonly max_alibi_bias?: number,
        readonly clamp_kqv?: number,
        readonly layer_norm_epsilon?: number,
        readonly layer_norm_rms_epsilon?: number,
        readonly key_length?: number,
        readonly value_length?: number,
        readonly causal?: boolean
    },

    readonly rope?: {
        readonly dimension_count?: number,
        readonly freq_base?: number,
        readonly scale_linear?: number,
        readonly scaling?: {
            readonly type?: "none" | "linear" | "yarn" | string,
            readonly factor?: number,
            readonly original_context_length?: number,
            readonly finetuned?: boolean
        }
    },

    readonly ssm?: {
        readonly conv_kernel?: number,
        readonly inner_size?: number,
        readonly state_size?: number,
        readonly time_step_rank?: number
    }
};

// export type GgufMetadataLlmKeyTypes = {
//     readonly context_length: number,
//     readonly embedding_length: number,
//     readonly block_count: number,
//     readonly feed_forward_length: number,
//     readonly use_parallel_residual: boolean,
//     readonly tensor_data_layout: string,
//     readonly expert_count: number,
//     readonly expert_used_count: number,
//
//     readonly attention: {
//         readonly head_count: number,
//         readonly head_count_kv: number,
//         readonly max_alibi_bias: number,
//         readonly clamp_kqv: number,
//         readonly layer_norm_epsilon: number,
//         readonly layer_norm_rms_epsilon: number,
//         readonly key_length: number,
//         readonly value_length: number
//     },
//
//     readonly rope: {
//         readonly dimension_count: number,
//         readonly freq_base: number,
//         readonly scaling: {
//             readonly type: "none" | "linear" | "yarn" | string,
//             readonly factor: number,
//             readonly original_context_length: number,
//             readonly finetuned: boolean,
//             readonly scale_linear?: number
//         }
//     },
//
//     readonly ssm: {
//         readonly conv_kernel: number,
//         readonly inner_size: number,
//         readonly state_size: number,
//         readonly time_step_rank: number
//     }
// };

// source: https://github.com/ggerganov/ggml/blob/master/docs/gguf.md#llama
export type GgufMetadataLlmLLaMA = {
    readonly context_length: number,
    readonly embedding_length: number,
    readonly block_count: number,
    readonly feed_forward_length: number,
    readonly attention: {
        readonly head_count: number,
        readonly layer_norm_rms_epsilon: number,
        readonly head_count_kv?: number
    },
    readonly rope: {
        readonly dimension_count: number,
        readonly scale?: number
    },
    readonly expert_count?: number,
    readonly expert_used_count?: number,
    readonly tensor_data_layout?: string
};

// source: https://github.com/ggerganov/ggml/blob/master/docs/gguf.md#mpt
export type GgufMetadataMPT = {
    readonly context_length: number,
    readonly embedding_length: number,
    readonly block_count: number,
    readonly attention: {
        readonly head_count: number,
        readonly alibi_bias_max: number,
        readonly clip_kqv: number,
        readonly layer_norm_epsilon: number
    }
};

// source: https://github.com/ggerganov/ggml/blob/master/docs/gguf.md#gpt-neox
export type GgufMetadataGPTNeoX = {
    readonly context_length: number,
    readonly embedding_length: number,
    readonly block_count: number,
    readonly use_parallel_residual: boolean,
    readonly rope: {
        readonly dimension_count: number,
        // readonly freq_base: number,
        readonly scale?: number
    },
    readonly attention: {
        readonly head_count: number,
        readonly layer_norm_epsilon: number
    }
};

// source: https://github.com/ggerganov/ggml/blob/master/docs/gguf.md#gpt-j
export type GgufMetadataGPTJ = {
    readonly context_length: number,
    readonly embedding_length: number,
    readonly block_count: number,
    readonly rope: {
        readonly dimension_count: number,
        readonly scale?: number
    },
    readonly attention: {
        readonly head_count: number,
        readonly layer_norm_epsilon: number
    }
};

// source: https://github.com/ggerganov/ggml/blob/master/docs/gguf.md#gpt-2
export type GgufMetadataGPT2 = {
    readonly context_length: number,
    readonly embedding_length: number,
    readonly block_count: number,
    readonly attention: {
        readonly head_count: number,
        readonly layer_norm_epsilon: number
    }
};

// source: https://github.com/ggerganov/ggml/blob/master/docs/gguf.md#bloom
export type GgufMetadataBloom = {
    readonly context_length: number,
    readonly embedding_length: number,
    readonly block_count: number,
    readonly feed_forward_length: number,
    readonly attention: {
        readonly head_count: number,
        readonly layer_norm_epsilon: number
    }
};

// source: https://github.com/ggerganov/ggml/blob/master/docs/gguf.md#falcon
export type GgufMetadataFalcon = {
    readonly context_length: number,
    readonly embedding_length: number,
    readonly block_count: number,
    readonly attention: {
        readonly head_count: number,
        readonly head_count_kv: number,
        readonly use_norm: boolean,
        readonly layer_norm_epsilon: number
    },
    readonly tensor_data_layout?: string
};

// source: https://github.com/ggerganov/ggml/blob/master/docs/gguf.md#mamba
export type GgufMetadataMamba = {
    readonly context_length: number,
    readonly embedding_length: number,
    readonly block_count: number,
    readonly ssm: {
        readonly conv_kernel: number,
        readonly inner_size: number,
        readonly state_size: number,
        readonly time_step_rank: number
    },
    readonly attention: {
        readonly layer_norm_rms_epsilon: number
    }
};

export function isGgufMetadataOfArchitectureType<A extends GgufArchitectureType>(
    metadata: GgufMetadata, type: A
): metadata is GgufMetadata<A> {
    return metadata?.general?.architecture === type;
}
