import {describe, expect, test} from "vitest";
import {ChatHistoryItem, defineChatSessionFunction, HarmonyChatWrapper} from "../../../src/index.js";
import {defaultChatSystemPrompt} from "../../../src/config.js";


describe("HarmonyChatWrapper", () => {
    const todayDate = new Date("2025-08-05T00:00:00Z");

    const conversationHistory: ChatHistoryItem[] = [{
        type: "system",
        text: defaultChatSystemPrompt
    }, {
        type: "user",
        text: "Hi there!"
    }, {
        type: "model",
        response: [
            {
                type: "segment",
                segmentType: "thought",
                text: "Let me think how to respond to this.",
                ended: true
            },
            "Hello!"
        ]
    }, {
        type: "user",
        text: "How are you?"
    }, {
        type: "model",
        response: [
            {
                type: "segment",
                segmentType: "thought",
                text: "Let me think how to answer",
                ended: true
            },
            {
                type: "segment",
                segmentType: "comment",
                text: "This is a question about my state",
                ended: true
            },
            "I'm good, how are you?"
        ]
    }];

    const functions = {
        getRandomNumber: defineChatSessionFunction({
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
            },
            async handler(params) {
                return Math.floor(Math.random() * (params.max - params.min + 1) + params.min);
            }
        }),
        notifyOwner: defineChatSessionFunction({
            description: "Send a notification to the owner, and create sub notifications",
            params: {
                $ref: "#/$defs/notification",
                $defs: {
                    notification: {
                        type: "object",
                        properties: {
                            message: {
                                type: "string"
                            },
                            subNotifications: {
                                type: "array",
                                items: {
                                    $ref: "#/$defs/notification"
                                }
                            }
                        }
                    }
                }
            },
            handler(notification) {
                return "Notification created: " + notification.message;
            }
        }),
        notifyOwner2: defineChatSessionFunction({
            description: "Send a notification to the owner, and create sub notifications",
            params: {
                $ref: "#/$defs/notification",
                $defs: {
                    notification: {
                        type: "object",
                        properties: {
                            message: {
                                type: "string",
                                description: "Notification message"
                            },
                            subNotifications: {
                                type: "array",
                                description: "Sub notifications",
                                items: {
                                    $ref: "#/$defs/notification"
                                }
                            }
                        }
                    }
                }
            },
            handler(notification) {
                return "Notification created: " + notification.message;
            }
        }),
        func1: defineChatSessionFunction({
            description: "Some function",
            params: {
                type: "object",
                properties: {
                    message: {
                        type: "string",
                        description: "Some message",
                        minLength: 3,
                        maxLength: 10
                    },
                    words: {
                        type: "array",
                        description: "Some words",
                        items: {
                            type: "string"
                        },
                        minItems: 2,
                        maxItems: 5
                    },
                    headers: {
                        type: "object",
                        description: "Some headers",
                        additionalProperties: {
                            type: "string"
                        },
                        minProperties: 4,
                        maxProperties: 12
                    },
                    mappings: {
                        type: "object",
                        description: "Some mappings",
                        properties: {
                            a: {
                                type: "boolean"
                            },
                            b: {
                                type: "number"
                            },
                            c: {
                                type: ["string", "null"]
                            }
                        },
                        additionalProperties: {
                            type: "string"
                        },
                        minProperties: 4,
                        maxProperties: 12
                    }
                }
            },
            handler(params) {

            }
        })
    };
    const conversationHistory2: ChatHistoryItem[] = [{
        type: "system",
        text: defaultChatSystemPrompt
    }, {
        type: "user",
        text: "Hi there!"
    }, {
        type: "model",
        response: ["Hello!"]
    }, {
        type: "user",
        text: "Role a dice twice and tell me the total result"
    }, {
        type: "model",
        response: [
            {
                type: "functionCall",
                name: "getRandomNumber",
                description: "Get a random number",
                params: {
                    min: 1,
                    max: 6
                },
                result: 3
            },
            {
                type: "functionCall",
                name: "getRandomNumber",
                description: "Get a random number",
                params: {
                    min: 1,
                    max: 6
                },
                result: 4
            },
            "The total result of rolling the dice twice is 3 + 4 = 7."
        ]
    }];

    test("should generate valid context text", () => {
        const chatWrapper = new HarmonyChatWrapper({todayDate, keepOnlyLastThought: false});
        const {contextText} = chatWrapper.generateContextState({chatHistory: conversationHistory});

        expect(contextText).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialTokensText("<|start|>system<|message|>"),
            "You are ChatGPT, a large language model trained by OpenAI.
          Knowledge cutoff: 2024-06
          Current date: 2025-08-05

          Reasoning: medium

          # Valid channels: analysis, commentary, final. Channel must be included for every message.",
            new SpecialTokensText("<|end|><|start|>developer<|message|>"),
            "# Instruction

          You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            new SpecialTokensText("<|end|><|start|>user<|message|>"),
            "Hi there!",
            new SpecialTokensText("<|end|><|start|>assistant<|channel|>analysis<|message|>"),
            "Let me think how to respond to this.",
            new SpecialTokensText("<|end|><|start|>assistant<|channel|>final<|message|>"),
            "Hello!",
            new SpecialTokensText("<|end|><|start|>user<|message|>"),
            "How are you?",
            new SpecialTokensText("<|end|><|start|>assistant<|channel|>analysis<|message|>"),
            "Let me think how to answer",
            new SpecialTokensText("<|end|><|start|>assistant<|channel|>commentary<|message|>"),
            "This is a question about my state",
            new SpecialTokensText("<|end|><|start|>assistant<|channel|>final<|message|>"),
            "I'm good, how are you?",
          ])
        `);

        const chatWrapper2 = new HarmonyChatWrapper({todayDate});
        const {contextText: contextText2} = chatWrapper2.generateContextState({
            chatHistory: conversationHistory2,
            availableFunctions: functions
        });

        expect(contextText2).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialTokensText("<|start|>system<|message|>"),
            "You are ChatGPT, a large language model trained by OpenAI.
          Knowledge cutoff: 2024-06
          Current date: 2025-08-05

          Reasoning: medium

          # Valid channels: analysis, commentary, final. Channel must be included for every message.
          Calls to these tools must go to the commentary channel: 'functions'.",
            new SpecialTokensText("<|end|><|start|>developer<|message|>"),
            "# Instructions

          You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.

          # Tools

          ## functions

          namespace functions {

          // Get a random number
          type getRandomNumber = (_: {min: number, max: number}) => any;

          // Send a notification to the owner, and create sub notifications
          type notifyOwner = (_: /* Type: notification */ {message: string, subNotifications: (/* notification type */ any)[]}) => any;

          // Send a notification to the owner, and create sub notifications
          type notifyOwner2 = (_: /* Type: notification */ {
          // Notification message
          message: string,

          // Sub notifications
          subNotifications: (/* notification type */ any)[]
          }) => any;

          // Some function
          type func1 = (_: {
          // Some message
          // minimum length: 3, maximum length: 10
          message: string,

          // Some words
          // maximum items: 5
          words: [string, string, ...string[]],

          // Some headers
          // minimum number of properties: 4, maximum number of properties: 12
          headers: {[key: string]: string},

          // Some mappings
          // minimum number of properties: 4, maximum number of properties: 12
          mappings: {a: boolean, b: number, c: string | null} & {[key: string]: string}
          }) => any;

          } // namespace functions",
            new SpecialTokensText("<|end|><|start|>user<|message|>"),
            "Hi there!",
            new SpecialTokensText("<|end|><|start|>assistant<|channel|>final<|message|>"),
            "Hello!",
            new SpecialTokensText("<|end|><|start|>user<|message|>"),
            "Role a dice twice and tell me the total result",
            new SpecialTokensText("<|end|><|start|>assistant<|channel|>commentary to="),
            "functions.getRandomNumber",
            new SpecialTokensText("<|constrain|>json<|message|>"),
            "{"min": 1, "max": 6}",
            new SpecialTokensText("<|call|><|start|>"),
            "functions.getRandomNumber",
            new SpecialTokensText(" to=assistant<|channel|>commentary<|message|>"),
            "3",
            new SpecialTokensText("<|end|><|start|>assistant<|channel|>commentary to="),
            "functions.getRandomNumber",
            new SpecialTokensText("<|constrain|>json<|message|>"),
            "{"min": 1, "max": 6}",
            new SpecialTokensText("<|call|><|start|>"),
            "functions.getRandomNumber",
            new SpecialTokensText(" to=assistant<|channel|>commentary<|message|>"),
            "4",
            new SpecialTokensText("<|end|><|start|>assistant<|channel|>final<|message|>"),
            "The total result of rolling the dice twice is 3 + 4 = 7.",
          ])
        `);

        const chatWrapper3 = new HarmonyChatWrapper({todayDate});
        const {contextText: contextText3} = chatWrapper3.generateContextState({chatHistory: conversationHistory});
        const {contextText: contextText3WithOpenModelResponse} = chatWrapper3.generateContextState({
            chatHistory: [
                ...conversationHistory,
                {
                    type: "model",
                    response: []
                }
            ]
        });

        expect(contextText3).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialTokensText("<|start|>system<|message|>"),
            "You are ChatGPT, a large language model trained by OpenAI.
          Knowledge cutoff: 2024-06
          Current date: 2025-08-05

          Reasoning: medium

          # Valid channels: analysis, commentary, final. Channel must be included for every message.",
            new SpecialTokensText("<|end|><|start|>developer<|message|>"),
            "# Instruction

          You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            new SpecialTokensText("<|end|><|start|>user<|message|>"),
            "Hi there!",
            new SpecialTokensText("<|end|><|start|>assistant<|channel|>final<|message|>"),
            "Hello!",
            new SpecialTokensText("<|end|><|start|>user<|message|>"),
            "How are you?",
            new SpecialTokensText("<|end|><|start|>assistant<|channel|>analysis<|message|>"),
            "Let me think how to answer",
            new SpecialTokensText("<|end|><|start|>assistant<|channel|>commentary<|message|>"),
            "This is a question about my state",
            new SpecialTokensText("<|end|><|start|>assistant<|channel|>final<|message|>"),
            "I'm good, how are you?",
          ])
        `);

        expect(contextText3WithOpenModelResponse).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialTokensText("<|start|>system<|message|>"),
            "You are ChatGPT, a large language model trained by OpenAI.
          Knowledge cutoff: 2024-06
          Current date: 2025-08-05

          Reasoning: medium

          # Valid channels: analysis, commentary, final. Channel must be included for every message.",
            new SpecialTokensText("<|end|><|start|>developer<|message|>"),
            "# Instruction

          You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            new SpecialTokensText("<|end|><|start|>user<|message|>"),
            "Hi there!",
            new SpecialTokensText("<|end|><|start|>assistant<|channel|>final<|message|>"),
            "Hello!",
            new SpecialTokensText("<|end|><|start|>user<|message|>"),
            "How are you?",
            new SpecialTokensText("<|end|><|start|>assistant<|channel|>commentary<|message|>"),
            "This is a question about my state",
            new SpecialTokensText("<|end|><|start|>assistant<|channel|>final<|message|>"),
            "I'm good, how are you?",
            new SpecialTokensText("<|end|><|start|>assistant"),
          ])
        `);
    });
});
