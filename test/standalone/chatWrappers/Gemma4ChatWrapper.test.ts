import {describe, expect, test} from "vitest";
import {ChatHistoryItem, defineChatSessionFunction, Gemma4ChatWrapper} from "../../../src/index.js";
import {defaultChatSystemPrompt} from "../../../src/config.js";


describe("Gemma4ChatWrapper", () => {
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
        const chatWrapper = new Gemma4ChatWrapper({keepOnlyLastThought: false});
        const {contextText} = chatWrapper.generateContextState({chatHistory: conversationHistory});

        expect(contextText).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialToken("BOS"),
            new SpecialTokensText("<|turn>system
          <|think|>"),
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            new SpecialTokensText("<turn|>
          <|turn>user
          "),
            "Hi there!",
            new SpecialTokensText("<turn|>
          <|turn>model
          <|channel>thought"),
            "Let me think how to respond to this.",
            new SpecialTokensText("<channel|>"),
            "Hello!",
            new SpecialTokensText("<turn|>
          <|turn>user
          "),
            "How are you?",
            new SpecialTokensText("<turn|>
          <|turn>model
          <|channel>thought"),
            "Let me think how to answer",
            new SpecialTokensText("<channel|>"),
            "I'm good, how are you?",
          ])
        `);

        const chatWrapper2 = new Gemma4ChatWrapper();
        const {contextText: contextText2} = chatWrapper2.generateContextState({
            chatHistory: conversationHistory2,
            availableFunctions: functions
        });

        expect(contextText2).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialToken("BOS"),
            new SpecialTokensText("<|turn>system
          <|think|>"),
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            new SpecialTokensText("<|tool>"),
            "declaration:getRandomNumber{{"description": "Get a random number", "parameters": {"type": "object", "properties": {"min": {"type": "number"}, "max": {"type": "number"}}}}}",
            new SpecialTokensText("<tool|><|tool>"),
            "declaration:notifyOwner{{"description": "Send a notification to the owner, and create sub notifications", "parameters": {"$ref": "#/$defs/notification", "$defs": {"notification": {"type": "object", "properties": {"message": {"type": "string"}, "subNotifications": {"type": "array", "items": {"$ref": "#/$defs/notification"}}}}}}}}",
            new SpecialTokensText("<tool|><|tool>"),
            "declaration:notifyOwner2{{"description": "Send a notification to the owner, and create sub notifications", "parameters": {"$ref": "#/$defs/notification", "$defs": {"notification": {"type": "object", "properties": {"message": {"type": "string", "description": "Notification message"}, "subNotifications": {"type": "array", "description": "Sub notifications", "items": {"$ref": "#/$defs/notification"}}}}}}}}",
            new SpecialTokensText("<tool|><|tool>"),
            "declaration:func1{{"description": "Some function", "parameters": {"type": "object", "properties": {"message": {"type": "string", "description": "Some message", "minLength": 3, "maxLength": 10}, "words": {"type": "array", "description": "Some words", "items": {"type": "string"}, "minItems": 2, "maxItems": 5}, "headers": {"type": "object", "description": "Some headers", "additionalProperties": {"type": "string"}, "minProperties": 4, "maxProperties": 12}, "mappings": {"type": "object", "description": "Some mappings", "properties": {"a": {"type": "boolean"}, "b": {"type": "number"}, "c": {"type": ["string", "null"]}}, "additionalProperties": {"type": "string"}, "minProperties": 4, "maxProperties": 12}}}}}",
            new SpecialTokensText("<tool|><turn|>
          <|turn>user
          "),
            "Hi there!",
            new SpecialTokensText("<turn|>
          <|turn>model
          "),
            "Hello!",
            new SpecialTokensText("<turn|>
          <|turn>user
          "),
            "Role a dice twice and tell me the total result",
            new SpecialTokensText("<turn|>
          <|turn>model
          <|tool_call>call:"),
            "getRandomNumber{{"min": 1, "max": 6}",
            new SpecialTokensText("}<tool_call|><tool_response>response:"),
            "getRandomNumber{3",
            new SpecialTokensText("}</tool_response><|tool_call>call:"),
            "getRandomNumber{{"min": 1, "max": 6}",
            new SpecialTokensText("}<tool_call|><tool_response>response:"),
            "getRandomNumber{4",
            new SpecialTokensText("}</tool_response>"),
            "The total result of rolling the dice twice is 3 + 4 = 7.",
          ])
        `);

        const chatWrapper3 = new Gemma4ChatWrapper();
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
            new SpecialTokensText("<|turn>system
          <|think|>"),
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            new SpecialTokensText("<turn|>
          <|turn>user
          "),
            "Hi there!",
            new SpecialTokensText("<turn|>
          <|turn>model
          "),
            "Hello!",
            new SpecialTokensText("<turn|>
          <|turn>user
          "),
            "How are you?",
            new SpecialTokensText("<turn|>
          <|turn>model
          <|channel>thought"),
            "Let me think how to answer",
            new SpecialTokensText("<channel|>"),
            "I'm good, how are you?",
          ])
        `);

        expect(contextText3WithOpenModelResponse).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialToken("BOS"),
            new SpecialTokensText("<|turn>system
          <|think|>"),
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            new SpecialTokensText("<turn|>
          <|turn>user
          "),
            "Hi there!",
            new SpecialTokensText("<turn|>
          <|turn>model
          "),
            "Hello!",
            new SpecialTokensText("<turn|>
          <|turn>user
          "),
            "How are you?",
            new SpecialTokensText("<turn|>
          <|turn>model
          "),
            "I'm good, how are you?",
            new SpecialTokensText("<turn|>
          <|turn>model
          "),
          ])
        `);
    });
});
