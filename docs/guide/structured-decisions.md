---
outline: [2, 4]
description: Generating structured decisions with node-llama-cpp
---
# Using Structured Decisions
::: info What are System One and System Two?
These names come from a distinction between two ways people think:
* **System One** is fast, automatic and intuitive judgments, such as recognizing that a message asks for help.
* **System Two** is slower, deliberate, and effortful, such as reasoning through a problem to develop a solution.
:::

The way that regular LLMs predict the next token is very similar to a System One judgment.
`node-llama-cpp` leverages this with multiple optimizations to allow using standard language models
for making fast and efficient structured decisions on a given text.
No need for a specialized System One model for most use cases.

Structured decisions can help you classify a given text or chat history, route requests, filter content, prioritize work,
and make more efficient use of the available resources for many kinds of automation.

## Question Types {#question-types}
Structured decisions support 3 types of questions:

### `noul` {#noul}
Use this type when the answer is yes or no.

For example:
* Does this message ask for help?
* Does this text mention an animal?
* Does this message refer to a person?

The answer will be a number representing the probability of the answer being yes, where `1` means yes, and `0` means no.
When the answer is near the middle (around `0.5`), it indicates uncertainty between yes and no.

### `choice` {#choice}
Use this type when the answer should be selected from a predefined set of choices.

For example:
* Which category does this text belong to? (options: news, blog, forum)
* What department should handle this message? (options: sales, support, engineering)
* What language is this text predominantly written in? (options: English, Spanish, French, German)

The answer will be a choice from the given options, along with a confidence score, and probabilities for each option.
Use the confidence score to determine whether to trust the model's decision.

### `score` {#score}
Use this type when the answer should be a rating on a given scale.

For example:
* How severe is this issue?
    * **0:** Cosmetic, no impact on functionality
    * **1:** Broken, but there are workarounds
    * **2:** Blocking, no workaround available
* How much prior knowledge does this text assume?
    * **0:** No prior knowledge
    * **1:** Basic familiarity
    * **2:** Specialist knowledge
* How strongly does the customer express an intention to purchase?
    * **0:** Not interested
    * **1:** Just browsing
    * **2:** Considering purchasing
    * **3:** Conditional intent to purchase
    * **4:** Ready to buy

The answer will be a score from the given scale (from `0` to the maximum defined level index), along with a confidence score, and probabilities for each level.


## Choosing a Model {#choosing-a-model}
Aim for the smallest model that fits your needs, since structured decisions are usually simple and don't require a high level of intelligence.
Models that are competent without reasoning tend to perform better for structured decisions.

Here are some recommended model URIs you start experimenting with:

| Model                                                                | Size  | URI                                   |
|----------------------------------------------------------------------|-------|---------------------------------------|
| [Gemma 4 5B E2B](https://huggingface.co/giladgd/gemma-4-E2B-it-GGUF) | 5.0GB | `hf:giladgd/gemma-4-E2B-it-GGUF:Q8_0` |
| [Gemma 4 5B E2B](https://huggingface.co/giladgd/gemma-4-E2B-it-GGUF) | 3.9GB | `hf:giladgd/gemma-4-E2B-it-GGUF:Q6_K` |
|                                                                      |       |                                       |
| [Qwen 3.5 2B](https://huggingface.co/unsloth/Qwen3.5-2B-GGUF)        | 1.3GB | `hf:unsloth/Qwen3.5-2B-GGUF:Q4_K_M`   |
| [Qwen 3.5 0.8B](https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF)    | 0.8GB | `hf:unsloth/Qwen3.5-0.8B-GGUF:Q8_0`   |

<div class="tip custom-block" style="padding-top: 8px">

For tips on choosing a model, see the [choosing a model guide](./choosing-a-model.md)

</div>


## Evaluating Questions {#evaluating-questions}
There are two places where you can use the structured decisions API:
* [On a decision context](#decision-context) with a given document as the context for the questions
* [On a chat session](#chat-session) with the entire chat history as the context for the questions


### On a Decision Context {#decision-context}
When using a [`LlamaDecisionContext`](../api/classes/LlamaDecisionContext.md) (via [`.decide()`](../api/classes/LlamaDecisionContext.md#decide)),
the document you provide as context is only evaluated once,
and then all questions are evaluated in parallel (up to the configured parallelism limit).

It's recommended to configure the [`contextSize`](../api/type-aliases/LlamaDecisionContextOptions.md#contextsize) to limit its size if you only expect short documents.
The advantage of doing this is that it reduces memory usage and allows you to configure more parallel evaluations (which essentially are context sequences).
Also, evaluating an input on a smaller context size is much faster and more efficient.

The document you provide can be in any format you like, as long as the model can read it.
For example, to put a JSON document into the context, you can stringify it and provide it as the document.

The main advantage of using a decision context is that it evaluates multiple questions in parallel,
which reduces the overall time it takes to evaluate multiple questions.

```typescript
import {getLlama, resolveModelFile} from "node-llama-cpp";

const modelUri = "hf:giladgd/gemma-4-E2B-it-GGUF:Q8_0";

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: await resolveModelFile(modelUri)
});
const context = await model.createDecisionContext({
    contextSize: {max: 4096},
    parallelQuestions: 4
});

await context.warmup(); // optional, makes timing the next decision more accurate
const startTime = Date.now();

const ticket = "I can't sign in after resetting my password. My whole team is locked out.";
const answers = await context.decide(ticket, {
    troubleshootingAttempted: {
        type: "noul",
        instruction: "Has the customer already tried to fix the issue?",
        criteria: {
            true: "The customer described troubleshooting steps they have already tried",
            false: "The customer reported a problem without mentioning any attempted fixes"
        }
    },
    team: {
        type: "choice",
        instruction: "Which support team should handle this ticket?",
        criteria: {
            accounts: "Signing in, passwords, and account access",
            billing: "Invoices, payments, and refunds",
            technical: "Problems using features after signing in"
        }
    },
    impact: {
        type: "score",
        instruction: "How much is the issue affecting the customer's work?",
        criteria: [
            "No interruption to work",
            "Some tasks are slower or harder",
            "The customer cannot continue their work"
        ]
    }
});

console.log({
    queue: answers.team.confidence >= 0.7
        ? answers.team.choice
        : "triage",
    priority:
        answers.impact.score >= 1.5
            ? "high"
            : "normal",
    nextStep: answers.troubleshootingAttempted.value >= 0.8
        ? "review previous attempts"
        : "suggest initial troubleshooting"
});
console.log("Decision time: " + (Date.now() - startTime) + "ms");
```

> Will output:
> ```
> {
>   queue: 'accounts',
>   priority: 'high',
>   nextStep: 'suggest initial troubleshooting'
> }
> Decision time: 178ms
> ```

::: tip TIP
The answers object is fully type-safe based on the questions you define in the [`.decide()`](../api/classes/LlamaDecisionContext.md#decide) call, so you might find it easier to define the questions inline, like in the example above.

If you want to store the questions separately, you can define them as a [`DecisionQuestions`](../api/type-aliases/DecisionQuestions.md) constant and pass them to the [`.decide()`](../api/classes/LlamaDecisionContext.md#decide) call.
:::

::: tip TIP
If the answer the model generates is right but its confidence is low,
look at the probabilities to check whether the model gets confused between two criteria.

In such a case you'll see that the probability of two or more items is pretty close.
Try refining the criteria to make it more specific, or add an additional option in order to remove ambiguity.
:::

::: tip NOTE

The specific values that you get for `confidence` and the rest of the probabilities could slightly vary on each evaluation (depending on your machine and setup),
but the general consensus should remain stable - the `choice` with the highest confidence stays the same, a `noul` stays as decisive as before,
but the exact confidence and probability values may fluctuate.

:::


### On a Chat Session {#chat-session}
When using structured decisions on a [`LlamaChatSession`](../api/classes/LlamaChatSession.md) (via [`.decide()`](../api/classes/LlamaChatSession.md#decide)),
since the entire chat history is already loaded into the [context sequence](../api/classes/LlamaContextSequence.md)
then only the questions themselves actually get evaluated on demand, which can save time and computational resources.
Doing so doesn't add the questions to the chat history, so you can use that in between prompts as much as you like.

Behind the scenes, `node-llama-cpp` evaluates each question as a user message on top of the existing chat history,
so the question should be asked in the context of the user.

For example, you might write a questions like:
* Did we talk about an animal in this chat?
* Do I seem frustrated?
* Did I ask to talk with a human representative?

Keep in mind that extremely long questions or answers can incur an unwanted [context shift](./chat-context-shift.md), but many short questions won't.
The rule of thumb is to split long questions or answers into smaller questions, to use less of the available window of the context sequence.

The downside of using a chat session for structured decisions is that questions are evaluated sequentially,
which can be slow if you need to evaluate many questions.
In such cases, you should consider using a [decision context](#decision-context) instead, as it supports parallel evaluation of questions.

```typescript
import {getLlama, resolveModelFile, LlamaChatSession} from "node-llama-cpp";

const modelUri = "hf:giladgd/gemma-4-E2B-it-GGUF:Q8_0";

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: await resolveModelFile(modelUri)
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
    systemPrompt: "You help customers resolve account access issues"
});

await session.prompt("I can't sign in after resetting my password.", {maxTokens: 150});
await session.prompt("That fixed it, thanks!", {maxTokens: 100});

const answers = await session.decide({
    resolved: {
        type: "noul",
        instruction: "Has the customer confirmed that their issue is resolved?"
    },
    needsHuman: {
        type: "noul",
        instruction: "Has the customer asked to speak to a person?"
    }
});

if (answers.needsHuman.value >= 0.8)
    console.log("Hand off to a support agent");
else if (answers.resolved.value >= 0.8)
    console.log("Mark the ticket as resolved");
else
    console.log("Continue the conversation");
```

> Will output:
> ```
> Mark the ticket as resolved
> ```

Calling [`.decide()`](../api/classes/LlamaChatSession.md#decide) doesn't add anything to the chat history, so you can continue chatting normally afterwards.


::: details Using `LlamaChat` {#llama-chat}

If you [manage the chat history externally](./external-chat-state.md),
use [`LlamaChat.generateDecisions()`](../api/classes/LlamaChat.md#generatedecisions).
Pass the history and questions, then read the results from [`answers`](../api/type-aliases/LlamaChatGenerateDecisionsResponse.md#answers) and store the returned [`lastEvaluation`](../api/type-aliases/LlamaChatGenerateDecisionsResponse.md#lastevaluation) (which is relevant when a context shift is needed).

```typescript
import {getLlama, resolveModelFile, LlamaChat} from "node-llama-cpp";

const modelUri = "hf:giladgd/gemma-4-E2B-it-GGUF:Q8_0";

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: await resolveModelFile(modelUri)
});
const context = await model.createContext();
const llamaChat = new LlamaChat({
    contextSequence: context.getSequence()
});

let chatHistory = llamaChat.chatWrapper.generateInitialChatHistory();
chatHistory.push({
    type: "user",
    text: "I can't sign in to my account."
});

const res = await llamaChat.generateResponse(chatHistory);
chatHistory = res.lastEvaluation.cleanHistory;
let chatHistoryContextWindow = res.lastEvaluation.contextWindow;
let lastContextShiftMetadata = res.lastEvaluation.contextShiftMetadata;


const newUserMessage = "I tried that and still can't get in. Can I speak to a person?";
chatHistory.push({
    type: "user",
    text: newUserMessage
});
chatHistoryContextWindow.push({
    type: "user",
    text: newUserMessage
});


const {answers, lastEvaluation} = await llamaChat.generateDecisions(chatHistory, {
    needsHuman: {
        type: "noul",
        instruction: "Has the customer asked to speak to a person?"
    }
}, {
    lastEvaluationContextWindow: {
        history: chatHistoryContextWindow
    },
    contextShift: {
        lastEvaluationMetadata: lastContextShiftMetadata
    }
});
chatHistoryContextWindow = lastEvaluation.contextWindow;
lastContextShiftMetadata = lastEvaluation.contextShiftMetadata;

console.log("Hand off to a support agent:", answers.needsHuman.value >= 0.8);
```

> Will output:
> ```
> Hand off to a support agent: true
> ```

:::
