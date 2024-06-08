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

            expect(contextText.values).toMatchInlineSnapshot(`
              [
                {
                  "type": "specialToken",
                  "value": "BOS",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|start_header_id|>system<|end_header_id|>

              ",
                },
                "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
              If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
                {
                  "type": "specialToken",
                  "value": "EOT",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|start_header_id|>user<|end_header_id|>

              ",
                },
                "Hi there!",
                {
                  "type": "specialToken",
                  "value": "EOT",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|start_header_id|>assistant<|end_header_id|>

              ",
                },
                "Hello!",
                {
                  "type": "specialToken",
                  "value": "EOT",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|start_header_id|>user<|end_header_id|>

              ",
                },
                "How are you?",
                {
                  "type": "specialToken",
                  "value": "EOT",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|start_header_id|>assistant<|end_header_id|>

              ",
                },
                "I'm good, how are you?",
              ]
            `);

            const chatWrapper2 = new FunctionaryChatWrapper({variation: "v2.llama3"});
            const {contextText: contextText2} = chatWrapper2.generateContextState({
                chatHistory: conversationHistory2,
                availableFunctions: functions
            });

            expect(contextText2.values).toMatchInlineSnapshot(`
              [
                {
                  "type": "specialToken",
                  "value": "BOS",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|start_header_id|>system<|end_header_id|>

              ",
                },
                "// Supported function definitions that should be called when necessary.
              namespace functions {

              // Get a random number
              type getRandomNumber = (_: {min: number, max: number}) => any;

              } // namespace functions",
                {
                  "type": "specialToken",
                  "value": "EOT",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|start_header_id|>system<|end_header_id|>

              ",
                },
                "The assistant calls functions with appropriate input when necessary. The assistant writes <|stop|> when finished answering.",
                {
                  "type": "specialToken",
                  "value": "EOT",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|start_header_id|>system<|end_header_id|>

              ",
                },
                "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
              If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
                {
                  "type": "specialToken",
                  "value": "EOT",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|start_header_id|>user<|end_header_id|>

              ",
                },
                "Hi there!",
                {
                  "type": "specialToken",
                  "value": "EOT",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|start_header_id|>assistant<|end_header_id|>

              ",
                },
                "Hello!",
                {
                  "type": "specialToken",
                  "value": "EOT",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|start_header_id|>user<|end_header_id|>

              ",
                },
                "Role a dice twice and tell me the total result",
                {
                  "type": "specialToken",
                  "value": "EOT",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|reserved_special_token_249|>",
                },
                "getRandomNumber",
                {
                  "type": "specialTokensText",
                  "value": "
              ",
                },
                "{"min":1,"max":6}",
                {
                  "type": "specialTokensText",
                  "value": "<|reserved_special_token_249|>",
                },
                "getRandomNumber",
                {
                  "type": "specialTokensText",
                  "value": "
              ",
                },
                "{"min":1,"max":6}",
                {
                  "type": "specialToken",
                  "value": "EOT",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|start_header_id|>tool<|end_header_id|>

              name=",
                },
                "getRandomNumber",
                {
                  "type": "specialTokensText",
                  "value": "
              ",
                },
                "3",
                {
                  "type": "specialToken",
                  "value": "EOT",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|start_header_id|>tool<|end_header_id|>

              name=",
                },
                "getRandomNumber",
                {
                  "type": "specialTokensText",
                  "value": "
              ",
                },
                "4",
                {
                  "type": "specialToken",
                  "value": "EOT",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|start_header_id|>assistant<|end_header_id|>

              ",
                },
                "The total result of rolling the dice twice is 3 + 4 = 7.",
              ]
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

            expect(contextText3.values).toMatchInlineSnapshot(`
              [
                {
                  "type": "specialToken",
                  "value": "BOS",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|start_header_id|>system<|end_header_id|>

              ",
                },
                "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
              If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
                {
                  "type": "specialToken",
                  "value": "EOT",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|start_header_id|>user<|end_header_id|>

              ",
                },
                "Hi there!",
                {
                  "type": "specialToken",
                  "value": "EOT",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|start_header_id|>assistant<|end_header_id|>

              ",
                },
                "Hello!",
                {
                  "type": "specialToken",
                  "value": "EOT",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|start_header_id|>user<|end_header_id|>

              ",
                },
                "How are you?",
                {
                  "type": "specialToken",
                  "value": "EOT",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|start_header_id|>assistant<|end_header_id|>

              ",
                },
                "I'm good, how are you?",
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
                  "value": "<|start_header_id|>system<|end_header_id|>

              ",
                },
                "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
              If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
                {
                  "type": "specialToken",
                  "value": "EOT",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|start_header_id|>user<|end_header_id|>

              ",
                },
                "Hi there!",
                {
                  "type": "specialToken",
                  "value": "EOT",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|start_header_id|>assistant<|end_header_id|>

              ",
                },
                "Hello!",
                {
                  "type": "specialToken",
                  "value": "EOT",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|start_header_id|>user<|end_header_id|>

              ",
                },
                "How are you?",
                {
                  "type": "specialToken",
                  "value": "EOT",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|start_header_id|>assistant<|end_header_id|>

              ",
                },
                "I'm good, how are you?",
                {
                  "type": "specialToken",
                  "value": "EOT",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|start_header_id|>assistant<|end_header_id|>

              ",
                },
              ]
            `);
        });
    });

    describe("v2", () => {
        test("should generate valid context text", () => {
            const chatWrapper = new FunctionaryChatWrapper({variation: "v2"});
            const {contextText} = chatWrapper.generateContextState({chatHistory: conversationHistory});

            expect(contextText.values).toMatchInlineSnapshot(`
              [
                {
                  "type": "specialToken",
                  "value": "BOS",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|from|>system
              <|recipient|>all
              <|content|>",
                },
                "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
              If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
                {
                  "type": "specialTokensText",
                  "value": "
              <|from|>user
              <|recipient|>all
              <|content|>",
                },
                "Hi there!",
                {
                  "type": "specialTokensText",
                  "value": "
              <|from|>assistant
              <|recipient|>all
              <|content|>",
                },
                "Hello!",
                {
                  "type": "specialTokensText",
                  "value": "<|stop|>
              <|from|>user
              <|recipient|>all
              <|content|>",
                },
                "How are you?",
                {
                  "type": "specialTokensText",
                  "value": "
              <|from|>assistant
              <|recipient|>all
              <|content|>",
                },
                "I'm good, how are you?",
              ]
            `);

            const chatWrapper2 = new FunctionaryChatWrapper({variation: "v2"});
            const {contextText: contextText2} = chatWrapper2.generateContextState({
                chatHistory: conversationHistory2,
                availableFunctions: functions
            });

            expect(contextText2.values).toMatchInlineSnapshot(`
              [
                {
                  "type": "specialToken",
                  "value": "BOS",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|from|>system
              <|recipient|>all
              <|content|>",
                },
                "// Supported function definitions that should be called when necessary.
              namespace functions {

              // Get a random number
              type getRandomNumber = (_: {min: number, max: number}) => any;

              } // namespace functions",
                {
                  "type": "specialTokensText",
                  "value": "
              <|from|>system
              <|recipient|>all
              <|content|>",
                },
                "The assistant calls functions with appropriate input when necessary. The assistant writes <|stop|> when finished answering.",
                {
                  "type": "specialTokensText",
                  "value": "
              <|from|>system
              <|recipient|>all
              <|content|>",
                },
                "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
              If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
                {
                  "type": "specialTokensText",
                  "value": "
              <|from|>user
              <|recipient|>all
              <|content|>",
                },
                "Hi there!",
                {
                  "type": "specialTokensText",
                  "value": "
              <|from|>assistant
              <|recipient|>all
              <|content|>",
                },
                "Hello!",
                {
                  "type": "specialTokensText",
                  "value": "<|stop|>
              <|from|>user
              <|recipient|>all
              <|content|>",
                },
                "Role a dice twice and tell me the total result",
                {
                  "type": "specialTokensText",
                  "value": "
              <|from|>assistant
              <|recipient|>",
                },
                "getRandomNumber",
                {
                  "type": "specialTokensText",
                  "value": "
              <|content|>",
                },
                "{"min":1,"max":6}",
                {
                  "type": "specialTokensText",
                  "value": "
              <|from|>assistant
              <|recipient|>",
                },
                "getRandomNumber",
                {
                  "type": "specialTokensText",
                  "value": "
              <|content|>",
                },
                "{"min":1,"max":6}",
                {
                  "type": "specialTokensText",
                  "value": "<|stop|>
              <|from|>",
                },
                "getRandomNumber",
                {
                  "type": "specialTokensText",
                  "value": "
              <|recipient|>all
              <|content|>",
                },
                "3",
                {
                  "type": "specialTokensText",
                  "value": "
              <|from|>",
                },
                "getRandomNumber",
                {
                  "type": "specialTokensText",
                  "value": "
              <|recipient|>all
              <|content|>",
                },
                "4",
                {
                  "type": "specialTokensText",
                  "value": "
              <|from|>assistant
              <|recipient|>all
              <|content|>",
                },
                "The total result of rolling the dice twice is 3 + 4 = 7.",
              ]
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

            expect(contextText3.values).toMatchInlineSnapshot(`
              [
                {
                  "type": "specialToken",
                  "value": "BOS",
                },
                {
                  "type": "specialTokensText",
                  "value": "<|from|>system
              <|recipient|>all
              <|content|>",
                },
                "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
              If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
                {
                  "type": "specialTokensText",
                  "value": "
              <|from|>user
              <|recipient|>all
              <|content|>",
                },
                "Hi there!",
                {
                  "type": "specialTokensText",
                  "value": "
              <|from|>assistant
              <|recipient|>all
              <|content|>",
                },
                "Hello!",
                {
                  "type": "specialTokensText",
                  "value": "<|stop|>
              <|from|>user
              <|recipient|>all
              <|content|>",
                },
                "How are you?",
                {
                  "type": "specialTokensText",
                  "value": "
              <|from|>assistant
              <|recipient|>all
              <|content|>",
                },
                "I'm good, how are you?",
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
                  "value": "<|from|>system
              <|recipient|>all
              <|content|>",
                },
                "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
              If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
                {
                  "type": "specialTokensText",
                  "value": "
              <|from|>user
              <|recipient|>all
              <|content|>",
                },
                "Hi there!",
                {
                  "type": "specialTokensText",
                  "value": "
              <|from|>assistant
              <|recipient|>all
              <|content|>",
                },
                "Hello!",
                {
                  "type": "specialTokensText",
                  "value": "<|stop|>
              <|from|>user
              <|recipient|>all
              <|content|>",
                },
                "How are you?",
                {
                  "type": "specialTokensText",
                  "value": "
              <|from|>assistant
              <|recipient|>all
              <|content|>",
                },
                "I'm good, how are you?",
                {
                  "type": "specialTokensText",
                  "value": "<|stop|>
              <|from|>assistant
              <|recipient|>all
              <|content|>",
                },
              ]
            `);
        });
    });
});
