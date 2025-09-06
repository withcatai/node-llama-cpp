import path from "node:path";
import {
    getLlama, Llama, LlamaChatSession, LlamaChatSessionPromptCompletionEngine, LlamaContext, LlamaContextSequence, LlamaModel,
    isChatModelResponseSegment, type ChatModelSegmentType
} from "node-llama-cpp";
import {withLock, State} from "lifecycle-utils";
import packageJson from "../../package.json";
import {modelFunctions} from "../llm/modelFunctions.js";

export const llmState = new State<LlmState>({
    appVersion: packageJson.version,
    llama: {
        loaded: false
    },
    model: {
        loaded: false
    },
    context: {
        loaded: false
    },
    contextSequence: {
        loaded: false
    },
    chatSession: {
        loaded: false,
        generatingResult: false,
        simplifiedChat: [],
        draftPrompt: {
            prompt: "",
            completion: ""
        }
    }
});

export type LlmState = {
    appVersion?: string,
    llama: {
        loaded: boolean,
        error?: string
    },
    selectedModelFilePath?: string,
    model: {
        loaded: boolean,
        loadProgress?: number,
        name?: string,
        error?: string
    },
    context: {
        loaded: boolean,
        error?: string
    },
    contextSequence: {
        loaded: boolean,
        error?: string
    },
    chatSession: {
        loaded: boolean,
        generatingResult: boolean,
        simplifiedChat: SimplifiedChatItem[],
        draftPrompt: {
            prompt: string,
            completion: string
        }
    }
};

export type SimplifiedChatItem = SimplifiedUserChatItem | SimplifiedModelChatItem;
export type SimplifiedUserChatItem = {
    type: "user",
    message: string
};
export type SimplifiedModelChatItem = {
    type: "model",
    message: Array<{
        type: "text",
        text: string
    } | {
        type: "segment",
        segmentType: ChatModelSegmentType,
        text: string,
        startTime?: string,
        endTime?: string
    }>
};

let llama: Llama | null = null;
let model: LlamaModel | null = null;
let context: LlamaContext | null = null;
let contextSequence: LlamaContextSequence | null = null;

let chatSession: LlamaChatSession | null = null;
let chatSessionCompletionEngine: LlamaChatSessionPromptCompletionEngine | null = null;
let promptAbortController: AbortController | null = null;
let inProgressResponse: SimplifiedModelChatItem["message"] = [];

export const llmFunctions = {
    async loadLlama() {
        await withLock([llmFunctions, "llama"], async () => {
            if (llama != null) {
                try {
                    await llama.dispose();
                    llama = null;
                } catch (err) {
                    console.error("Failed to dispose llama", err);
                }
            }

            try {
                llmState.state = {
                    ...llmState.state,
                    llama: {loaded: false}
                };

                llama = await getLlama();
                llmState.state = {
                    ...llmState.state,
                    llama: {loaded: true}
                };

                llama.onDispose.createListener(() => {
                    llmState.state = {
                        ...llmState.state,
                        llama: {loaded: false}
                    };
                });
            } catch (err) {
                console.error("Failed to load llama", err);
                llmState.state = {
                    ...llmState.state,
                    llama: {
                        loaded: false,
                        error: String(err)
                    }
                };
            }
        });
    },
    async loadModel(modelPath: string) {
        await withLock([llmFunctions, "model"], async () => {
            if (llama == null)
                throw new Error("Llama not loaded");

            if (model != null) {
                try {
                    await model.dispose();
                    model = null;
                } catch (err) {
                    console.error("Failed to dispose model", err);
                }
            }

            try {
                llmState.state = {
                    ...llmState.state,
                    model: {
                        loaded: false,
                        loadProgress: 0
                    }
                };

                model = await llama.loadModel({
                    modelPath,
                    onLoadProgress(loadProgress: number) {
                        llmState.state = {
                            ...llmState.state,
                            model: {
                                ...llmState.state.model,
                                loadProgress
                            }
                        };
                    }
                });
                llmState.state = {
                    ...llmState.state,
                    model: {
                        loaded: true,
                        loadProgress: 1,
                        name: path.basename(modelPath)
                    }
                };

                model.onDispose.createListener(() => {
                    llmState.state = {
                        ...llmState.state,
                        model: {loaded: false}
                    };
                });
            } catch (err) {
                console.error("Failed to load model", err);
                llmState.state = {
                    ...llmState.state,
                    model: {
                        loaded: false,
                        error: String(err)
                    }
                };
            }
        });
    },
    async createContext() {
        await withLock([llmFunctions, "context"], async () => {
            if (model == null)
                throw new Error("Model not loaded");

            if (context != null) {
                try {
                    await context.dispose();
                    context = null;
                } catch (err) {
                    console.error("Failed to dispose context", err);
                }
            }

            try {
                llmState.state = {
                    ...llmState.state,
                    context: {loaded: false}
                };

                context = await model.createContext();
                llmState.state = {
                    ...llmState.state,
                    context: {loaded: true}
                };

                context.onDispose.createListener(() => {
                    llmState.state = {
                        ...llmState.state,
                        context: {loaded: false}
                    };
                });
            } catch (err) {
                console.error("Failed to create context", err);
                llmState.state = {
                    ...llmState.state,
                    context: {
                        loaded: false,
                        error: String(err)
                    }
                };
            }
        });
    },
    async createContextSequence() {
        await withLock([llmFunctions, "contextSequence"], async () => {
            if (context == null)
                throw new Error("Context not loaded");

            try {
                llmState.state = {
                    ...llmState.state,
                    contextSequence: {loaded: false}
                };

                contextSequence = context.getSequence();
                llmState.state = {
                    ...llmState.state,
                    contextSequence: {loaded: true}
                };

                contextSequence.onDispose.createListener(() => {
                    llmState.state = {
                        ...llmState.state,
                        contextSequence: {loaded: false}
                    };
                });
            } catch (err) {
                console.error("Failed to get context sequence", err);
                llmState.state = {
                    ...llmState.state,
                    contextSequence: {
                        loaded: false,
                        error: String(err)
                    }
                };
            }
        });
    },
    chatSession: {
        async createChatSession() {
            await withLock([llmFunctions, "chatSession"], async () => {
                if (contextSequence == null)
                    throw new Error("Context sequence not loaded");

                if (chatSession != null) {
                    try {
                        chatSession.dispose();
                        chatSession = null;
                        chatSessionCompletionEngine = null;
                    } catch (err) {
                        console.error("Failed to dispose chat session", err);
                    }
                }

                try {
                    llmState.state = {
                        ...llmState.state,
                        chatSession: {
                            loaded: false,
                            generatingResult: false,
                            simplifiedChat: [],
                            draftPrompt: llmState.state.chatSession.draftPrompt
                        }
                    };

                    llmFunctions.chatSession.resetChatHistory(false);

                    try {
                        await chatSession?.preloadPrompt("", {
                            functions: modelFunctions, // these won't be called, but are used to avoid redundant context shifts
                            signal: promptAbortController?.signal
                        });
                    } catch (err) {
                        // do nothing
                    }
                    chatSessionCompletionEngine?.complete(llmState.state.chatSession.draftPrompt.prompt);

                    llmState.state = {
                        ...llmState.state,
                        chatSession: {
                            ...llmState.state.chatSession,
                            loaded: true
                        }
                    };
                } catch (err) {
                    console.error("Failed to create chat session", err);
                    llmState.state = {
                        ...llmState.state,
                        chatSession: {
                            loaded: false,
                            generatingResult: false,
                            simplifiedChat: [],
                            draftPrompt: llmState.state.chatSession.draftPrompt
                        }
                    };
                }
            });
        },
        async prompt(message: string) {
            await withLock([llmFunctions, "chatSession"], async () => {
                if (chatSession == null)
                    throw new Error("Chat session not loaded");

                llmState.state = {
                    ...llmState.state,
                    chatSession: {
                        ...llmState.state.chatSession,
                        generatingResult: true,
                        draftPrompt: {
                            prompt: "",
                            completion: ""
                        }
                    }
                };
                promptAbortController = new AbortController();

                llmState.state = {
                    ...llmState.state,
                    chatSession: {
                        ...llmState.state.chatSession,
                        simplifiedChat: getSimplifiedChatHistory(true, message)
                    }
                };

                const abortSignal = promptAbortController.signal;
                try {
                    await chatSession.prompt(message, {
                        signal: abortSignal,
                        stopOnAbortSignal: true,
                        functions: modelFunctions,
                        onResponseChunk(chunk) {
                            inProgressResponse = squashMessageIntoModelChatMessages(
                                inProgressResponse,
                                (chunk.type == null || chunk.segmentType == null)
                                    ? {
                                        type: "text",
                                        text: chunk.text
                                    }
                                    : {
                                        type: "segment",
                                        segmentType: chunk.segmentType,
                                        text: chunk.text,
                                        startTime: chunk.segmentStartTime?.toISOString(),
                                        endTime: chunk.segmentEndTime?.toISOString()
                                    }
                            );

                            llmState.state = {
                                ...llmState.state,
                                chatSession: {
                                    ...llmState.state.chatSession,
                                    simplifiedChat: getSimplifiedChatHistory(true, message)
                                }
                            };
                        }
                    });
                } catch (err) {
                    if (err !== abortSignal.reason)
                        throw err;

                    // if the prompt was aborted before the generation even started, we ignore the error
                }

                llmState.state = {
                    ...llmState.state,
                    chatSession: {
                        ...llmState.state.chatSession,
                        generatingResult: false,
                        simplifiedChat: getSimplifiedChatHistory(false),
                        draftPrompt: {
                            ...llmState.state.chatSession.draftPrompt,
                            completion:
                                chatSessionCompletionEngine?.complete(llmState.state.chatSession.draftPrompt.prompt)?.trimStart() ?? ""
                        }
                    }
                };
                inProgressResponse = [];
            });
        },
        stopActivePrompt() {
            promptAbortController?.abort();
        },
        resetChatHistory(markAsLoaded: boolean = true) {
            if (contextSequence == null)
                return;

            chatSession?.dispose();
            chatSession = new LlamaChatSession({
                contextSequence,
                autoDisposeSequence: false
            });
            chatSessionCompletionEngine = chatSession.createPromptCompletionEngine({
                functions: modelFunctions, // these won't be called, but are used to avoid redundant context shifts
                onGeneration(prompt, completion) {
                    if (llmState.state.chatSession.draftPrompt.prompt === prompt) {
                        llmState.state = {
                            ...llmState.state,
                            chatSession: {
                                ...llmState.state.chatSession,
                                draftPrompt: {
                                    prompt,
                                    completion: completion.trimStart()
                                }
                            }
                        };
                    }
                }
            });

            llmState.state = {
                ...llmState.state,
                chatSession: {
                    loaded: markAsLoaded
                        ? true
                        : llmState.state.chatSession.loaded,
                    generatingResult: false,
                    simplifiedChat: [],
                    draftPrompt: {
                        prompt: llmState.state.chatSession.draftPrompt.prompt,
                        completion: chatSessionCompletionEngine.complete(llmState.state.chatSession.draftPrompt.prompt)?.trimStart() ?? ""
                    }
                }
            };

            chatSession.onDispose.createListener(() => {
                chatSessionCompletionEngine = null;
                promptAbortController = null;
                llmState.state = {
                    ...llmState.state,
                    chatSession: {
                        loaded: false,
                        generatingResult: false,
                        simplifiedChat: [],
                        draftPrompt: llmState.state.chatSession.draftPrompt
                    }
                };
            });
        },
        setDraftPrompt(prompt: string) {
            if (chatSessionCompletionEngine == null)
                return;

            llmState.state = {
                ...llmState.state,
                chatSession: {
                    ...llmState.state.chatSession,
                    draftPrompt: {
                        prompt: prompt,
                        completion: chatSessionCompletionEngine.complete(prompt)?.trimStart() ?? ""
                    }
                }
            };
        }
    }
} as const;

function getSimplifiedChatHistory(generatingResult: boolean, currentPrompt?: string) {
    if (chatSession == null)
        return [];

    const chatHistory: SimplifiedChatItem[] = chatSession.getChatHistory()
        .flatMap((item): SimplifiedChatItem[] => {
            if (item.type === "system")
                return [];
            else if (item.type === "user")
                return [{type: "user", message: item.text}];
            else if (item.type === "model")
                return [{
                    type: "model",
                    message: item.response
                        .filter((item) => (typeof item === "string" || isChatModelResponseSegment(item)))
                        .map((item): SimplifiedModelChatItem["message"][number] | null => {
                            if (typeof item === "string")
                                return {
                                    type: "text",
                                    text: item
                                };
                            else if (isChatModelResponseSegment(item))
                                return {
                                    type: "segment",
                                    segmentType: item.segmentType,
                                    text: item.text,
                                    startTime: item.startTime,
                                    endTime: item.endTime
                                };

                            void (item satisfies never); // ensure all item types are handled
                            return null;
                        })
                        .filter((item) => item != null)

                        // squash adjacent response items of the same type
                        .reduce((res, item) => {
                            return squashMessageIntoModelChatMessages(res, item);
                        }, [] as SimplifiedModelChatItem["message"])
                }];

            void (item satisfies never); // ensure all item types are handled
            return [];
        });

    if (generatingResult && currentPrompt != null) {
        chatHistory.push({
            type: "user",
            message: currentPrompt
        });

        if (inProgressResponse.length > 0)
            chatHistory.push({
                type: "model",
                message: inProgressResponse
            });
    }

    return chatHistory;
}

/** Squash a new model response message into the existing model response messages array */
function squashMessageIntoModelChatMessages(
    modelChatMessages: SimplifiedModelChatItem["message"],
    message: SimplifiedModelChatItem["message"][number]
): SimplifiedModelChatItem["message"] {
    const newModelChatMessages = structuredClone(modelChatMessages);
    const lastExistingModelMessage = newModelChatMessages.at(-1);

    if (lastExistingModelMessage == null || lastExistingModelMessage.type !== message.type) {
        // avoid pushing empty text messages
        if (message.type !== "text" || message.text !== "")
            newModelChatMessages.push(message);

        return newModelChatMessages;
    }

    if (lastExistingModelMessage.type === "text" && message.type === "text") {
        lastExistingModelMessage.text += message.text;
        return newModelChatMessages;
    } else if (
        lastExistingModelMessage.type === "segment" && message.type === "segment" &&
        lastExistingModelMessage.segmentType === message.segmentType &&
        lastExistingModelMessage.endTime == null
    ) {
        lastExistingModelMessage.text += message.text;
        lastExistingModelMessage.endTime = message.endTime;
        return newModelChatMessages;
    }

    newModelChatMessages.push(message);
    return newModelChatMessages;
}
