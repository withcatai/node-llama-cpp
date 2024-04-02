import {describe, expect, test} from "vitest";
import {ChatHistoryItem, JinjaTemplateChatWrapper} from "../../../../src/index.js";
import {defaultChatSystemPrompt} from "../../../../src/config.js";


describe("JinjaTemplateChatWrapper", () => {
    const template1 =
        "{{ bos_token }}" +
        "{% for message in messages %}" +
        "" + "{% if (message['role'] == 'user') != (loop.index0 % 2 == 0) %}" +
        "" + "" + "{{ raise_exception('Conversation roles must alternate user/assistant/user/assistant/...') }}" +
        "" + "{% endif %}" +
        "" + "{% if message['role'] == 'user' %}" +
        "" + "" + "{{ '[INST] ' + message['content'] + ' [/INST]' }}" +
        "" + "{% elif message['role'] == 'assistant' %}" +
        "" + "" + "{{ message['content'] + eos_token}}" +
        "" + "{% else %}" +
        "" + "" + "{{ raise_exception('Only user and assistant roles are supported!') }}" +
        "" + "{% endif %}" +
        "{% endfor %}";
    const template2 =
        "{% for message in messages %}" +
        "" + "{% if message['role'] == 'user' %}" +
        "" + "" + "{{ bos_token + '[INST] ' + message['content'] + ' [/INST]' }}" +
        "" + "{% elif message['role'] == 'system' %}" +
        "" + "" + "{{ '<<SYS>>\\n' + message['content'] + '\\n<</SYS>>\\n\\n' }}" +
        "" + "{% elif message['role'] == 'assistant' %}" +
        "" + "" + "{{ ' '  + message['content'] + ' ' + eos_token }}" +
        "" + "{% endif %}" +
        "{% endfor %}";
    const template3 =
        "{% for message in messages %}" +
        "" + "{% if message['role'] == 'user' %}" +
        "" + "" + "{{ bos_token + '[INST] ' + message['content'] + ' [/INST]' }}" +
        "" + "{% elif message['role'] == 'assistant' %}" +
        "" + "" + "{{ ' '  + message['content'] + ' ' + eos_token }}" +
        "" + "{% endif %}" +
        "{% endfor %}";

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

    test("with system prompt support", () => {
        const chatWrapper = new JinjaTemplateChatWrapper({
            template: template2
        });
        const {contextText, stopGenerationTriggers} = chatWrapper.generateContextText(conversationHistory);

        expect(contextText.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialToken",
              "value": "<<SYS>>
          ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialToken",
              "value": "
          <</SYS>>

          ",
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
            "Hi there!",
            {
              "type": "specialToken",
              "value": " [/INST] ",
            },
            "Hello!",
          ]
        `);
        expect(stopGenerationTriggers).toMatchInlineSnapshot(`
          [
            LlamaText [
              {
                "builtin": true,
                "type": "specialToken",
                "value": "EOS",
              },
            ],
            LlamaText [
              {
                "type": "specialToken",
                "value": " ",
              },
              {
                "builtin": true,
                "type": "specialToken",
                "value": "EOS",
              },
            ],
          ]
        `);

        const {contextText: contextText2} = chatWrapper.generateContextText(conversationHistory2);

        expect(contextText2.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialToken",
              "value": "<<SYS>>
          ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialToken",
              "value": "
          <</SYS>>

          ",
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
            "Hi there!",
            {
              "type": "specialToken",
              "value": " [/INST] ",
            },
            "Hello!",
            {
              "type": "specialToken",
              "value": " ",
            },
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
              "value": " [/INST] ",
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
              "value": "<<SYS>>
          ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialToken",
              "value": "
          <</SYS>>

          ",
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
            "Hi there!",
            {
              "type": "specialToken",
              "value": " [/INST] ",
            },
            "Hello!",
          ]
        `);

        expect(contextText3WithOpenModelResponse.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialToken",
              "value": "<<SYS>>
          ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialToken",
              "value": "
          <</SYS>>

          ",
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
            "Hi there!",
            {
              "type": "specialToken",
              "value": " [/INST] ",
            },
            "Hello!

          ",
          ]
        `);

        const {contextText: contextText4} = chatWrapper.generateContextText(conversationHistory3);

        expect(contextText4.values).toMatchInlineSnapshot(`
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
            "Hi there!",
            {
              "type": "specialToken",
              "value": " [/INST] ",
            },
            "Hello!",
            {
              "type": "specialToken",
              "value": " ",
            },
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
              "value": " [/INST]",
            },
          ]
        `);
    });

    test("without system prompt support", () => {
        const chatWrapper = new JinjaTemplateChatWrapper({
            template: template1
        });
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
            "System: You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.

          Hi there!",
            {
              "type": "specialToken",
              "value": " [/INST]",
            },
            "Hello!",
          ]
        `);
    });

    test("without system prompt support with no exception from the template", () => {
        const chatWrapper = new JinjaTemplateChatWrapper({
            template: template3
        });
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
            "System: You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.

          Hi there!",
            {
              "type": "specialToken",
              "value": " [/INST] ",
            },
            "Hello!",
          ]
        `);
    });

    test("without system prompt support with no exception from the template 2", () => {
        const chatWrapper = new JinjaTemplateChatWrapper({
            template: template2,
            systemRoleName: "something1"
        });
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
            "System: You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.

          Hi there!",
            {
              "type": "specialToken",
              "value": " [/INST] ",
            },
            "Hello!",
          ]
        `);
    });

    test("without joining adjacent messages of the same type", () => {
        const chatWrapper = new JinjaTemplateChatWrapper({
            template: template2,
            joinAdjacentMessagesOfTheSameType: false
        });
        const {contextText} = chatWrapper.generateContextText([conversationHistory[0], ...conversationHistory]);

        expect(contextText.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialToken",
              "value": "<<SYS>>
          ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialToken",
              "value": "
          <</SYS>>

          <<SYS>>
          ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialToken",
              "value": "
          <</SYS>>

          ",
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
            "Hi there!",
            {
              "type": "specialToken",
              "value": " [/INST] ",
            },
            "Hello!",
          ]
        `);
    });

    test("functions", () => {
        const chatWrapper = new JinjaTemplateChatWrapper({
            template: template2
        });
        const {contextText} = chatWrapper.generateContextText(conversationHistory, {
            availableFunctions: exampleFunctions
        });

        expect(contextText.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialToken",
              "value": "<<SYS>>
          ",
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
          <</SYS>>

          ",
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
            "Hi there!",
            {
              "type": "specialToken",
              "value": " [/INST] ",
            },
            "Hello!",
          ]
        `);
    });

    test("functions template", () => {
        const chatWrapper = new JinjaTemplateChatWrapper({
            template: template3,
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
              "builtin": true,
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialToken",
              "value": "[INST] ",
            },
            "System: The assistant calls the provided functions as needed to retrieve information instead of relying on things it already knows.
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
          The assistant calls the functions in advance before telling the user about the result

          Hi there!",
            {
              "type": "specialToken",
              "value": " [/INST] ",
            },
            "Hello!
          [[call: func2({"message":"Hello","feeling":"good","words":1})]] [[result: {"yes":true,"message":"ok"}]]",
            {
              "type": "specialToken",
              "value": " ",
            },
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
              "value": " [/INST]",
            },
          ]
        `);
    });

    test("functions template 2", () => {
        const chatWrapper = new JinjaTemplateChatWrapper({
            template: template3,
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
              "builtin": true,
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialToken",
              "value": "[INST] ",
            },
            "System: The assistant calls the provided functions as needed to retrieve information instead of relying on things it already knows.
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
          The assistant calls the functions in advance before telling the user about the result

          Hi there!",
            {
              "type": "specialToken",
              "value": " [/INST] ",
            },
            "Hello!

          Call function: func2 with params {"message":"Hello","feeling":"good","words":1}.
          Function result: {"yes":true,"message":"ok"}
          ",
            {
              "type": "specialToken",
              "value": " ",
            },
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
              "value": " [/INST]",
            },
          ]
        `);
    });

    test("Fails when messages are not present in the render output", () => {
        try {
            new JinjaTemplateChatWrapper({
                template: template2,
                userRoleName: "something1"
            });
            expect.unreachable("Should have thrown an error");
        } catch (err) {
            expect(String(err)).toMatchInlineSnapshot('"Error: The provided Jinja template failed that sanity test: Error: Some input messages are not present in the generated Jinja template output"');
        }
    });

    test("Fails when messages are not present in the render output 2", () => {
        try {
            new JinjaTemplateChatWrapper({
                template: template2,
                modelRoleName: "something1"
            });
            expect.unreachable("Should have thrown an error");
        } catch (err) {
            expect(String(err)).toMatchInlineSnapshot('"Error: The provided Jinja template failed that sanity test: Error: Some input messages are not present in the generated Jinja template output"');
        }
    });
});
