# Chat Context Shift Strategy {#background}
When the chat history gets longer than the sequence's context size, we have to remove the oldest tokens from the context state to make room for new tokens to be generated.
This is called a context shift.

`node-llama-cpp` has a smart mechanism to handle context shifts on the chat level, so the oldest messages are truncated (from their beginning) or removed from the context state, while keeping the system prompt in place to ensure the model follows the guidelines you set for it.

You can override `node-llama-cpp`'s default context shift strategy
when using [`LlamaChatSession`](../api/classes/LlamaChatSession.md) or [`LlamaChat`](../api/classes/LlamaChat.md)
by providing a custom context shift strategy.

## The Default Context Shift Strategy {#default-strategy}
The [default context shift strategy](../api/type-aliases/LLamaChatContextShiftOptions.md#strategy) is `eraseFirstResponseAndKeepFirstSystem`.

This strategy attempts to truncate the oldest model responses (from their beginning) or remove them completely from the chat history while keeping the first system prompt in place.
If a response is completely removed, the prompt that came before it will be removed as well.

## Implementing a Custom Context Shift Strategy {#custom-strategy}
A [custom context shift strategy](../api/type-aliases/LLamaChatContextShiftOptions.md#strategy) is a function that receives the full chat history as input and
returns a new chat history that when tokenized will result in an array of tokens shorter than the desired max size.

The context shift strategy will be called only when the context state needs to be shifted.

If the context shift strategy returns an invalid chat history (e.g., a chat history that is too long),
the prompting function will abort the evaluation and throw an error.

A custom context shift strategy can be a simple logic that prioritizes which data to remove,
or it can even use a language model to summarize information to shorten the chat history.

It's important to keep the last user prompt and model response as-is to prevent infinite generation loops.

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

// ---cut---
const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
    contextShift: {
        strategy({
            chatHistory, chatWrapper, maxTokensCount, tokenizer,
            lastShiftMetadata
        }) {
            // clone the chat history to not mutate the original
            const newChatHistory = chatHistory.map(
                (item) => structuredClone(item)
            );

            function getTokensLeftToRemove() {
                const {
                    contextText
                } = chatWrapper.generateContextState({chatHistory});
                const tokenUsage = contextText.tokenize(tokenizer).length;

                return Math.max(0, tokenUsage - maxTokensCount);
            }

            while (getTokensLeftToRemove() > 0 && newChatHistory.length > 2) {
                for (let i = 0; i < newChatHistory.length - 2; i++) {
                    const chatItem = newChatHistory[i]!;

                    if (i === 0 && chatItem.type === "system")
                        // don't remove the first system message
                        continue;
                    else if (chatItem.type === "model") {
                        // remove the model response
                        newChatHistory.splice(i, 1);
                        i--;

                        // remove the user messages that
                        // came before the model response
                        while (
                            i > 0 &&
                            newChatHistory[i - 1]?.type === "user"
                        ) {
                            newChatHistory.splice(i - 1, 1);
                            i--;
                        }
                    } else if (chatItem.type === "system") {
                        // don't remove system messages on their own
                        continue;
                    } else if (chatItem.type === "user") {
                        // don't remove user messages on their own
                        continue;
                    } else {
                        // ensure we handle all message types.
                        // otherwise, this will error
                        void (chatItem satisfies never);
                    }
                }
            }

            return {
                chatHistory: newChatHistory,

                // this metadata will be passed to the next context shift
                // strategy call as the `lastShiftMetadata` argument
                metadata: {}
            };
        }
    }
});
```
