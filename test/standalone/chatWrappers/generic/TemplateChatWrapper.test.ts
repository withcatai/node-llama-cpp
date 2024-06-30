import {describe, expect, test} from "vitest";
import {ChatHistoryItem, TemplateChatWrapper} from "../../../../src/index.js";
import {defaultChatSystemPrompt} from "../../../../src/config.js";


describe("TemplateChatWrapper", () => {
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
    const conversationHistory3: ChatHistoryItem[] = [{
        type: "user",
        text: "Hi there!"
    }, {
        type: "model",
        response: ["Hello!"]
    }, {
        type: "user",
        text: "How are you?"
    }];
    const conversationHistoryWithFunctionCalls: ChatHistoryItem[] = [{
        type: "user",
        text: "Hi there!"
    }, {
        type: "model",
        response: ["Hello!", {
            type: "functionCall",
            name: "func2",
            params: {
                message: "Hello",
                feeling: "good",
                words: 1
            },
            result: {
                yes: true,
                message: "ok"
            }
        }]
    }, {
        type: "user",
        text: "How are you?"
    }];
    const exampleFunctions = {
        func1: {

        },
        func2: {
            params: {
                type: "object",
                properties: {
                    message: {
                        type: "string"
                    },
                    feeling: {
                        enum: ["good", "bad"]
                    },
                    words: {
                        type: "number"
                    }
                }
            }
        },
        func3: {
            description: "Some description here",
            params: {
                type: "array",
                items: {
                    type: "string"
                }
            }
        }
    } as const;

    test("with system prompt", () => {
        const chatWrapper = new TemplateChatWrapper({
            template: "SYS: {{systemPrompt}}\n{{history}}model:{{completion}}\nuser:",
            historyTemplate: "{{roleName}}: {{message}}\n",
            modelRoleName: "model",
            userRoleName: "user",
            systemRoleName: "system"
        });
        const {contextText} = chatWrapper.generateContextState({chatHistory: conversationHistory});

        expect(contextText.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialTokensText",
              "value": "SYS: ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialTokensText",
              "value": "
          user: ",
            },
            "Hi there!",
            {
              "type": "specialTokensText",
              "value": "
          model:",
            },
            "Hello!",
          ]
        `);

        const {contextText: contextText2} = chatWrapper.generateContextState({chatHistory: conversationHistory2});

        expect(contextText2.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialTokensText",
              "value": "SYS: ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialTokensText",
              "value": "
          user: ",
            },
            "Hi there!",
            {
              "type": "specialTokensText",
              "value": "
          model: ",
            },
            "Hello!",
            {
              "type": "specialTokensText",
              "value": "
          user: ",
            },
            "How are you?",
            {
              "type": "specialTokensText",
              "value": "
          model:",
            },
            "I'm good, how are you?",
          ]
        `);

        const {contextText: contextText3} = chatWrapper.generateContextState({chatHistory: conversationHistory});
        const {contextText: contextText3WithOpenModelResponse} = chatWrapper.generateContextState({
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
              "type": "specialTokensText",
              "value": "SYS: ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialTokensText",
              "value": "
          user: ",
            },
            "Hi there!",
            {
              "type": "specialTokensText",
              "value": "
          model:",
            },
            "Hello!",
          ]
        `);

        expect(contextText3WithOpenModelResponse.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialTokensText",
              "value": "SYS: ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialTokensText",
              "value": "
          user: ",
            },
            "Hi there!",
            {
              "type": "specialTokensText",
              "value": "
          model:",
            },
            "Hello!

          ",
          ]
        `);

        const {contextText: contextText4} = chatWrapper.generateContextState({chatHistory: conversationHistory3});

        expect(contextText4.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialTokensText",
              "value": "SYS: 
          user: ",
            },
            "Hi there!",
            {
              "type": "specialTokensText",
              "value": "
          model: ",
            },
            "Hello!",
            {
              "type": "specialTokensText",
              "value": "
          user: ",
            },
            "How are you?",
            {
              "type": "specialTokensText",
              "value": "
          ",
            },
          ]
        `);
    });

    test("without system prompt", () => {
        const chatWrapper = new TemplateChatWrapper({
            template: "BEGIN {{history}}model:{{completion}}\nuser:",
            historyTemplate: "{{roleName}}: {{message}}\n",
            modelRoleName: "model",
            userRoleName: "user",
            systemRoleName: "system"
        });
        const {contextText} = chatWrapper.generateContextState({chatHistory: conversationHistory});

        expect(contextText.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialTokensText",
              "value": "BEGIN system: ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialTokensText",
              "value": "
          user: ",
            },
            "Hi there!",
            {
              "type": "specialTokensText",
              "value": "
          model:",
            },
            "Hello!",
          ]
        `);
    });

    test("without beginning text", () => {
        const chatWrapper = new TemplateChatWrapper({
            template: "{{history}}model:{{completion}}\nuser:",
            historyTemplate: "{{roleName}}: {{message}}\n",
            modelRoleName: "model",
            userRoleName: "user",
            systemRoleName: "system"
        });
        const {contextText} = chatWrapper.generateContextState({chatHistory: conversationHistory});

        expect(contextText.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialTokensText",
              "value": "system: ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialTokensText",
              "value": "
          user: ",
            },
            "Hi there!",
            {
              "type": "specialTokensText",
              "value": "
          model:",
            },
            "Hello!",
          ]
        `);
    });

    test("functions", () => {
        const chatWrapper = new TemplateChatWrapper({
            template: "{{history}}model:{{completion}}\nuser:",
            historyTemplate: "{{roleName}}: {{message}}\n",
            modelRoleName: "model",
            userRoleName: "user",
            systemRoleName: "system"
        });
        const {contextText} = chatWrapper.generateContextState({
            chatHistory: conversationHistory,
            availableFunctions: exampleFunctions
        });

        expect(contextText.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialTokensText",
              "value": "system: ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.

          The assistant calls the provided functions as needed to retrieve information instead of relying on existing knowledge.
          To fulfill a request, the assistant calls relevant functions in advance when needed before responding to the request, and does not tell the user prior to calling a function.
          Provided functions:
          \`\`\`typescript
          function func1();

          function func2(params: {message: string, feeling: "good" | "bad", words: number});

          // Some description here
          function func3(params: (string)[]);
          \`\`\`

          Calling any of the provided functions can be done like this:
          ||call: getSomeInfo",
            {
              "type": "specialTokensText",
              "value": "(",
            },
            "{"someKey":"someValue"}",
            {
              "type": "specialTokensText",
              "value": ")",
            },
            "

          Note that the || prefix is mandatory
          The assistant does not inform the user about using functions and does not explain anything before calling a function.
          After calling a function, the raw result appears afterwards and is not part of the conversation
          To make information be part of the conversation, the assistant paraphrases and repeats the information without the function syntax.",
            {
              "type": "specialTokensText",
              "value": "
          user: ",
            },
            "Hi there!",
            {
              "type": "specialTokensText",
              "value": "
          model:",
            },
            "Hello!",
          ]
        `);
    });

    test("functions template", () => {
        const chatWrapper = new TemplateChatWrapper({
            template: "{{history}}model:{{completion}}\nuser:",
            historyTemplate: "{{roleName}}: {{message}}\n",
            modelRoleName: "model",
            userRoleName: "user",
            systemRoleName: "system",
            functionCallMessageTemplate: {
                call: "[[call: {{functionName}}({{functionParams}})]]",
                result: " [[result: {{functionCallResult}}]]"
            }
        });
        const {contextText} = chatWrapper.generateContextState({
            chatHistory: conversationHistoryWithFunctionCalls,
            availableFunctions: exampleFunctions
        });

        expect(contextText.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialTokensText",
              "value": "system: ",
            },
            "The assistant calls the provided functions as needed to retrieve information instead of relying on existing knowledge.
          To fulfill a request, the assistant calls relevant functions in advance when needed before responding to the request, and does not tell the user prior to calling a function.
          Provided functions:
          \`\`\`typescript
          function func1();

          function func2(params: {message: string, feeling: "good" | "bad", words: number});

          // Some description here
          function func3(params: (string)[]);
          \`\`\`

          Calling any of the provided functions can be done like this:
          [[call: getSomeInfo({"someKey":"someValue"})]]

          Note that the || prefix is mandatory
          The assistant does not inform the user about using functions and does not explain anything before calling a function.
          After calling a function, the raw result appears afterwards and is not part of the conversation
          To make information be part of the conversation, the assistant paraphrases and repeats the information without the function syntax.",
            {
              "type": "specialTokensText",
              "value": "
          user: ",
            },
            "Hi there!",
            {
              "type": "specialTokensText",
              "value": "
          model: ",
            },
            "Hello![[call: func2({"message":"Hello","feeling":"good","words":1})]] [[result: {"yes":true,"message":"ok"}]]",
            {
              "type": "specialTokensText",
              "value": "
          user: ",
            },
            "How are you?",
            {
              "type": "specialTokensText",
              "value": "
          ",
            },
          ]
        `);
    });

    test("functions template 2", () => {
        const chatWrapper = new TemplateChatWrapper({
            template: "{{history}}model:{{completion}}\nuser:",
            historyTemplate: "{{roleName}}: {{message}}\n",
            modelRoleName: "model",
            userRoleName: "user",
            systemRoleName: "system",
            functionCallMessageTemplate: {
                call: "\nCall function: {{functionName}} with params {{functionParams}}.",
                result: "\nFunction result: {{functionCallResult}}\n"
            }
        });
        const {contextText} = chatWrapper.generateContextState({
            chatHistory: conversationHistoryWithFunctionCalls,
            availableFunctions: exampleFunctions
        });

        expect(contextText.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialTokensText",
              "value": "system: ",
            },
            "The assistant calls the provided functions as needed to retrieve information instead of relying on existing knowledge.
          To fulfill a request, the assistant calls relevant functions in advance when needed before responding to the request, and does not tell the user prior to calling a function.
          Provided functions:
          \`\`\`typescript
          function func1();

          function func2(params: {message: string, feeling: "good" | "bad", words: number});

          // Some description here
          function func3(params: (string)[]);
          \`\`\`

          Calling any of the provided functions can be done like this:

          Call function: getSomeInfo with params {"someKey":"someValue"}.

          Note that the || prefix is mandatory
          The assistant does not inform the user about using functions and does not explain anything before calling a function.
          After calling a function, the raw result appears afterwards and is not part of the conversation
          To make information be part of the conversation, the assistant paraphrases and repeats the information without the function syntax.",
            {
              "type": "specialTokensText",
              "value": "
          user: ",
            },
            "Hi there!",
            {
              "type": "specialTokensText",
              "value": "
          model: ",
            },
            "Hello!
          Call function: func2 with params {"message":"Hello","feeling":"good","words":1}.
          Function result: {"yes":true,"message":"ok"}
          ",
            {
              "type": "specialTokensText",
              "value": "
          user: ",
            },
            "How are you?",
            {
              "type": "specialTokensText",
              "value": "
          ",
            },
          ]
        `);
    });
});
