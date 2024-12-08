---
description: Generating text completions with node-llama-cpp
---
# Text Completion {#title}
To generate text completions, you can use the [`LlamaCompletion`](../api/classes/LlamaCompletion.md) class.

Here are usage examples of [`LlamaCompletion`](../api/classes/LlamaCompletion.md):

## Text Completion {#complete}
Generate a completion to a given text.

::: tip
It's recommended to set [`maxTokens`](../api/type-aliases/LlamaCompletionGenerationOptions.md#maxtokens) when generating a text completion to ensure the completion doesn't go on forever.
:::

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaCompletion} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const completion = new LlamaCompletion({
    contextSequence: context.getSequence()
});

const input = "Here is a list of sweet fruits:\n* ";
console.log("Input: " + input);

const res = await completion.generateCompletion(input, {
    maxTokens: 100
});
console.log("Completion: " + res);
```

## Fill in the Middle (Infill) {#infill}
Generate a completion to a given text (prefix), that should connect to a give continuation (suffix).

You can use [`infillSupported`](../api/classes/LlamaCompletion.md#infillsupported) to check whether a model supports infill completions.
Using infill with an unsupported model will throw an [`UnsupportedError`](../api/classes/UnsupportedError.md) error.

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaCompletion} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "codegemma-2b-Q4_K_M.gguf")
});
const context = await model.createContext();
const completion = new LlamaCompletion({
    contextSequence: context.getSequence()
});

if (!completion.infillSupported) {
    console.error("Infill is not supported for this model");
    process.exit(1);
}

const prefix = "4 sweet fruits: Apple,";
const suffix = "and Grape.\n\n";
console.log("Prefix: " + prefix);
console.log("Suffix: " + suffix);

const res = await completion.generateInfillCompletion(prefix, suffix, {
    maxTokens: 100
});
console.log("Fill: " + res);
```
> This example uses [CodeGemma](https://huggingface.co/bartowski/codegemma-2b-GGUF).
