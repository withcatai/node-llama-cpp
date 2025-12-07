export const enum GgufArchitectureType {
    llama = "llama",
    llama4 = "llama4",
    deci = "deci",
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
    nomicBertMoe = "nomic-bert-moe",
    neoBert = "neo-bert",
    jinaBertV2 = "jina-bert-v2",
    jinaBertV3 = "jina-bert-v3",
    bloom = "bloom",
    stablelm = "stablelm",
    qwen = "qwen",
    qwen2 = "qwen2",
    qwen2moe = "qwen2moe",
    qwen2vl = "qwen2vl",
    qwen3 = "qwen3",
    qwen3moe = "qwen3moe",
    qwen3next = "qwen3next",
    qwen3vl = "qwen3vl",
    qwen3vlmoe = "qwen3vlmoe",
    phi2 = "phi2",
    phi3 = "phi3",
    phimoe = "phimoe",
    plamo = "plamo",
    plamo2 = "plamo2",
    codeshell = "codeshell",
    orion = "orion",
    internlm2 = "internlm2",
    minicpm = "minicpm",
    minicpm3 = "minicpm3",
    gemma = "gemma",
    gemma2 = "gemma2",
    gemma3 = "gemma3",
    gemma3n = "gemma3n",
    gemmaEmbedding = "gemma-embedding",
    starcoder2 = "starcoder2",
    mamba = "mamba",
    mamba2 = "mamba2",
    jamba = "jamba",
    falconH1 = "falcon-h1",
    xverse = "xverse",
    commandR = "command-r",
    cohere2 = "cohere2",
    dbrx = "dbrx",
    olmo = "olmo",
    olmo2 = "olmo2",
    olmoe = "olmoe",
    openelm = "openelm",
    arctic = "arctic",
    deepseek = "deepseek",
    deepseek2 = "deepseek2",
    chatglm = "chatglm",
    glm4 = "glm4",
    glm4moe = "glm4moe",
    bitnet = "bitnet",
    t5 = "t5",
    t5encoder = "t5encoder",
    jais = "jais",
    nemotron = "nemotron",
    nemotronH = "nemotron_h",
    exaone = "exaone",
    exaone4 = "exaone4",
    rwkv6 = "rwkv6",
    rwkv6qwen2 = "rwkv6qwen2",
    rwkv7 = "rwkv7",
    arwkv7 = "arwkv7",
    granite = "granite",
    granitemoe = "granitemoe",
    granitehybrid = "granitehybrid",
    chameleon = "chameleon",
    wavtokenizerDec = "wavtokenizer-dec",
    plm = "plm",
    bailingmoe = "bailingmoe",
    bailingmoe2 = "bailingmoe2",
    dots1 = "dots1",
    arcee = "arcee",
    afmoe = "afmoe",
    ernie4_5 = "ernie4_5",
    ernie4_5Moe = "ernie4_5-moe",
    hunyuanMoe = "hunyuan-moe",
    hunyuanDense = "hunyuan-dense",
    smollm3 = "smollm3",
    gptOss = "gpt-oss",
    lfm2 = "lfm2",
    lfm2moe = "lfm2moe",
    dream = "dream",
    smallthinker = "smallthinker",
    llada = "llada",
    lladaMoe = "llada-moe",
    seedOss = "seed_oss",
    grovemoe = "grovemoe",
    apertus = "apertus",
    minimaxM2 = "minimax-m2",
    cogvlm = "cogvlm",
    rnd1 = "rnd1",
    panguEmbedded = "pangu-embedded",
    mistral3 = "mistral3",
    clip = "clip",
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
    MOSTLY_Q4_1_SOME_F16 = 4, // deprecated
    MOSTLY_Q4_2 = 5, // deprecated
    MOSTLY_Q4_3 = 6, // deprecated
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
    MOSTLY_IQ4_XS = 30,
    MOSTLY_IQ1_M = 31,
    MOSTLY_BF16 = 32,
    MOSTLY_Q4_0_4_4 = 33, // deprecated
    MOSTLY_Q4_0_4_8 = 34, // deprecated
    MOSTLY_Q4_0_8_8 = 35, // deprecated
    MOSTLY_TQ1_0 = 36,
    MOSTLY_TQ2_0 = 37,
    MOSTLY_MXFP4_MOE = 38
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
    readonly alignment?: number,

    /**
     * The name of the model. This should be a human-readable name that can be
     * used to identify the model. It should be unique within the community
     * that the model is defined in.
     */
    readonly name?: string,
    readonly basename?: string,
    readonly size_label?: string,
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
    readonly "license.name"?: string,
    readonly "license.link"?: string,

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
    readonly file_type?: GgufFileType | undefined,

    readonly base_model?: {
        readonly count: number,
        readonly [key: `${bigint}`]: {
            readonly name?: string,
            readonly author?: string,
            readonly version?: string,
            readonly organization?: string,
            readonly url?: string,
            readonly doi?: string,
            readonly uuid?: string,
            readonly repo_url?: string
        }
    }
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
        readonly model: "no_vocab" | "none" | "llama" | "gpt2" | "bert" | "rwkv" | "t5" | "plamo2" | string,
        readonly pre?: "default" | "llama3" | "llama-v3" | "llama-bpe" | "deepseek-llm" | "deepseek-coder" | "falcon" | "falcon3" |
            "pixtral" | "mpt" | "starcoder" | "gpt-2" | "phi-2" | "jina-es" | "jina-de" | "jina-v1-en" | "jina-v2-es" | "jina-v2-de" |
            "jina-v2-code" | "refact" | "command-r" | "qwen2" | "stablelm2" | "olmo" | "dbrx" | "smaug-bpe" | "poro-chat" | "chatglm-bpe" |
            "viking" | "jais" | "tekken" | "smollm" | "codeshell" | "bloom" | "gpt3-finnish" | "exaone" | "exaone4" | "chameleon" |
            "minerva-7b" | "megrez" | "gpt-4o" | "superbpe" | "trillion" | "bailingmoe" | "a.x-4.0" | "mellum" | string,
        readonly tokens: readonly string[],
        readonly token_type: GgufMetadataTokenizerTokenType[],
        readonly token_type_count?: number,
        readonly scores?: readonly number[],
        readonly merges?: readonly string[],
        readonly bos_token_id?: number,
        readonly eos_token_id?: number,
        readonly eot_token_id?: number,
        readonly eom_token_id?: number,
        readonly unknown_token_id?: number,
        readonly seperator_token_id?: number,
        readonly padding_token_id?: number,
        readonly cls_token_id?: number,
        readonly mask_token_id?: number,
        readonly add_bos_token?: boolean,
        readonly add_eos_token?: boolean,
        readonly add_space_prefix?: boolean,
        readonly added_tokens?: readonly string[],
        readonly fim_pre_token_id?: number,
        readonly fim_suf_token_id?: number,
        readonly fim_mid_token_id?: number,
        readonly fim_pad_token_id?: number,
        readonly fim_rep_token_id?: number,
        readonly fim_sep_token_id?: number,

        /** @deprecated */
        readonly prefix_token_id?: number,
        /** @deprecated */
        readonly suffix_token_id?: number,
        /** @deprecated */
        readonly middle_token_id?: number
    },
    readonly huggingface?: {
        readonly json?: string
    },
    readonly chat_template?: string,
    readonly "chat_template.rerank"?: string
};

export const enum GgufMetadataArchitecturePoolingType {
    unspecified = -1,
    none = 0,
    mean = 1,
    cls = 2,
    last = 3,
    rank = 4
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
    readonly token_shift_count?: number,

    readonly attention?: {
        readonly head_count?: number,
        readonly head_count_kv?: number | number[],
        readonly max_alibi_bias?: number,
        readonly clamp_kqv?: number,
        readonly layer_norm_epsilon?: number,
        readonly layer_norm_rms_epsilon?: number,
        readonly key_length?: number,
        readonly value_length?: number,
        readonly sliding_window?: number,
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
    },

    readonly wkv?: {
        readonly head_size?: number
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

// source: https://github.com/ggml-org/ggml/blob/master/docs/gguf.md#llama
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

// source: https://github.com/ggml-org/ggml/blob/master/docs/gguf.md#mpt
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

// source: https://github.com/ggml-org/ggml/blob/master/docs/gguf.md#gpt-neox
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

// source: https://github.com/ggml-org/ggml/blob/master/docs/gguf.md#gpt-j
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

// source: https://github.com/ggml-org/ggml/blob/master/docs/gguf.md#gpt-2
export type GgufMetadataGPT2 = {
    readonly context_length: number,
    readonly embedding_length: number,
    readonly block_count: number,
    readonly attention: {
        readonly head_count: number,
        readonly layer_norm_epsilon: number
    }
};

// source: https://github.com/ggml-org/ggml/blob/master/docs/gguf.md#bloom
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

// source: https://github.com/ggml-org/ggml/blob/master/docs/gguf.md#falcon
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

// source: https://github.com/ggml-org/ggml/blob/master/docs/gguf.md#mamba
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
