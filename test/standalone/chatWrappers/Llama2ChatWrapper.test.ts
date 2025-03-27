import {describe, expect, test} from "vitest";
import {ChatHistoryItem, Llama2ChatWrapper} from "../../../src/index.js";
import {defaultChatSystemPrompt} from "../../../src/config.js";


describe("Llama2ChatWrapper", () => {
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
        const chatWrapper = new Llama2ChatWrapper();
        const {contextText} = chatWrapper.generateContextState({chatHistory: conversationHistory});

        expect(contextText).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialToken("BOS"),
            new SpecialTokensText("[INST] <<SYS>>
          "),
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            new SpecialTokensText("
          <</SYS>>

          "),
            "Hi there!",
            new SpecialTokensText(" [/INST] "),
            "Hello!",
          ])
        `);

        const chatWrapper2 = new Llama2ChatWrapper();
        const {contextText: contextText2} = chatWrapper2.generateContextState({chatHistory: conversationHistory2});

        expect(contextText2).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialToken("BOS"),
            new SpecialTokensText("[INST] <<SYS>>
          "),
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            new SpecialTokensText("
          <</SYS>>

          "),
            "Hi there!",
            new SpecialTokensText(" [/INST] "),
            "Hello!",
            new SpecialToken("EOS"),
            new SpecialToken("BOS"),
            new SpecialTokensText("[INST] "),
            "How are you?",
            new SpecialTokensText(" [/INST] "),
            "I'm good, how are you?",
          ])
        `);

        const chatWrapper3 = new Llama2ChatWrapper();
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
            new SpecialTokensText("[INST] <<SYS>>
          "),
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            new SpecialTokensText("
          <</SYS>>

          "),
            "Hi there!",
            new SpecialTokensText(" [/INST] "),
            "Hello!",
          ])
        `);

        expect(contextText3WithOpenModelResponse).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialToken("BOS"),
            new SpecialTokensText("[INST] <<SYS>>
          "),
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            new SpecialTokensText("
          <</SYS>>

          "),
            "Hi there!",
            new SpecialTokensText(" [/INST] "),
            "Hello!

          ",
          ])
        `);
    });
});
