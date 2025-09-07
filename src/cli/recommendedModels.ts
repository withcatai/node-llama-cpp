import {ModelRecommendation} from "./utils/resolveModelRecommendationFileOptions.js";

export const recommendedModels: ModelRecommendation[] = [{
    name: "gpt-oss 20B",
    abilities: ["chat", "complete", "functionCalling", "reasoning"],
    description: "gpt-oss models were created by OpenAI and are using chain of though (CoT) to reason across a wide variety of topics, and utilize a Mixture of Experts architecture.\n" +
        "It's optimized for agentic cases, with native support for function calling.\n" +
        "Mixtures of Experts (MoE) is a technique where different models, each skilled in solving a particular kind of problem, work together to the improve the overall performance on complex tasks.\n" +
        "This model only has 3.6B active parameters, thus making it very fast.\n" +
        "This is the 20 billion parameters version of the model.",

    fileOptions: [
        "hf:giladgd/gpt-oss-20b-GGUF/gpt-oss-20b.MXFP4.gguf"
    ]
}, {
    name: "gpt-oss 120B",
    abilities: ["chat", "complete", "functionCalling", "reasoning"],
    description: "gpt-oss models were created by OpenAI and are using chain of though (CoT) to reason across a wide variety of topics, and utilize a Mixture of Experts architecture.\n" +
        "It's optimized for agentic cases, with native support for function calling.\n" +
        "Mixtures of Experts (MoE) is a technique where different models, each skilled in solving a particular kind of problem, work together to the improve the overall performance on complex tasks.\n" +
        "This model only has 5.1B active parameters, thus making it very fast.\n" +
        "This is the 120 billion parameters version of the model.",

    fileOptions: [
        "hf:giladgd/gpt-oss-120b-GGUF/gpt-oss-120b.MXFP4-00001-of-00002.gguf"
    ]
}, {
    name: "Qwen 3 32B",
    abilities: ["chat", "complete", "functionCalling", "reasoning"],
    description: "Qwen model was created by Alibaba and is using chain of though (CoT) to reason across a wide variety of topics.\n" +
        "It's optimized for an assistant-like chat use cases, with native support for function calling.\n" +
        "This model is censored, but its responses quality on many topics is extremely high.\n" +
        "This is the 32 billion parameters version of the model.\n" +
        "Its performance is comparable and even surpasses DeepSeek R1 and GPT-o1.",

    fileOptions: [
        "hf:Qwen/Qwen3-32B-GGUF:Q8_0",
        "hf:Qwen/Qwen3-32B-GGUF:Q6_K",
        "hf:Qwen/Qwen3-32B-GGUF:Q5_K_M",
        "hf:Qwen/Qwen3-32B-GGUF:Q4_K_M"
    ]
}, {
    name: "Qwen 3 14B",
    abilities: ["chat", "complete", "functionCalling", "reasoning"],
    description: "Qwen model was created by Alibaba and is using chain of though (CoT) to reason across a wide variety of topics.\n" +
        "It's optimized for an assistant-like chat use cases, with native support for function calling.\n" +
        "This model is censored, but its responses quality on many topics is extremely high compared to its size.\n" +
        "This is the 14 billion parameters version of the model.",

    fileOptions: [
        "hf:Qwen/Qwen3-14B-GGUF:Q8_0",
        "hf:Qwen/Qwen3-14B-GGUF:Q6_K",
        "hf:Qwen/Qwen3-14B-GGUF:Q5_K_M",
        "hf:Qwen/Qwen3-14B-GGUF:Q4_K_M"
    ]
}, {
    name: "Qwen 3 8B",
    abilities: ["chat", "complete", "functionCalling", "reasoning"],
    description: "Qwen model was created by Alibaba and is using chain of though (CoT) to reason across a wide variety of topics.\n" +
        "It's optimized for an assistant-like chat use cases, with native support for function calling.\n" +
        "This model is censored, but its responses quality on many topics is extremely high compared to its size.\n" +
        "This is the 8 billion parameters version of the model.",

    fileOptions: [
        "hf:Qwen/Qwen3-8B-GGUF:Q8_0",
        "hf:Qwen/Qwen3-8B-GGUF:Q6_K",
        "hf:Qwen/Qwen3-8B-GGUF:Q5_K_M",
        "hf:Qwen/Qwen3-8B-GGUF:Q4_K_M"
    ]
}, {
    name: "Qwen 3 4B",
    abilities: ["chat", "complete", "functionCalling", "reasoning"],
    description: "Qwen model was created by Alibaba and is using chain of though (CoT) to reason across a wide variety of topics.\n" +
        "It's optimized for an assistant-like chat use cases, with native support for function calling.\n" +
        "This model is censored, but its responses quality on many topics is extremely high compared to its size.\n" +
        "This is the 4 billion parameters version of the model, and is suitable for simpler tasks and can run on lower-end hardware, as well as be very fast on higher-end hardware.",

    fileOptions: [
        "hf:Qwen/Qwen3-4B-GGUF:Q8_0",
        "hf:Qwen/Qwen3-4B-GGUF:Q6_K",
        "hf:Qwen/Qwen3-4B-GGUF:Q5_K_M",
        "hf:Qwen/Qwen3-4B-GGUF:Q4_K_M"
    ]
}, {
    name: "Qwen 3 0.6B",
    abilities: ["chat", "complete", "functionCalling", "reasoning"],
    description: "Qwen model was created by Alibaba and is using chain of though (CoT) to reason across a wide variety of topics.\n" +
        "It's optimized for an assistant-like chat use cases, with native support for function calling.\n" +
        "This model is censored, but its responses quality on many topics is very high compared to its small size.\n" +
        "This is the 0.6B billion parameters version of the model and is suitable for very simple tasks and can run on very resource-constraint hardware.\n",

    fileOptions: [
        "hf:Qwen/Qwen3-0.6B-GGUF:Q8_0"
    ]
}, {
    name: "Seed OSS 36B",
    abilities: ["chat", "complete", "functionCalling", "reasoning"],
    description: "The Seed OSS model was created by ByteDance and is using chain of though (CoT) to reason across a wide variety of topics.\n" +
        "It's optimized for agentic use cases, with native support for function calling and flexible control of the thinking budget (via `SeedChatWrapper` options).\n" +
        "This model can support a context size of up to 512K tokens (if you have enough VRAM to accommodate it).\n" +
        "This is a 36 billion parameters model.",

    fileOptions: [
        "hf:giladgd/Seed-OSS-36B-Instruct-GGUF:Q8_0",
        "hf:giladgd/Seed-OSS-36B-Instruct-GGUF:Q6_K",
        "hf:giladgd/Seed-OSS-36B-Instruct-GGUF:Q5_K_M",
        "hf:giladgd/Seed-OSS-36B-Instruct-GGUF:Q4_K_M"
    ]
}, {
    name: "DeepSeek R1 Distill Qwen 7B",
    abilities: ["chat", "complete", "functionCalling", "reasoning"],
    description: "DeepSeek R1 model was created by DeepSeek and is using chain of though (CoT) to reason across a wide variety of topics.\n" +
        "It's optimized for an assistant-like chat use cases, with support for function calling.\n" +
        "This model is censored, but its responses quality on many topics is extremely high.\n" +
        "This is the 7 billion parameters version of the model - a fine tuned Qwen 2.5 7B base model with distillation from the 671B DeepSeek R1 version.",

    fileOptions: [
        "hf:mradermacher/DeepSeek-R1-Distill-Qwen-7B-GGUF:Q8_0",
        "hf:mradermacher/DeepSeek-R1-Distill-Qwen-7B-GGUF:Q6_K",
        "hf:mradermacher/DeepSeek-R1-Distill-Qwen-7B-GGUF:Q5_K_M",
        "hf:mradermacher/DeepSeek-R1-Distill-Qwen-7B-GGUF:Q5_K_S",
        "hf:mradermacher/DeepSeek-R1-Distill-Qwen-7B-GGUF:Q4_K_M"
    ]
}, {
    name: "DeepSeek R1 Distill Qwen 14B",
    abilities: ["chat", "complete", "functionCalling", "reasoning"],
    description: "DeepSeek R1 model was created by DeepSeek and is using chain of though (CoT) to reason across a wide variety of topics.\n" +
        "It's optimized for an assistant-like chat use cases, with support for function calling.\n" +
        "This model is censored, but its responses quality on many topics is extremely high.\n" +
        "This is the 14 billion parameters version of the model - a fine tuned Qwen 2.5 14B base model with distillation from the 671B DeepSeek R1 version.",

    fileOptions: [
        "hf:mradermacher/DeepSeek-R1-Distill-Qwen-14B-GGUF:Q8_0",
        "hf:mradermacher/DeepSeek-R1-Distill-Qwen-14B-GGUF:Q6_K",
        "hf:mradermacher/DeepSeek-R1-Distill-Qwen-14B-GGUF:Q5_K_M",
        "hf:mradermacher/DeepSeek-R1-Distill-Qwen-14B-GGUF:Q5_K_S",
        "hf:mradermacher/DeepSeek-R1-Distill-Qwen-14B-GGUF:Q4_K_M"
    ]
}, {
    name: "DeepSeek R1 Distill Qwen 32B",
    abilities: ["chat", "complete", "functionCalling", "reasoning"],
    description: "DeepSeek R1 model was created by DeepSeek and is using chain of though (CoT) to reason across a wide variety of topics.\n" +
        "It's optimized for an assistant-like chat use cases, with support for function calling.\n" +
        "This model is censored, but its responses quality on many topics is extremely high.\n" +
        "This is the 32 billion parameters version of the model - a fine tuned Qwen 2.5 32B base model with distillation from the 671B DeepSeek R1 version.",

    fileOptions: [
        "hf:mradermacher/DeepSeek-R1-Distill-Qwen-32B-GGUF:Q8_0",
        "hf:mradermacher/DeepSeek-R1-Distill-Qwen-32B-GGUF:Q6_K",
        "hf:mradermacher/DeepSeek-R1-Distill-Qwen-32B-GGUF:Q5_K_M",
        "hf:mradermacher/DeepSeek-R1-Distill-Qwen-32B-GGUF:Q5_K_S",
        "hf:mradermacher/DeepSeek-R1-Distill-Qwen-32B-GGUF:Q4_K_M"
    ]
}, {
    name: "DeepSeek R1 Distill Llama 8B",
    abilities: ["chat", "complete", "functionCalling", "reasoning"],
    description: "DeepSeek R1 model was created by DeepSeek and is using chain of though (CoT) to reason across a wide variety of topics.\n" +
        "It's optimized for an assistant-like chat use cases, with support for function calling.\n" +
        "This model is censored, even though it's based on Llama 3.1.\n" +
        "This is the 8 billion parameters version of the model - a fine tuned Llama 3.1 8B base model with distillation from the 671B DeepSeek R1 version.",

    fileOptions: [
        "hf:mradermacher/DeepSeek-R1-Distill-Llama-8B-GGUF:Q8_0",
        "hf:mradermacher/DeepSeek-R1-Distill-Llama-8B-GGUF:Q6_K",
        "hf:mradermacher/DeepSeek-R1-Distill-Llama-8B-GGUF:Q5_K_M",
        "hf:mradermacher/DeepSeek-R1-Distill-Llama-8B-GGUF:Q5_K_S",
        "hf:mradermacher/DeepSeek-R1-Distill-Llama-8B-GGUF:Q4_K_M"
    ]
}, {
    name: "DeepSeek R1 Distill Llama 70B",
    abilities: ["chat", "complete", "functionCalling", "reasoning"],
    description: "DeepSeek R1 model was created by DeepSeek and is using chain of though (CoT) to reason across a wide variety of topics.\n" +
        "It's optimized for an assistant-like chat use cases, with support for function calling.\n" +
        "This model is censored, even though it's based on Llama 3.3.\n" +
        "This is the 70 billion parameters version of the model - a fine tuned Llama 3.3 70B base model with distillation from the 671B DeepSeek R1 version.",

    fileOptions: [
        "hf:mradermacher/DeepSeek-R1-Distill-Llama-70B-GGUF/DeepSeek-R1-Distill-Llama-70B.Q8_0.gguf.part1of2",
        "hf:mradermacher/DeepSeek-R1-Distill-Llama-70B-GGUF/DeepSeek-R1-Distill-Llama-70B.Q6_K.gguf.part1of2",
        "hf:mradermacher/DeepSeek-R1-Distill-Llama-70B-GGUF:Q5_K_M",
        "hf:mradermacher/DeepSeek-R1-Distill-Llama-70B-GGUF:Q5_K_S",
        "hf:mradermacher/DeepSeek-R1-Distill-Llama-70B-GGUF:Q4_K_M"
    ]
}, {
    name: "Qwen 3 30B A3B MoE",
    abilities: ["chat", "complete", "functionCalling", "reasoning"],
    description: "Qwen model was created by Alibaba and is using chain of though (CoT) to reason across a wide variety of topics.\n" +
        "It's optimized for an assistant-like chat use cases, with native support for function calling.\n" +
        "This version of the model utilizes a Mixture of Experts architecture, with only 3B active parameters, thus making it very fast.\n" +
        "Mixtures of Experts (MoE) is a technique where different models, each skilled in solving a particular kind of problem, work together to the improve the overall performance on complex tasks.\n" +
        "This model is censored, but its responses quality on many topics is high compared to its high generation speed.\n" +
        "This is the 30 billion parameters Mixtures of Experts (MoE) version of the model.\n" +
        "Its performance is comparable and even surpasses DeepSeek V3 and GPT-4o.",

    fileOptions: [
        "hf:Qwen/Qwen3-30B-A3B-GGUF:Q8_0",
        "hf:Qwen/Qwen3-30B-A3B-GGUF:Q6_K",
        "hf:Qwen/Qwen3-30B-A3B-GGUF:Q5_K_M",
        "hf:Qwen/Qwen3-30B-A3B-GGUF:Q4_K_M"
    ]
}, {
    name: "QwQ 32B",
    abilities: ["chat", "complete", "functionCalling", "reasoning"],
    description: "QwQ model was created by Alibaba and is using chain of though (CoT) to reason across a wide variety of topics.\n" +
        "It's optimized for an assistant-like chat use cases, with native support for function calling.\n" +
        "This model is censored, but its responses quality on many topics is extremely high.\n" +
        "Its performance is comparable to DeepSeek R1 671B.",

    fileOptions: [
        "hf:Qwen/QwQ-32B-GGUF:Q8_0",
        "hf:Qwen/QwQ-32B-GGUF:Q6_K",
        "hf:Qwen/QwQ-32B-GGUF:Q5_K_M",
        "hf:Qwen/QwQ-32B-GGUF:Q4_K_M"
    ]
}, {
    name: "Llama 3.1 8B",
    abilities: ["chat", "complete", "functionCalling"],
    description: "Llama 3.1 model was created by Meta and is optimized for an assistant-like chat use cases, with support for function calling.\n" +
        "This is the 8 billion parameters version of the model.",

    fileOptions: [
        "hf:mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF:Q8_0",
        "hf:mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF:Q6_K",
        "hf:mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M"
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
        "hf:mradermacher/Meta-Llama-3.1-70B-Instruct-GGUF:Q4_K_M",
        "hf:mradermacher/Meta-Llama-3.1-70B-Instruct-GGUF:Q4_K_S"
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
    name: "Phi 4 14B",
    abilities: ["chat", "complete", "functionCalling"],
    description: "Phi 4 model was created by Microsoft and is optimized for complex reasoning in areas such as math.",

    fileOptions: [
        "hf:mradermacher/phi-4-GGUF:Q8_0",
        "hf:mradermacher/phi-4-GGUF:Q6_K",
        "hf:mradermacher/phi-4-GGUF:Q4_K_M",
        "hf:mradermacher/phi-4-GGUF:Q4_K_S"
    ]
}, {
    name: "Mistral Nemo 12B",
    abilities: ["chat", "complete", "functionCalling"],
    description: "Mistral Nemo model was created by Mistral AI and was trained on large proportion of multilingual and code data, with support for function calling.\n" +
        "It was trained jointly by Mistral AI and NVIDIA.\n" +
        "This is a 12 billion parameters model.",

    fileOptions: [
        "hf:mradermacher/Mistral-Nemo-Instruct-2407-GGUF:Q8_0",
        "hf:mradermacher/Mistral-Nemo-Instruct-2407-GGUF:Q6_K",
        "hf:mradermacher/Mistral-Nemo-Instruct-2407-GGUF:Q4_K_M",
        "hf:mradermacher/Mistral-Nemo-Instruct-2407-GGUF:Q4_K_S"
    ]
}, {
    name: "Llama 3.2 3B",
    abilities: ["chat", "complete", "functionCalling"],
    description: "Llama 3.2 3B model was created by Meta and is optimized for an assistant-like chat use cases, with support for function calling.\n" +
        "This model is smarter than the 1B model, but is still relatively small and can run on less capable machines.",

    fileOptions: [
        "hf:mradermacher/Llama-3.2-3B-Instruct-GGUF:Q8_0",
        "hf:mradermacher/Llama-3.2-3B-Instruct-GGUF:Q6_K",
        "hf:mradermacher/Llama-3.2-3B-Instruct-GGUF:Q4_K_M",
        "hf:mradermacher/Llama-3.2-3B-Instruct-GGUF:Q4_K_S"
    ]
}, {
    name: "Phi 3 3.8B",
    abilities: ["chat", "complete", "functionCalling"],
    description: "Phi 3 model was created by Microsoft and is optimized for strong reasoning (especially math and logic).\n" +
        "This is the small version of the model.",

    fileOptions: [
        "hf:bartowski/Phi-3.1-mini-4k-instruct-GGUF:Q8_0",
        "hf:bartowski/Phi-3.1-mini-4k-instruct-GGUF:Q4_K_M"
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
        "hf:TheBloke/Mixtral-8x7B-v0.1-GGUF:Q5_K_M",
        "hf:TheBloke/Mixtral-8x7B-v0.1-GGUF:Q4_K_M"
    ]
}, {
    name: "Mistral 7B Instruct v0.2",
    abilities: ["chat", "complete"],
    description: "Mistral models were created by Mistal AI and are general purpose models.\n" +
        "This is the 7 billion parameters version of the model.",

    fileOptions: [
        "hf:TheBloke/Mistral-7B-Instruct-v0.2-GGUF:Q5_K_M",
        "hf:TheBloke/Mistral-7B-Instruct-v0.2-GGUF:Q4_K_M"
    ]
}, {
    name: "Dolphin 2.5 Mixtral 8x7B MoE",
    abilities: ["chat", "complete"],
    description: "This Dolphin Mixtral model was created by Eric Hartford and is an uncensored model based on Mixtral, with really good coding skills.\n" +
        "See the Mixtral model above for more information about Mixtral models.\n" +
        "This model includes 8 expert models, each with 7 billion parameters.",

    fileOptions: [
        "hf:TheBloke/dolphin-2.5-mixtral-8x7b-GGUF:Q5_K_M",
        "hf:TheBloke/dolphin-2.5-mixtral-8x7b-GGUF:Q4_K_M"
    ]
}, {
    name: "Gemma 2 9B",
    abilities: ["chat", "complete"],
    description: "Gemma models were created by Google and are optimized suited for variety of text generation tasks, " +
        "including question answering, summarization, and reasoning, with a focus on responsible responses.\n" +
        "This is the 9 billion parameters version of the model.",

    fileOptions: [
        "hf:bartowski/gemma-2-9b-it-GGUF:Q6_K_L",
        "hf:bartowski/gemma-2-9b-it-GGUF:Q6_K",
        "hf:bartowski/gemma-2-9b-it-GGUF:Q5_K_M",
        "hf:bartowski/gemma-2-9b-it-GGUF:Q5_K_S",
        "hf:bartowski/gemma-2-9b-it-GGUF:Q4_K_M"
    ]
}, {
    name: "Gemma 2 2B",
    abilities: ["chat", "complete"],
    description: "Gemma models were created by Google and are optimized suited for variety of text generation tasks, " +
        "including question answering, summarization, and reasoning, with a focus on responsible responses.\n" +
        "This is the 2 billion parameters version of the model and is significantly less powerful than the 9B version.",

    fileOptions: [
        "hf:bartowski/gemma-2-2b-it-GGUF:Q6_K_L",
        "hf:bartowski/gemma-2-2b-it-GGUF:Q6_K",
        "hf:bartowski/gemma-2-2b-it-GGUF:Q5_K_M",
        "hf:bartowski/gemma-2-2b-it-GGUF:Q5_K_S",
        "hf:bartowski/gemma-2-2b-it-GGUF:Q4_K_M"
    ]
}, {
    name: "Gemma 2 27B",
    abilities: ["chat", "complete"],
    description: "Gemma models were created by Google and are optimized suited for varoety of text generation tasks, " +
        "including question answering, summarization, and reasoning, with a focus on responsible responses.\n" +
        "This is the 27 billion parameters version of the model.\n" +
        "Since the model is relatively big, it may not run well on your machine",

    fileOptions: [
        "hf:bartowski/gemma-2-27b-it-GGUF:Q6_K_L",
        "hf:bartowski/gemma-2-27b-it-GGUF:Q6_K",
        "hf:bartowski/gemma-2-27b-it-GGUF:Q5_K_M",
        "hf:bartowski/gemma-2-27b-it-GGUF:Q5_K_S",
        "hf:bartowski/gemma-2-27b-it-GGUF:Q4_K_M"
    ]
}, {
    name: "Orca 2 13B",
    abilities: ["chat", "complete"],
    description: "Orca 2 model was created by Microsoft and is optimized for reasoning over given data, reading comprehensions, math problem solving and text summarization.\n" +
        "This is the 13 billion parameters version of the model.",

    fileOptions: [
        "hf:TheBloke/Orca-2-13B-GGUF:Q5_K_M",
        "hf:TheBloke/Orca-2-13B-GGUF:Q4_K_M"
    ]
}, {
    name: "Code Llama 7B",
    abilities: ["chat", "complete", "infill"],
    description: "Code Llama model was created by Meta based on Llama 2 and is optimized for coding tasks.\n" +
        "This is the 7 billion parameters version of the model.",

    fileOptions: [
        "hf:TheBloke/CodeLlama-7B-GGUF:Q5_K_M",
        "hf:TheBloke/CodeLlama-7B-GGUF:Q4_K_M"
    ]
}, {
    name: "Code Llama 13B",
    abilities: ["chat", "complete", "infill"],
    description: "Code Llama model was created by Meta based on Llama 2 and is optimized for coding tasks.\n" +
        "This is the 13 billion parameters version of the model.",

    fileOptions: [
        "hf:TheBloke/CodeLlama-13B-GGUF:Q5_K_M",
        "hf:TheBloke/CodeLlama-13B-GGUF:Q4_K_M"
    ]
}, {
    name: "Code Llama 34B",
    abilities: ["chat", "complete", "infill"],
    description: "Code Llama model was created by Meta based on Llama 2 and is optimized for coding tasks.\n" +
        "This is the 34 billion parameters version of the model.\n" +
        "You need a GPU with handful of VRAM to use this version.",

    fileOptions: [
        "hf:TheBloke/CodeLlama-34B-GGUF:Q5_K_M",
        "hf:TheBloke/CodeLlama-34B-GGUF:Q4_K_M"
    ]
}, {
    name: "CodeGemma 2B",
    abilities: ["code", "complete", "infill"],
    description: "CodeGemma models were created by Google and are optimized for code completion, code generation, " +
        "natual language understanding, mathematical reasoning, and instruction following.\n" +
        "This model is not suited for chat.\n" +
        "This is the 2 billion parameters version of the model.\n",

    fileOptions: [
        "hf:bartowski/codegemma-2b-GGUF:Q8_0",
        "hf:bartowski/codegemma-2b-GGUF:Q6_K",
        "hf:bartowski/codegemma-2b-GGUF:Q5_K_M",
        "hf:bartowski/codegemma-2b-GGUF:Q5_K_S",
        "hf:bartowski/codegemma-2b-GGUF:Q4_K_M"
    ]
}, {
    name: "CodeGemma 7B",
    abilities: ["code", "complete", "infill"],
    description: "CodeGemma models were created by Google and are optimized for code completion, code generation, " +
        "natual language understanding, mathematical reasoning, and instruction following.\n" +
        "This model is not suited for chat.\n" +
        "This is the 7 billion parameters version of the model.\n",

    fileOptions: [
        "hf:bartowski/codegemma-1.1-7b-it-GGUF:Q6_K",
        "hf:bartowski/codegemma-1.1-7b-it-GGUF:Q5_K_M",
        "hf:bartowski/codegemma-1.1-7b-it-GGUF:Q5_K_S",
        "hf:bartowski/codegemma-1.1-7b-it-GGUF:Q4_K_M"
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
