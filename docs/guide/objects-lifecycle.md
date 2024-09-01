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
