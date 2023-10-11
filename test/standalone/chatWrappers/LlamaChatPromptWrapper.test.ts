import {describe, expect, test} from "vitest";
import {generateContextTextFromConversationHistory} from "../../../src/chatWrappers/generateContextTextFromConversationHistory.js";
import {ConversationInteraction, LlamaChatPromptWrapper} from "../../../src/index.js";


describe("LlamaChatPromptWrapper", () => {
    const conversationHistory: ConversationInteraction[] = [{
        prompt: "Hi there!",
        response: "Hello!"
    }];
    const conversationHistory2: ConversationInteraction[] = [{
        prompt: "Hi there!",
        response: "Hello!"
    }, {
        prompt: "How are you?",
        response: "I'm good, how are you?"
    }];

    test("should generate valid output for default roles", () => {
        const chatWrapper = new LlamaChatPromptWrapper();
        const {text: response} = generateContextTextFromConversationHistory(chatWrapper, conversationHistory);

        expect(response).toMatchInlineSnapshot(`
          "<s>[INST] <<SYS>>
          You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information.
          <</SYS>>

          Hi there! [/INST]

          Hello!</s>"
        `);

        const chatWrapper2 = new LlamaChatPromptWrapper();
        const {text: response2} = generateContextTextFromConversationHistory(chatWrapper2, conversationHistory2);

        expect(response2).toMatchInlineSnapshot(`
          "<s>[INST] <<SYS>>
          You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information.
          <</SYS>>

          Hi there! [/INST]

          Hello!</s><s>[INST] How are you? [/INST]

          I'm good, how are you?</s>"
        `);

        const chatWrapper3 = new LlamaChatPromptWrapper();
        const {text: response3, stopStringSuffix, stopString} = generateContextTextFromConversationHistory(chatWrapper3, conversationHistory);

        const newPrompt = conversationHistory2[1].prompt;
        const wrappedNewPrompt = chatWrapper3.wrapPrompt(newPrompt, {
            systemPrompt: response3,
            promptIndex: 1,
            lastStopString: stopString,
            lastStopStringSuffix: stopStringSuffix
        });

        expect(response3).toMatchInlineSnapshot(`
          "<s>[INST] <<SYS>>
          You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information.
          <</SYS>>

          Hi there! [/INST]

          Hello!</s>"
        `);

        expect(wrappedNewPrompt).toMatchInlineSnapshot(`
          "<s>[INST] How are you? [/INST]

          "
        `);

        expect(response3 + wrappedNewPrompt).toMatchInlineSnapshot(`
          "<s>[INST] <<SYS>>
          You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information.
          <</SYS>>

          Hi there! [/INST]

          Hello!</s><s>[INST] How are you? [/INST]

          "
        `);
    });

    test("should generate valid output for custom system prompt", () => {
        const chatWrapper = new LlamaChatPromptWrapper();
        const {text: response} = generateContextTextFromConversationHistory(chatWrapper, conversationHistory, {
            systemPrompt: "Below is an instruction the describes a task, Write a response the appropriately completes the request."
        });

        expect(response).toMatchInlineSnapshot(`
          "<s>[INST] <<SYS>>
          Below is an instruction the describes a task, Write a response the appropriately completes the request.
          <</SYS>>

          Hi there! [/INST]

          Hello!</s>"
        `);

        const chatWrapper2 = new LlamaChatPromptWrapper();
        const {text: response2} = generateContextTextFromConversationHistory(chatWrapper2, conversationHistory2, {
            systemPrompt: "Below is an instruction the describes a task, Write a response the appropriately completes the request."
        });

        expect(response2).toMatchInlineSnapshot(`
          "<s>[INST] <<SYS>>
          Below is an instruction the describes a task, Write a response the appropriately completes the request.
          <</SYS>>

          Hi there! [/INST]

          Hello!</s><s>[INST] How are you? [/INST]

          I'm good, how are you?</s>"
        `);
    });
});
