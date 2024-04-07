import {ModelRecommendation} from "./utils/resolveModelRecommendationFileOptions.js";

export const recommendedModels: ModelRecommendation[] = [{
    name: "Llama 2 chat 7B",
    abilities: ["chat", "complete"],
    description: "Llama 2 chat model was created by Meta and is optimized for an assistant-like chat use cases.\n" +
        "This is the 7 billion parameters version of the model.",

    fileOptions: [{
        huggingFace: {
            model: "TheBloke/Llama-2-7B-Chat-GGUF",
            branch: "main",
            file: "llama-2-7b-chat.Q5_K_M.gguf"
        }
    }, {
        huggingFace: {
            model: "TheBloke/Llama-2-7B-Chat-GGUF",
            branch: "main",
            file: "llama-2-7b-chat.Q4_K_M.gguf"
        }
    }]
}, {
    name: "Llama 2 chat 13B",
    abilities: ["chat", "complete"],
    description: "Llama 2 chat model was created by Meta and is optimized for an assistant-like chat use cases.\n" +
        "This is the 13 billion parameters version of the model.",

    fileOptions: [{
        huggingFace: {
            model: "TheBloke/Llama-2-13B-chat-GGUF",
            branch: "main",
            file: "llama-2-13b-chat.Q5_K_M.gguf"
        }
    }, {
        huggingFace: {
            model: "TheBloke/Llama-2-13B-chat-GGUF",
            branch: "main",
            file: "llama-2-13b-chat.Q4_K_M.gguf"
        }
    }]
}, {
    name: "Llama 2 chat 70B",
    abilities: ["chat", "complete"],
    description: "Llama 2 chat model was created by Meta and is optimized for an assistant-like chat use cases.\n" +
        "This is the 70 billion parameters version of the model. " +
        "You need a GPU with a lot of VRAM to use this version.",

    fileOptions: [{
        huggingFace: {
            model: "TheBloke/Llama-2-70B-Chat-GGUF",
            branch: "main",
            file: "llama-2-70b-chat.Q5_K_M.gguf"
        }
    }, {
        huggingFace: {
            model: "TheBloke/Llama-2-70B-Chat-GGUF",
            branch: "main",
            file: "llama-2-70b-chat.Q4_K_M.gguf"
        }
    }]
}, {
    name: "Gemma 1.1 7B",
    abilities: ["chat", "complete"],
    description: "Gemma models were created by Google and are optimized to provide responsible responses.\n" +
        "This is the 7 billion parameters version of the model.",

    fileOptions: [{
        huggingFace: {
            model: "ggml-org/gemma-1.1-7b-it-Q8_0-GGUF",
            branch: "main",
            file: "gemma-1.1-7b-it.Q8_0.gguf"
        }
    }, {
        huggingFace: {
            model: "ggml-org/gemma-1.1-7b-it-Q4_K_M-GGUF",
            branch: "main",
            file: "gemma-1.1-7b-it.Q4_K_M.gguf"
        }
    }]
}, {
    name: "Gemma 1.1 2B",
    abilities: ["chat", "complete"],
    description: "Gemma models were created by Google and are optimized to provide responsible responses.\n" +
        "This is the 2 billion parameters version of the model and is significantly less powerful than the 7B version.",

    fileOptions: [{
        huggingFace: {
            model: "ggml-org/gemma-1.1-2b-it-Q8_0-GGUF",
            branch: "main",
            file: "gemma-1.1-2b-it.Q8_0.gguf"
        }
    }, {
        huggingFace: {
            model: "ggml-org/gemma-1.1-2b-it-Q4_K_M-GGUF",
            branch: "main",
            file: "gemma-1.1-2b-it.Q4_K_M.gguf"
        }
    }]
}, {
    name: "Mixtral 8x7B MoE",
    abilities: ["chat", "complete"],
    description: "Mixtral models were created by Mistal AI and are general purpose models that utilize a Mixture of Experts architecture.\n" +
        "Mixtures of Experts (MoE) is a technique where different models, each skilled in solving a particular kind of problem, work together to the improve the overall performance on complex tasks.\n"
        + "This model includes 8 expert models, each with 7 billion parameters.",

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
        + "This is the 7 billion parameters version of the model.",

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
    name: "Code Llama 7B",
    abilities: ["chat", "complete"],
    description: "Code Llama model was created by Meta based on Llama 2 and is optimized for coding tasks.\n"
        + "This is the 7 billion parameters version of the model.",

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
    abilities: ["chat", "complete"],
    description: "Code Llama model was created by Meta based on Llama 2 and is optimized for coding tasks.\n"
        + "This is the 13 billion parameters version of the model.",

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
    abilities: ["chat", "complete"],
    description: "Code Llama model was created by Meta based on Llama 2 and is optimized for coding tasks.\n"
        + "This is the 34 billion parameters version of the model.\n" +
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
}];
