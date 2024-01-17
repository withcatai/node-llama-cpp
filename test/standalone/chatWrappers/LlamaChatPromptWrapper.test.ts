import {describe, expect, test} from "vitest";
import {ChatHistoryItem, LlamaChatWrapper} from "../../../src/index.js";
import {defaultChatSystemPrompt} from "../../../src/config.js";


describe("LlamaChatWrapper", () => {
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
        text: "How are you?"
    }, {
        type: "model",
        response: ["I'm good, how are you?"]
    }];

    test("should generate valid context text", () => {
        const chatWrapper = new LlamaChatWrapper();
        const {contextText} = chatWrapper.generateContextText(conversationHistory);

        expect(contextText.values).toMatchInlineSnapshot(`
          [
            {
              "builtin": true,
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialToken",
              "value": "[INST] ",
            },
            {
              "type": "specialToken",
              "value": "<<SYS>>
          ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information.",
            {
              "type": "specialToken",
              "value": "
          <</SYS>>

          ",
            },
            "Hi there!",
            {
              "type": "specialToken",
              "value": " [/INST]

          ",
            },
            "Hello!",
          ]
        `);

        const chatWrapper2 = new LlamaChatWrapper();
        const {contextText: contextText2} = chatWrapper2.generateContextText(conversationHistory2);

        expect(contextText2.values).toMatchInlineSnapshot(`
          [
            {
              "builtin": true,
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialToken",
              "value": "[INST] ",
            },
            {
              "type": "specialToken",
              "value": "<<SYS>>
          ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information.",
            {
              "type": "specialToken",
              "value": "
          <</SYS>>

          ",
            },
            "Hi there!",
            {
              "type": "specialToken",
              "value": " [/INST]

          ",
            },
            "Hello!",
            {
              "builtin": true,
              "type": "specialToken",
              "value": "EOS",
            },
            {
              "builtin": true,
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialToken",
              "value": "[INST] ",
            },
            "How are you?",
            {
              "type": "specialToken",
              "value": " [/INST]

          ",
            },
            "I'm good, how are you?",
          ]
        `);

        const chatWrapper3 = new LlamaChatWrapper();
        const {contextText: contextText3} = chatWrapper3.generateContextText(conversationHistory);
        const {contextText: contextText3WithOpenModelResponse} = chatWrapper3.generateContextText([
            ...conversationHistory,
            {
                type: "model",
                response: []
            }
        ]);

        expect(contextText3.values).toMatchInlineSnapshot(`
          [
            {
              "builtin": true,
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialToken",
              "value": "[INST] ",
            },
            {
              "type": "specialToken",
              "value": "<<SYS>>
          ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information.",
            {
              "type": "specialToken",
              "value": "
          <</SYS>>

          ",
            },
            "Hi there!",
            {
              "type": "specialToken",
              "value": " [/INST]

          ",
            },
            "Hello!",
          ]
        `);

        expect(contextText3WithOpenModelResponse.values).toMatchInlineSnapshot(`
          [
            {
              "builtin": true,
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialToken",
              "value": "[INST] ",
            },
            {
              "type": "specialToken",
              "value": "<<SYS>>
          ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information.",
            {
              "type": "specialToken",
              "value": "
          <</SYS>>

          ",
            },
            "Hi there!",
            {
              "type": "specialToken",
              "value": " [/INST]

          ",
            },
            "Hello!

          ",
          ]
        `);
    });
});
