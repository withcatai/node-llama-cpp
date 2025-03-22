import {describe, expect, test} from "vitest";
import {ChatHistoryItem, ChatModelFunctions, DeepSeekChatWrapper} from "../../../src/index.js";
import {defaultChatSystemPrompt} from "../../../src/config.js";


describe("DeepSeekChatWrapper", () => {
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
        ...(new DeepSeekChatWrapper()).generateInitialChatHistory({systemPrompt: defaultChatSystemPrompt}), {
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
        ...(new DeepSeekChatWrapper()).generateInitialChatHistory({systemPrompt: defaultChatSystemPrompt}), {
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
            response: ["I'll fet some information for you", {
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
        const chatWrapper = new DeepSeekChatWrapper();
        const {contextText} = chatWrapper.generateContextState({chatHistory: conversationHistory});

        expect(contextText).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialToken("BOS"),
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            new SpecialTokensText("<｜User｜>"),
            "Hi there!",
            new SpecialTokensText("<｜Assistant｜>"),
            "Hello!",
          ])
        `);

        const chatWrapper2 = new DeepSeekChatWrapper();
        const {contextText: contextText2} = chatWrapper2.generateContextState({
            chatHistory: conversationHistory2,
            availableFunctions: conversationHistory2Functions
        });

        expect(contextText2).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialToken("BOS"),
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.

          The assistant calls the provided functions as needed to retrieve information instead of relying on existing knowledge.
          To fulfill a request, the assistant calls relevant functions in advance when needed before responding to the request, and does not tell the user prior to calling a function.
          If the result of function calls from previous turns might be stale, the assistant will call the functions again if needed.
          Provided functions:
          {"name": "getTime", "description": "Retrieve the current time", "parameters": {"type": "object", "properties": {"hours": {"enum": ["24", "12"]}, "seconds": {"type": "boolean"}}}}

          Calling any of the provided functions can be done like this:
          ",
            new SpecialTokensText("<function="),
            "getSomeInfo",
            new SpecialTokensText(">"),
            "{"someKey": "someValue"}",
            new SpecialTokensText("</function>"),
            "

          Note that the verbatim ",
            new SpecialTokensText("<function="),
            " prefix is mandatory.

          The assistant never assumes the results of function calls, and instead uses the raw results directly for processing.
          The assistant does not inform the user about using functions and does not explain anything before calling a function.
          After calling a function, the raw result appears afterwards and is not part of the conversation.
          To make information be part of the conversation, the assistant paraphrases and repeats the information without the function syntax.
          The assistant never repeats itself unless necessary.",
            new SpecialTokensText("<｜User｜>"),
            "Hi there!",
            new SpecialTokensText("<｜Assistant｜>"),
            "Hello!",
            new SpecialTokensText("<｜end▁of▁sentence｜><｜User｜>"),
            "What is the time?",
            new SpecialTokensText("<｜Assistant｜><function="),
            "getTime",
            new SpecialTokensText(">"),
            "{"hours": "24", "seconds": true}",
            new SpecialTokensText("</function><｜tool▁output▁begin｜>"),
            ""22:00:00"",
            new SpecialTokensText("<｜tool▁output▁end｜>
          "),
            "I'm good, how are you?",
          ])
        `);

        const chatWrapper3 = new DeepSeekChatWrapper();
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
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            new SpecialTokensText("<｜User｜>"),
            "Hi there!",
            new SpecialTokensText("<｜Assistant｜>"),
            "Hello!",
          ])
        `);

        expect(contextText3WithOpenModelResponse).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialToken("BOS"),
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            new SpecialTokensText("<｜User｜>"),
            "Hi there!",
            new SpecialTokensText("<｜Assistant｜>"),
            "Hello!",
            new SpecialTokensText("<｜end▁of▁sentence｜><｜Assistant｜>"),
          ])
        `);
    });

    test("should generate valid context text for 2 sequential function calls", () => {
        const chatWrapper = new DeepSeekChatWrapper();
        const {contextText} = chatWrapper.generateContextState({
            chatHistory: conversationHistory3,
            availableFunctions: conversationHistory3Functions
        });

        expect(contextText).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialToken("BOS"),
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.

          The assistant calls the provided functions as needed to retrieve information instead of relying on existing knowledge.
          To fulfill a request, the assistant calls relevant functions in advance when needed before responding to the request, and does not tell the user prior to calling a function.
          If the result of function calls from previous turns might be stale, the assistant will call the functions again if needed.
          Provided functions:
          {"name": "getTime", "description": "Retrieve the current time", "parameters": {"type": "object", "properties": {"hours": {"enum": ["24", "12"]}, "seconds": {"type": "boolean"}}}}

          {"name": "getDate", "description": "Retrieve the current date", "parameters": {"type": "object", "properties": {"timezone": {"type": "integer"}}}}

          Calling any of the provided functions can be done like this:
          ",
            new SpecialTokensText("<function="),
            "getSomeInfo",
            new SpecialTokensText(">"),
            "{"someKey": "someValue"}",
            new SpecialTokensText("</function>"),
            "

          Note that the verbatim ",
            new SpecialTokensText("<function="),
            " prefix is mandatory.

          The assistant never assumes the results of function calls, and instead uses the raw results directly for processing.
          The assistant does not inform the user about using functions and does not explain anything before calling a function.
          After calling a function, the raw result appears afterwards and is not part of the conversation.
          To make information be part of the conversation, the assistant paraphrases and repeats the information without the function syntax.
          The assistant never repeats itself unless necessary.",
            new SpecialTokensText("<｜User｜>"),
            "Hi there!",
            new SpecialTokensText("<｜Assistant｜>"),
            "Hello!",
            new SpecialTokensText("<｜end▁of▁sentence｜><｜User｜>"),
            "What is the time?",
            new SpecialTokensText("<｜Assistant｜>"),
            "I'll fet some information for you",
            new SpecialTokensText("<function="),
            "getTime",
            new SpecialTokensText(">"),
            "{"hours": "24", "seconds": true}",
            new SpecialTokensText("</function><｜tool▁output▁begin｜>"),
            ""22:00:00"",
            new SpecialTokensText("<｜tool▁output▁end｜>
          <function="),
            "getDate",
            new SpecialTokensText(">"),
            "{"timezone": 0}",
            new SpecialTokensText("</function><｜tool▁output▁begin｜>"),
            ""2025-03-20T00:00:00Z"",
            new SpecialTokensText("<｜tool▁output▁end｜>
          "),
            "I'm good, how are you?",
          ])
        `);
    });
});
