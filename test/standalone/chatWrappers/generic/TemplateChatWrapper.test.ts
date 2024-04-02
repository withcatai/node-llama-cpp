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
        const {contextText} = chatWrapper.generateContextText(conversationHistory);

        expect(contextText.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialToken",
              "value": "SYS: ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialToken",
              "value": "
          user: ",
            },
            "Hi there!",
            {
              "type": "specialToken",
              "value": "
          model:",
            },
            "Hello!",
          ]
        `);

        const {contextText: contextText2} = chatWrapper.generateContextText(conversationHistory2);

        expect(contextText2.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialToken",
              "value": "SYS: ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialToken",
              "value": "
          user: ",
            },
            "Hi there!",
            {
              "type": "specialToken",
              "value": "
          model: ",
            },
            "Hello!",
            {
              "type": "specialToken",
              "value": "
          ",
            },
            {
              "type": "specialToken",
              "value": "user: ",
            },
            "How are you?",
            {
              "type": "specialToken",
              "value": "
          model:",
            },
            "I'm good, how are you?",
          ]
        `);

        const {contextText: contextText3} = chatWrapper.generateContextText(conversationHistory);
        const {contextText: contextText3WithOpenModelResponse} = chatWrapper.generateContextText([
            ...conversationHistory,
            {
                type: "model",
                response: []
            }
        ]);

        expect(contextText3.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialToken",
              "value": "SYS: ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialToken",
              "value": "
          user: ",
            },
            "Hi there!",
            {
              "type": "specialToken",
              "value": "
          model:",
            },
            "Hello!",
          ]
        `);

        expect(contextText3WithOpenModelResponse.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialToken",
              "value": "SYS: ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialToken",
              "value": "
          user: ",
            },
            "Hi there!",
            {
              "type": "specialToken",
              "value": "
          model:",
            },
            "Hello!

          ",
          ]
        `);

        const {contextText: contextText4} = chatWrapper.generateContextText(conversationHistory3);

        expect(contextText4.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialToken",
              "value": "SYS: 
          user: ",
            },
            "Hi there!",
            {
              "type": "specialToken",
              "value": "
          model: ",
            },
            "Hello!",
            {
              "type": "specialToken",
              "value": "
          ",
            },
            {
              "type": "specialToken",
              "value": "user: ",
            },
            "How are you?",
            {
              "type": "specialToken",
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
        const {contextText} = chatWrapper.generateContextText(conversationHistory);

        expect(contextText.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialToken",
              "value": "BEGIN system: ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialToken",
              "value": "
          user: ",
            },
            "Hi there!",
            {
              "type": "specialToken",
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
        const {contextText} = chatWrapper.generateContextText(conversationHistory);

        expect(contextText.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialToken",
              "value": "system: ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialToken",
              "value": "
          user: ",
            },
            "Hi there!",
            {
              "type": "specialToken",
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
        const {contextText} = chatWrapper.generateContextText(conversationHistory, {
            availableFunctions: exampleFunctions
        });

        expect(contextText.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialToken",
              "value": "system: ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.

          The assistant calls the provided functions as needed to retrieve information instead of relying on things it already knows.
          Provided functions:
          \`\`\`
          function func1();

          function func2(params: message: string, feeling: "good" | "bad", words: number);

          // Some description here
          function func3(params: (string)[]);
          \`\`\`

          Calling any of the provided functions can be done like this:
          [[call: functionName({ someKey: "someValue" })]]

          After calling a function the result will appear afterwards and be visible only to the assistant, so the assistant has to tell the user about it outside of the function call context.
          The assistant calls the functions in advance before telling the user about the result",
            {
              "type": "specialToken",
              "value": "
          user: ",
            },
            "Hi there!",
            {
              "type": "specialToken",
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
            functionCallMessageTemplate: [
                "[[call: {{functionName}}({{functionParams}})]]",
                " [[result: {{functionCallResult}}]]"
            ]
        });
        const {contextText} = chatWrapper.generateContextText(conversationHistoryWithFunctionCalls, {
            availableFunctions: exampleFunctions
        });

        expect(contextText.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialToken",
              "value": "system: ",
            },
            "The assistant calls the provided functions as needed to retrieve information instead of relying on things it already knows.
          Provided functions:
          \`\`\`
          function func1();

          function func2(params: message: string, feeling: "good" | "bad", words: number);

          // Some description here
          function func3(params: (string)[]);
          \`\`\`

          Calling any of the provided functions can be done like this:
          [[call: functionName({ someKey: "someValue" })]]

          After calling a function the result will appear afterwards and be visible only to the assistant, so the assistant has to tell the user about it outside of the function call context.
          The assistant calls the functions in advance before telling the user about the result",
            {
              "type": "specialToken",
              "value": "
          user: ",
            },
            "Hi there!",
            {
              "type": "specialToken",
              "value": "
          model: ",
            },
            "Hello!
          [[call: func2({"message":"Hello","feeling":"good","words":1})]] [[result: {"yes":true,"message":"ok"}]]",
            {
              "type": "specialToken",
              "value": "
          ",
            },
            {
              "type": "specialToken",
              "value": "user: ",
            },
            "How are you?",
            {
              "type": "specialToken",
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
            functionCallMessageTemplate: [
                "\nCall function: {{functionName}} with params {{functionParams}}.",
                "\nFunction result: {{functionCallResult}}\n"
            ]
        });
        const {contextText} = chatWrapper.generateContextText(conversationHistoryWithFunctionCalls, {
            availableFunctions: exampleFunctions
        });

        expect(contextText.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialToken",
              "value": "system: ",
            },
            "The assistant calls the provided functions as needed to retrieve information instead of relying on things it already knows.
          Provided functions:
          \`\`\`
          function func1();

          function func2(params: message: string, feeling: "good" | "bad", words: number);

          // Some description here
          function func3(params: (string)[]);
          \`\`\`

          Calling any of the provided functions can be done like this:
          Call function: functionName with params { someKey: "someValue" }.

          After calling a function the result will appear afterwards and be visible only to the assistant, so the assistant has to tell the user about it outside of the function call context.
          The assistant calls the functions in advance before telling the user about the result",
            {
              "type": "specialToken",
              "value": "
          user: ",
            },
            "Hi there!",
            {
              "type": "specialToken",
              "value": "
          model: ",
            },
            "Hello!

          Call function: func2 with params {"message":"Hello","feeling":"good","words":1}.
          Function result: {"yes":true,"message":"ok"}
          ",
            {
              "type": "specialToken",
              "value": "
          ",
            },
            {
              "type": "specialToken",
              "value": "user: ",
            },
            "How are you?",
            {
              "type": "specialToken",
              "value": "
          ",
            },
          ]
        `);
    });
});
