import {describe, expect, test} from "vitest";
import {generateContextTextFromConversationHistory} from "../../../src/chatWrappers/generateContextTextFromConversationHistory.js";
import {ChatMLChatPromptWrapper, ConversationInteraction} from "../../../src/index.js";


describe("ChatMLChatPromptWrapper", () => {
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
        const chatWrapper = new ChatMLChatPromptWrapper();
        const {text: response} = generateContextTextFromConversationHistory(chatWrapper, conversationHistory);

        expect(response).toMatchInlineSnapshot(`
          "<|im_start|>system
          You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information.<|im_end|>
          <|im_start|>user
          Hi there!<|im_end|>
          <|im_start|>assistant
          Hello!<|im_end|>"
        `);

        const chatWrapper2 = new ChatMLChatPromptWrapper();
        const {text: response2} = generateContextTextFromConversationHistory(chatWrapper2, conversationHistory2);

        expect(response2).toMatchInlineSnapshot(`
          "<|im_start|>system
          You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information.<|im_end|>
          <|im_start|>user
          Hi there!<|im_end|>
          <|im_start|>assistant
          Hello!<|im_end|>
          <|im_start|>user
          How are you?<|im_end|>
          <|im_start|>assistant
          I'm good, how are you?<|im_end|>"
        `);

        const chatWrapper3 = new ChatMLChatPromptWrapper();
        const {text: response3, stopStringSuffix, stopString} = generateContextTextFromConversationHistory(chatWrapper3, conversationHistory);

        const newPrompt = conversationHistory2[1].prompt;
        const wrappedNewPrompt = chatWrapper3.wrapPrompt(newPrompt, {
            systemPrompt: response3,
            promptIndex: 1,
            lastStopString: stopString,
            lastStopStringSuffix: stopStringSuffix
        });

        expect(response3).toMatchInlineSnapshot(`
          "<|im_start|>system
          You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information.<|im_end|>
          <|im_start|>user
          Hi there!<|im_end|>
          <|im_start|>assistant
          Hello!<|im_end|>"
        `);

        expect(wrappedNewPrompt).toMatchInlineSnapshot(`
          "
          <|im_start|>user
          How are you?<|im_end|>
          <|im_start|>assistant
          "
        `);

        expect(response3 + wrappedNewPrompt).toMatchInlineSnapshot(`
          "<|im_start|>system
          You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information.<|im_end|>
          <|im_start|>user
          Hi there!<|im_end|>
          <|im_start|>assistant
          Hello!<|im_end|>
          <|im_start|>user
          How are you?<|im_end|>
          <|im_start|>assistant
          "
        `);
    });

    test("should generate valid output for custom system prompt", () => {
        const chatWrapper = new ChatMLChatPromptWrapper();
        const {text: response} = generateContextTextFromConversationHistory(chatWrapper, conversationHistory, {
            systemPrompt: "Below is an instruction the describes a task, Write a response the appropriately completes the request."
        });

        expect(response).toMatchInlineSnapshot(`
          "<|im_start|>system
          Below is an instruction the describes a task, Write a response the appropriately completes the request.<|im_end|>
          <|im_start|>user
          Hi there!<|im_end|>
          <|im_start|>assistant
          Hello!<|im_end|>"
        `);

        const chatWrapper2 = new ChatMLChatPromptWrapper();
        const {text: response2} = generateContextTextFromConversationHistory(chatWrapper2, conversationHistory2, {
            systemPrompt: "Below is an instruction the describes a task, Write a response the appropriately completes the request."
        });

        expect(response2).toMatchInlineSnapshot(`
          "<|im_start|>system
          Below is an instruction the describes a task, Write a response the appropriately completes the request.<|im_end|>
          <|im_start|>user
          Hi there!<|im_end|>
          <|im_start|>assistant
          Hello!<|im_end|>
          <|im_start|>user
          How are you?<|im_end|>
          <|im_start|>assistant
          I'm good, how are you?<|im_end|>"
        `);
    });
});
