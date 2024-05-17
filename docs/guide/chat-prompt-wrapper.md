# Chat wrapper
## Background
Text generation models are trained to predict the completion of incomplete text. 
To have a conversation with a model, we have to generate a text the model can complete,
and parse its response to know whether it finished answering, or should we tell it to continue completing the text. 

For example, to prompt a model with "Where do llamas come from?" we can give the model a text like this to predict the completion of:
```txt
You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly.
If you don't know the answer to a question, don't share false information.

### Human
Where do llamas come from?

### Assistant

```

> The first text we gave to the model in this example is called a "system prompt".
> This text will guide the model towards generating a response we want it to generate.

The model will then generate a response like this:
```
### Assistant
Llamas come from the Andes mountains.

### Human

```

On every character the model generates, we have to check whether the text completion now includes the `### Human\n` part, and if it does, we can stop the completion and return the response.

Most models are trained to understand a specific format of conversation, or output a specific text when they finish generating a response.

Usually, when a model finishes generating a response, it'll output an EOS token (End of Sequence token) that's specific to the model.

For example, LLama chat models have [their own conversation format](https://huggingface.co/blog/llama2#how-to-prompt-llama-2).

## Chat prompt wrappers
The [`LlamaChatSession`](/api/classes/LlamaChatSession) class allows you to chat with a model without having to worry about any parsing or formatting.

To do that, it uses a chat prompt wrapper to handle the unique format of the model you use.

For example, to chat with a LLama model, you can use [Llama3ChatWrapper](/api/classes/Llama3ChatWrapper):

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {LlamaModel, LlamaContext, LlamaChatSession, Llama3ChatWrapper} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const model = new LlamaModel({
    modelPath: path.join(__dirname, "models", "codellama-13b.Q3_K_M.gguf")
});
const context = new LlamaContext({model});
const session = new LlamaChatSession({
    context,
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

> You can find the list of builtin chat prompt wrappers [here](/api/classes/ChatWrapper).

## Custom chat prompt wrapper
To create your own chat prompt wrapper, you need to extend the [`ChatPromptWrapper`](/api/classes/ChatWrapper) class:

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {LlamaModel, LlamaContext, LlamaChatSession, ChatWrapper} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class MyCustomChatWrapper extends ChatWrapper {
    public readonly wrapperName: string = "MyCustomChat";
    
    public override wrapPrompt(prompt: string, {systemPrompt, promptIndex}: {systemPrompt: string, promptIndex: number}) {
        if (promptIndex === 0) {
            return "SYSTEM: " + systemPrompt + "\nUSER: " + prompt + "\nASSISTANT:";
        } else {
            return "USER: " + prompt + "\nASSISTANT:";
        }
    }

    public override getStopStrings(): string[] {
        return ["USER:"];
    }

    public override getDefaultStopString(): string {
        return "USER:";
    }
}

const model = new LlamaModel({
    modelPath: path.join(__dirname, "models", "codellama-13b.Q3_K_M.gguf")
});
const context = new LlamaContext({model});
const session = new LlamaChatSession({
    context,
    promptWrapper: new MyCustomChatWrapper()
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
