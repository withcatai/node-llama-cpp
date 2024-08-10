import {describe, expect, test} from "vitest";
import {ChatHistoryItem, ChatModelFunctions, MistralChatWrapper} from "../../../src/index.js";
import {defaultChatSystemPrompt} from "../../../src/config.js";


describe("MistralChatWrapper", () => {
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
        ...(new MistralChatWrapper()).generateInitialChatHistory({systemPrompt: defaultChatSystemPrompt}), {
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

    test("should generate valid context text", () => {
        const chatWrapper = new MistralChatWrapper();
        const {contextText} = chatWrapper.generateContextState({chatHistory: conversationHistory});

        expect(contextText.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialTokensText",
              "value": "[INST]",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.

          Hi there!",
            {
              "type": "specialTokensText",
              "value": "[/INST]",
            },
            "Hello!",
          ]
        `);

        const chatWrapper2 = new MistralChatWrapper();
        const {contextText: contextText2} = chatWrapper2.generateContextState({
            chatHistory: conversationHistory2,
            availableFunctions: conversationHistory2Functions
        });

        expect(contextText2.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialTokensText",
              "value": "[INST]",
            },
            "Hi there!",
            {
              "type": "specialTokensText",
              "value": "[/INST]",
            },
            "Hello!",
            {
              "type": "specialToken",
              "value": "EOS",
            },
            {
              "type": "specialTokensText",
              "value": "[AVAILABLE_TOOLS]",
            },
            "[{"type": "function", "function": {"name": "getTime", "description": "Retrieve the current time", "parameters": {"type": "object", "properties": {"hours": {"enum": ["24", "12"]}, "seconds": {"type": "boolean"}}}}}]",
            {
              "type": "specialTokensText",
              "value": "[/AVAILABLE_TOOLS][INST]",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.

          What is the time?",
            {
              "type": "specialTokensText",
              "value": "[/INST][TOOL_CALLS]",
            },
            "[{"name": "getTime", "arguments": {"hours": "24", "seconds": true}}]",
            {
              "type": "specialToken",
              "value": "EOS",
            },
            {
              "type": "specialTokensText",
              "value": "[TOOL_RESULTS]",
            },
            "[{"name": "getTime", "content": "22:00:00"}]",
            {
              "type": "specialTokensText",
              "value": "[/TOOL_RESULTS]",
            },
            "I'm good, how are you?",
          ]
        `);

        const chatWrapper3 = new MistralChatWrapper();
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

        expect(contextText3.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialTokensText",
              "value": "[INST]",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.

          Hi there!",
            {
              "type": "specialTokensText",
              "value": "[/INST]",
            },
            "Hello!",
          ]
        `);

        expect(contextText3WithOpenModelResponse.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialTokensText",
              "value": "[INST]",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.

          Hi there!",
            {
              "type": "specialTokensText",
              "value": "[/INST]",
            },
            "Hello!

          ",
          ]
        `);
    });
});
