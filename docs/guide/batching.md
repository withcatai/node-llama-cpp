---
description: Using batching in node-llama-cpp
---
# Using Batching
> Batching is the process of grouping multiple input sequences together to be processed simultaneously,
> which improves computational efficiently and reduces overall inference times.
> 
> This is useful when you have a large number of inputs to evaluate and want to speed up the process.

When evaluating inputs on multiple context sequences in parallel, batching is automatically used.

To create a context that has multiple context sequences, you can set the [`sequences`](../api/type-aliases/LlamaContextOptions.md#sequences) option when creating a context.

Here's an example of how to process 2 inputs in parallel, utilizing batching:
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelPath = path.join(__dirname, "my-model.gguf")

// ---cut---
const llama = await getLlama();
const model = await llama.loadModel({modelPath});
const context = await model.createContext({
    sequences: 2
});

const sequence1 = context.getSequence();
const sequence2 = context.getSequence();

const session1 = new LlamaChatSession({
    contextSequence: sequence1
});
const session2 = new LlamaChatSession({
    contextSequence: sequence2
});

const q1 = "Hi there, how are you?";
const q2 = "How much is 6+6?";

const [
    a1,
    a2
] = await Promise.all([
    session1.prompt(q1),
    session2.prompt(q2)
]);

console.log("User: " + q1);
console.log("AI: " + a1);

console.log("User: " + q2);
console.log("AI: " + a2);
```
::: info
Since multiple context sequences are processed in parallel, aborting the evaluation of one of them will only cancel the next evaluations of that sequence, and the existing batched evaluation will continue.

For clarification, when aborting a response on a chat session, the response will stop only after the next token finishes being generated; the rest of the response after that token will not be generated.
:::

::: info Custom [`batchSize`](../api/type-aliases/LlamaContextOptions.md#batchsize)
You can set the [`batchSize`](../api/type-aliases/LlamaContextOptions.md#batchsize) option when creating a context to change the maximum number of tokens that can be processed in parallel.

Note that a larger [`batchSize`](../api/type-aliases/LlamaContextOptions.md#batchsize) will require more memory and may slow down inference if the GPU is not powerful enough to handle it.
:::
