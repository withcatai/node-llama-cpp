---
layout: home

title: node-llama-cpp
titleTemplate: Run AI models locally on your machine

hero:
  name: "node-llama-cpp"
  text: "Run AI models locally on your machine"
  tagline: node.js bindings for llama.cpp, and much more
  actions:
    - theme: brand
      text: Get Started
      link: /guide/
    - theme: alt
      text: API Reference
      link: /api/functions/getLlama
  image:
    src: /logo.jpg
    alt: node-llama-cpp Logo
    width: 320
    height: 320

features:
  - icon: 🌟
    title: Easy to use
    details: |
      Zero-config by default.
      Works in Node.js, Bun, and Electron.
      Bootstrap a project with a single command
    link: /guide/
    linkText: Learn more
  - icon: 🚀
    title: Metal, CUDA and Vulkan support
    details: Adapts to your hardware automatically to run models with maximum performance
    link: /guide/#gpu-support
    linkText: Learn more
  - icon: 📦
    title: Native binaries
    details: Pre-built binaries are provided, with a fallback to building from source without <code>node-gyp</code> or Python
    link: /guide/building-from-source
    linkText: Learn more
  - icon: <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M600-160q-17 0-28.5-11.5T560-200q0-17 11.5-28.5T600-240h80q17 0 28.5-11.5T720-280v-80q0-38 22-69t58-44v-14q-36-13-58-44t-22-69v-80q0-17-11.5-28.5T680-720h-80q-17 0-28.5-11.5T560-760q0-17 11.5-28.5T600-800h80q50 0 85 35t35 85v80q0 17 11.5 28.5T840-560t28.5 11.5Q880-537 880-520v80q0 17-11.5 28.5T840-400t-28.5 11.5Q800-377 800-360v80q0 50-35 85t-85 35h-80Zm-320 0q-50 0-85-35t-35-85v-80q0-17-11.5-28.5T120-400t-28.5-11.5Q80-423 80-440v-80q0-17 11.5-28.5T120-560t28.5-11.5Q160-583 160-600v-80q0-50 35-85t85-35h80q17 0 28.5 11.5T400-760q0 17-11.5 28.5T360-720h-80q-17 0-28.5 11.5T240-680v80q0 38-22 69t-58 44v14q36 13 58 44t22 69v80q0 17 11.5 28.5T280-240h80q17 0 28.5 11.5T400-200q0 17-11.5 28.5T360-160h-80Z"/></svg>
    title: Powerful features
    details: Force a model to generate output according to a JSON schema, provide a model with functions it can call on demand, and much more
    link: /guide/grammar#json-schema
    linkText: Learn more
---

<script setup>
import HomePage from "../.vitepress/components/HomePage/HomePage.vue";
</script>

<HomePage>
<template v-slot:chat-command>

```shell
npx -y node-llama-cpp chat
```

</template>
<template v-slot:inspect-command>

```shell
npx -y node-llama-cpp inspect gpu
```

</template>
<template v-slot:features-list>

* [Embedding](./guide/embedding.md)
* [Grammar](./guide/grammar.md)
* [JSON schema grammar](./guide/index.md#chatbot-with-json-schema)
* [Function calling](./guide/index.md#chatbot-with-json-schema)
* [CUDA support](./guide/CUDA.md)
* [Metal support](./guide/Metal.md)
* [Vulkan support](./guide/Vulkan.md)
* [Adapts to your hardware](./guide/index.md#gpu-support)
* [Model downloader](./guide/downloading-models.md)
* [Prebuilt binaries](./guide/building-from-source.md)
* [Electron support](./guide/electron.md)
* [Prompt preloading](./guide/chat-session.md#preload-prompt)
* [Automatic chat wrapper](./guide/chat-wrapper.md#chat-wrappers)
* [Template chat wrapper](./guide/chat-wrapper.md#template)
* [Text completion](./guide/text-completion.md#complete)
* [Fill in the middle (infill)](./guide/text-completion.md#infill)
* [Jinja support](./guide/chat-wrapper.md#jinja)
* [Smart context shift](./guide/chat-wrapper.md#smart-context-shift)
* [Token bias](./guide/token-bias.md)
* Windows on Arm support
* [Apple Silicon support](./guide/Metal.md)
* [Inspect GGUF files](./cli/inspect/gguf.md)
* [Custom CMake options](./guide/building-from-source.md#customize-build)
* [Automatic batching](./guide/batching.md)
* [TypeScript type-safety](./api/functions/getLlama.md)
* [LoRA](./api/type-aliases/LlamaContextOptions.md#lora)
* [Remote GGUF reader](./api/functions/readGgufFileInfo.md)
* [User input safety](./guide/llama-text.md#input-safety-in-node-llama-cpp)
* [Token prediction](./guide/token-prediction.md)
* [Reranking](./guide/embedding.md#reranking)
* [Thought segmentation](./guide/chat-session.md#stream-response-segments)

</template>
<template v-slot:simple-code>

```TypeScript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(
    fileURLToPath(import.meta.url)
);

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "my-model.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});


const q1 = "Hi there, how are you?";
console.log("User: " + q1);

const a1 = await session.prompt(q1);
console.log("AI: " + a1);
```

</template>
<template v-slot:simple-embedding>

```TypeScript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama} from "node-llama-cpp";

const __dirname = path.dirname(
    fileURLToPath(import.meta.url)
);

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "my-model.gguf")
});
const context = await model.createEmbeddingContext();





const text = "Hello world";
console.log("Text:", text);

const embedding = await context.getEmbeddingFor(text);
console.log("Embedding vector:", embedding.vector);
```

</template>
<template v-slot:json-schema>

```TypeScript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(
    fileURLToPath(import.meta.url)
);

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "my-model.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});

const grammar = await llama.createGrammarForJsonSchema({
    type: "object",
    properties: {
        positiveWordsInUserMessage: {
            type: "array",
            items: {
                type: "string"
            }
        },
        userMessagePositivityScoreFromOneToTen: {
            enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        },
        nameOfUser: {
            oneOf: [{
                type: "null"
            }, {
                type: "string"
            }]
        }
    }
});

const prompt = "Hi there! I'm John. Nice to meet you!";

const res = await session.prompt(prompt, {
    grammar
});
const parsedRes = grammar.parse(res);

console.log("User name:", parsedRes.nameOfUser);
console.log(
    "Positive words in user message:", 
    parsedRes.positiveWordsInUserMessage
);
console.log(
    "User message positivity score:",
    parsedRes.userMessagePositivityScoreFromOneToTen
);
```

</template>
<template v-slot:function-calling>

```TypeScript
import {fileURLToPath} from "url";
import path from "path";
import {
    getLlama,
    LlamaChatSession,
    defineChatSessionFunction
} from "node-llama-cpp";

const __dirname = path.dirname(
    fileURLToPath(import.meta.url)
);

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "my-model.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});

const fruitPrices: Record<string, string> = {
    "apple": "$6",
    "banana": "$4"
};
const functions = {
    getFruitPrice: defineChatSessionFunction({
        description: "Get the price of a fruit",
        params: {
            type: "object",
            properties: {
                name: {
                    type: "string"
                }
            }
        },
        async handler(params) {
            const name = params.name.toLowerCase();
            if (Object.keys(fruitPrices).includes(name))
                return {
                    name: name,
                    price: fruitPrices[name]
                };

            return `Unrecognized fruit "${params.name}"`;
        }
    })
};


const q1 = "Is an apple more expensive than a banana?";
console.log("User: " + q1);

const a1 = await session.prompt(q1, {functions});
console.log("AI: " + a1);
```

</template>
</HomePage>
