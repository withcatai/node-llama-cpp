---
outline: [2, 3]
description: Objects lifecycle in node-llama-cpp
---
# Objects Lifecycle
Every object in `node-llama-cpp` has a ` .dispose()` function you can call to free up its resources.

Calling the `.dispose()` function on an object also disposes all of its dependant objects.

For example, calling [`.dispose()`](../api/classes/LlamaModel.md#dispose) on a model automatically disposes all of its contexts:
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(
    fileURLToPath(import.meta.url)
);
const modelPath = path.join(__dirname, "my-model.gguf");

// ---cut---
const llama = await getLlama();
const model = await llama.loadModel({modelPath});
const context = await model.createContext();

await model.dispose();
console.log("Context disposed:", context.disposed); // true
```
> You cannot use a disposed object after disposing it.
> 
> Attempting to create a context from a disposed model will throw a `DisposedError`,
> attempting to evaluate input on a disposed context sequence will also throw a `DisposedError`, etc.

To automatically dispose an object when it goes out of scope, you can use [`await using` in TypeScript](https://devblogs.microsoft.com/typescript/announcing-typescript-5-2/#using-declarations-and-explicit-resource-management) (TypeScript 5.2 or later):

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession, LlamaContext} from "node-llama-cpp";

const __dirname = path.dirname(
    fileURLToPath(import.meta.url)
);
const modelPath = path.join(__dirname, "my-model.gguf");

// ---cut---
const llama = await getLlama();
let context: LlamaContext | undefined;

async function doThings() {
    await using model = await llama.loadModel({modelPath});
    context = await model.createContext();
}

await doThings();

// the model is disposed when the `doThings` function is done,
// and so are its contexts
console.log("Context disposed:", context?.disposed); // true
```

## Garbage Collection
If you forget to dispose an object, it will automatically be disposed when the garbage collector runs.

It's best to dispose objects yourself to free up resources as soon as you're done with them, so you can allocate new resources sooner when needed.
Disposing objects yourself can make a big difference in what you can do with the resources you have available, especially since models and contexts use a lot of VRAM.

## Llama Instances
Every call to [`getLlama`](../api/functions/getLlama.md) creates a new instance of [`Llama`](../api/classes/Llama.md) that allocates its own resources,
so it's best to create a single instance and reuse it throughout your entire application.

You can do so by creating a `llama.ts` file and exporting the instance from there:
::: code-group
```typescript [<code>llama.ts</code>]
import {getLlama} from "node-llama-cpp";
export const llama = await getLlama();// [!code highlight]
```
```typescript [<code>index.ts</code>]
// @filename: llama.ts
import {getLlama} from "node-llama-cpp";
export const llama = await getLlama();

// @filename: index.ts
// ---cut---
import {fileURLToPath} from "url";
import path from "path";
import {llama} from "./llama.js";// [!code highlight]

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelPath = path.join(__dirname, "my-model.gguf");

const model = await llama.loadModel({modelPath});
```
```typescript [<code>vram.ts</code>]
// @filename: llama.ts
import {getLlama} from "node-llama-cpp";
export const llama = await getLlama();

// @filename: memory.ts
// ---cut---
import {llama} from "./llama.js";// [!code highlight]

export async function logVramState() {
    const vramState = await llama.getVramState();
    
    console.log("Used VRAM:", vramState.used);
    console.log("Free VRAM:", vramState.free);
}
```
:::

## Reusing Existing Context Sequence State
When prompting a model using [`LlamaChatSession`](../api/classes/LlamaChatSession.md) or [`LlamaChat`](../api/classes/LlamaChat.md),
it attempts to use the existing context sequence state as much as possible to avoid redundant evaluations,
but when needed, it'll flush irrelevant parts of the state (or all of it) to perform the requested evaluation.

You can reuse a context sequence for a new [`LlamaChatSession`](../api/classes/LlamaChatSession.md) or [`LlamaChat`](../api/classes/LlamaChat.md)
without worrying about data leakage between different chat sessions.

You'll probably want to do so to utilize the existing state for faster evaluation using the new chat,
since the preamble system prompt and other chat history items may have already been evaluated in the existing context sequence,
so reusing the context sequence for a new chat will allow it to automatically continue evaluation from the first difference in the existing state,
thus reducing the time needed to start generating output.

::: warning
It's important to make sure you don't use the same context sequence for multiple chats _at the same time_,
as it'll cause the chats to compete for the same resources and may lead to unexpected results.

Always make sure you're done with the existing chat before reusing the context sequence for a new chat.
:::

## Objects Relationship
### [`Llama`](../api/classes/Llama.md)
The main class returned by the [`getLlama()`](../api/functions/getLlama.md) method that provides access to `llama.cpp` APIs as well as additional native APIs.

### [`LlamaModel`](../api/classes/LlamaModel.md)
A model loaded using the [`.loadModel()`](../api/classes/Llama.md#loadmodel) method of a [`Llama`](../api/classes/Llama.md) instance.

### [`LlamaContext`](../api/classes/LlamaContext.md)
A context created using the [`.createContext()`](../api/classes/LlamaModel.md#createcontext) method of a [`LlamaModel`](../api/classes/LlamaModel.md) instance.

A context can hold [multiple context sequences](./batching.md).

Having multiple context sequences is more efficient and performant than creating multiple contexts, and allows using [batching](./batching.md).

### [`LlamaContextSequence`](../api/classes/LlamaContextSequence.md)
A context sequence created using the [`.createContextSequence()`](../api/classes/LlamaContext.md#createcontextsequence) method of a [`LlamaContext`](../api/classes/LlamaContext.md) instance.

A context sequence holds a state ([usually tokens](../api/classes/LlamaContextSequence.md#contexttokens)) of the conversation and is used to generate completions and evaluate inputs.

All context sequences are independent of each other and do not share data between them.

### [`LlamaChatSession`](../api/classes/LlamaChatSession.md)
A chat session created with a [`LlamaContextSequence`](../api/classes/LlamaContextSequence.md) instance.

A chat session is used to prompt a model with a conversation history and generate responses.

The existing state of the context sequence will be overridden if it cannot be reused for the chat session.
You don't need to provide a clean context sequence for a [`LlamaChatSession`](../api/classes/LlamaChatSession.md) to work as expected.
