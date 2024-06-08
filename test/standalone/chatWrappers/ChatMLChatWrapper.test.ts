import {describe, expect, test} from "vitest";
import {ChatMLChatWrapper, ChatHistoryItem} from "../../../src/index.js";
import {defaultChatSystemPrompt} from "../../../src/config.js";


describe("ChatMLChatWrapper", () => {
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
        const chatWrapper = new ChatMLChatWrapper();
        const {contextText} = chatWrapper.generateContextState({chatHistory: conversationHistory});

        expect(contextText.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialTokensText",
              "value": "<|im_start|>system
          ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialTokensText",
              "value": "<|im_end|>
          <|im_start|>user
          ",
            },
            "Hi there!",
            {
              "type": "specialTokensText",
              "value": "<|im_end|>
          <|im_start|>assistant
          ",
            },
            "Hello!",
          ]
        `);

        const chatWrapper2 = new ChatMLChatWrapper();
        const {contextText: contextText2} = chatWrapper2.generateContextState({chatHistory: conversationHistory2});

        expect(contextText2.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialTokensText",
              "value": "<|im_start|>system
          ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialTokensText",
              "value": "<|im_end|>
          <|im_start|>user
          ",
            },
            "Hi there!",
            {
              "type": "specialTokensText",
              "value": "<|im_end|>
          <|im_start|>assistant
          ",
            },
            "Hello!",
            {
              "type": "specialTokensText",
              "value": "<|im_end|>
          <|im_start|>user
          ",
            },
            "How are you?",
            {
              "type": "specialTokensText",
              "value": "<|im_end|>
          <|im_start|>assistant
          ",
            },
            "I'm good, how are you?",
          ]
        `);

        const chatWrapper3 = new ChatMLChatWrapper();
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
              "value": "<|im_start|>system
          ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialTokensText",
              "value": "<|im_end|>
          <|im_start|>user
          ",
            },
            "Hi there!",
            {
              "type": "specialTokensText",
              "value": "<|im_end|>
          <|im_start|>assistant
          ",
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
              "value": "<|im_start|>system
          ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialTokensText",
              "value": "<|im_end|>
          <|im_start|>user
          ",
            },
            "Hi there!",
            {
              "type": "specialTokensText",
              "value": "<|im_end|>
          <|im_start|>assistant
          ",
            },
            "Hello!",
            {
              "type": "specialTokensText",
              "value": "<|im_end|>
          <|im_start|>assistant
          ",
            },
          ]
        `);
    });
});
