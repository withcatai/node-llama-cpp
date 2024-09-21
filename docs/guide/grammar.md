# Using Grammar
Use this to enforce a model to generate response in a specific format of text, like `JSON` for example.

::: tip NOTE

It's important to tell the model as part of the prompt itself what format to generate the output in.

Grammar forcing makes sure the model follows the specified format, but it doesn't tell the model what format to use.

If you don't do that, the model may not generate any output at all.

:::


::: tip NOTE

There's an issue with some grammars where the model won't stop generating output,
so it's recommended to use it together with `maxTokens` set to the context size of the model

:::

## Using a Builtin Grammar {#builtin-grammar}
The [`llama.getGrammarFor("<format>")`](../api/classes/Llama.md#getgrammarfor) method reads a GBNF grammar file that's originally provided by `llama.cpp` and is included inside of `node-llama-cpp`.

You can see the full list of supported grammar files [here](https://github.com/ggerganov/llama.cpp/tree/master/grammars).

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
const grammar = await llama.getGrammarFor("json");


const q1 = 'Create a JSON that contains a message saying "hi there"';
console.log("User: " + q1);

const a1 = await session.prompt(q1, {
    grammar,
    maxTokens: context.contextSize
});
console.log("AI: " + a1);
console.log(JSON.parse(a1));


const q2 = 'Add another field to the JSON with the key being "author" ' +
    'and the value being "Llama"';
console.log("User: " + q2);

const a2 = await session.prompt(q2, {
    grammar,
    maxTokens: context.contextSize
});
console.log("AI: " + a2);
console.log(JSON.parse(a2));
```

## Using a JSON Schema Grammar {#json-schema}
The [`llama.createGrammarForJsonSchema(...)`](../api/classes/Llama.md#creategrammarforjsonschema) creates a [`LlamaJsonSchemaGrammar`](../api/classes/LlamaJsonSchemaGrammar)
from a GBNF grammar generated a based on the [JSON schema](https://json-schema.org/learn/getting-started-step-by-step) you provide.

It only supports [a small subset of the JSON schema spec](../api/type-aliases/GbnfJsonSchema.md),
but it's enough to generate useful JSON objects using a text generation model.

Many features of [JSON schema spec](https://json-schema.org/learn/getting-started-step-by-step) are not supported here on purpose,
as those features don't align well with the way models generate text and are prone to [hallucinations](https://en.wikipedia.org/wiki/Hallucination_(artificial_intelligence)).
Workarounds for the missing features that you can implement with the supported set of features often lead to improved generation quality.

To see what subset of the JSON schema spec is supported, see the [`GbnfJsonSchema` type](../api/type-aliases/GbnfJsonSchema.md) and follow its sub-types.

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

## Creating Your Own Grammar {#custom-grammar}
To create your own grammar, read the [GBNF guide](https://github.com/ggerganov/llama.cpp/blob/f5fe98d11bdf9e7797bcfb05c0c3601ffc4b9d26/grammars/README.md) to create a GBNF grammar file.

To use your custom grammar file, load it via the [`llama.createGrammar(...)`](../api/classes/Llama.md#creategrammar) method:
```typescript
import {fileURLToPath} from "url";
import path from "path";
import fs from "fs/promises";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const myGrammar = await fs.readFile(path.join(__dirname, "my-json-grammar.gbnf"), "utf-8");

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});
const grammar = await llama.createGrammar({
    grammar: myGrammar,
    stopGenerationTriggers: [
        "\n\n\n\n"
    ]
});


const q1 = 'Create a JSON that contains a message saying "hi there"';
console.log("User: " + q1);

const a1 = await session.prompt(q1, {
    grammar,
    maxTokens: context.contextSize
});
console.log("AI: " + a1);
console.log(JSON.parse(a1));


const q2 = 'Add another field to the JSON with the key being "author" ' +
    'and the value being "Llama"';
console.log("User: " + q2);

const a2 = await session.prompt(q2, {
    grammar,
    maxTokens: context.contextSize
});
console.log("AI: " + a2);
console.log(JSON.parse(a2));
```

## Using Both Grammar and Function Calling {#grammar-and-function-calling}
Prompting with both a grammar and [function calling](./function-calling.md) is not supported due to the nature of how grammar enforcement works.

To workaround this, you can use function calling to make the model generate a response, and then prompt it again to force the model to convert it to your desired format.

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {
    getLlama, LlamaChatSession, defineChatSessionFunction
} from "node-llama-cpp";

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
const grammar = await llama.createGrammarForJsonSchema({
    type: "object",
    properties: {
        itemName: {
            type: "string"
        }
    }
});

const prompt1 = "What is more expensive? An apple or a bannana?";
const res1 = await session.prompt(prompt1, {functions});
console.log("First response:", res1);

const prompt2 = "Repeat the name of the more expensive item";
const res2 = await session.prompt(prompt2, {
    grammar,
    maxTokens: context.contextSize
});
const parsedRes2 = grammar.parse(res2);

console.log("More expensive item:", parsedRes2.itemName);
```

## Grammar Generation Libraries {#grammar-libraries}
There are some useful libraries you can use to generate GBNF grammars to load via the [`llama.createGrammar(...)`](../api/classes/Llama.md#creategrammar) method:
* **gbnfgen ([GitHub](https://github.com/IntrinsicLabsAI/gbnfgen) | [npm](https://www.npmjs.com/package/@intrinsicai/gbnfgen))** - Generate GBNF grammar to output JSON files based on TypeScript interfaces and enums.
* **grammar-builder ([GitHub](https://github.com/gabriel-peracio/grammar-builder) | [npm](https://www.npmjs.com/package/grammar-builder))** - A simple helper library to facilitate building GBNF grammars manually 

> If you're the creator of a library that generates GBNF grammars, or you find such library, you're encouraged to open a PR to add it to this list
