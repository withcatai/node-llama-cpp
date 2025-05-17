---
outline: deep
description: Learn how to use the low-level API of node-llama-cpp
---
# Low Level API
`node-llama-cpp` provides high-level APIs for the most common use cases to make it easy to use.
However, it also provides low-level APIs for more advanced use cases.

There are various low-level APIs that you can use - the more high level you can go, the more optimizations and features you can leverage. 

## Background {#background}
Before you can use the low-level API, here are a few concepts you should be familiar with:

### Context Sequence {#context-sequence}
A [`LlamaContextSequence`](../api/classes/LlamaContextSequence.md) is an isolated component that holds an inference state.

The state is constructed from tokens you evaluate to "append" to the state, and you can access the current state tokens using [`.contextTokens`](../api/classes/LlamaContextSequence.md#contexttokens).

When evaluating input (tokens) onto a context sequence, you can choose to generate a "next token" for each of the input tokens you evaluate.
When choosing to generate a "next token" for a given token,
the model will "see" all the tokens up to it (input tokens and the current context sequence state tokens),
and the generated token will be in the generation result you get from the API and won't be appended to the context sequence state.

### Probabilities List {#probabilities-list}
When generating a token, the model actually generates a list of probabilities for each token in the vocabulary to be the next token.

It then uses the probabilities to choose the next token based on the heuristics you provide (like [`temperature`](../api/type-aliases/SequenceEvaluateOptions#temperature), for example).

The operation of applying such heuristics to choose the next token is also called _sampling_.

When you pass sampling options (like [`temperature`](../api/type-aliases/SequenceEvaluateOptions#temperature), for example) for the generation of a token,
it may make adjustments to the probabilities list so it can choose the next token based on the heuristics you provide.

The sampling is done on the native side of `node-llama-cpp` for performance reasons.
However, you can still opt to get the full probabilities list after the sampling is done,
and you can pass no sampling options to avoid making any adjustments to the probabilities list.

It's best to avoid getting the full probabilities list unless you really need it,
as passing it to the JavaScript side can be slow.

### Context Shift {#context-shift}
When the context sequence is full and you want to evaluate more tokens onto it,
some tokens will have to be removed to make room for new ones to be added.

Ideally, you'd want to do that on your logic level, so you can control which content to keep and which to remove.
> All the high-level APIs of `node-llama-cpp` [automatically do that](./chat-context-shift.md).

If you don't do that, `node-llama-cpp` will automatically remove the oldest tokens from the context sequence state to make room for new ones.

You can customize the context shift strategy `node-llama-cpp` uses for the context sequence by configuring the [`contextShift`](../api/classes/LlamaContext.md#parameters) option when calling [`.getSequence(...)`](../api/classes/LlamaContext.md#getsequence),
or by passing a customized the [`contextShift`](../api/type-aliases/SequenceEvaluateOptions#contextshift) option to the evaluation method you use.

## Simple Evaluation {#simple-evaluation}
You can evaluate the given input tokens onto a context sequence using [`.evaluate(...)`](../api/classes/LlamaContextSequence.md#evaluate)
and generate the next token for the last input token.

On each iteration of the returned iterator, the generated token is then added to the context sequence state and the next token is generated for it, and so on.

When using [`.evaluate(...)`](../api/classes/LlamaContextSequence.md#evaluate), the configured [token predictor](./token-prediction.md) is used to speed up the generation process.

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, Token, SequenceEvaluateOptions} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const sequence = context.getSequence();

const input = "The best way to";
const tokens = model.tokenize(input);
const maxTokens = 10;
const res: Token[] = [];
const options: SequenceEvaluateOptions = {
    temperature: 0.8
};

for await (const generatedToken of sequence.evaluate(tokens, options)) {
    res.push(generatedToken);
    if (res.length >= maxTokens)
        break;
}

const resText = model.detokenize(res);
console.log("Result: " + resText);
```
> For generating text completion, it's better to use [`LlamaCompletion`](./text-completion.md) instead of manually evaluating input,
> since it supports all models, and provides many more features and optimizations

### Replacement Token(s) {#replacement-tokens}
You can manually iterate over the evaluation iterator and provide a replacement to the generated token.
You you provide a replacement token(s), it'll be appended to the context sequence state instead of the generated token.

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, Token, SequenceEvaluateOptions} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const sequence = context.getSequence();

const input = "The best way to";
const tokens = model.tokenize(input);
const options: SequenceEvaluateOptions = {
    temperature: 0.8
};
const maxTokens = 10;
const res: Token[] = [];

// fill this with tokens to replace
const replacementMap = new Map<Token, Token>();

const iterator = sequence.evaluate(tokens, options);
let replacementToken: Token | undefined;

while (true) {
    const {value: token, done} = await iterator.next(replacementToken);
    replacementToken = undefined;
    if (done || token == null)
        break;

    replacementToken = replacementMap.get(token);

    res.push(replacementToken ?? token);
    if (res.length >= maxTokens)
        break;
}

const resText = model.detokenize(res);
console.log("Result: " + resText);
```
> If you want to adjust the token probabilities when generating output, consider using [token bias](./token-bias.md) instead

### With Metadata {#evaluation-with-metadata}
You can use [`.evaluateWithMetadata(...)`](../api/classes/LlamaContextSequence.md#evaluatewithmetadata) to evaluate tokens onto the context sequence state like [`.evaluate(...)`](#simple-evaluation), but with metadata emitted for each token.

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, Token, SequenceEvaluateOptions} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const sequence = context.getSequence();

const input = "The best way to";
const tokens = model.tokenize(input);
const maxTokens = 10;
const res: Array<{
    token: Token,
    confidence: number,
    probabilities: Map<Token, number>
}> = [];
const metadataOptions = {
    // configure which metadata should be returned
    confidence: true,
    probabilities: true
} as const;
const options: SequenceEvaluateOptions = {
    temperature: 0.8
};

const iterator = sequence.evaluateWithMetadata(
    tokens,
    metadataOptions,
    options
);
for await (const item of iterator) {
    res.push({
        token: item.token,
        confidence: item.confidence,
        probabilities: new Map(
            // only keep the top 5 probabilities
            [...item.probabilities.entries()].slice(0, 5)
        )
    });

    if (res.length >= maxTokens)
        break;
}

const resText = model.detokenize(res.map(({token}) => token));
console.log("Result: " + resText);
console.log("With metadata:", res);
```

### No Generation {#evaluation-without-generation}
To evaluate the input tokens onto a context sequence without generating new tokens,
you can use [`.evaluateWithoutGeneratingNewTokens(...)`](../api/classes/LlamaContextSequence.md#evaluatewithoutgeneratingnewtokens).

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const sequence = context.getSequence();

const input = "The best way to";
const tokens = model.tokenize(input);
await sequence.evaluateWithoutGeneratingNewTokens(tokens);
```

## Controlled Evaluation {#controlled-evaluation}
To manually control for which of the input tokens to generate output,
you can use [`.controlledEvaluate(...)`](../api/classes/LlamaContextSequence.md#controlledevaluate).

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, Token, ControlledEvaluateInputItem} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const sequence = context.getSequence();

const input = "The best way to";
const tokens = model.tokenize(input);
const evaluateInput: ControlledEvaluateInputItem[] = tokens.slice();

// generate output for the last token only
const lastToken = evaluateInput.pop() as Token;
if (lastToken != null)
    evaluateInput.push([lastToken, {
        generateNext: {
            token: true,
            probabilities: true,
            options: {
                temperature: 0.8
            }
        }
    }])

const res = await sequence.controlledEvaluate(evaluateInput);
const lastTokenResult = res[evaluateInput.length - 1];
if (lastTokenResult != null) {
    const {next} = lastTokenResult;

    if (next.token != null)
        console.log(
            "next token",
            next.token,
            model.detokenize([next.token], true)
        );

    if (next.probabilities != null)
        console.log(
            "next probabilities",
            [...next.probabilities.entries()]
                .slice(0, 5) // top 5 probabilities
                .map(([token, probability]) => (
                    [model.detokenize([token], true), probability]
                ))
        );
    
    // next: evalute `next.token` onto the context sequence
    // and generate the next token for it
}
```

## State Manipulation {#state-manipulation}
You can manipulate the context sequence state by erasing tokens from it or shifting tokens in it.

Make sure that you don't attempt to manipulate the state while waiting for a generation result from an evaluation operation,
as it may lead to unexpected results.

### Erase State Ranges {#erase-state-ranges}
To erase a range of tokens from the context sequence state,
you can use [`.eraseContextTokenRanges(...)`](../api/classes/LlamaContextSequence.md#erasecontexttokenranges).

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const sequence = context.getSequence();

const input = "The best way to";
const tokens = model.tokenize(input);
await sequence.evaluateWithoutGeneratingNewTokens(tokens);

console.log(
    "Current state:",
    model.detokenize(sequence.contextTokens, true),
    sequence.contextTokens
);

// erase the last token from the state
if (sequence.nextTokenIndex > 0)
    await sequence.eraseContextTokenRanges([{
        start: sequence.nextTokenIndex - 1,
        end: sequence.nextTokenIndex
    }]);

console.log(
    "Current state:",
    model.detokenize(sequence.contextTokens, true),
    sequence.contextTokens
);
```

### Adapt State to Tokens {#adapt-state-to-tokens}
You can adapt the existing context state to a new input to avoid re-evaluating some of the tokens you've already evaluated.

::: tip NOTE
All the high-level APIs provided by `node-llama-cpp` automatically do this to improve efficiency and performance.
:::

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const sequence = context.getSequence();

const input = "The best way to";
const tokens = model.tokenize(input);
await sequence.evaluateWithoutGeneratingNewTokens(tokens);

console.log(
    "Current state:",
    model.detokenize(sequence.contextTokens, true),
    sequence.contextTokens
);

const newInput = "The best method to";
const newTokens = model.tokenize(newInput);

// only align the current state if the length
// of the new tokens won't incur a context shift
if (newTokens.length < sequence.contextSize && newTokens.length > 0) {
    // ensure we have at least one token to evalute
    const lastToken = newTokens.pop()!;

    await sequence.adaptStateToTokens(newTokens);
    newTokens.push(lastToken);

    // remove the tokens that already exist in the state
    newTokens.splice(0, sequence.nextTokenIndex)
}

console.log(
    "Current state:",
    model.detokenize(sequence.contextTokens, true),
    sequence.contextTokens
);
console.log(
    "New tokens:",
    model.detokenize(newTokens, true),
    newTokens
);
```

### Save and Restore State {#save-and-restore-state}
You can save the evaluation state of a context sequence to then later load it back.

This is useful for avoiding the evaluation of tokens that you've already evaluated in the past.

::: warning
When loading a context sequence state from a file,
always ensure that the model used to create the context sequence is exactly the same as the one used to save the state file.

Loading a state file created from a different model can crash the process,
thus you have to pass `{acceptRisk: true}` to the [`loadStateFromFile`](../api/classes/LlamaContextSequence.md#loadstatefromfile) method to use it.

Use with caution.
:::

::: code-group
```typescript [Save state]
import {fileURLToPath} from "url";
import path from "path";
import {getLlama} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const sequence = context.getSequence();

const input = "The best way to";
const tokens = model.tokenize(input);
await sequence.evaluateWithoutGeneratingNewTokens(tokens);

console.log(
    "Current state:",
    model.detokenize(sequence.contextTokens, true),
    sequence.contextTokens
);

await sequence.saveStateToFile("state.bin");// [!code highlight]
```
:::

::: code-group
```typescript [Load state]
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, Token} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// ---cut---
const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const sequence = context.getSequence();

await sequence.loadStateFromFile("state.bin", {acceptRisk: true});// [!code highlight]

console.log(
    "Loaded state:",
    model.detokenize(sequence.contextTokens, true),
    sequence.contextTokens
);

const input = " find";
const inputTokens = model.tokenize(input);
const maxTokens = 10;
const res: Token[] = [];
for await (const token of sequence.evaluate(inputTokens)) {
    res.push(token);

    if (res.length >= maxTokens)
        break;
}

console.log("Result:", model.detokenize(res));
```
:::
