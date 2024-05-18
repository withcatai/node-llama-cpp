# Using `LlamaChatSession`
To chat with a text generation model, you can use the [`LlamaChatSession`](/api/classes/LlamaChatSession) class.

Here are some examples usage of [`LlamaChatSession`](/api/classes/LlamaChatSession):

## Simple chatbot
> To use a custom chat prompt wrapper, see the [chat prompt wrapper guide](./chat-prompt-wrapper.md).
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {LlamaModel, LlamaContext, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const model = new LlamaModel({
    modelPath: path.join(__dirname, "models", "codellama-13b.Q3_K_M.gguf")
});
const context = new LlamaContext({model});
const session = new LlamaChatSession({context});


const q1 = "Hi there, how are you?";
console.log("User: " + q1);

const a1 = await session.prompt(q1);
console.log("AI: " + a1);


const q2 = "Summarize what you said";
console.log("User: " + q2);

const a2 = await session.prompt(q2);
console.log("AI: " + a2);
```

## Different chat prompt wrapper
To learn more about chat prompt wrappers, see the [chat prompt wrapper guide](./chat-prompt-wrapper.md).
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {
    LlamaModel, LlamaContext, LlamaChatSession, Llama3ChatWrapper
} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const model = new LlamaModel({
    modelPath: path.join(__dirname, "models", "codellama-13b.Q3_K_M.gguf"),
    chatWrapper: new Llama3ChatWrapper()
});
const context = new LlamaContext({model});
const session = new LlamaChatSession({context});


const q1 = "Hi there, how are you?";
console.log("User: " + q1);

const a1 = await session.prompt(q1);
console.log("AI: " + a1);


const q2 = "Summarize what you said";
console.log("User: " + q2);

const a2 = await session.prompt(q2);
console.log("AI: " + a2);
```

## Response streaming
You can see all the possible parameters of the `prompt` function [here](/api/classes/LlamaChatSession#prompt).
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
const session = new LlamaChatSession({context});


const q1 = "Hi there, how are you?";
console.log("User: " + q1);

process.stdout.write("AI: ");
const a1 = await session.prompt(q1, {
    onToken(chunk: Token[]) {
        process.stdout.write(context.decode(chunk));
    }
});
```

## Repeat penalty customization
You can see all the possible parameters of the `prompt` function [here](/api/classes/LlamaChatSession#prompt).
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
const session = new LlamaChatSession({
    context
});


const q1 = "Write a poem about llamas";
console.log("User: " + q1);

const a1 = await session.prompt(q1, {
    repeatPenalty: {
        lastTokens: 24,
        penalty: 1.12,
        penalizeNewLine: true,
        frequencyPenalty: 0.02,
        presencePenalty: 0.02,
        punishTokensFilter(tokens: Token[]) {
            // allow the model to repeat the tokens that make up
            // the words "Better" and "better"
            const BetterTokens = Array.from(context.encode("Better"));
            const betterTokens = Array.from(context.encode("better"));
            const allowedTokens = new Set([
                ...BetterTokens, ...betterTokens
            ]);

            return tokens.filter(token => !allowedTokens.has(token));
        }
    }
});
console.log("AI: " + a1);
```

## Custom temperature
You can see the description of the parameters of the `prompt` function [here](/api/classes/LlamaChatSession#prompt).
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {LlamaModel, LlamaContext, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const model = new LlamaModel({
    modelPath: path.join(__dirname, "models", "codellama-13b.Q3_K_M.gguf")
});
const context = new LlamaContext({model});
const session = new LlamaChatSession({context});


const q1 = "Hi there, how are you?";
console.log("User: " + q1);

const a1 = await session.prompt(q1, {
    temperature: 0.8,
    topK: 40,
    topP: 0.02
});
console.log("AI: " + a1);
```

## JSON response
To learn more about grammars, see the [grammar guide](./grammar.md).
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {
    LlamaModel, LlamaGrammar, LlamaContext, LlamaChatSession
} from "node-llama-cpp";

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

const a1 = await session.prompt(q1, {
    grammar,
    maxTokens: context.getContextSize()
});
console.log("AI: " + a1);
console.log(JSON.parse(a1));


const q2 = 'Add another field to the JSON with the key being "author" ' +
    'and the value being "Llama"';
console.log("User: " + q2);

const a2 = await session.prompt(q2, {
    grammar,
    maxTokens: context.getContextSize()
});
console.log("AI: " + a2);
console.log(JSON.parse(a2));
```

## JSON response with schema
To learn more about the JSON schema grammar, see the [grammar guide](./grammar.md#using-a-json-schema-grammar).
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
