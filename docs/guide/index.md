---
outline: deep
description: Get started with node-llama-cpp
---
# Getting Started

## Installation {#installation}
### Scaffold a New Project {#scaffold-new-project}
To create a new `node-llama-cpp` project with everything set up, run this command:
```shell
npm create node-llama-cpp@latest
```
> It may take a minute to download all the prebuilt binaries

You will be asked to enter a project name, select a template, and choose a model from a list of recommended models.

If this is your first time running models on your machine, we recommend starting with the `Node + TypeScript` template.

### Existing Project {#add-to-existing-project}
Inside of your node.js project directory, run this command:
```shell
npm install node-llama-cpp
```

> `node-llama-cpp` comes with pre-built binaries for macOS, Linux and Windows.
>
> If binaries are not available for your platform, it'll fallback to download a release of `llama.cpp` and build it from source with `cmake`.
> To disable this behavior, set the environment variable `NODE_LLAMA_CPP_SKIP_DOWNLOAD` to `true`.

## ESM Usage {#esm-usage}
`node-llama-cpp` is an [ES module](https://nodejs.org/api/esm.html#modules-ecmascript-modules), so can only use `import` to load it and cannot use `require`.

To make sure you can use it in your project, make sure your `package.json` file has `"type": "module"` in it.

For workarounds for existing projects, see the [ESM troubleshooting guide](./troubleshooting.md#esm-usage).

## GPU Support {#gpu-support}
`node-llama-cpp` automatically detects the available compute layers on your machine and uses the best one by default,
as well as balances the default settings to get the best performance from your hardware.
No need to manually configure anything.

**Metal:** Enabled by default on Macs with Apple Silicon. If you're using a Mac with an Intel chip, [you can manually enable it](./Metal.md).
[Accelerate framework](https://developer.apple.com/accelerate/) is always enabled.

**CUDA:** Used by default when support is detected. For more details, see the [CUDA guide](./CUDA.md).

**Vulkan:** Used by default when support is detected. For more details, see the [Vulkan guide](./Vulkan.md).

To inspect your hardware, run this command:
```shell
npx --no node-llama-cpp inspect gpu
```

## Getting a Model File
We recommend getting a GGUF model from either [Michael Radermacher on Hugging Face](https://huggingface.co/mradermacher) or by [searching HuggingFace directly](https://huggingface.co/models?library=gguf) for a GGUF model.

We recommend starting by getting a small model that doesn't have a lot of parameters just to ensure everything works, so try downloading a `7B`/`8B` parameters model first (search for models with both `7B`/`8B` and `GGUF` in their name).

To ensure you can chat with the model, make sure you [choose an Instruct model](./choosing-a-model.md#model-purpose) by looking for `Instruct` or `it` in the model name.

For improved download speeds, you can use the [`pull`](../cli/pull.md) command to download a model:
```shell
npx --no node-llama-cpp pull --dir ./models <model-file-url>
```

::: tip Not sure what model to get started with?
Run the [`chat`](../cli/chat.md) command with no parameters to see a list of recommended models:
```shell
npx --no node-llama-cpp chat
```
:::

For more tips on choosing a model, see the [choosing a model guide](./choosing-a-model.md).

## Validating the Model
To validate that the model you downloaded is working properly, use the [`chat`](../cli/chat.md) command to chat with it:
```shell
npx --no node-llama-cpp chat <path-to-a-model-file-on-your-computer>
```

Try telling the model `Hi there` and see how it reacts.
If the response looks weird or doesn't make sense, try using a different model.

If the model doesn't stop generating output, try using a different [chat wrapper](./chat-wrapper). For example:
```shell
npx --no node-llama-cpp chat --wrapper general <path-to-a-model-file-on-your-computer>
```

> [!TIP]
> To download a model and prompt it right away with a single command,
> use the [`chat`](../cli/chat.md) command and pass a model URL together with a `--prompt` flag:
> ```shell
> npx --no node-llama-cpp chat --prompt 'Hi there' <model-url>
> ```

## Usage {#usage}
### Chatbot {#chatbot}
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});


const q1 = "Hi there, how are you?";
console.log("User: " + q1);

const a1 = await session.prompt(q1);
console.log("AI: " + a1);


const q2 = "Summarize what you said";
console.log("User: " + q2);

const a2 = await session.prompt(q2);
console.log("AI: " + a2);
```

> To use a custom chat wrapper, see the [chat wrapper guide](./chat-wrapper).


### Chatbot With JSON Schema {#chatbot-with-json-schema}
To enforce a model to generate output according to a JSON schema, use [`llama.createGrammarForJsonSchema()`](../api/classes/Llama.md#creategrammarforjsonschema).

It'll force the model to generate output according to the JSON schema you provide, and it'll do it on the text generation level.

It only supports [a small subset of the JSON schema spec](../api/type-aliases/GbnfJsonSchema.md), but it's enough to generate useful JSON objects using a text generation model.

::: tip NOTE

To learn more about using grammars correctly, read the [grammar guide](./grammar.md).

:::

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(
    fileURLToPath(import.meta.url)
);

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3-8B-Instruct.Q4_K_M.gguf")
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

const res = await session.prompt(prompt, {grammar});
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


### Chatbot With Function Calling {#chatbot-with-function-calling}
You can provide functions that the model can call during generation to retrieve information or perform actions.

Some models have official support for function calling in `node-llama-cpp` (such as [Functionary](https://huggingface.co/meetkai/functionary-small-v2.5-GGUF/blob/main/functionary-small-v2.5.Q4_0.gguf) and [Llama 3 Instruct](https://huggingface.co/mradermacher/Meta-Llama-3-8B-Instruct-GGUF/blob/main/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf)),
while other models fallback to a generic function calling mechanism that works with many models, but not all of them.

::: tip NOTE

To learn more about using function calling correctly, read the [function calling guide](./function-calling.md).

:::

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession, defineChatSessionFunction} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3-8B-Instruct.Q4_K_M.gguf")
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

### Raw
::: tip NOTE
To learn more about using low level APIs, read the [low level API guide](./low-level-api.md).
:::

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, Token} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const sequence = context.getSequence();

const q1 = "Hi there, how are you?";
console.log("User: " + q1);

const tokens = model.tokenize("USER: " + q1 + "\nASSISTANT: ");
const res: Token[] = [];
for await (const generatedToken of sequence.evaluate(tokens)) {
    res.push(generatedToken);

    // It's important to not concatenate the results as strings,
    // as doing so breaks some characters (like some emojis)
    // that consist of multiple tokens.
    // By using an array of tokens, we can decode them correctly together.
    const resString = model.detokenize(res);

    const lastPart = resString.split("ASSISTANT:").pop();
    if (lastPart?.includes("USER:"))
        break;
}

const a1 = model.detokenize(res).split("USER:")[0]!;
console.log("AI: " + a1.trim());
```

## Next Steps {#next-steps}
Now that you've learned the basics of `node-llama-cpp`,
you can explore more advanced topics by reading the guides in the _Guide_ section of the sidebar.

Use [GitHub Discussions](https://github.com/withcatai/node-llama-cpp/discussions) to ask questions if you get stuck,<br/>
and [give `node-llama-cpp` a star on GitHub](https://github.com/withcatai/node-llama-cpp) if you found it useful.

Explore the [API reference](../api/functions/getLlama.md) to learn more about the available functions and classes,
and use the search bar (press <kbd class="doc-kbd">/</kbd>) to find documentation for a specific topic or API.

Check out the [roadmap](https://github.com/orgs/withcatai/projects/1) to see what's coming next,<br/>
visit the [awesome list](./awesome.md) to find great projects that use `node-llama-cpp`,<br/>
and consider [sponsoring `node-llama-cpp`](https://github.com/sponsors/giladgd) to accelerate the development of new features.
