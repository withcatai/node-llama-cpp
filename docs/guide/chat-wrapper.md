---
description: Chat with a model without having to worry about any parsing or formatting
---
# Chat Wrapper
## Background
Text generation models are trained to predict the completion of incomplete text. 
To have a conversation with a model, we have to generate a text the model can complete,
and parse its response to know whether it finished answering, or should we tell it to continue completing the text. 

For example, to prompt a model with "Where do llamas come from?" we can give the model a text like this to predict the completion of it:
```
You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly.
If you don't know the answer to a question, don't share false information.

### Human
Where do llamas come from?

### Assistant
⠀
```

> The first text we gave to the model in this example is called a "system prompt".
> This text will guide the model towards generating a response we want it to generate.

The model will then generate a response like this:
```
Llamas come from the Andes mountains.

### Human
⠀
```

On every character the model generates, we have to check whether the text completion now includes the `### Human\n` part, and if it does, we can stop the completion and return the response.

Most models are trained to understand a specific conversation format, or output a specific text when they finish generating a response.

Usually, when a model finishes generating a response, it'll output an EOS token (End of Sequence token) that's specific to the model.

For example, LLama 3 Instruct models have [their own conversation format](https://huggingface.co/blog/llama3#how-to-prompt-llama-3).

::: info
To learn more about tokens, see the [tokens guide](./tokens.md)
:::

## Chat Wrappers
The [`LlamaChatSession`](../api/classes/LlamaChatSession.md) class allows you to chat with a model without having to worry about any parsing or formatting.

To do that, it uses a chat wrapper to handle the unique chat format of the model you use.

It automatically selects and configures a chat wrapper that it thinks is best for the model you use (via [`resolveChatWrapper(...)`](../api/functions/resolveChatWrapper.md)).

You can also specify a specific chat wrapper to only use it, or to customize its settings.
For example, to chat with a LLama 3 Instruct model, you can use [Llama3ChatWrapper](../api/classes/Llama3ChatWrapper.md):

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession, Llama3ChatWrapper} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
    chatWrapper: new Llama3ChatWrapper() // by default, "auto" is used
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

> You can find the list of builtin chat prompt wrappers [here](../api/classes/ChatWrapper.md).


## Template Chat Wrapper {#template}
A simple way to create your own custom chat wrapper is to use [`TemplateChatWrapper`](../api/classes/TemplateChatWrapper.md).

Example usage:
```typescript
import {TemplateChatWrapper} from "node-llama-cpp";

const chatWrapper = new TemplateChatWrapper({
    template: "{{systemPrompt}}\n{{history}}model: {{completion}}\nuser: ",
    historyTemplate: {
        system: "system: {{message}}\n",
        user: "user: {{message}}\n",
        model: "model: {{message}}\n"
    },
    // functionCallMessageTemplate: { // optional
    //     call: "[[call: {{functionName}}({{functionParams}})]]",
    //     result: " [[result: {{functionCallResult}}]]"
    // }
});
```
> See [`TemplateChatWrapper`](../api/classes/TemplateChatWrapper.md) for more details.


## Jinja Template Chat Wrapper {#jinja}
To reuse an existing Jinja template you have, you can use [`JinjaTemplateChatWrapper`](../api/classes/JinjaTemplateChatWrapper.md).

::: tip NOTE
Not all the features of Jinja are supported by the [`JinjaTemplateChatWrapper`](../api/classes/JinjaTemplateChatWrapper.md), so some Jinja templates might need some simple modifications to work.

If you'd like to create your own chat wrapper, it's significantly easier to [write you own custom chat wrapper directly](#custom-chat-wrapper).
:::

```typescript
import {JinjaTemplateChatWrapper} from "node-llama-cpp";

const chatWrapper = new JinjaTemplateChatWrapper({
    template: "<Jinja template here>",
    // functionCallMessageTemplate: { // optional
    //     call: "[[call: {{functionName}}({{functionParams}})]]",
    //     result: " [[result: {{functionCallResult}}]]"
    // }
});
```

## Custom Chat Wrapper
To create your own chat wrapper, you need to extend the [`ChatWrapper`](../api/classes/ChatWrapper.md) class.

The way a chat wrapper works is that it implements the [`generateContextState`](../api/classes/ChatWrapper.md#generatecontextstate) method,
which received the full chat history and available functions and is responsible for generating the content to be loaded into the context state, so the model can generate a completion of it.

The context content is returned in the form of a [`LlamaText`](../api/classes/LlamaText.md) (see the [LlamaText guide](./llama-text.md)).

If the last message in the chat history is a model response, it must **not** include a syntax suffix for the message,
so the model can continue generating completion for an existing response. This is needed for context shifts to work properly.

> For example, this is a valid ending of a context text:
> ```text
> ### Assistant
> Llamas come from the
> ```
> 
> This is an invalid ending of a context text:
> ```text
> ### Assistant
> Llamas come from the
> 
> ### Human
> ```

::: info What is a context shift? {#smart-context-shift}

When the chat history gets longer than the sequence's context size, we have to remove the oldest tokens from the context state to make room for new tokens to be generated.

`node-llama-cpp` has a smart mechanism to handle context shifts on the chat level, so the oldest messages are truncated (from their beginning) or removed from the context state, while keeping the system prompt in place to ensure the model follows the guidelines you set for it.

:::

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {
    getLlama, LlamaChatSession, ChatWrapper,
    ChatWrapperSettings, ChatWrapperGenerateContextStateOptions,
    ChatWrapperGeneratedContextState, LlamaText
} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class MyCustomChatWrapper extends ChatWrapper {
    public readonly wrapperName: string = "MyCustomChat";

    public override readonly settings: ChatWrapperSettings = {
        ...ChatWrapper.defaultSettings
    };

    public override generateContextState({
        chatHistory, availableFunctions, documentFunctionParams
    }: ChatWrapperGenerateContextStateOptions): ChatWrapperGeneratedContextState {
        const historyWithFunctions = this.addAvailableFunctionsSystemMessageToHistory(chatHistory, availableFunctions, {
            documentParams: documentFunctionParams
        });

        const texts = historyWithFunctions.map((item, index) => {
            if (item.type === "system") {
                if (index === 0)
                    return LlamaText([
                        LlamaText.fromJSON(item.text)
                    ]);
                
                return LlamaText([
                    "### System\n",
                    LlamaText.fromJSON(item.text)
                ]);
            } else if (item.type === "user")
                return LlamaText([
                    "### Human\n",
                    item.text
                ]);
            else if (item.type === "model")
                return LlamaText([
                    "### Assistant\n",
                    this.generateModelResponseText(item.response)
                ]);

            // ensure that all chat item types are handled,
            // or TypeScript will throw an error
            return item satisfies never;
        });

        return {
            contextText: LlamaText.joinValues("\n\n", texts),
            
            // if the model generates any of these texts,
            // the completion will stop, and the text will not
            // be included in the response returned to the user
            stopGenerationTriggers: [
                LlamaText(["### Human\n"])
            ]
        };
    }
}

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
    chatWrapper: new MyCustomChatWrapper()
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

## Default Chat Wrapper Options
You can use the [`resolveChatWrapper(...)`](../api/functions/resolveChatWrapper.md) function to resolve the best chat wrapper for a given model,
and configure the default options for each of the builtin chat wrappers it may resolve to. 

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession, resolveChatWrapper} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
    chatWrapper: resolveChatWrapper(model, {// [!code highlight]
        customWrapperSettings: {// [!code highlight]
            "llama3.1": {// [!code highlight]
                cuttingKnowledgeDate: new Date("2025-01-01T00:00:00Z")// [!code highlight]
            }// [!code highlight]
        }// [!code highlight]
    })// [!code highlight]
});


const q1 = "Hi there, how are you?";
console.log("User: " + q1);

const a1 = await session.prompt(q1);
console.log("AI: " + a1);
```
