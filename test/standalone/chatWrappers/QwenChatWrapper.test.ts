import {describe, expect, test} from "vitest";
import {ChatHistoryItem, ChatModelFunctions, QwenChatWrapper} from "../../../src/index.js";
import {defaultChatSystemPrompt} from "../../../src/config.js";


describe("QwenChatWrapper", () => {
    const conversationHistory: ChatHistoryItem[] = [{
        type: "system",
        text: defaultChatSystemPrompt
    }, {
        type: "user",
        text: "Hi there!"
    }, {
        type: "model",
        response: ["Hello!"]
    }];
    const conversationHistory2: ChatHistoryItem[] = [
        ...(new QwenChatWrapper()).generateInitialChatHistory({systemPrompt: defaultChatSystemPrompt}), {
            type: "user",
            text: "Hi there!"
        }, {
            type: "model",
            response: ["Hello!"]
        }, {
            type: "user",
            text: "What is the time?"
        }, {
            type: "model",
            response: [{
                type: "functionCall",
                name: "getTime",
                description: "Retrieve the current time",
                params: {
                    hours: "24",
                    seconds: true
                },
                result: "22:00:00"
            }, "I'm good, how are you?"]
        }
    ];
    const conversationHistory2Functions: ChatModelFunctions = {
        getTime: {
            description: "Retrieve the current time",
            params: {
                type: "object",
                properties: {
                    hours: {
                        enum: ["24", "12"]
                    },
                    seconds: {
                        type: "boolean"
                    }
                }
            }
        }
    };
    const conversationHistory3: ChatHistoryItem[] = [
        ...(new QwenChatWrapper()).generateInitialChatHistory({systemPrompt: defaultChatSystemPrompt}), {
            type: "user",
            text: "Hi there!"
        }, {
            type: "model",
            response: ["Hello!"]
        }, {
            type: "user",
            text: "What is the time?"
        }, {
            type: "model",
            response: ["I'll fetch some information for you", {
                type: "functionCall",
                name: "getTime",
                description: "Retrieve the current time",
                params: {
                    hours: "24",
                    seconds: true
                },
                result: "22:00:00",
                startsNewChunk: true
            }, {
                type: "functionCall",
                name: "getDate",
                description: "Retrieve the current date",
                params: {
                    timezone: 0
                },
                result: "2025-03-20T00:00:00Z",
                startsNewChunk: false
            }, "I'm good, how are you?"]
        }
    ];
    const conversationHistory3Functions: ChatModelFunctions = {
        getTime: {
            description: "Retrieve the current time",
            params: {
                type: "object",
                properties: {
                    hours: {
                        enum: ["24", "12"]
                    },
                    seconds: {
                        type: "boolean"
                    }
                }
            }
        },
        getDate: {
            description: "Retrieve the current date",
            params: {
                type: "object",
                properties: {
                    timezone: {
                        type: "integer"
                    }
                }
            }
        }
    };

    test("should generate valid context text", () => {
        const chatWrapper = new QwenChatWrapper();
        const {contextText} = chatWrapper.generateContextState({chatHistory: conversationHistory});

        expect(contextText).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialTokensText("<|im_start|>system
          "),
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            new SpecialTokensText("<|im_end|>
          <|im_start|>user
          "),
            "Hi there!",
            new SpecialTokensText("<|im_end|>
          <|im_start|>assistant
          "),
            "Hello!",
          ])
        `);

        const chatWrapper2 = new QwenChatWrapper();
        const {contextText: contextText2} = chatWrapper2.generateContextState({
            chatHistory: conversationHistory2,
            availableFunctions: conversationHistory2Functions
        });

        expect(contextText2).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialTokensText("<|im_start|>system
          "),
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.

          # Tools

          You may call one or more functions to assist with the user query.

          You are provided with function signatures within ",
            new SpecialTokensText("<tools></tools>"),
            " XML tags:
          ",
            new SpecialTokensText("<tools>"),
            "
          {"type": "function", "function": {"name": "getTime", "description": "Retrieve the current time", "parameters": {"type": "object", "properties": {"hours": {"enum": ["24", "12"]}, "seconds": {"type": "boolean"}}}}}
          ",
            new SpecialTokensText("</tools>"),
            "

          For each function call, return a json object with function name and arguments within ",
            new SpecialTokensText("<tool_call></tool_call>"),
            " XML tags:
          ",
            new SpecialTokensText("<tool_call>"),
            "
          {"name": <function-name>, "arguments": <args-json-object>}
          ",
            new SpecialTokensText("</tool_call><|im_end|>
          <|im_start|>user
          "),
            "Hi there!",
            new SpecialTokensText("<|im_end|>
          <|im_start|>assistant
          "),
            "Hello!",
            new SpecialTokensText("<|im_end|>
          <|im_start|>user
          "),
            "What is the time?",
            new SpecialTokensText("<|im_end|>
          <|im_start|>assistant
          <tool_call>"),
            "
          {"name": "getTime", "arguments": {"hours": "24", "seconds": true}}
          ",
            new SpecialTokensText("</tool_call><|im_end|>
          <|im_start|>user
          <tool_response>
          "),
            ""22:00:00"",
            new SpecialTokensText("
          </tool_response><|im_end|>
          <|im_start|>assistant
          "),
            "I'm good, how are you?",
          ])
        `);

        const chatWrapper3 = new QwenChatWrapper();
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
            new SpecialTokensText("<|im_start|>system
          "),
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            new SpecialTokensText("<|im_end|>
          <|im_start|>user
          "),
            "Hi there!",
            new SpecialTokensText("<|im_end|>
          <|im_start|>assistant
          "),
            "Hello!",
          ])
        `);

        expect(contextText3WithOpenModelResponse).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialTokensText("<|im_start|>system
          "),
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            new SpecialTokensText("<|im_end|>
          <|im_start|>user
          "),
            "Hi there!",
            new SpecialTokensText("<|im_end|>
          <|im_start|>assistant
          "),
            "Hello!",
            new SpecialTokensText("<|im_end|>
          <|im_start|>assistant
          "),
          ])
        `);
    });

    test("should generate valid context text for 2 sequential function calls", () => {
        const chatWrapper = new QwenChatWrapper();
        const {contextText} = chatWrapper.generateContextState({
            chatHistory: conversationHistory3,
            availableFunctions: conversationHistory3Functions
        });

        expect(contextText).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialTokensText("<|im_start|>system
          "),
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.

          # Tools

          You may call one or more functions to assist with the user query.

          You are provided with function signatures within ",
            new SpecialTokensText("<tools></tools>"),
            " XML tags:
          ",
            new SpecialTokensText("<tools>"),
            "
          {"type": "function", "function": {"name": "getTime", "description": "Retrieve the current time", "parameters": {"type": "object", "properties": {"hours": {"enum": ["24", "12"]}, "seconds": {"type": "boolean"}}}}}
          {"type": "function", "function": {"name": "getDate", "description": "Retrieve the current date", "parameters": {"type": "object", "properties": {"timezone": {"type": "integer"}}}}}
          ",
            new SpecialTokensText("</tools>"),
            "

          For each function call, return a json object with function name and arguments within ",
            new SpecialTokensText("<tool_call></tool_call>"),
            " XML tags:
          ",
            new SpecialTokensText("<tool_call>"),
            "
          {"name": <function-name>, "arguments": <args-json-object>}
          ",
            new SpecialTokensText("</tool_call><|im_end|>
          <|im_start|>user
          "),
            "Hi there!",
            new SpecialTokensText("<|im_end|>
          <|im_start|>assistant
          "),
            "Hello!",
            new SpecialTokensText("<|im_end|>
          <|im_start|>user
          "),
            "What is the time?",
            new SpecialTokensText("<|im_end|>
          <|im_start|>assistant
          "),
            "I'll fetch some information for you",
            new SpecialTokensText("<tool_call>"),
            "
          {"name": "getTime", "arguments": {"hours": "24", "seconds": true}}
          ",
            new SpecialTokensText("</tool_call>"),
            "
          ",
            new SpecialTokensText("<tool_call>"),
            "
          {"name": "getDate", "arguments": {"timezone": 0}}
          ",
            new SpecialTokensText("</tool_call><|im_end|>
          <|im_start|>user
          <tool_response>
          "),
            ""22:00:00"",
            new SpecialTokensText("
          </tool_response>
          <tool_response>
          "),
            ""2025-03-20T00:00:00Z"",
            new SpecialTokensText("
          </tool_response><|im_end|>
          <|im_start|>assistant
          "),
            "I'm good, how are you?",
          ])
        `);
    });
});
