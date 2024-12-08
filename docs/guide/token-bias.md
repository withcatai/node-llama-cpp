---
description: Using token bias to adjust the probabilities of tokens in the generated response
---
# Using Token Bias {#title}
## Background {#background}
To feed text into a language model,
we use its tokenizer to convert the text into tokens that the model can understand (tokenizing text),
and the model generates tokens that we can convert back into text (detokenizing tokens).

Every model has its own vocabulary, which is a mapping between text and tokens, that it used by the tokenizer for tokenization and detokenization.

The model can only be fed with text that can be converted into tokens using its vocabulary.

When we generate text using a language model,
the model tells us the probability for each of the tokens in the vocabulary to be the next token for the generated text.
We then can apply our own heuristics to choose the next token based on those probabilities (like [`temperature`](../api/type-aliases/LLamaChatPromptOptions.md#temperature), for example).

We can also apply a token bias heuristics to change the probabilities of specific tokens to be the next token for the generated text.

## Using Token Bias {#using-token-bias}
Here is an example of how we can use [`TokenBias`](../api/classes/TokenBias.md) to lower the probability the model will
generate tokens that contain the text `hello`,
and also apply biases to some other tokens:
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession, TokenBias} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});

const customBias = new TokenBias(model.tokenizer);

// iterate over all the tokens in the vocabulary
for (const token of model.iterateAllTokens()) {
    const text = model.detokenize([token]);

    if (text.toLowerCase().includes("hello"))
        // reduce the probability of this token by 90%
        customBias.set(token, -0.9);
    else if (text.toLowerCase().includes("hi"))
        // make sure this token is never generated
        customBias.set(token, "never");
    else if (text.toLowerCase().includes("best"))
        // increase the probability of this token by 20%
        customBias.set(token, 0.2);
    else if (text.toLowerCase().includes("greetings"))
        // increase the logit of this token by 0.8
        customBias.set(token, {logit: 0.8});
}


const q1 = "Say hello to me";
console.log("User: " + q1);

const a1 = await session.prompt(q1, {
    tokenBias: customBias
});
console.log("AI - with bias: " + a1);


const q2 = "Say hello to me";
console.log("User: " + q2);

const a2 = await session.prompt(q2);
console.log("AI - no bias: " + a2);
```

::: tip NOTE
Even if we set a bias of `"never"` to all tokens containing the text ``hello``,
the model can still generate the text `hello` by using other tokens that are not affected by the token bias.

For example, it can generate a token that represents the text `he` and then generate another token that represents the text `llo`.
:::

::: info
If the model gave a token a probability of 0 or near 0,
even if we increase the probability of this token using a token bias,
the model may still not generate this token.

If you want to make sure the model includes specific text in its responses, it's best to instruct it to do so using a [system prompt](../guide/chat-session.md#system-prompt) together with token bias.
:::
