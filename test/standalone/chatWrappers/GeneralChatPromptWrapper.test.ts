import {describe, expect, test} from "vitest";
import {generateContextTextFromConversationHistory} from "../../../src/chatWrappers/generateContextTextFromConversationHistory.js";
import {ConversationInteraction, GeneralChatPromptWrapper} from "../../../src/index.js";


describe("GeneralChatPromptWrapper", () => {
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
        const chatWrapper = new GeneralChatPromptWrapper();
        const {text: response} = generateContextTextFromConversationHistory(chatWrapper, conversationHistory);

        expect(response).toMatchInlineSnapshot(`
          "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information.

          ### Human:
          Hi there!

          ### Assistant:
          Hello!

          ### Human"
        `);

        const chatWrapper2 = new GeneralChatPromptWrapper();
        const {text: response2} = generateContextTextFromConversationHistory(chatWrapper2, conversationHistory2);

        expect(response2).toMatchInlineSnapshot(`
          "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information.

          ### Human:
          Hi there!

          ### Assistant:
          Hello!

          ### Human:
          How are you?

          ### Assistant:
          I'm good, how are you?

          ### Human"
        `);

        const chatWrapper3 = new GeneralChatPromptWrapper();
        const {text: response3, stopStringSuffix, stopString} = generateContextTextFromConversationHistory(chatWrapper3, conversationHistory);

        const newPrompt = conversationHistory2[1].prompt;
        const wrappedNewPrompt = chatWrapper3.wrapPrompt(newPrompt, {
            systemPrompt: response3,
            promptIndex: 1,
            lastStopString: stopString,
            lastStopStringSuffix: stopStringSuffix
        });

        expect(response3).toMatchInlineSnapshot(`
          "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information.

          ### Human:
          Hi there!

          ### Assistant:
          Hello!

          ### Human"
        `);

        expect(wrappedNewPrompt).toMatchInlineSnapshot(`
          ":
          How are you?

          ### Assistant:
          "
        `);

        expect(response3 + wrappedNewPrompt).toMatchInlineSnapshot(`
          "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information.

          ### Human:
          Hi there!

          ### Assistant:
          Hello!

          ### Human:
          How are you?

          ### Assistant:
          "
        `);
    });

    test("should generate valid output for custom roles", () => {
        const chatWrapper = new GeneralChatPromptWrapper({
            instructionName: "Instruction",
            responseName: "Response"
        });
        const {text: response} = generateContextTextFromConversationHistory(chatWrapper, conversationHistory);

        expect(response).toMatchInlineSnapshot(`
          "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information.

          ### Instruction:
          Hi there!

          ### Response:
          Hello!

          ### Instruction"
        `);

        const chatWrapper2 = new GeneralChatPromptWrapper({
            instructionName: "Instruction",
            responseName: "Response"
        });
        const {text: response2} = generateContextTextFromConversationHistory(chatWrapper2, conversationHistory2);

        expect(response2).toMatchInlineSnapshot(`
          "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information.

          ### Instruction:
          Hi there!

          ### Response:
          Hello!

          ### Instruction:
          How are you?

          ### Response:
          I'm good, how are you?

          ### Instruction"
        `);
    });

    test("should generate valid output for custom system prompt", () => {
        const chatWrapper = new GeneralChatPromptWrapper();
        const {text: response} = generateContextTextFromConversationHistory(chatWrapper, conversationHistory, {
            systemPrompt: "Below is an instruction the describes a task, Write a response the appropriately completes the request."
        });

        expect(response).toMatchInlineSnapshot(`
          "Below is an instruction the describes a task, Write a response the appropriately completes the request.

          ### Human:
          Hi there!

          ### Assistant:
          Hello!

          ### Human"
        `);

        const chatWrapper2 = new GeneralChatPromptWrapper({
            instructionName: "Instruction",
            responseName: "Response"
        });
        const {text: response2} = generateContextTextFromConversationHistory(chatWrapper2, conversationHistory2, {
            systemPrompt: "Below is an instruction the describes a task, Write a response the appropriately completes the request."
        });

        expect(response2).toMatchInlineSnapshot(`
          "Below is an instruction the describes a task, Write a response the appropriately completes the request.

          ### Instruction:
          Hi there!

          ### Response:
          Hello!

          ### Instruction:
          How are you?

          ### Response:
          I'm good, how are you?

          ### Instruction"
        `);
    });
});
