# Using grammar
Use this to force the model to generate a specific format of text, like `JSON` for example.

::: tip NOTE

It's important to tell the model as part of the prompt itself what format to generate the output in.

Grammar forcing makes sure the model follows the specified format, but it doesn't tell the model what format to use.

If you don't do that, the model may not generate any output at all.

:::


::: tip NOTE

there's an issue with some grammars where the model won't stop generating output,
so it's advised to use it together with `maxTokens` set to the context size of the model

:::

## Using a builtin grammar
The [`LlamaGrammar.getFor("<format>")`](/api/classes/LlamaGrammar#getfor) method reads a GBNF grammar file that's originally provided by `llama.cpp` and is included inside of `node-llama-cpp`.

You can see the full list of supported grammar files [here](https://github.com/ggerganov/llama.cpp/tree/master/grammars).

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {LlamaModel, LlamaGrammar, LlamaContext, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const model = new LlamaModel({
    modelPath: path.join(__dirname, "models", "codellama-13b.Q3_K_M.gguf")
})
const grammar = await LlamaGrammar.getFor("json");
const context = new LlamaContext({
    model
});
const session = new LlamaChatSession({context});


const q1 = 'Create a JSON that contains a message saying "hi there"';
console.log("User: " + q1);

const a1 = await session.prompt(q1, {grammar, maxTokens: context.getContextSize()});
console.log("AI: " + a1);
console.log(JSON.parse(a1));


const q2 = 'Add another field to the JSON with the key being "author" and the value being "Llama"';
console.log("User: " + q2);

const a2 = await session.prompt(q2, {grammar, maxTokens: context.getContextSize()});
console.log("AI: " + a2);
console.log(JSON.parse(a2));
```

## Using a JSON schema grammar
The [`LlamaJsonSchemaGrammar`](/api/classes/LlamaJsonSchemaGrammar) class uses a GBNF grammar that's generated based on the [JSON schema](https://json-schema.org/learn/getting-started-step-by-step) you provide.

It only supports [a small subset of the JSON schema spec](/api/type-aliases/GbnfJsonSchema), but it's enough to generate useful JSON objects using a text generation model.

To see what subset of the JSON schema spec is supported, see the [`GbnfJsonSchema` type](/api/type-aliases/GbnfJsonSchema).

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

## Creating your own grammar
To create your own grammar, read the [GBNF guide](https://github.com/ggerganov/llama.cpp/blob/f5fe98d11bdf9e7797bcfb05c0c3601ffc4b9d26/grammars/README.md) to create a GBNF grammar file.

To use your custom grammar file, load it into a [`LlamaGrammar`](/api/classes/LlamaGrammar) object:
```typescript
import {fileURLToPath} from "url";
import path from "path";
import fs from "fs/promises";
import {LlamaModel, LlamaGrammar, LlamaContext, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const myGrammar = await fs.readFile(path.join(__dirname, "my-json-grammar.gbnf"), "utf-8");

const model = new LlamaModel({
    modelPath: path.join(__dirname, "models", "codellama-13b.Q3_K_M.gguf")
})
const grammar = new LlamaGrammar({
    grammar: myGrammar
});
const context = new LlamaContext({
    model
});
const session = new LlamaChatSession({context});


const q1 = 'Create a JSON that contains a message saying "hi there"';
console.log("User: " + q1);

const a1 = await session.prompt(q1, {grammar, maxTokens: context.getContextSize()});
console.log("AI: " + a1);
console.log(JSON.parse(a1));


const q2 = 'Add another field to the JSON with the key being "author" and the value being "Llama"';
console.log("User: " + q2);

const a2 = await session.prompt(q2, {grammar, maxTokens: context.getContextSize()});
console.log("AI: " + a2);
console.log(JSON.parse(a2));
```

## Grammar generation libraries
There are some useful libraries you can use to generate GBNF grammars to [load into a `LlamaGrammar` object](#creating-your-own-grammar):
* **gbnfgen ([GitHub](https://github.com/IntrinsicLabsAI/gbnfgen) | [npm](https://www.npmjs.com/package/@intrinsicai/gbnfgen))** - Generate GBNF grammar to output JSON files based on TypeScript interfaces and enums.

> If you're the creator of a library that generates GBNF grammars, or you find such library, you're encouraged to open a PR to add it to this list
