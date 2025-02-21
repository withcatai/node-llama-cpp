---
outline: deep
description: Using grammar
---
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

You can see the full list of supported grammar files [here](https://github.com/ggml-org/llama.cpp/tree/master/grammars).

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

It only supports [a subset of the JSON schema spec](../api/type-aliases/GbnfJsonSchema.md),
but it's enough to generate useful JSON objects using a text generation model.

Some features of [JSON schema spec](https://json-schema.org/learn/getting-started-step-by-step) are not supported on purpose,
as those features don't align well with the way models generate text, and are too prone to [hallucinations](https://en.wikipedia.org/wiki/Hallucination_(artificial_intelligence)).
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

### Reducing Hallucinations When Using JSON Schema Grammar {#reducing-json-schema-hallucinations}
When forcing a model to follow a specific JSON schema in its response, the model isn't aware of the entire schema being enforced on it.
To avoid hallucinations, you need to inform the model in some way what are your expectations from its response.

To do that, you can:
* Explain to the model what you expect in the prompt itself.
  <br />
  You can do that by giving a brief explanation of what you expect,
  or by dumping the entire JSON schema in the prompt (which can eat up a lot of tokens, thus is not recommended).
* Force the model to output self-explanatory keys as part of its response, so it can then generate values for those keys.
* Use a combination of both.

The technique used in [the above example](#json-schema) forces the model to output the given keys, and then lets the model generate the values for those keys:
1. The model is forced to generate the text `{"positiveWordsInUserMessage": [`, and then we let it finish the syntax of the JSON array with only strings.
2. When it finishes the array, we force it to <br />generate the text <span>`, "userMessagePositivityScoreFromOneToTen": `</span>, and then we let it generate a number.
3. Finally, we force it to generate the text `, "nameOfUser": `, and then we let it generate either a string or `null`.

This technique allows us to get the desired result without explaining to the model what we want in advance.
While this method works great in this example, it may not work as well in other cases that need some explanation.

For example, let's say we force the model to generate an array with at least 2 items and at most 5 items;
if we don't provide any prior explanation for this requirement (either by using a self-explanatory key name or in the prompt),
then the model won't be able to "plan" the entire content of the array in advance,
which can lead it to generate inconsistent and unevenly spread items.
It can also make the model repeat the existing value in different forms or make up wrong values,
just so it can follow the enforced schema.

The key takeaway is that to reduce hallucinations and achieve great results when using a JSON schema grammar,
you need to ensure you inform the model of your expectations in some way.

::: tip NOTE
When using [function calling](./function-calling.md), the model is always aware of the entire schema being enforced on it,
so there's no need to explain the schema in the prompt.
:::

## Creating Your Own Grammar {#custom-grammar}
To create your own grammar, read the [GBNF guide](https://github.com/ggml-org/llama.cpp/blob/f5fe98d11bdf9e7797bcfb05c0c3601ffc4b9d26/grammars/README.md) to create a GBNF grammar file.

To use your custom grammar file, load it via the [`llama.createGrammar(...)`](../api/classes/Llama.md#creategrammar) method:
```typescript
import {fileURLToPath} from "url";
import path from "path";
import fs from "fs/promises";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const myGrammar = await fs.readFile(path.join(__dirname, "my-json-grammar.gbnf"), "utf8");

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
