import {describe, expect, test} from "vitest";
import {ChatHistoryItem, ChatModelFunctions, Llama3_1ChatWrapper} from "../../../src/index.js";
import {defaultChatSystemPrompt} from "../../../src/config.js";


describe("Llama3_1ChatWrapper", () => {
    const todayDate = new Date("2024-07-26T00:00:00Z");
    const conversationHistory: ChatHistoryItem[] = [
        ...(new Llama3_1ChatWrapper({todayDate})).generateInitialChatHistory({systemPrompt: defaultChatSystemPrompt}), {
            type: "user",
            text: "Hi there!"
        }, {
            type: "model",
            response: ["Hello!"]
        }
    ];
    const conversationHistory2: ChatHistoryItem[] = [
        ...(new Llama3_1ChatWrapper({todayDate})).generateInitialChatHistory({systemPrompt: defaultChatSystemPrompt}), {
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
        const chatWrapper = new Llama3_1ChatWrapper({todayDate});
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
            "Cutting Knowledge Date: December 2023
          Today Date: 26 Jul 2024

          # Tool Instructions
          - When looking for real time information use relevant functions if available



          You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
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
          ]
        `);

        const chatWrapper2 = new Llama3_1ChatWrapper({todayDate});
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
              "value": "<|start_header_id|>system<|end_header_id|>

          ",
            },
            "Cutting Knowledge Date: December 2023
          Today Date: 26 Jul 2024

          # Tool Instructions
          - When looking for real time information use relevant functions if available



          You have access to the following functions:

          Use the function 'getTime' to: Retrieve the current time
          {"name": "getTime", "description": "Retrieve the current time", "parameters": {"type": "object", "properties": {"hours": {"enum": ["24", "12"]}, "seconds": {"type": "boolean"}}}}


          If you choose to call a function ONLY reply in the following format:
          <{start_tag}={function_name}>{parameters}{end_tag}
          where

          start_tag => \`<function\`
          parameters => a JSON dict with the function argument name as key and function argument value as value.
          end_tag => \`</function>\`

          Here is an example,
          ",
            {
              "type": "specialTokensText",
              "value": "<function=",
            },
            "example_function_name",
            {
              "type": "specialTokensText",
              "value": ">",
            },
            "{"example_name": "example_value"}",
            {
              "type": "specialTokensText",
              "value": "</function>",
            },
            "

          Reminder:
          - Function calls MUST follow the specified format
          - Only call one function at a time
          - Put the entire function call reply on one line
          - Always add your sources when using search results to answer the user query

          You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
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
            "What is the time?",
            {
              "type": "specialToken",
              "value": "EOT",
            },
            {
              "type": "specialTokensText",
              "value": "<|start_header_id|>assistant<|end_header_id|>

          <function=",
            },
            "getTime",
            {
              "type": "specialTokensText",
              "value": ">",
            },
            "{"hours": "24", "seconds": true}",
            {
              "type": "specialTokensText",
              "value": "</function><|eom_id|>
          <|start_header_id|>ipython<|end_header_id|>

          ",
            },
            ""22:00:00"",
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

        const chatWrapper3 = new Llama3_1ChatWrapper({todayDate});
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
            "Cutting Knowledge Date: December 2023
          Today Date: 26 Jul 2024

          # Tool Instructions
          - When looking for real time information use relevant functions if available



          You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
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
            "Cutting Knowledge Date: December 2023
          Today Date: 26 Jul 2024

          # Tool Instructions
          - When looking for real time information use relevant functions if available



          You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
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
            "Hello!

          ",
          ]
        `);
    });
});
