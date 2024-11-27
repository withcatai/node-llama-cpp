import {ModelRecommendation} from "./utils/resolveModelRecommendationFileOptions.js";

export const recommendedModels: ModelRecommendation[] = [{
    name: "Llama 3.1 8B",
    abilities: ["chat", "complete", "functionCalling"],
    description: "Llama 3.1 model was created by Meta and is optimized for an assistant-like chat use cases, with support for function calling.\n" +
        "This is the 8 billion parameters version of the model.",

    fileOptions: [
        "hf:mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF/Meta-Llama-3.1-8B-Instruct.Q8_0.gguf",
        "hf:mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF/Meta-Llama-3.1-8B-Instruct.Q6_K.gguf",
        "hf:mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF/Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf"
    ]
}, {
    name: "Llama 3.1 70B",
    abilities: ["chat", "complete", "functionCalling"],
    description: "Llama 3.1 model was created by Meta and is optimized for an assistant-like chat use cases, with support for function calling.\n" +
        "This is the 70 billion parameters version of the model. " +
        "You need a GPU with a lot of VRAM to use this version.",

    fileOptions: [
        "hf:mradermacher/Meta-Llama-3.1-70B-Instruct-GGUF/Meta-Llama-3.1-70B-Instruct.Q8_0.gguf.part1of2",
        "hf:mradermacher/Meta-Llama-3.1-70B-Instruct-GGUF/Meta-Llama-3.1-70B-Instruct.Q6_K.gguf.part1of2",
        "hf:mradermacher/Meta-Llama-3.1-70B-Instruct-GGUF/Meta-Llama-3.1-70B-Instruct.Q4_K_M.gguf",
        "hf:mradermacher/Meta-Llama-3.1-70B-Instruct-GGUF/Meta-Llama-3.1-70B-Instruct.Q4_K_S.gguf"
    ]
}, {
    name: "Llama 3.1 405B",
    abilities: ["chat", "complete", "functionCalling"],
    description: "Llama 3.1 model was created by Meta and is optimized for an assistant-like chat use cases, with support for function calling.\n" +
        "This is the 405 billion parameters version of the model, and its capabilities are comparable and sometimes even surpass GPT-4o and Claude 3.5 Sonnet.\n" +
        "You need a GPU with a lot of VRAM to use this version of Llama 3.1.",

    fileOptions: [
        "hf:mradermacher/Meta-Llama-3.1-405B-Instruct-GGUF/Meta-Llama-3.1-405B-Instruct.Q3_K_L.gguf.part1of5",
        "hf:mradermacher/Meta-Llama-3.1-405B-Instruct-GGUF/Meta-Llama-3.1-405B-Instruct.Q3_K_M.gguf.part1of4"
    ]
}, {
    name: "Mistral Nemo 12B",
    abilities: ["chat", "complete", "functionCalling"],
    description: "Mistral Nemo model was created by Mistral AI and was trained on large proportion of multilingual and code data, with support for function calling.\n" +
        "It was trained jointly by Mistral AI and NVIDIA.\n" +
        "This is a 12 billion parameters model.",

    fileOptions: [
        "hf:mradermacher/Mistral-Nemo-Instruct-2407-GGUF/Mistral-Nemo-Instruct-2407.Q8_0.gguf",
        "hf:mradermacher/Mistral-Nemo-Instruct-2407-GGUF/Mistral-Nemo-Instruct-2407.Q6_K.gguf",
        "hf:mradermacher/Mistral-Nemo-Instruct-2407-GGUF/Mistral-Nemo-Instruct-2407.Q4_K_M.gguf",
        "hf:mradermacher/Mistral-Nemo-Instruct-2407-GGUF/Mistral-Nemo-Instruct-2407.Q4_K_S.gguf"
    ]
}, {
    name: "Llama 3.2 3B",
    abilities: ["chat", "complete", "functionCalling"],
    description: "Llama 3.2 3B model was created by Meta and is optimized for an assistant-like chat use cases, with support for function calling.\n" +
        "This model is smarter than the 1B model, but is still relatively small and can run on less capable machines.",

    fileOptions: [
        "hf:mradermacher/Llama-3.2-3B-Instruct-GGUF/Llama-3.2-3B-Instruct.Q8_0.gguf",
        "hf:mradermacher/Llama-3.2-3B-Instruct-GGUF/Llama-3.2-3B-Instruct.Q6_K.gguf",
        "hf:mradermacher/Llama-3.2-3B-Instruct-GGUF/Llama-3.2-3B-Instruct.Q4_K_M.gguf",
        "hf:mradermacher/Llama-3.2-3B-Instruct-GGUF/Llama-3.2-3B-Instruct.Q4_K_S.gguf"
    ]
}, {
    name: "Phi 3 3.8B",
    abilities: ["chat", "complete", "functionCalling"],
    description: "Phi 3 model was created by Microsoft and is optimized for strong reasoning (especially math and logic).\n" +
        "This is the smallversion of the model.",

    fileOptions: [
        "hf:bartowski/Phi-3.1-mini-4k-instruct-GGUF/Phi-3.1-mini-4k-instruct-Q8_0.gguf",
        "hf:bartowski/Phi-3.1-mini-4k-instruct-GGUF/Phi-3.1-mini-4k-instruct-Q4_K_M.gguf"
    ]
}, {
    name: "OLMoE 1B 7B MoE",
    abilities: ["chat"],
    description: "OLMoE models were created by AllenAI, and are fully open source models that utilize a Mixture of Experts architecture.\n" +
        "Mixtures of Experts (MoE) is a technique where different models, each skilled in solving a particular kind of problem, work together to the improve the overall performance on complex tasks.\n" +
        "This model includes 64 expert models, with a total of 7 billion parameters.\n" +
        "This model generates output extremely fast.",

    fileOptions: [
        "hf:allenai/OLMoE-1B-7B-0924-Instruct-GGUF/olmoe-1b-7b-0924-instruct-q8_0.gguf",
        "hf:allenai/OLMoE-1B-7B-0924-Instruct-GGUF/olmoe-1b-7b-0924-instruct-q6_k.gguf",
        "hf:allenai/OLMoE-1B-7B-0924-Instruct-GGUF/olmoe-1b-7b-0924-instruct-q5_k_m.gguf",
        "hf:allenai/OLMoE-1B-7B-0924-Instruct-GGUF/olmoe-1b-7b-0924-instruct-q4_k_s.gguf",
        "hf:allenai/OLMoE-1B-7B-0924-Instruct-GGUF/olmoe-1b-7b-0924-instruct-q4_k_m.gguf"
    ]
}, {
    name: "Mixtral 8x7B MoE",
    abilities: ["chat", "complete"],
    description: "Mixtral models were created by Mistal AI and are general purpose models that utilize a Mixture of Experts architecture.\n" +
        "Mixtures of Experts (MoE) is a technique where different models, each skilled in solving a particular kind of problem, work together to the improve the overall performance on complex tasks.\n" +
        "This model includes 8 expert models, each with 7 billion parameters.",

    fileOptions: [
        "hf:TheBloke/Mixtral-8x7B-v0.1-GGUF/mixtral-8x7b-v0.1.Q5_K_M.gguf",
        "hf:TheBloke/Mixtral-8x7B-v0.1-GGUF/mixtral-8x7b-v0.1.Q4_K_M.gguf"
    ]
}, {
    name: "Mistral 7B Instruct v0.2",
    abilities: ["chat", "complete"],
    description: "Mistral models were created by Mistal AI and are general purpose models.\n" +
        "This is the 7 billion parameters version of the model.",

    fileOptions: [
        "hf:TheBloke/Mistral-7B-Instruct-v0.2-GGUF/mistral-7b-instruct-v0.2.Q5_K_M.gguf",
        "hf:TheBloke/Mistral-7B-Instruct-v0.2-GGUF/mistral-7b-instruct-v0.2.Q4_K_M.gguf"
    ]
}, {
    name: "Dolphin 2.5 Mixtral 8x7B MoE",
    abilities: ["chat", "complete"],
    description: "This Dolphin Mixtral model was created by Eric Hartford and is an uncensored model based on Mixtral, with really good coding skills.\n" +
        "See the Mixtral model above for more information about Mixtral models.\n" +
        "This model includes 8 expert models, each with 7 billion parameters.",

    fileOptions: [
        "hf:TheBloke/dolphin-2.5-mixtral-8x7b-GGUF/dolphin-2.5-mixtral-8x7b.Q5_K_M.gguf",
        "hf:TheBloke/dolphin-2.5-mixtral-8x7b-GGUF/dolphin-2.5-mixtral-8x7b.Q4_K_M.gguf"
    ]
}, {
    name: "Gemma 2 9B",
    abilities: ["chat", "complete"],
    description: "Gemma models were created by Google and are optimized suited for variety of text generation tasks, " +
        "including question answering, summarization, and reasoning, with a focus on responsible responses.\n" +
        "This is the 9 billion parameters version of the model.",

    fileOptions: [
        "hf:bartowski/gemma-2-9b-it-GGUF/gemma-2-9b-it-Q6_K_L.gguf",
        "hf:bartowski/gemma-2-9b-it-GGUF/gemma-2-9b-it-Q6_K.gguf",
        "hf:bartowski/gemma-2-9b-it-GGUF/gemma-2-9b-it-Q5_K_L.gguf",
        "hf:bartowski/gemma-2-9b-it-GGUF/gemma-2-9b-it-Q5_K_M.gguf",
        "hf:bartowski/gemma-2-9b-it-GGUF/gemma-2-9b-it-Q5_K_S.gguf",
        "hf:bartowski/gemma-2-9b-it-GGUF/gemma-2-9b-it-Q4_K_L.gguf",
        "hf:bartowski/gemma-2-9b-it-GGUF/gemma-2-9b-it-Q4_K_M.gguf"
    ]
}, {
    name: "Gemma 2 2B",
    abilities: ["chat", "complete"],
    description: "Gemma models were created by Google and are optimized suited for variety of text generation tasks, " +
        "including question answering, summarization, and reasoning, with a focus on responsible responses.\n" +
        "This is the 2 billion parameters version of the model and is significantly less powerful than the 9B version.",

    fileOptions: [
        "hf:bartowski/gemma-2-2b-it-GGUF/gemma-2-2b-it-Q6_K_L.gguf",
        "hf:bartowski/gemma-2-2b-it-GGUF/gemma-2-2b-it-Q6_K.gguf",
        "hf:bartowski/gemma-2-2b-it-GGUF/gemma-2-2b-it-Q5_K_M.gguf",
        "hf:bartowski/gemma-2-2b-it-GGUF/gemma-2-2b-it-Q5_K_S.gguf",
        "hf:bartowski/gemma-2-2b-it-GGUF/gemma-2-2b-it-Q4_K_M.gguf"
    ]
}, {
    name: "Gemma 2 27B",
    abilities: ["chat", "complete"],
    description: "Gemma models were created by Google and are optimized suited for varoety of text generation tasks, " +
        "including question answering, summarization, and reasoning, with a focus on responsible responses.\n" +
        "This is the 27 billion parameters version of the model.\n" +
        "Since the model is relatively big, it may not run well on your machine",

    fileOptions: [
        "hf:bartowski/gemma-2-27b-it-GGUF/gemma-2-27b-it-Q6_K_L.gguf",
        "hf:bartowski/gemma-2-27b-it-GGUF/gemma-2-27b-it-Q6_K.gguf",
        "hf:bartowski/gemma-2-27b-it-GGUF/gemma-2-27b-it-Q5_K_L.gguf",
        "hf:bartowski/gemma-2-27b-it-GGUF/gemma-2-27b-it-Q5_K_M.gguf",
        "hf:bartowski/gemma-2-27b-it-GGUF/gemma-2-27b-it-Q5_K_S.gguf",
        "hf:bartowski/gemma-2-27b-it-GGUF/gemma-2-27b-it-Q4_K_L.gguf",
        "hf:bartowski/gemma-2-27b-it-GGUF/gemma-2-27b-it-Q4_K_M.gguf"
    ]
}, {
    name: "Orca 2 13B",
    abilities: ["chat", "complete"],
    description: "Orca 2 model was created by Microsoft and is optimized for reasoning over given data, reading comprehensions, math problem solving and text summarization.\n" +
        "This is the 13 billion parameters version of the model.",

    fileOptions: [
        "hf:TheBloke/Orca-2-13B-GGUF/orca-2-13b.Q5_K_M.gguf",
        "hf:TheBloke/Orca-2-13B-GGUF/orca-2-13b.Q4_K_M.gguf"
    ]
}, {
    name: "Code Llama 7B",
    abilities: ["chat", "complete", "infill"],
    description: "Code Llama model was created by Meta based on Llama 2 and is optimized for coding tasks.\n" +
        "This is the 7 billion parameters version of the model.",

    fileOptions: [
        "hf:TheBloke/CodeLlama-7B-GGUF/codellama-7b.Q5_K_M.gguf",
        "hf:TheBloke/CodeLlama-7B-GGUF/codellama-7b.Q4_K_M.gguf"
    ]
}, {
    name: "Code Llama 13B",
    abilities: ["chat", "complete", "infill"],
    description: "Code Llama model was created by Meta based on Llama 2 and is optimized for coding tasks.\n" +
        "This is the 13 billion parameters version of the model.",

    fileOptions: [
        "hf:TheBloke/CodeLlama-13B-GGUF/codellama-13b.Q5_K_M.gguf",
        "hf:TheBloke/CodeLlama-13B-GGUF/codellama-13b.Q4_K_M.gguf"
    ]
}, {
    name: "Code Llama 34B",
    abilities: ["chat", "complete", "infill"],
    description: "Code Llama model was created by Meta based on Llama 2 and is optimized for coding tasks.\n" +
        "This is the 34 billion parameters version of the model.\n" +
        "You need a GPU with handful of VRAM to use this version.",

    fileOptions: [
        "hf:TheBloke/CodeLlama-34B-GGUF/codellama-34b.Q5_K_M.gguf",
        "hf:TheBloke/CodeLlama-34B-GGUF/codellama-34b.Q4_K_M.gguf"
    ]
}, {
    name: "CodeGemma 2B",
    abilities: ["code", "complete", "infill"],
    description: "CodeGemma models were created by Google and are optimized for code completion, code generation, " +
        "natual language understanding, mathematical reasoning, and instruction following.\n" +
        "This model is not suited for chat.\n" +
        "This is the 2 billion parameters version of the model.\n",

    fileOptions: [
        "hf:bartowski/codegemma-2b-GGUF/codegemma-2b-Q8_0.gguf",
        "hf:bartowski/codegemma-2b-GGUF/codegemma-2b-Q6_K.gguf",
        "hf:bartowski/codegemma-2b-GGUF/codegemma-2b-Q5_K_M.gguf",
        "hf:bartowski/codegemma-2b-GGUF/codegemma-2b-Q5_K_S.gguf",
        "hf:bartowski/codegemma-2b-GGUF/codegemma-2b-Q4_K_M.gguf"
    ]
}, {
    name: "CodeGemma 7B",
    abilities: ["code", "complete", "infill"],
    description: "CodeGemma models were created by Google and are optimized for code completion, code generation, " +
        "natual language understanding, mathematical reasoning, and instruction following.\n" +
        "This model is not suited for chat.\n" +
        "This is the 7 billion parameters version of the model.\n",

    fileOptions: [
        "hf:bartowski/codegemma-1.1-7b-it-GGUF/codegemma-1.1-7b-it-Q6_K.gguf",
        "hf:bartowski/codegemma-1.1-7b-it-GGUF/codegemma-1.1-7b-it-Q5_K_M.gguf",
        "hf:bartowski/codegemma-1.1-7b-it-GGUF/codegemma-1.1-7b-it-Q5_K_S.gguf",
        "hf:bartowski/codegemma-1.1-7b-it-GGUF/codegemma-1.1-7b-it-Q4_K_M.gguf"
    ]
}, {
    name: "Stable Code Instruct 3B",
    abilities: ["chat", "complete", "infill"],
    description: "Stable Code models were created by Stability AI and are optimized for code completion.",

    fileOptions: [
        "hf:stabilityai/stable-code-instruct-3b/stable-code-3b-q5_k_m.gguf",
        "hf:stabilityai/stable-code-instruct-3b/stable-code-3b-q4_k_m.gguf"
    ]
}];
