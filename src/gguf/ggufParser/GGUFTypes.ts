import {fileTypeIntToString} from "./checkArchitecture.js";

export type GGUFArchitectureType =
    | "llama"
    | "falcon"
    | "mpt"
    | "gptneox"
    | "gptj"
    | "gpt2"
    | "bloom"
    | "rwkv"
    | "whisper";

export type GGUFMetadataArchitectureProperties = {
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

export type GGUFMetadataGeneralProperties = {
    architecture: GGUFArchitectureType,
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
    file_type: ReturnType<typeof fileTypeIntToString>
};

export type GGUFMetadataAny = {
    general: GGUFMetadataGeneralProperties
} & {
    [key in GGUFArchitectureType]: GGUFMetadataArchitectureProperties
};

export type GGUFMetadataLLAMA = {
    general: GGUFMetadataGeneralProperties & {
        architecture: "llama"
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

export type GGUFMetadataFalcon = {
    general: GGUFMetadataGeneralProperties & {
        architecture: "falcon"
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

export type GGUFMetadataMPT = {
    general: GGUFMetadataGeneralProperties & {
        architecture: "mpt"
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

export type GGUFMetadataGPTNeoX = {
    general: GGUFMetadataGeneralProperties & {
        architecture: "gptneox"
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

export type GGUFMetadataGPTJ = {
    general: GGUFMetadataGeneralProperties & {
        architecture: "gptj"
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

export type GGUFMetadataGPT2 = {
    general: GGUFMetadataGeneralProperties & {
        architecture: "gpt2"
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

export type GGUFMetadataBloom = {
    general: GGUFMetadataGeneralProperties & {
        architecture: "bloom"
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

export type GGUFMetadataRWKV = {
    general: GGUFMetadataGeneralProperties & {
        architecture: "rwkv"
    },

    rwkv: {
        context_length: number,
        block_count: number,
        embedding_length: number,
        feed_forward_length: number
    }
};

export type GGUFMetadataWhisper = {
    general: GGUFMetadataGeneralProperties & {
        architecture: "whisper"
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


export type GGUFMetadata =
    | GGUFMetadataLLAMA
    | GGUFMetadataFalcon
    | GGUFMetadataMPT
    | GGUFMetadataGPTNeoX
    | GGUFMetadataGPTJ
    | GGUFMetadataGPT2
    | GGUFMetadataBloom
    | GGUFMetadataRWKV
    | GGUFMetadataWhisper;
