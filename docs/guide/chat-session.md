---
description: Chatting with a text generation model
---
# Using `LlamaChatSession`
To chat with a text generation model, you can use the [`LlamaChatSession`](../api/classes/LlamaChatSession.md) class.

Here are usage examples of [`LlamaChatSession`](../api/classes/LlamaChatSession.md):

## Simple Chatbot {#simple-chatbot}
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf")
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

## Specific Chat Wrapper {#specific-chat-wrapper}
To learn more about chat wrappers, see the [chat wrapper guide](./chat-wrapper).
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession, GeneralChatWrapper} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
    chatWrapper: new GeneralChatWrapper()
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

## Response Streaming {#response-streaming}
You can see all the possible options of the [`prompt`](../api/classes/LlamaChatSession.md#prompt) function [here](../api/type-aliases/LLamaChatPromptOptions.md).
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});


const q1 = "Hi there, how are you?";
console.log("User: " + q1);

process.stdout.write("AI: ");
const a1 = await session.prompt(q1, {
    onTextChunk(chunk: string) {
        process.stdout.write(chunk);
    }
});
```

> To stream `thought` segment, see [Stream Response Segments](#stream-response-segments)

## Repeat Penalty Customization {#repeat-penalty}
You can see all the possible options of the [`prompt`](../api/classes/LlamaChatSession.md#prompt) function [here](../api/type-aliases/LLamaChatPromptOptions.md).
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession, Token} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
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
            return tokens.filter(token => {
                const text = model.detokenize([token]);

                // allow the model to repeat tokens
                // that contain the word "better"
                return !text.toLowerCase().includes("better");
            });
        }
    }
});
console.log("AI: " + a1);

```

## Custom Temperature {#temperature}
Setting the [`temperature`](../api/type-aliases/LLamaChatPromptOptions#temperature) option is useful for controlling the randomness of the model's responses.

A temperature of `0` (the default) will ensure the model response is always deterministic for a given prompt.

The randomness of the temperature can be controlled by the [`seed`](../api/type-aliases/LLamaChatPromptOptions.md#seed) parameter.
Setting a specific [`seed`](../api/type-aliases/LLamaChatPromptOptions.md#seed) and a specific [`temperature`](../api/type-aliases/LLamaChatPromptOptions#temperature) will yield the same response every time for the same input.

You can see the description of the [`prompt`](../api/classes/LlamaChatSession.md#prompt) function options [here](../api/type-aliases/LLamaChatPromptOptions.md).
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});


const q1 = "Hi there, how are you?";
console.log("User: " + q1);

const a1 = await session.prompt(q1, {
    temperature: 0.8,
    topK: 40,
    topP: 0.02,
    seed: 2462
});
console.log("AI: " + a1);
```

## JSON Response {#json-response}
To learn more about grammars, see the [grammar guide](./grammar.md).
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf")
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

## JSON Response With a Schema {#response-json-schema}
To learn more about the JSON schema grammar, see the [grammar guide](./grammar.md#using-a-json-schema-grammar).
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(
    fileURLToPath(import.meta.url)
);

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf")
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


## Function Calling {#function-calling}
To learn more about using function calling, read the [function calling guide](./function-calling.md).

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession, defineChatSessionFunction} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf")
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

## Customizing the System Prompt {#system-prompt}
::: info What is a system prompt?
A system prompt is a text that guides the model towards the kind of responses we want it to generate.

It's recommended to explain to the model how to behave in certain situations you care about,
and to tell it to not make up information if it doesn't know something.
:::

Here is an example of how to customize the system prompt:
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
    systemPrompt: "You are a helpful, respectful and honest botanist. " +
        "Always answer as helpfully as possible.\n" +
        
        "If a question does not make any sense or is not factually coherent," +
        "explain why instead of answering something incorrectly.\n" +
        
        "Attempt to include nature facts that you know in your answers.\n" + 
        
        "If you don't know the answer to a question, " +
        "don't share false information."
});


const q1 = "What is the tallest tree in the world?";
console.log("User: " + q1);

const a1 = await session.prompt(q1);
console.log("AI: " + a1);
```

## Saving and Restoring a Chat Session {#save-and-restore}
::: code-group
```typescript [Save chat history]
import {fileURLToPath} from "url";
import path from "path";
import fs from "fs/promises";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});


const q1 = "Hi there, how are you?";
console.log("User: " + q1);

const a1 = await session.prompt(q1);
console.log("AI: " + a1);

const chatHistory = session.getChatHistory();// [!code highlight]
await fs.writeFile("chatHistory.json", JSON.stringify(chatHistory), "utf8");// [!code highlight]
```
:::

::: code-group
```typescript [Restore chat history]
import {fileURLToPath} from "url";
import path from "path";
import fs from "fs/promises";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// ---cut---
const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});

const chatHistory = JSON.parse(await fs.readFile("chatHistory.json", "utf8"));// [!code highlight]
session.setChatHistory(chatHistory);// [!code highlight]

const q2 = "Summarize what you said";
console.log("User: " + q2);

const a2 = await session.prompt(q2);
console.log("AI: " + a2);
```
:::

:::: details Saving and restoring a context sequence evaluation state {#save-and-restore-with-context-sequence-state}
You can also save and restore the context sequence evaluation state to avoid re-evaluating the chat history
when you load it on a new context sequence.

Please note that context sequence state files can get very large (109MB for only 1K tokens).
Using this feature is only recommended when the chat history is very long and you plan to load it often,
or when the evaluation is too slow due to hardware limitations.

::: warning
When loading a context sequence state from a file,
always ensure that the model used to create the context sequence is exactly the same as the one used to save the state file.

Loading a state file created from a different model can crash the process,
thus you have to pass `{acceptRisk: true}` to the [`loadStateFromFile`](../api/classes/LlamaContextSequence.md#loadstatefromfile) method to use it.

Use with caution.
:::

::: code-group
```typescript [Save chat history and context sequence state]
import {fileURLToPath} from "url";
import path from "path";
import fs from "fs/promises";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const contextSequence = context.getSequence();
const session = new LlamaChatSession({contextSequence});


const q1 = "Hi there, how are you?";
console.log("User: " + q1);

const a1 = await session.prompt(q1);
console.log("AI: " + a1);

const chatHistory = session.getChatHistory();// [!code highlight]
await Promise.all([// [!code highlight]
    contextSequence.saveStateToFile("state.bin"),// [!code highlight]
    fs.writeFile("chatHistory.json", JSON.stringify(chatHistory), "utf8")// [!code highlight]
]);// [!code highlight]
```
:::

::: code-group
```typescript [Restore chat history and context sequence state]
import {fileURLToPath} from "url";
import path from "path";
import fs from "fs/promises";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// ---cut---
const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const contextSequence = context.getSequence();
const session = new LlamaChatSession({contextSequence});

await contextSequence.loadStateFromFile("state.bin", {acceptRisk: true});// [!code highlight]
const chatHistory = JSON.parse(await fs.readFile("chatHistory.json", "utf8"));// [!code highlight]
session.setChatHistory(chatHistory);// [!code highlight]

const q2 = "Summarize what you said";
console.log("User: " + q2);

const a2 = await session.prompt(q2);
console.log("AI: " + a2);
```
:::

::::

## Prompt Without Updating Chat History {#prompt-without-updating-chat-history}
Prompt without saving the prompt to the chat history.

```typescript
import {fileURLToPath} from "url";
import path from "path";
import fs from "fs/promises";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});

// Save the initial chat history
const initialChatHistory = session.getChatHistory();// [!code highlight]

const q1 = "Hi there, how are you?";
console.log("User: " + q1);

const a1 = await session.prompt(q1);
console.log("AI: " + a1);

// Reset the chat history
session.setChatHistory(initialChatHistory);// [!code highlight]

const q2 = "Summarize what you said";
console.log("User: " + q2);

// This response will not be aware of the previous interaction
const a2 = await session.prompt(q2);
console.log("AI: " + a2);
```


## Preload User Prompt {#preload-prompt}
You can preload a user prompt onto the context sequence state
to make the response start being generated sooner when the final prompt is given.

This won't speed up inference if you call the [`.prompt()`](../api/classes/LlamaChatSession.md#prompt) function immediately after preloading the prompt,
but can greatly improve initial response times if you preload a prompt before the user gives it.

You can call this function with an empty string
to only preload the existing chat history onto the context sequence state.

::: tip NOTE
Preloading a long prompt can cause context shifts,
so it's recommended to limit the maximum length of the prompt you preload.
:::

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});

const prompt = "Hi there, how are you?";

console.log("Preloading prompt");
await session.preloadPrompt(prompt);

console.log("Prompt preloaded. Waiting 10 seconds");
await new Promise(resolve => setTimeout(resolve, 1000 * 10));

console.log("Generating response...");
process.stdout.write("AI: ");
const res = await session.prompt(prompt, {
    onTextChunk(text) {
        process.stdout.write(text);
    }
});

console.log("AI: " + res);
```

## Complete User Prompt {#complete-prompt}

<script setup lang="ts">
import {withBase} from "vitepress";
import {ref} from "vue";
import {
    defaultDownloadElectronExampleAppLink,
    getElectronExampleAppDownloadLink
} from "../../.vitepress/components/HomePage/utils/getElectronExampleAppDownloadLink.js";

const downloadElectronExampleAppLink = ref<string>(defaultDownloadElectronExampleAppLink);

getElectronExampleAppDownloadLink()
    .then((link) => {
        downloadElectronExampleAppLink.value = link;
    });
</script>

<div class="info custom-block" style="padding-top: 8px;">

You can try this feature in the <a target="_blank" :href="downloadElectronExampleAppLink">example Electron app</a>.
Just type a prompt and see the completion generated by the model.

</div>

You can generate a completion to a given incomplete user prompt and let the model complete it.

The advantage of doing that on the chat session is that it will use the chat history as context for the completion,
and also use the existing context sequence state, so you don't have to create another context sequence for this.

::: tip NOTE
Generating a completion to a user prompt can incur context shifts,
so it's recommended to limit the maximum number of tokens that are used for the prompt + completion.
:::
::: info
Prompting the model while a prompt completion is in progress will automatically abort the prompt completion.
:::
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});


const q1 = "Give me a recipe for a cheesecake";
console.log("User: " + q1);

process.stdout.write("AI: ");
const a1 = await session.prompt(q1, {
    onTextChunk(text) {
        process.stdout.write(text);
    }
});
console.log("AI: " + a1);

const maxTokens = 100;
const partialPrompt = "Can I replace the cream cheese with ";

const maxCompletionTokens = maxTokens - model.tokenize(partialPrompt).length;
console.log("Partial prompt: " + partialPrompt);
process.stdout.write("Completion: ");
const promptCompletion = await session.completePrompt(partialPrompt, {
    maxTokens: maxCompletionTokens,
    onTextChunk(text) {
        process.stdout.write(text);
    }
});
console.log("\nPrompt completion: " + promptCompletion);
```

## Prompt Completion Engine {#prompt-completion-engine}
If you want to complete a user prompt as the user types it in an input field,
you need a more robust prompt completion engine
that can work well with partial prompts that their completion is frequently cancelled and restarted.

The prompt completion created with [`.createPromptCompletionEngine()`](../api/classes/LlamaChatSession.md#createpromptcompletionengine)
allows you to trigger the completion of a prompt,
while utilizing existing cache to avoid redundant inference and provide fast completions.

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});

// ensure the model is fully loaded before continuing this demo
await session.preloadPrompt("");

const completionEngine = session.createPromptCompletionEngine({
    // 15 is used for demonstration only,
    // it's best to omit this option
    maxPreloadTokens: 15,
    // temperature: 0.8, // you can set custom generation options
    onGeneration(prompt, completion) {
        console.log(`Prompt: ${prompt} | Completion:${completion}`);
        // you should add a custom code here that checks whether
        // the existing input text equals to `prompt`, and if it does,
        // use `completion` as the completion of the input text.
        // this callback will be called multiple times
        // as the completion is being generated.
    }
});

completionEngine.complete("Hi the");

await new Promise(resolve => setTimeout(resolve, 1500));

completionEngine.complete("Hi there");
await new Promise(resolve => setTimeout(resolve, 1500));

completionEngine.complete("Hi there! How");
await new Promise(resolve => setTimeout(resolve, 1500));

// get an existing completion from the cache
// and begin/continue generating a completion for it
const cachedCompletion = completionEngine.complete("Hi there! How");
console.log("Cached completion:", cachedCompletion);
```

## Response Prefix {#response-prefix}
You can force the model response to start with a specific prefix,
to make the model follow a certain direction in its response.

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});


const q1 = "Hi there, how are you?";
console.log("User: " + q1);

const a1 = await session.prompt(q1, {
    responsePrefix: "The weather today is"
});
console.log("AI: " + a1);
```

## Stop Response Generation {#stop-response-generation}
To stop the generation of the current response, without removing the existing partial generation from the chat history,
you can use the [`stopOnAbortSignal`](../api/type-aliases/LLamaChatPromptOptions.md#stoponabortsignal) option
to configure what happens when the given [`signal`](../api/type-aliases/LLamaChatPromptOptions.md#signal) is aborted.

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});


const abortController = new AbortController();
const q1 = "Hi there, how are you?";
console.log("User: " + q1);

let response = "";

const a1 = await session.prompt(q1, {
    // stop the generation, instead of cancelling it
    stopOnAbortSignal: true,
    
    signal: abortController.signal,
    onTextChunk(chunk) {
        response += chunk;
        
        if (response.length >= 10)
            abortController.abort();
    }
});
console.log("AI: " + a1);
```


## Stream Response Segments {#stream-response-segments}
The raw model response is automatically segmented into different types of segments.
The main response is not segmented, but other kinds of sections,
like thoughts (chain of thought) and comments (on relevant models, like [`gpt-oss`](../blog/v3.12-gpt-oss.md#comment-segments)), are segmented.

To stream response segments you can use the [`onResponseChunk`](../api/type-aliases/LLamaChatPromptOptions.md#onresponsechunk) option.

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "DeepSeek-R1-Distill-Qwen-14B.Q4_K_M.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});


const q1 = "Hi there, how are you?";
console.log("User: " + q1);

process.stdout.write("AI: ");
const a1 = await session.promptWithMeta(q1, {
    onResponseChunk(chunk) {
        const isThoughtSegment = chunk.type === "segment" &&
            chunk.segmentType === "thought";
        const isCommentSegment = chunk.type === "segment" &&
            chunk.segmentType === "comment";
        
        if (chunk.type === "segment" && chunk.segmentStartTime != null)
            process.stdout.write(` [segment start: ${chunk.segmentType}] `);

        process.stdout.write(chunk.text);

        if (chunk.type === "segment" && chunk.segmentEndTime != null)
            process.stdout.write(` [segment end: ${chunk.segmentType}] `);
    }
});

const fullResponse = a1.response
    .map((item) => {
        if (typeof item === "string")
            return item;
        else if (item.type === "segment") {
            const isThoughtSegment = item.segmentType === "thought";
            const isCommentSegment = item.segmentType === "comment";
            let res = "";
            
            if (item.startTime != null)
                res += ` [segment start: ${item.segmentType}] `;

            res += item.text;

            if (item.endTime != null)
                res += ` [segment end: ${item.segmentType}] `;

            return res;
        }

        return "";
    })
    .join("");

console.log("Full response: " + fullResponse);
```

## Set Reasoning Budget {#reasoning-budget}
You can set a reasoning budget to limit the number of tokens a thinking model can spend on [thought segments](#stream-response-segments).
```typescript
import {
    getLlama, LlamaChatSession, resolveModelFile, Token
} from "node-llama-cpp";

const modelPath = await resolveModelFile("hf:Qwen/Qwen3-14B-GGUF:Q4_K_M");

const llama = await getLlama();
const model = await llama.loadModel({modelPath});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});


const q1 = "Where do llamas come from?";
console.log("User: " + q1);

const maxThoughtTokens = 100;

let responseTokens = 0;
let thoughtTokens = 0;

process.stdout.write("AI: ");
const response = await session.prompt(q1, {
    budgets: {
        thoughtTokens: maxThoughtTokens
    },
    onResponseChunk(chunk) {
        const isThoughtSegment = chunk.type === "segment" &&
            chunk.segmentType === "thought";

        if (chunk.type === "segment" && chunk.segmentStartTime != null)
            process.stdout.write(` [segment start: ${chunk.segmentType}] `);

        process.stdout.write(chunk.text);

        if (chunk.type === "segment" && chunk.segmentEndTime != null)
            process.stdout.write(` [segment end: ${chunk.segmentType}] `);

        if (isThoughtSegment)
            thoughtTokens += chunk.tokens.length;
        else
            responseTokens += chunk.tokens.length;
    }
});

console.log("Response: " + response);

console.log("Response tokens: " + responseTokens);
console.log("Thought tokens: " + thoughtTokens);
```
