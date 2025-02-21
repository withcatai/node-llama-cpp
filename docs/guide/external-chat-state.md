---
description: Chat with a model and manage the chat state externally
---
# External Chat State
::: warning
If you're not building a library around `node-llama-cpp`, you'd probably want to use the simpler [`LlamaChatSession`](../api/classes/LlamaChatSession.md); read more on the [chat session documentation](./chat-session.md).

You can [save and restore a chat history](./chat-session.md#save-and-restore) on [`LlamaChatSession`](../api/classes/LlamaChatSession.md) instead of managing the chat state externally.
:::

To interact with a model in a chat form, you can use [`LlamaChatSession`](../api/classes/LlamaChatSession.md),
which is a stateful chat session that manages the chat state on its own.

When building a library around `node-llama-cpp`, you may want to store that chat state externally and control the evaluations yourself.

This is where [`LlamaChat`](../api/classes/LlamaChat.md) may come in handy.
[`LlamaChat`](../api/classes/LlamaChat.md) Allows you to generate a completion to an existing chat session and manage the evaluation yourself,
which allows you to also store the chat state externally. [`LlamaChat`](../api/classes/LlamaChat.md) is stateless and has no state of its own.

In fact, [`LlamaChatSession`](../api/classes/LlamaChatSession.md) is just a wrapper around [`LlamaChat`](../api/classes/LlamaChat.md) to make it more convenient to use.

Let's see how you can use [`LlamaChat`](../api/classes/LlamaChat.md) to prompt a model:
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChat} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(
        __dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf"
    )
});
const context = await model.createContext();
const llamaChat = new LlamaChat({
    contextSequence: context.getSequence()
});

let chatHistory = llamaChat.chatWrapper.generateInitialChatHistory({
    // systemPrompt: "You're a helpful assistant"
});

const prompt = "Hi there, how are you?";

// add the user prompt to the chat history
chatHistory.push({
    type: "user",
    text: prompt
});

// add a slot for the model response, for the model to complete.
// if we want the model response to start with a specific text,
// we can do so by adding it to the response array
chatHistory.push({
    type: "model",
    response: []
});

console.log("User: " + prompt);
const res = await llamaChat.generateResponse(chatHistory, {
    onTextChunk(text) {
        // stream the text to the console
        process.stdout.write(text);
    }
});

const fullResponse = res.fullResponse
    .map((item) => {
        if (typeof item === "string")
            return item;
        else if (item.type === "segment") {
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

console.log("AI: " + res.response);
console.log("Full response:", fullResponse);
```

Now, let's say we want to ask the model a follow-up question based on the previous response.
Since we already have a context sequence loaded with the previous chat history,
we'd want to reuse it as much a possible.

To do so, we pass the context window of the previous evaluation output to the new evaluation.
This is important, since if a context shift has happened, we want to use the existing post-context-shift context sequence state
as much as possible instead of starting from scratch.

::: info NOTE
Keeping and passing the context window and context shift metadata is only necessary if you use the same context sequence in the next evaluation,
and the state from the previous evaluation is still present in the context sequence.
:::
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChat} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const llamaChat = new LlamaChat({
    contextSequence: context.getSequence()
});

let chatHistory = llamaChat.chatWrapper.generateInitialChatHistory();

const prompt = "Hi there, how are you?";

// add the user prompt to the chat history
chatHistory.push({
    type: "user",
    text: prompt
});

// add a slot for the model response, for the model to complete.
// if we want the model response to start with a specific text,
// we can do so by adding it to the response array
chatHistory.push({
    type: "model",
    response: []
});

console.log("User: " + prompt);
const res = await llamaChat.generateResponse(chatHistory, {
    onTextChunk(text) {
        // stream the text to the console
        process.stdout.write(text);
    }
});

console.log("AI: " + res.response);
// ---cut---
chatHistory = res.lastEvaluation.cleanHistory;
let chatHistoryContextWindow = res.lastEvaluation.contextWindow;
let lastContextShiftMetadata = res.lastEvaluation.contextShiftMetadata;

const prompt2 = "Summarize what you said";

// add the user prompt to the chat history
chatHistory.push({
    type: "user",
    text: prompt2
});
// add the user prompt to the chat history context window
chatHistoryContextWindow.push({
    type: "user",
    text: prompt2
});

// add a slot for the model response, for the model to complete
chatHistory.push({
    type: "model",
    response: []
});
// add a slot for the model response in the context window
chatHistoryContextWindow.push({
    type: "model",
    response: []
});

console.log("User: " + prompt2);
const res2 = await llamaChat.generateResponse(chatHistory, {
    onTextChunk(text) {
        // stream the text to the console
        process.stdout.write(text);
    },
    contextShift: {
        // pass the context shift metadata from the previous evaluation
        lastEvaluationMetadata: lastContextShiftMetadata
    },
    lastEvaluationContextWindow: {
        history: chatHistoryContextWindow
    },
});

console.log("AI: " + res2.response);
console.log("Full response:", res2.fullResponse);
```

## Handling Function Calling {#function-calling}
When passing information about functions the model can call, the response of the [`.generateResponse()`](../api/classes/LlamaChat.md#generateresponse)
can contain function calls.

Then, it's our implementation's responsibility to:
* Print the textual response the model generated
* Perform the appropriate function calls
* Add the function calls and their results to the chat history

Here's an example of how we can prompt a model and support function calling:
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {
    getLlama, LlamaChat, ChatModelFunctions, ChatHistoryItem,
    ChatModelResponse, ChatModelFunctionCall
} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(
        __dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf"
    )
});
const context = await model.createContext();
const llamaChat = new LlamaChat({
    contextSequence: context.getSequence()
});

let chatHistory = llamaChat.chatWrapper.generateInitialChatHistory();

const prompt = "Give me the result of 2 dice rolls";
const functionDefinitions = {
    getRandomNumber: {
        description: "Get a random number",
        params: {
            type: "object",
            properties: {
                min: {
                    type: "number"
                },
                max: {
                    type: "number"
                }
            }
        }
    }
} satisfies ChatModelFunctions;
function getRandomNumber(params: {min: number, max: number}) {
    return Math.floor(
        (Math.random() * (params.max - params.min + 1)) +
        params.min
    );
}

// add the user prompt to the chat history
chatHistory.push({
    type: "user",
    text: prompt
});

// add a slot for the model response, for the model to complete.
// if we want the model response to start with a specific text,
// we can do so by adding it to the response array
chatHistory.push({
    type: "model",
    response: []
});

console.log("User: " + prompt);

let chatHistoryContextWindow: ChatHistoryItem[] | undefined;
let lastContextShiftMetadata: any;

while (true) {
    const res = await llamaChat.generateResponse(chatHistory, {
        functions: functionDefinitions,
        onFunctionCall(functionCall) {
            // we can use this callback to start performing
            // the function as soon as the model calls it
            console.log(
                "model called function", functionCall.functionName,
                "with params", functionCall.params
            );
        },
        contextShift: {
            lastEvaluationMetadata: lastContextShiftMetadata
        },
        lastEvaluationContextWindow: {
            history: chatHistoryContextWindow
        },
    });
    chatHistory = res.lastEvaluation.cleanHistory;
    chatHistoryContextWindow = res.lastEvaluation.contextWindow;
    lastContextShiftMetadata = res.lastEvaluation.contextShiftMetadata;

    // print the text the model generated before calling functions
    if (res.response !== "") {
        const fullResponse = res.fullResponse
            .map((item) => {
                if (typeof item === "string")
                    return item;
                else if (item.type === "segment") {
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
        
        console.log("AI: " + res.response);
        console.log("Full response:", fullResponse);
    }

    // when there are no function calls,
    // it means the model has finished generating the response
    if (res.functionCalls == null)
        break;

    // perform the function calls
    const callItems: ChatModelFunctionCall[] = res.functionCalls
        .map((functionCall) => {
            if (functionCall.functionName !== "getRandomNumber")
                throw new Error("only function getRandomNumber is supported");
            
            const res = getRandomNumber(functionCall.params);
            console.log(
                "Responding to function", functionCall.functionName,
                "with params", functionCall.params,
                "with result", res
            );

            const functionDefinition =
                functionDefinitions[functionCall.functionName];
    
            return {
                type: "functionCall",
                name: functionCall.functionName,
                params: functionCall.params,
                rawCall: functionCall.raw,
                description: functionDefinition?.description,
                result: res
            } satisfies ChatModelFunctionCall;
        });

    // needed for maintaining the existing context sequence state
    // with parallel function calling,
    // and avoiding redundant context shifts
    callItems[0]!.startsNewChunk = true;


    if (chatHistory.at(-1)?.type !== "model")
        chatHistory.push({
            type: "model",
            response: []
        });

    if (chatHistoryContextWindow.at(-1)?.type !== "model")
        chatHistoryContextWindow.push({
            type: "model",
            response: []
        });

    const modelResponse = chatHistory.at(-1)! as ChatModelResponse;
    const contextWindowModelResponse =
        chatHistoryContextWindow.at(-1)! as ChatModelResponse;

    // add the function calls and their results
    // both to the chat history and the context window chat history
    for (const callItem of callItems) {
        modelResponse.response.push(callItem);
        contextWindowModelResponse.response.push(callItem);
    }
}
```
