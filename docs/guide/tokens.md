---
description: The basics of working with tokens in node-llama-cpp
---
# Using Tokens
`node-llama-cpp` provides you with a high-level API that abstracts dealing with tokens,
so you may not even encounter a scenario where you have to deal with tokens directly.

However, `node-llama-cpp` provides you flexibility to work with tokens directly if you need to.

## Background
The way we interact with a model is by using tokens.
A token is a number that represents a piece of text or a special function.
A token can be as small as a single character or as large as a word or a subword.

To convert text to tokens, we use the tokenizer of the model we're working with.

The tokenizer has a vocabulary that maps between text and tokens.
When we tokenize text, we get a list of tokens that represent the text.
When we detokenize tokens, we get the original text back.

Let's see what that tokenizing text looks like, using [this model](https://huggingface.co/mradermacher/Meta-Llama-3-8B-Instruct-GGUF/blob/main/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf):
```typescript
import {getLlama} from "node-llama-cpp";

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: "Meta-Llama-3-8B-Instruct.Q4_K_M.gguf"
});

const text = "Hi there";

const tokens = model.tokenize(text);
const tokenTexts = tokens.map((token) => model.detokenize([token]));
const originalText = model.detokenize(tokens);

console.log(tokens); // [13347, 1070]
console.log(tokenTexts); // ["Hi", " there"]
console.log(originalText); // "Hi there"
```

> The tokenization and detokenization processed are not compute-intensive and don't use the GPU.

As you can see, the text `Hi there` is tokenized into two tokens: `13347` and `1070`.
When we detokenized these tokens, we got the original text back.

When you create a context from a model (using [`.createContext(...)`](../api/classes/LlamaModel#createcontext)),
that context has a [context size](../api/type-aliases/LlamaEmbeddingContextOptions#contextsize), which is the number of tokens that it can hold.

The maximum context size depends on the context size used during the training of the model.
`node-llama-cpp` attempts to use the maximum context size possible by default.

To generate output, we put tokens into the context let the model generate completion for it.
The completion is also an array of tokens, which we can detokenize to get the generated text.


## Special Tokens
Special tokens are tokens that are used to provide specific instructions or context to the language model,
such as marking the beginning or end of a sequence, separating different segments of text,
or denoting special functions.

A user should not see these tokens, and is not supposed to be able to type them.

Special tokens may have a text representation we can use to tokenize them when we enable the special tokens mode.

For example, [this model](https://huggingface.co/mradermacher/Meta-Llama-3-8B-Instruct-GGUF/blob/main/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf)
has a special token with the `<|begin_of_text|>` text representation.
This token is a BOS (Beginning Of Sequence) token that is supposed to mark the beginning of a sequence.

To tokenize it as a special token, we can do this:
```typescript
import {getLlama} from "node-llama-cpp";

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: "Meta-Llama-3-8B-Instruct.Q4_K_M.gguf"
});

const tokens = model.tokenize("<|begin_of_text|>", true);
console.log(tokens); // [128000]
```
Note that we enabled the special tokens mode by passing `true` as the second argument to the [`.tokenize(...)`](../api/classes/LlamaModel.md#tokenize) function.

If we pass this token to the model, that model will know that this is the beginning of a sequence.

Let's see what happens when we tokenize this same text without special tokens mode:
```typescript
import {getLlama} from "node-llama-cpp";

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: "Meta-Llama-3-8B-Instruct.Q4_K_M.gguf"
});

const tokens = model.tokenize("<|begin_of_text|>");
const tokenTexts = tokens.map((token) => model.detokenize([token]));
console.log(tokens); // [27, 91, 7413, 3659, 4424, 91, 29]
console.log(tokenTexts); // ["<", "|", "begin", "_of", "_text", "|", ">"]
```

As you can see, the text is tokenized into multiple tokens, so the model will "see" this as the text representation of `<|begin_of_text|>` and not as the start of a sequence.

::: tip
To tokenize text that consists of text received from a user together with special tokens, see the [LlamaText guide](./llama-text.md) to tokenize it in a safe and readable manner.
:::


## Builtin Special Tokens
Common special tokens can be used without having to know their text representation in the model you use.

For example, this is how you can use the BOS (Beginning Of Sequence) token of a model without knowing its text representation:
```typescript
import {getLlama} from "node-llama-cpp";

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: "Meta-Llama-3-8B-Instruct.Q4_K_M.gguf"
});

console.log(model.tokens.bos);
```

## Track Token Usage
You can track the usage of tokens by a context sequence using the [`.tokenMeter`](../api/classes/LlamaContextSequence.md#tokenmeter) property of a context sequence.

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
const contextSequence = context.getSequence();

console.log("evaluated tokens", contextSequence.tokenMeter.usedInputTokens)
console.log("generated tokens", contextSequence.tokenMeter.usedOutputTokens)
```
