---
outline: deep
---
# Getting started

## Installation
Inside of your node.js project directory, run this command:
```bash
npm install --save node-llama-cpp
```

> `node-llama-cpp` comes with pre-built binaries for macOS, Linux and Windows.
>
> If binaries are not available for your platform, it'll fallback to download a release of `llama.cpp` and build it from source with `cmake`.
> To disable this behavior, set the environment variable `NODE_LLAMA_CPP_SKIP_DOWNLOAD` to `true`.

## ESM usage
`node-llama-cpp` is an [ES module](https://nodejs.org/api/esm.html#modules-ecmascript-modules), so can only use `import` to load it and cannot use `require`.

To make sure you can use it in your project, make sure your `package.json` file has `"type": "module"` in it.

## CUDA and Metal support
**Metal:** Metal support is enabled by default on macOS. If you're using a Mac with an Intel chip, [you might want to disable it](./Metal.md).

**CUDA:** To enable CUDA support, see the [CUDA guide](./CUDA.md).

## Getting a model file
We recommend you to get a GGUF model from the [TheBloke on Hugging Face](https://huggingface.co/TheBloke?search_models=GGUF).

We recommend you to start by getting a small model that doesn't have a lot of parameters just to ensure everything works, so try downloading a `7B` parameters model first (search for models with both `7B` and `GGUF` in their name).

For improved download speeds, you can use [`ipull`](https://www.npmjs.com/package/ipull) to download the model:
```bash
npx ipull <model-file-ul>
```

## Validating the model
To validate that the model you downloaded is working properly, run the following command to chat with it:
```bash
npx --no node-llama-cpp chat --model <path-to-a-model-file-on-your-computer>
```

Try telling the model `Hi there` and see how it reacts.
If the response looks weird or doesn't make sense, try using a different model.

If the model doesn't stop generating output, try using a different [chat wrapper](./chat-prompt-wrapper.md). For example:
```bash
npx --no node-llama-cpp chat --wrapper llamaChat --model <path-to-a-model-file-on-your-computer>
```

## Usage
### Chatbot
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "dolphin-2.1-mistral-7b.Q4_K_M.gguf")
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

> To use a custom chat prompt wrapper, see the [chat prompt wrapper guide](./chat-prompt-wrapper.md).


### Chatbot with JSON schema
To force the model to generate output according to a JSON schema, use the [`LlamaJsonSchemaGrammar`](/api/classes/LlamaJsonSchemaGrammar) class.

It'll force the model to generate output according to the JSON schema you provide, and it'll do it on the text generation level.

It only supports [a small subset of the JSON schema spec](/api/type-aliases/GbnfJsonSchema), but it's enough to generate useful JSON objects using a text generation model.

::: tip NOTE

To learn more on how to use grammars correctly, read the [grammar guide](./grammar.md).

:::

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {
    LlamaModel, LlamaJsonSchemaGrammar, LlamaContext, LlamaChatSession
} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const model = new LlamaModel({
    modelPath: path.join(__dirname, "models", "codellama-13b.Q3_K_M.gguf")
})
const grammar = new LlamaJsonSchemaGrammar({
    "type": "object",
    "properties": {
        "responseMessage": {
            "type": "string"
        },
        "requestPositivityScoreFromOneToTen": {
            "type": "number"
        }
    }
} as const);
const context = new LlamaContext({model});
const session = new LlamaChatSession({context});


const q1 = 'How are you doing?';
console.log("User: " + q1);

const a1 = await session.prompt(q1, {
    grammar,
    maxTokens: context.getContextSize()
});
console.log("AI: " + a1);

const parsedA1 = grammar.parse(a1);
console.log(
    parsedA1.responseMessage,
    parsedA1.requestPositivityScoreFromOneToTen
);
```


### Raw
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {
    LlamaModel, LlamaContext, LlamaChatSession, Token
} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const model = new LlamaModel({
    modelPath: path.join(__dirname, "models", "codellama-13b.Q3_K_M.gguf")
});

const context = new LlamaContext({model});

const q1 = "Hi there, how are you?";
console.log("AI: " + q1);

const tokens = context.encode(q1);
const res: Token[] = [];
for await (const modelToken of context.evaluate(tokens)) {
    res.push(modelToken);
    
    // It's important to not concatinate the results as strings,
    // as doing so will break some characters (like some emojis)
    // that consist of multiple tokens.
    // By using an array of tokens, we can decode them correctly together.
    const resString: string = context.decode(res);
    
    const lastPart = resString.split("ASSISTANT:").reverse()[0];
    if (lastPart.includes("USER:"))
        break;
}

const a1 = context.decode(res).split("USER:")[0];
console.log("AI: " + a1);
```
