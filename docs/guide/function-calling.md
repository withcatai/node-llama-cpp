---
outline: [2, 4]
description: Using function calling
---
# Using Function Calling

When prompting a model using a [`LlamaChatSession`](../api/classes/LlamaChatSession.md), you can provide a list of functions that a model can call during generation to retrieve information or perform actions.

For this to work, `node-llama-cpp` tells the model what functions are available and what parameters they take, and instructs it to call those as needed.
It also ensures that when the model calls a function, it always uses the correct parameters.

Some models have built-in support for function calling, and some of them are not trained for that.

For example, _Llama 3_ is not trained for function calling.
When using a _Llama 3_ model, the [`Llama3ChatWrapper`](../api/classes/Llama3ChatWrapper.md) is automatically used, and it includes a custom handling for function calling,
which contains a fine-tuned instruction for explaining the model how to call functions and when to do so.

There are also models that do have built-in support for function calling, like _Llama 3.1_.
When using a _Llama 3.1_ model, the [`Llama3_1ChatWrapper`](../api/classes/Llama3_1ChatWrapper.md) is automatically used, and it knows how to handle function calling for this model.

In order for the model to know what functions can do and what they return, you need to provide this information in the function description.

Let's see an example of how to use function calling with a _Llama 3.1_ model:
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession, defineChatSessionFunction} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "Meta-Llama-3.1-8B.Q4_K_M.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});

const fruitPrices: Record<string, string> = {
    "apple": "$6",
    "banana": "$4"
};
const functions = {
    getFruitPrice: defineChatSessionFunction({
        description: "Get the price of a fruit",
        params: {
            type: "object",
            properties: {
                name: {
                    type: "string"
                }
            }
        },
        async handler(params) {
            const name = params.name.toLowerCase();
            if (Object.keys(fruitPrices).includes(name))
                return {
                    name: name,
                    price: fruitPrices[name]
                };

            return `Unrecognized fruit "${params.name}"`;
        }
    })
};


const q1 = "Is an apple more expensive than a banana?";
console.log("User: " + q1);

const a1 = await session.prompt(q1, {functions});
console.log("AI: " + a1);
```

In this example, you can see that we have a function called `getFruitPrice` that returns the price of a fruit.
This function has a description that explains what it does and what it returns.

The `params` schema ensure that the model can only call this function with the correct parameters,
and is also used to inform the model what parameters this function takes,
so there's no need to provide this information again as part of the function description or prompt.

It's important, though, to make sure that the parameter names are clear and easy to understand, so the model can use them correctly.
It's okay for parameters to be very long, as long as they're self-explanatory.

We return the fruit name that the model asked for in the response.
When processing the response, some models don't properly match the response of a function call with the function call parameters when multiple function calls are being made in parallel,
so providing the context as part of the response itself helps the model understand the context better.
This may not be necessary for the model you use, but can be helpful in some cases.

When we encounter an error, like an unrecognized fruit, we have to communicate it to the model in a way that it can understand,
so we return a text response explaining what went wrong. Throwing an error will just abort the generation, so avoid doing that if you want the generation to continue.

## Function Parameters
All the parameters passed to a function are considered required by the schema.
This is intentional because many models struggle to use optional parameters effectively.

The generation process works like this: the model is provided with an existing state and is tasked with generating a completion to that state.
Each generation depends on the previous one, requiring alignment with the existing state.
The model must pass the parameters in the order they are defined, but it may not always be aware of all the possible parameters.
As a result, after a parameter value is generated, the next parameter is "forced" on the model, requiring the model to generate its value.
This method ensures that the model adheres to the schema, even if it doesn't fully comprehend it.

Optional properties can introduce unpredictability.
Whether the model decides to generate an optional property or is forced to do so can be random, leading to inconsistent results.

To address cases involving optional values, it is recommended to use [`oneOf`](../api/type-aliases/GbnfJsonOneOfSchema.md).
This allows the model to either set the property to `null` or assign it a value,
ensuring that the model deliberately chooses the outcome rather than leaving it to chance.

Let's see an example of how to use [`oneOf`](../api/type-aliases/GbnfJsonOneOfSchema.md) to handle an optional parameter:
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession, defineChatSessionFunction} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "Meta-Llama-3.1-8B.Q4_K_M.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});

const fruitPrices: Record<string, {USD: number, EUR: number}> = {
    "apple": {
        USD: 6,
        EUR: 5
    },
    "banana": {
        USD: 4,
        EUR: 4
    }
};
const functions = {
    getFruitPrice: defineChatSessionFunction({
        description: "Get the price of a fruit",
        params: {
            type: "object",
            properties: {
                name: {
                    type: "string"
                },
                currency: {
                    oneOf: [{
                        type: "null"
                    }, {
                        enum: ["USD", "EUR"]
                    }]
                }
            }
        },
        async handler(params) {
            const name = params.name.toLowerCase();
            const currency = params.currency ?? "USD";
            if (Object.keys(fruitPrices).includes(name))
                return {
                    name: name,
                    price: currency === "USD"
                        ? `${fruitPrices[name]!.USD}$`
                        : `${fruitPrices[name]!.EUR}€`
                };

            return `Unrecognized fruit "${params.name}"`;
        }
    })
};


const q1 = "Is an apple more expensive than a banana?";
console.log("User: " + q1);

const a1 = await session.prompt(q1, {functions});
console.log("AI: " + a1);
```

In this example, we let the model decide whether to use USD or EUR as the currency, or whether to ignore the currency altogether.

To make it clearer for the model that there's a default currency in this function, we can instead add a `"default"` currency option instead of `null`, and force the model to choose it if it doesn't want to choose USD or EUR.

## Custom Function Calling Syntax
To provide a custom function calling syntax for the model to use, you can customize the function calling template of [`TemplateChatWrapper`](./chat-wrapper.md#template-chat-wrapper) or [`JinjaTemplateChatWrapper`](./chat-wrapper#jinja-template-chat-wrapper).


### Using a Custom Chat Wrapper
To provide a custom function calling syntax for a custom chat wrapper, you can set its settings with the desired function calling syntax.

Let's see an example of a custom chat wrapper that provides a custom function calling syntax:
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {
    getLlama, LlamaChatSession, ChatWrapper,
    ChatWrapperSettings, ChatWrapperGenerateContextStateOptions,
    ChatWrapperGeneratedContextState, LlamaText, ChatModelFunctions,
    ChatModelFunctionsDocumentationGenerator, defineChatSessionFunction
} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class MyCustomChatWrapper extends ChatWrapper {
    public readonly wrapperName: string = "MyCustomChat";

    public override readonly settings: ChatWrapperSettings = {
        ...ChatWrapper.defaultSettings,
        supportsSystemMessages: true,
        functions: {
            call: {
                optionalPrefixSpace: true,
                prefix: "[[call: ",
                paramsPrefix: "(",
                suffix: ")]]"
            },
            result: {
                prefix: " [[result: ",
                suffix: "]]"
            }
        }
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

    public override generateAvailableFunctionsSystemText(availableFunctions: ChatModelFunctions, {documentParams = true}: {
        documentParams?: boolean
    }) {
        const functionsDocumentationGenerator = new ChatModelFunctionsDocumentationGenerator(availableFunctions);

        if (!functionsDocumentationGenerator.hasAnyFunctions)
            return LlamaText([]);

        return LlamaText.joinValues("\n", [
            "The assistant calls the provided functions as needed to retrieve information instead of relying on existing knowledge.",
            "To fulfill a request, the assistant calls relevant functions in advance when needed before responding to the request, and does not tell the user prior to calling a function.",
            "Provided functions:",
            "```typescript",
            functionsDocumentationGenerator.getTypeScriptFunctionSignatures({documentParams}),
            "```",
            "",
            "Calling any of the provided functions can be done like this:",
            this.generateFunctionCall("getSomeInfo", {someKey: "someValue"}),
            "",
            "Note that the [[call: prefix is mandatory.",
            "The assistant does not inform the user about using functions and does not explain anything before calling a function.",
            "After calling a function, the raw result appears afterwards and is not part of the conversation.",
            "To make information be part of the conversation, the assistant paraphrases and repeats the information without the function syntax."
        ]);
    }
}

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "my-model.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
    chatWrapper: new MyCustomChatWrapper()
});

const fruitPrices: Record<string, string> = {
    "apple": "$6",
    "banana": "$4"
};
const functions = {
    getFruitPrice: defineChatSessionFunction({
        description: "Get the price of a fruit",
        params: {
            type: "object",
            properties: {
                name: {
                    type: "string"
                }
            }
        },
        async handler(params) {
            const name = params.name.toLowerCase();
            if (Object.keys(fruitPrices).includes(name))
                return {
                    name: name,
                    price: fruitPrices[name]
                };

            return `Unrecognized fruit "${params.name}"`;
        }
    })
};


const q1 = "Is an apple more expensive than a banana?";
console.log("User: " + q1);

const a1 = await session.prompt(q1, {functions});
console.log("AI: " + a1);
```

In this example, if the model would want to call the `getFruitPrice` function, it would use the following syntax:
```
[[call: getFruitPrice({name: "apple"})]]
```
And the result would be:
```
[[result: {name: "apple", price: "$6"}]]
```

The [`generateAvailableFunctionsSystemText`](../api/classes/ChatWrapper.md#generateavailablefunctionssystemtext) function in the chat wrapper we defined here is used to inform the model about the available functions and how to call them.
It'll be added to the context state as a system message, only if there are functions available.

The [`ChatModelFunctionsDocumentationGenerator` class](../api/classes/ChatModelFunctionsDocumentationGenerator.md) is used to generate documentation for the available functions in various formats.

#### Parallel Function Calling Syntax
To support parallel function calling syntax, you can configure the [`functions.parallelism`](../api/type-aliases/ChatWrapperSettings.md#functions-parallelism) field:
```typescript
import {
    ChatWrapper, SpecialToken, ChatWrapperSettings, LlamaText
} from "node-llama-cpp";
// ---cut---
class MyCustomChatWrapper extends ChatWrapper {
    public readonly wrapperName: string = "MyCustomChat";

    public override readonly settings: ChatWrapperSettings = {
        ...ChatWrapper.defaultSettings,
        supportsSystemMessages: true,
        functions: {
            call: {
                optionalPrefixSpace: true,
                prefix: "[[call: ",
                paramsPrefix: "(",
                suffix: ")]]"
            },
            result: {
                prefix: "{{functionName}}({{functionParams}}) result: ",
                suffix: ";"
            },
            parallelism: {
                call: {
                    sectionPrefix: "",
                    betweenCalls: "\n",
                    sectionSuffix: LlamaText(new SpecialToken("EOT"))
                },
                result: {
                    sectionPrefix: "Results:\n",
                    betweenResults: "\n",
                    sectionSuffix: "\n\n"
                }
            }
        }
    };
}
```

In this example, if the model would want to call the `getFruitPrice` function twice, it would use the following syntax:
```
[[call: getFruitPrice({name: "apple"})]]
[[call: getFruitPrice({name: "banana"})]]<EOT token>
```
And the result would be:
```
Results:
getFruitPrice({name: "apple"}) result: {name: "apple", price: "$6"};
getFruitPrice({name: "banana"}) result: {name: "banana", price: "$4"};


```

## Troubleshooting {#troubleshooting}
### Function Calling Issues With [`JinjaTemplateChatWrapper`](../api/classes/JinjaTemplateChatWrapper.md) {#troubleshoot-jinja-function-calling-issues}
If function calling doesn't work well (or at all) with a model you're trying to use,
and the [chat wrapper](./chat-wrapper.md) used by your [`LlamaChatSession`](../api/classes/LlamaChatSession.md)
is a [`JinjaTemplateChatWrapper`](../api/classes/JinjaTemplateChatWrapper.md)
(you can check that by accessing [`.chatWrapper`](../api/classes/LlamaChatSession.md#chatwrapper)),
you can try to force it to not use the function calling template defined in the Jinja template.

Doing this can help you achieve better function calling performance with some models.

To do this, create your [`LlamaChatSession`](../api/classes/LlamaChatSession.md) like this:
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

// ---cut---
import {LlamaChatSession, resolveChatWrapper} from "node-llama-cpp";

const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
    chatWrapper: resolveChatWrapper(model, {
        customWrapperSettings: {
            jinjaTemplate: {
                functionCallMessageTemplate: "noJinja"
            }
        }
    })
});
```
