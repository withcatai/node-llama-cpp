import {ModelRecommendation} from "./utils/resolveModelRecommendationFileOptions.js";

export const recommendedModels: ModelRecommendation[] = [{
    name: "Llama 3.1 8B",
    abilities: ["chat", "complete", "functionCalling"],
    description: "Llama 3.1 model was created by Meta and is optimized for an assistant-like chat use cases, with support for function calling.\n" +
        "This is the 8 billion parameters version of the model.",

    fileOptions: [{
        huggingFace: {
            model: "mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF",
            branch: "main",
            file: "Meta-Llama-3.1-8B-Instruct.Q8_0.gguf"
        }
    }, {
        huggingFace: {
            model: "mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF",
            branch: "main",
            file: "Meta-Llama-3.1-8B-Instruct.Q6_K.gguf"
        }
    }, {
        huggingFace: {
            model: "mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF",
            branch: "main",
            file: "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf"
        }
    }]
}, {
    name: "Llama 3.1 70B",
    abilities: ["chat", "complete", "functionCalling"],
    description: "Llama 3.1 model was created by Meta and is optimized for an assistant-like chat use cases, with support for function calling.\n" +
        "This is the 70 billion parameters version of the model. " +
        "You need a GPU with a lot of VRAM to use this version.",

    fileOptions: [{
        huggingFace: {
            model: "mradermacher/Meta-Llama-3.1-70B-Instruct-GGUF",
            branch: "main",
            file: "Meta-Llama-3.1-70B-Instruct.Q8_0.gguf.part1of2"
        }
    }, {
        huggingFace: {
            model: "mradermacher/Meta-Llama-3.1-70B-Instruct-GGUF",
            branch: "main",
            file: "Meta-Llama-3.1-70B-Instruct.Q6_K.gguf.part1of2"
        }
    }, {
        huggingFace: {
            model: "mradermacher/Meta-Llama-3.1-70B-Instruct-GGUF",
            branch: "main",
            file: "Meta-Llama-3.1-70B-Instruct.Q4_K_M.gguf"
        }
    }, {
        huggingFace: {
            model: "mradermacher/Meta-Llama-3.1-70B-Instruct-GGUF",
            branch: "main",
            file: "Meta-Llama-3.1-70B-Instruct.Q4_K_S.gguf"
        }
    }]
}, {
    name: "Llama 3.1 405B",
    abilities: ["chat", "complete", "functionCalling"],
    description: "Llama 3.1 model was created by Meta and is optimized for an assistant-like chat use cases, with support for function calling.\n" +
        "This is the 405 billion parameters version of the model, and its capabilities are comparable and sometimes even surpass GPT-4o and Claude 3.5 Sonnet.\n" +
        "You need a GPU with a lot of VRAM to use this version of Llama 3.1.",

    fileOptions: [{
        huggingFace: {
            model: "mradermacher/Meta-Llama-3.1-405B-Instruct-GGUF",
            branch: "main",
            file: "Meta-Llama-3.1-405B-Instruct.Q3_K_L.gguf.part1of5"
        }
    }, {
        huggingFace: {
            model: "mradermacher/Meta-Llama-3.1-405B-Instruct-GGUF",
            branch: "main",
            file: "Meta-Llama-3.1-405B-Instruct.Q3_K_M.gguf.part1of4"
        }
    }]
}, {
    name: "Mistral Nemo 12B",
    abilities: ["chat", "complete", "functionCalling"],
    description: "Mistral Nemo model was created by Mistral AI and was trained on large proportion of multilingual and code data, with support for function calling.\n" +
        "It was trained jointly by Mistral AI and NVIDIA.\n" +
        "This is a 12 billion parameters model.",

    fileOptions: [{
        huggingFace: {
            model: "mradermacher/Mistral-Nemo-Instruct-2407-GGUF",
            branch: "main",
            file: "Mistral-Nemo-Instruct-2407.Q8_0.gguf"
        }
    }, {
        huggingFace: {
            model: "mradermacher/Mistral-Nemo-Instruct-2407-GGUF",
            branch: "main",
            file: "Mistral-Nemo-Instruct-2407.Q6_K.gguf"
        }
    }, {
        huggingFace: {
            model: "mradermacher/Mistral-Nemo-Instruct-2407-GGUF",
            branch: "main",
            file: "Mistral-Nemo-Instruct-2407.Q4_K_M.gguf"
        }
    }, {
        huggingFace: {
            model: "mradermacher/Mistral-Nemo-Instruct-2407-GGUF",
            branch: "main",
            file: "Mistral-Nemo-Instruct-2407.Q4_K_S.gguf"
        }
    }]
}, {
    name: "Phi 3 3.8B",
    abilities: ["chat", "complete", "functionCalling"],
    description: "Phi 3 model was created by Microsoft and is optimized for strong reasoning (especially math and logic).\n" +
        "This is the smallversion of the model.",

    fileOptions: [{
        huggingFace: {
            model: "bartowski/Phi-3.1-mini-4k-instruct-GGUF",
            branch: "main",
            file: "Phi-3.1-mini-4k-instruct-Q8_0.gguf"
        }
    }, {
        huggingFace: {
            model: "bartowski/Phi-3.1-mini-4k-instruct-GGUF",
            branch: "main",
            file: "Phi-3.1-mini-4k-instruct-Q4_K_M.gguf"
        }
    }]
}, {
    name: "OLMoE 1B 7B MoE",
    abilities: ["chat"],
    description: "OLMoE models were created by AllenAI, and are fully open source models that utilize a Mixture of Experts architecture.\n" +
        "Mixtures of Experts (MoE) is a technique where different models, each skilled in solving a particular kind of problem, work together to the improve the overall performance on complex tasks.\n" +
        "This model includes 64 expert models, with a total of 7 billion parameters.\n" +
        "This model generates output extremely fast.",

    fileOptions: [{
        huggingFace: {
            model: "allenai/OLMoE-1B-7B-0924-Instruct-GGUF",
            branch: "main",
            file: "olmoe-1b-7b-0924-instruct-q8_0.gguf"
        }
    }, {
        huggingFace: {
            model: "allenai/OLMoE-1B-7B-0924-Instruct-GGUF",
            branch: "main",
            file: "olmoe-1b-7b-0924-instruct-q6_k.gguf"
        }
    }, {
        huggingFace: {
            model: "allenai/OLMoE-1B-7B-0924-Instruct-GGUF",
            branch: "main",
            file: "olmoe-1b-7b-0924-instruct-q5_k_m.gguf"
        }
    }, {
        huggingFace: {
            model: "allenai/OLMoE-1B-7B-0924-Instruct-GGUF",
            branch: "main",
            file: "olmoe-1b-7b-0924-instruct-q4_k_s.gguf"
        }
    }, {
        huggingFace: {
            model: "allenai/OLMoE-1B-7B-0924-Instruct-GGUF",
            branch: "main",
            file: "olmoe-1b-7b-0924-instruct-q4_k_m.gguf"
        }
    }]
}, {
    name: "Mixtral 8x7B MoE",
    abilities: ["chat", "complete"],
    description: "Mixtral models were created by Mistal AI and are general purpose models that utilize a Mixture of Experts architecture.\n" +
        "Mixtures of Experts (MoE) is a technique where different models, each skilled in solving a particular kind of problem, work together to the improve the overall performance on complex tasks.\n" +
        "This model includes 8 expert models, each with 7 billion parameters.",

    fileOptions: [{
        huggingFace: {
            model: "TheBloke/Mixtral-8x7B-v0.1-GGUF",
            branch: "main",
            file: "mixtral-8x7b-v0.1.Q5_K_M.gguf"
        }
    }, {
        huggingFace: {
            model: "TheBloke/Mixtral-8x7B-v0.1-GGUF",
            branch: "main",
            file: "mixtral-8x7b-v0.1.Q4_K_M.gguf"
        }
    }]
}, {
    name: "Mistral 7B Instruct v0.2",
    abilities: ["chat", "complete"],
    description: "Mistral models were created by Mistal AI and are general purpose models.\n" +
        "This is the 7 billion parameters version of the model.",

    fileOptions: [{
        huggingFace: {
            model: "TheBloke/Mistral-7B-Instruct-v0.2-GGUF",
            branch: "main",
            file: "mistral-7b-instruct-v0.2.Q5_K_M.gguf"
        }
    }, {
        huggingFace: {
            model: "TheBloke/Mistral-7B-Instruct-v0.2-GGUF",
            branch: "main",
            file: "mistral-7b-instruct-v0.2.Q4_K_M.gguf"
        }
    }]
}, {
    name: "Dolphin 2.5 Mixtral 8x7B MoE",
    abilities: ["chat", "complete"],
    description: "This Dolphin Mixtral model was created by Eric Hartford and is an uncensored model based on Mixtral, with really good coding skills.\n" +
        "See the Mixtral model above for more information about Mixtral models.\n" +
        "This model includes 8 expert models, each with 7 billion parameters.",

    fileOptions: [{
        huggingFace: {
            model: "TheBloke/dolphin-2.5-mixtral-8x7b-GGUF",
            branch: "main",
            file: "dolphin-2.5-mixtral-8x7b.Q5_K_M.gguf"
        }
    }, {
        huggingFace: {
            model: "TheBloke/dolphin-2.5-mixtral-8x7b-GGUF",
            branch: "main",
            file: "dolphin-2.5-mixtral-8x7b.Q4_K_M.gguf"
        }
    }]
}, {
    name: "Gemma 2 9B",
    abilities: ["chat", "complete"],
    description: "Gemma models were created by Google and are optimized suited for variety of text generation tasks, " +
        "including question answering, summarization, and reasoning, with a focus on responsible responses.\n" +
        "This is the 9 billion parameters version of the model.",

    fileOptions: [{
        huggingFace: {
            model: "bartowski/gemma-2-9b-it-GGUF",
            branch: "main",
            file: "gemma-2-9b-it-Q6_K_L.gguf"
        }
    }, {
        huggingFace: {
            model: "bartowski/gemma-2-9b-it-GGUF",
            branch: "main",
            file: "gemma-2-9b-it-Q6_K.gguf"
        }
    }, {
        huggingFace: {
            model: "bartowski/gemma-2-9b-it-GGUF",
            branch: "main",
            file: "gemma-2-9b-it-Q5_K_L.gguf"
        }
    }, {
        huggingFace: {
            model: "bartowski/gemma-2-9b-it-GGUF",
            branch: "main",
            file: "gemma-2-9b-it-Q5_K_M.gguf"
        }
    }, {
        huggingFace: {
            model: "bartowski/gemma-2-9b-it-GGUF",
            branch: "main",
            file: "gemma-2-9b-it-Q5_K_S.gguf"
        }
    }, {
        huggingFace: {
            model: "bartowski/gemma-2-9b-it-GGUF",
            branch: "main",
            file: "gemma-2-9b-it-Q4_K_L.gguf"
        }
    }, {
        huggingFace: {
            model: "bartowski/gemma-2-9b-it-GGUF",
            branch: "main",
            file: "gemma-2-9b-it-Q4_K_M.gguf"
        }
    }]
}, {
    name: "Gemma 2 2B",
    abilities: ["chat", "complete"],
    description: "Gemma models were created by Google and are optimized suited for variety of text generation tasks, " +
        "including question answering, summarization, and reasoning, with a focus on responsible responses.\n" +
        "This is the 2 billion parameters version of the model and is significantly less powerful than the 9B version.",

    fileOptions: [{
        huggingFace: {
            model: "bartowski/gemma-2-2b-it-GGUF",
            branch: "main",
            file: "gemma-2-2b-it-Q6_K_L.gguf"
        }
    }, {
        huggingFace: {
            model: "bartowski/gemma-2-2b-it-GGUF",
            branch: "main",
            file: "gemma-2-2b-it-Q6_K.gguf"
        }
    }, {
        huggingFace: {
            model: "bartowski/gemma-2-2b-it-GGUF",
            branch: "main",
            file: "gemma-2-2b-it-Q5_K_M.gguf"
        }
    }, {
        huggingFace: {
            model: "bartowski/gemma-2-2b-it-GGUF",
            branch: "main",
            file: "gemma-2-2b-it-Q5_K_S.gguf"
        }
    }, {
        huggingFace: {
            model: "bartowski/gemma-2-2b-it-GGUF",
            branch: "main",
            file: "gemma-2-2b-it-Q4_K_M.gguf"
        }
    }]
}, {
    name: "Gemma 2 27B",
    abilities: ["chat", "complete"],
    description: "Gemma models were created by Google and are optimized suited for varoety of text generation tasks, " +
        "including question answering, summarization, and reasoning, with a focus on responsible responses.\n" +
        "This is the 27 billion parameters version of the model.\n" +
        "Since the model is relatively big, it may not run well on your machine",

    fileOptions: [{
        huggingFace: {
            model: "bartowski/gemma-2-27b-it-GGUF",
            branch: "main",
            file: "gemma-2-27b-it-Q6_K_L.gguf"
        }
    }, {
        huggingFace: {
            model: "bartowski/gemma-2-27b-it-GGUF",
            branch: "main",
            file: "gemma-2-27b-it-Q6_K.gguf"
        }
    }, {
        huggingFace: {
            model: "bartowski/gemma-2-27b-it-GGUF",
            branch: "main",
            file: "gemma-2-27b-it-Q5_K_L.gguf"
        }
    }, {
        huggingFace: {
            model: "bartowski/gemma-2-27b-it-GGUF",
            branch: "main",
            file: "gemma-2-27b-it-Q5_K_M.gguf"
        }
    }, {
        huggingFace: {
            model: "bartowski/gemma-2-27b-it-GGUF",
            branch: "main",
            file: "gemma-2-27b-it-Q5_K_S.gguf"
        }
    }, {
        huggingFace: {
            model: "bartowski/gemma-2-27b-it-GGUF",
            branch: "main",
            file: "gemma-2-27b-it-Q4_K_L.gguf"
        }
    }, {
        huggingFace: {
            model: "bartowski/gemma-2-27b-it-GGUF",
            branch: "main",
            file: "gemma-2-27b-it-Q4_K_M.gguf"
        }
    }]
}, {
    name: "Orca 2 13B",
    abilities: ["chat", "complete"],
    description: "Orca 2 model was created by Microsoft and is optimized for reasoning over given data, reading comprehensions, math problem solving and text summarization.\n" +
        "This is the 13 billion parameters version of the model.",

    fileOptions: [{
        huggingFace: {
            model: "TheBloke/Orca-2-13B-GGUF",
            branch: "main",
            file: "orca-2-13b.Q5_K_M.gguf"
        }
    }, {
        huggingFace: {
            model: "TheBloke/Orca-2-13B-GGUF",
            branch: "main",
            file: "orca-2-13b.Q4_K_M.gguf"
        }
    }]
}, {
    name: "Code Llama 7B",
    abilities: ["chat", "complete", "infill"],
    description: "Code Llama model was created by Meta based on Llama 2 and is optimized for coding tasks.\n" +
        "This is the 7 billion parameters version of the model.",

    fileOptions: [{
        huggingFace: {
            model: "TheBloke/CodeLlama-7B-GGUF",
            branch: "main",
            file: "codellama-7b.Q5_K_M.gguf"
        }
    }, {
        huggingFace: {
            model: "TheBloke/CodeLlama-7B-GGUF",
            branch: "main",
            file: "codellama-7b.Q4_K_M.gguf"
        }
    }]
}, {
    name: "Code Llama 13B",
    abilities: ["chat", "complete", "infill"],
    description: "Code Llama model was created by Meta based on Llama 2 and is optimized for coding tasks.\n" +
        "This is the 13 billion parameters version of the model.",

    fileOptions: [{
        huggingFace: {
            model: "TheBloke/CodeLlama-13B-GGUF",
            branch: "main",
            file: "codellama-13b.Q5_K_M.gguf"
        }
    }, {
        huggingFace: {
            model: "TheBloke/CodeLlama-13B-GGUF",
            branch: "main",
            file: "codellama-13b.Q4_K_M.gguf"
        }
    }]
}, {
    name: "Code Llama 34B",
    abilities: ["chat", "complete", "infill"],
    description: "Code Llama model was created by Meta based on Llama 2 and is optimized for coding tasks.\n" +
        "This is the 34 billion parameters version of the model.\n" +
        "You need a GPU with handful of VRAM to use this version.",

    fileOptions: [{
        huggingFace: {
            model: "TheBloke/CodeLlama-34B-GGUF",
            branch: "main",
            file: "codellama-34b.Q5_K_M.gguf"
        }
    }, {
        huggingFace: {
            model: "TheBloke/CodeLlama-34B-GGUF",
            branch: "main",
            file: "codellama-34b.Q4_K_M.gguf"
        }
    }]
}, {
    name: "CodeGemma 2B",
    abilities: ["code", "complete", "infill"],
    description: "CodeGemma models were created by Google and are optimized for code completion, code generation, " +
        "natual language understanding, mathematical reasoning, and instruction following.\n" +
        "This model is not suited for chat.\n" +
        "This is the 2 billion parameters version of the model.\n",

    fileOptions: [{
        huggingFace: {
            model: "bartowski/codegemma-2b-GGUF",
            branch: "main",
            file: "codegemma-2b-Q8_0.gguf"
        }
    }, {
        huggingFace: {
            model: "bartowski/codegemma-2b-GGUF",
            branch: "main",
            file: "codegemma-2b-Q6_K.gguf"
        }
    }, {
        huggingFace: {
            model: "bartowski/codegemma-2b-GGUF",
            branch: "main",
            file: "codegemma-2b-Q5_K_M.gguf"
        }
    }, {
        huggingFace: {
            model: "bartowski/codegemma-2b-GGUF",
            branch: "main",
            file: "codegemma-2b-Q5_K_S.gguf"
        }
    }, {
        huggingFace: {
            model: "bartowski/codegemma-2b-GGUF",
            branch: "main",
            file: "codegemma-2b-Q4_K_M.gguf"
        }
    }]
}, {
    name: "CodeGemma 7B",
    abilities: ["code", "complete", "infill"],
    description: "CodeGemma models were created by Google and are optimized for code completion, code generation, " +
        "natual language understanding, mathematical reasoning, and instruction following.\n" +
        "This model is not suited for chat.\n" +
        "This is the 7 billion parameters version of the model.\n",

    fileOptions: [{
        huggingFace: {
            model: "bartowski/codegemma-1.1-7b-it-GGUF",
            branch: "main",
            file: "codegemma-1.1-7b-it-Q6_K.gguf"
        }
    }, {
        huggingFace: {
            model: "bartowski/codegemma-1.1-7b-it-GGUF",
            branch: "main",
            file: "codegemma-1.1-7b-it-Q5_K_M.gguf"
        }
    }, {
        huggingFace: {
            model: "bartowski/codegemma-1.1-7b-it-GGUF",
            branch: "main",
            file: "codegemma-1.1-7b-it-Q5_K_S.gguf"
        }
    }, {
        huggingFace: {
            model: "bartowski/codegemma-1.1-7b-it-GGUF",
            branch: "main",
            file: "codegemma-1.1-7b-it-Q4_K_M.gguf"
        }
    }]
}, {
    name: "Stable Code Instruct 3B",
    abilities: ["chat", "complete", "infill"],
    description: "Stable Code models were created by Stability AI and are optimized for code completion.",

    fileOptions: [{
        huggingFace: {
            model: "stabilityai/stable-code-instruct-3b",
            branch: "main",
            file: "stable-code-3b-q5_k_m.gguf"
        }
    }, {
        huggingFace: {
            model: "stabilityai/stable-code-instruct-3b",
            branch: "main",
            file: "stable-code-3b-q4_k_m.gguf"
        }
    }]
}];
