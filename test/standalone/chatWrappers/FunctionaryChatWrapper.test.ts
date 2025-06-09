import {describe, expect, test} from "vitest";
import {ChatHistoryItem, defineChatSessionFunction, FunctionaryChatWrapper} from "../../../src/index.js";
import {defaultChatSystemPrompt} from "../../../src/config.js";


describe("FunctionaryChatWrapper", () => {
    const conversationHistory: ChatHistoryItem[] = [{
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
        text: "How are you?"
    }, {
        type: "model",
        response: ["I'm good, how are you?"]
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

    describe("v2.llama3", () => {
        test("should generate valid context text", () => {
            const chatWrapper = new FunctionaryChatWrapper({variation: "v2.llama3"});
            const {contextText} = chatWrapper.generateContextState({chatHistory: conversationHistory});

            expect(contextText).toMatchInlineSnapshot(`
              LlamaText([
                new SpecialToken("BOS"),
                new SpecialTokensText("<|start_header_id|>system<|end_header_id|>

              "),
                "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
              If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>user<|end_header_id|>

              "),
                "Hi there!",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>assistant<|end_header_id|>

              "),
                "Hello!",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>user<|end_header_id|>

              "),
                "How are you?",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>assistant<|end_header_id|>

              "),
                "I'm good, how are you?",
              ])
            `);

            const chatWrapper2 = new FunctionaryChatWrapper({variation: "v2.llama3"});
            const {contextText: contextText2} = chatWrapper2.generateContextState({
                chatHistory: conversationHistory2,
                availableFunctions: functions
            });

            expect(contextText2).toMatchInlineSnapshot(`
              LlamaText([
                new SpecialToken("BOS"),
                new SpecialTokensText("<|start_header_id|>system<|end_header_id|>

              "),
                "// Supported function definitions that should be called when necessary.
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
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>system<|end_header_id|>

              "),
                "The assistant calls functions with appropriate input when necessary. The assistant writes <|stop|> when finished answering.",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>system<|end_header_id|>

              "),
                "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
              If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>user<|end_header_id|>

              "),
                "Hi there!",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>assistant<|end_header_id|>

              "),
                "Hello!",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>user<|end_header_id|>

              "),
                "Role a dice twice and tell me the total result",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|reserved_special_token_249|>"),
                "getRandomNumber",
                new SpecialTokensText("
              "),
                "{"min": 1, "max": 6}",
                new SpecialTokensText("<|reserved_special_token_249|>"),
                "getRandomNumber",
                new SpecialTokensText("
              "),
                "{"min": 1, "max": 6}",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>tool<|end_header_id|>

              name="),
                "getRandomNumber",
                new SpecialTokensText("
              "),
                "3",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>tool<|end_header_id|>

              name="),
                "getRandomNumber",
                new SpecialTokensText("
              "),
                "4",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>assistant<|end_header_id|>

              "),
                "The total result of rolling the dice twice is 3 + 4 = 7.",
              ])
            `);

            const chatWrapper3 = new FunctionaryChatWrapper({variation: "v2.llama3"});
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
                new SpecialToken("BOS"),
                new SpecialTokensText("<|start_header_id|>system<|end_header_id|>

              "),
                "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
              If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>user<|end_header_id|>

              "),
                "Hi there!",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>assistant<|end_header_id|>

              "),
                "Hello!",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>user<|end_header_id|>

              "),
                "How are you?",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>assistant<|end_header_id|>

              "),
                "I'm good, how are you?",
              ])
            `);

            expect(contextText3WithOpenModelResponse).toMatchInlineSnapshot(`
              LlamaText([
                new SpecialToken("BOS"),
                new SpecialTokensText("<|start_header_id|>system<|end_header_id|>

              "),
                "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
              If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>user<|end_header_id|>

              "),
                "Hi there!",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>assistant<|end_header_id|>

              "),
                "Hello!",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>user<|end_header_id|>

              "),
                "How are you?",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>assistant<|end_header_id|>

              "),
                "I'm good, how are you?",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>assistant<|end_header_id|>

              "),
              ])
            `);
        });
    });

    describe("v2", () => {
        test("should generate valid context text", () => {
            const chatWrapper = new FunctionaryChatWrapper({variation: "v2"});
            const {contextText} = chatWrapper.generateContextState({chatHistory: conversationHistory});

            expect(contextText).toMatchInlineSnapshot(`
              LlamaText([
                new SpecialToken("BOS"),
                new SpecialTokensText("<|from|>system
              <|recipient|>all
              <|content|>"),
                "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
              If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
                new SpecialTokensText("
              <|from|>user
              <|recipient|>all
              <|content|>"),
                "Hi there!",
                new SpecialTokensText("
              <|from|>assistant
              <|recipient|>all
              <|content|>"),
                "Hello!",
                new SpecialTokensText("<|stop|>
              <|from|>user
              <|recipient|>all
              <|content|>"),
                "How are you?",
                new SpecialTokensText("
              <|from|>assistant
              <|recipient|>all
              <|content|>"),
                "I'm good, how are you?",
              ])
            `);

            const chatWrapper2 = new FunctionaryChatWrapper({variation: "v2"});
            const {contextText: contextText2} = chatWrapper2.generateContextState({
                chatHistory: conversationHistory2,
                availableFunctions: functions
            });

            expect(contextText2).toMatchInlineSnapshot(`
              LlamaText([
                new SpecialToken("BOS"),
                new SpecialTokensText("<|from|>system
              <|recipient|>all
              <|content|>"),
                "// Supported function definitions that should be called when necessary.
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
                new SpecialTokensText("
              <|from|>system
              <|recipient|>all
              <|content|>"),
                "The assistant calls functions with appropriate input when necessary. The assistant writes <|stop|> when finished answering.",
                new SpecialTokensText("
              <|from|>system
              <|recipient|>all
              <|content|>"),
                "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
              If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
                new SpecialTokensText("
              <|from|>user
              <|recipient|>all
              <|content|>"),
                "Hi there!",
                new SpecialTokensText("
              <|from|>assistant
              <|recipient|>all
              <|content|>"),
                "Hello!",
                new SpecialTokensText("<|stop|>
              <|from|>user
              <|recipient|>all
              <|content|>"),
                "Role a dice twice and tell me the total result",
                new SpecialTokensText("
              <|from|>assistant
              <|recipient|>"),
                "getRandomNumber",
                new SpecialTokensText("
              <|content|>"),
                "{"min": 1, "max": 6}",
                new SpecialTokensText("
              <|from|>assistant
              <|recipient|>"),
                "getRandomNumber",
                new SpecialTokensText("
              <|content|>"),
                "{"min": 1, "max": 6}",
                new SpecialTokensText("<|stop|>
              <|from|>"),
                "getRandomNumber",
                new SpecialTokensText("
              <|recipient|>all
              <|content|>"),
                "3",
                new SpecialTokensText("
              <|from|>"),
                "getRandomNumber",
                new SpecialTokensText("
              <|recipient|>all
              <|content|>"),
                "4",
                new SpecialTokensText("
              <|from|>assistant
              <|recipient|>all
              <|content|>"),
                "The total result of rolling the dice twice is 3 + 4 = 7.",
              ])
            `);

            const chatWrapper3 = new FunctionaryChatWrapper({variation: "v2"});
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
                new SpecialToken("BOS"),
                new SpecialTokensText("<|from|>system
              <|recipient|>all
              <|content|>"),
                "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
              If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
                new SpecialTokensText("
              <|from|>user
              <|recipient|>all
              <|content|>"),
                "Hi there!",
                new SpecialTokensText("
              <|from|>assistant
              <|recipient|>all
              <|content|>"),
                "Hello!",
                new SpecialTokensText("<|stop|>
              <|from|>user
              <|recipient|>all
              <|content|>"),
                "How are you?",
                new SpecialTokensText("
              <|from|>assistant
              <|recipient|>all
              <|content|>"),
                "I'm good, how are you?",
              ])
            `);

            expect(contextText3WithOpenModelResponse).toMatchInlineSnapshot(`
              LlamaText([
                new SpecialToken("BOS"),
                new SpecialTokensText("<|from|>system
              <|recipient|>all
              <|content|>"),
                "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
              If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
                new SpecialTokensText("
              <|from|>user
              <|recipient|>all
              <|content|>"),
                "Hi there!",
                new SpecialTokensText("
              <|from|>assistant
              <|recipient|>all
              <|content|>"),
                "Hello!",
                new SpecialTokensText("<|stop|>
              <|from|>user
              <|recipient|>all
              <|content|>"),
                "How are you?",
                new SpecialTokensText("
              <|from|>assistant
              <|recipient|>all
              <|content|>"),
                "I'm good, how are you?",
                new SpecialTokensText("<|stop|>
              <|from|>assistant
              <|recipient|>all
              <|content|>"),
              ])
            `);
        });
    });
});
