---
description: Using token predictors to speed up the generation process in node-llama-cpp
---
# Using Token Predictors
## Background {#background}
The output generation process is an iterative process where the model generates one token at a time,
and the generated token is appended to the sequence state to generate the next token.

```js-highlight
Evaluation: [1, 2, 3] -> 4
Evaluation: [1, 2, 3, 4] -> 5
Evaluation: [1, 2, 3, 4, 5] -> 6
...
```

If your machine can handle many evaluations in parallel, and you want to speed up the generation process,
then you can use token predictors. This is also called speculative decoding.

A token predictor is a mechanism that predicts the next few tokens faster than the model can generate them,
but the predictions can be inaccurate.
We then generate the next token and validate the predictions of the tokens that follow it, all in parallel.
After the validation, we discard the incorrect predictions and use the correct ones to speed up the generation process.

Using token predictors **doesn't affect** the quality of the generated output, but it can speed up the generation process.

```js-highlight
Prediction: [1, 2, 3] -> [4, 5, 2, 7]

// All of these are evaluated in parallel
Evaluation: [1, 2, 3] -> 4 // the next token, wasn't based on prediction
Evaluation: [1, 2, 3, 4] -> 5 // ✔ correct prediction
Evaluation: [1, 2, 3, 4, 5] -> 6 // ✘ incorrect prediction
Evaluation: [1, 2, 3, 4, 5, 2] -> 3 // ✘ incorrect prediction
Evaluation: [1, 2, 3, 4, 5, 2, 7] -> 4 // ✘ incorrect prediction


Prediction: [1, 2, 3, 4, 5, 6] -> ...
```
> In this example, given the input `[1, 2, 3]`, the predictor predicted `[4, 5, 2, 7]` as the next tokens.
> 
> <br />
> 
> We then generated the next token for each of these inputs in parallel:
> `[1, 2, 3,]`, `[1, 2, 3, 4]`, `[1, 2, 3, 4, 5]`, `[1, 2, 3, 4, 5, 2]`, and `[1, 2, 3, 4, 5, 2, 7]`.
> 
> <br />
>
> The generated result for the input `[1, 2, 3]` is `4`. We generated this result without using the prediction.
>
> <br />
> 
> If we were generating the output iteratively, we would now have to evaluate the state `[1, 2, 3, 4]`
> to generate the next token, but because we had the prediction, we already evaluated this input and found
> that the next token is `5`, so we can use this result right away without any additional evaluation.
>
> <br />
> 
> Now for the state of `[1, 2, 3, 4, 5]` the generation output is `6`, which is different from the prediction `2`.
> We discard this prediction and the following ones and clear them from the context sequence state,
> and continue the generation process as usual.
>
> <br />
> 
> We will now have to evaluate the state `[1, 2, 3, 4, 5, 6]` to generate the next token,
> and we can use token predictions again to speed up the process.

The token predictors run in parallel to the regular evaluation process, so if the prediction takes longer than the evaluation,
it will just be discarded and the regular evaluation process will continue.

::: tip NOTE
If the predictor is too resource intensive, it can slow down the generation process due to the overhead of running the predictor.

It's recommended to test resource intensive token predictors on the machine you plan to run them on to see if they provide a speedup.
:::


## Draft Model Token Predictor {#draft-model}
A common method to predict the next tokens when using large models is to use a smaller model (draft model) of the same model family to predict (draft) the next tokens faster.

This works only if both models have the same tokenizer configuration and behave similarly.

If the smaller model is too large, it may take longer to generate the predictions and validate them than to generate the output tokens directly.
Also, if your machine isn't capable enough, the draft model can take resources that would have otherwise been used to generate the output, which would result in a slowdown. 

It's recommended to measure the performance of the model combination you choose on the target machine you plan to run this on to see whether it provides any speedup.

An example combination of models that would benefit from draft model token prediction can be using [Llama 3.3 70B](https://huggingface.co/mradermacher/Llama-3.3-70B-Instruct-GGUF) with [Llama 3.1 8B](https://huggingface.co/mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF).

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {
    getLlama,
    DraftSequenceTokenPredictor,
    LlamaChatSession
} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const draftModel = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "small-model.gguf")
});
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "large-model.gguf")
});

const draftContext = await draftModel.createContext({
    contextSize: {
        // we don't want to use too much memory
        // for the draft sequence, so we limit the size
        max: 4096
    }
});
const context = await model.createContext();

const draftContextSequence = draftContext.getSequence();
const contextSequence = context.getSequence({
    tokenPredictor: new DraftSequenceTokenPredictor(draftContextSequence, {
        // try to change this value to `1` or more
        // and see the difference in response times
        minTokens: 0,
        
        // the minimum probability of a toke prediction to be considered
        minConfidence: 0.6
    })
});

const session = new LlamaChatSession({contextSequence});

// preload the preamble to the context
// to measure only the generation time
await session.preloadPrompt("");


const q1 = "Hi there, how are you?";
console.log("User: " + q1);

const startTime = Date.now();
const a1 = await session.prompt(q1);
const endTime = Date.now();
const responseTime = endTime - startTime;

console.log("AI: " + a1);
console.log("Response time: " + responseTime.toLocaleString("en-US") + "ms");
console.log("Validated tokens: " + contextSequence.tokenPredictions.validated);
console.log("Refuted tokens: " + contextSequence.tokenPredictions.refuted);
```
> `Validated tokens` are the number of token predictions that were validated as correct,
> and `Refuted tokens` are the number of token predictions that were refuted as incorrect.
> 
> You should aim to find a small model that would provide the lowest `Refuted tokens` count and the highest `Validated tokens` count,
> while also being fast enough to provide a speedup.


## Input Lookup Token Predictor {#input-lookup}
When using a model for input-grounded tasks (tasks where the model frequently repeats some of the input tokens in
its output, such as text summarization or modifying code),
the last few generated tokens can be used to try to find a pattern in the input and predict the next few tokens based on it.

The advantage of this method is that it doesn't require using another model to generate token predictions,
but it's only effective for tasks where the model repeats some of the input tokens in the output.

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {
    getLlama,
    InputLookupTokenPredictor,
    LlamaChatSession
} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();

const contextSequence = context.getSequence({
    tokenPredictor: new InputLookupTokenPredictor({
        patternLength: {
            min: 2
        },
        predictionLength: {
            max: 2
        }
    })
});

const session = new LlamaChatSession({contextSequence});

// preload the preamble to the context
// to measure only the generation time
await session.preloadPrompt("");


const article = "<some long text here>";
const q1 = [
    article,
    "\n------\n",
    "Summarize the above article in a few sentences"
].join("\n");
console.log("User: " + q1);

const startTime = Date.now();
const a1 = await session.prompt(q1);
const endTime = Date.now();
const responseTime = endTime - startTime;

console.log("AI: " + a1);
console.log("Response time: " + responseTime.toLocaleString("en-US") + "ms");
console.log("Validated tokens: " + contextSequence.tokenPredictions.validated);
console.log("Refuted tokens: " + contextSequence.tokenPredictions.refuted);
```
> `Validated tokens` are the number of token predictions that were validated as correct,
> and `Refuted tokens` are the number of token predictions that were refuted as incorrect.
>
> You should aim to find a balance in the [`InputLookupTokenPredictor`](../api/classes/InputLookupTokenPredictor.md) configuration that works well for your
> average use cases that would provide the lowest `Refuted tokens` count and the highest `Validated tokens` count.


## Custom Token Predictor {#custom}
You can create your own token predictor by extending the [`TokenPredictor`](../api/classes/TokenPredictor.md) class and implementing the necessary methods.

```typescript
import {
    TokenPredictor,
    LlamaContextSequence,
    Token,
    SequenceEvaluateOptions,
    DisposedError
} from "node-llama-cpp";

export class MyCustomTokenPredictor extends TokenPredictor {
    public readonly minPredictionTokens: number;
    private _stateTokens: Token[] = [];
    private _inputTokens: Token[] = [];
    private _disposed: boolean = false;

    public constructor({
        minPredictionTokens = 0
    }: {
        minPredictionTokens?: number
    } = {}) {
        super();

        this.minPredictionTokens = minPredictionTokens;
    }

    // called before the generation starts
    // can return a promise if the reset operation is async
    public reset({stateTokens}: {
        // target sequence that this predictor is supposed to assist
        targetSequence: LlamaContextSequence,

        // the tokens that should be regarded to as the current state
        // of the target sequence.
        // the first predictions should be based on these tokens
        stateTokens: Token[],

        // the evaluation options used for the generation
        // in the target sequence
        evaluateOptions: Readonly<SequenceEvaluateOptions>
    }) {
        // we save the state tokens so we can use them to provide completions
        this._stateTokens = stateTokens.slice();
    }

    // called with the user input tokens before `predictTokens` is called
    public override updateInputTokens(tokens: Token[]) {
        this._inputTokens = tokens.slice();
    }

    // called whenever tokens are added to the state of the target sequence,
    // whether due to the predicted tokens being validated or the user input.
    // in either case, we should regard these tokens as added to the state.
    // we can resume a background prediction process if it was stopped
    // (whether due to the `.stop()` method being called or the maximum
    // number of predictions being reached).
    public pushTokens(tokens: Token[]) {
        for (const token of tokens)
            this._stateTokens.push(token);
    }

    // called when the current evaluation gathers predictions.
    // if there's no background prediction process,
    // then it can start when this function is called.
    // the function can return a promise if the main generation
    // should wait until the predictions are ready,
    // like when `minPredictionTokens` is greater than 0.
    // ideally, this function should return the predictions it already has
    // and not wait for the background prediction process to
    // finish, to avoid slowing the main generation process.
    public predictTokens(): Promise<Token[]> | Token[] {
        if (this._disposed)
            throw new DisposedError();

        const recentTokens = this._stateTokens.slice(-10);
        const firstToken = recentTokens[0];
        if (firstToken != null) {
            const tokenIndex = this._inputTokens.indexOf(firstToken);
            if (tokenIndex >= 0) {
                return this._inputTokens.slice(tokenIndex + 10);
            }
        }

        return this._inputTokens.slice(0, this.minPredictionTokens);
    }

    // all background prediction processes should be stopped
    // when this method is called.
    // if `untilPredictionsExhausted` is true, the prediction process
    // can automatically resume once the current predictions
    // are exhausted (refuted or validated by the state
    // additions added by the `pushTokens` method).
    // can return a promise if the stop operation is async
    public override stop(untilPredictionsExhausted: boolean = false) {
        // stop the prediction process
    }

    // called when the target sequence is manually disposed.
    // when this is called, we should release
    // all resources used by this predictor.
    // can return a promise if the dispose operation is async
    public override dispose() {
        this._disposed = true;
        this._stateTokens = [];
        this._inputTokens = [];
    }
}
```
> If you manage to create a generic and performant token predictor, consider [opening a PR](./development.md) to contribute it to `node-llama-cpp`.
