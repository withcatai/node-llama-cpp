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
        const {contextText, stopGenerationTriggers} = chatWrapper.generateContextState({chatHistory: conversationHistory});

        expect(contextText.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialTokensText",
              "value": "<<SYS>>
          ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialTokensText",
              "value": "
          <</SYS>>

          ",
            },
            {
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialTokensText",
              "value": "[INST] ",
            },
            "Hi there!",
            {
              "type": "specialTokensText",
              "value": " [/INST] ",
            },
            "Hello!",
          ]
        `);
        expect(stopGenerationTriggers).toMatchInlineSnapshot(`
          [
            LlamaText [
              {
                "type": "specialToken",
                "value": "EOS",
              },
            ],
            LlamaText [
              {
                "type": "specialTokensText",
                "value": " ",
              },
              {
                "type": "specialToken",
                "value": "EOS",
              },
            ],
          ]
        `);

        const {contextText: contextText2} = chatWrapper.generateContextState({chatHistory: conversationHistory2});

        expect(contextText2.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialTokensText",
              "value": "<<SYS>>
          ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialTokensText",
              "value": "
          <</SYS>>

          ",
            },
            {
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialTokensText",
              "value": "[INST] ",
            },
            "Hi there!",
            {
              "type": "specialTokensText",
              "value": " [/INST] ",
            },
            "Hello!",
            {
              "type": "specialTokensText",
              "value": " ",
            },
            {
              "type": "specialToken",
              "value": "EOS",
            },
            {
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialTokensText",
              "value": "[INST] ",
            },
            "How are you?",
            {
              "type": "specialTokensText",
              "value": " [/INST] ",
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
              "value": "<<SYS>>
          ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialTokensText",
              "value": "
          <</SYS>>

          ",
            },
            {
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialTokensText",
              "value": "[INST] ",
            },
            "Hi there!",
            {
              "type": "specialTokensText",
              "value": " [/INST] ",
            },
            "Hello!",
          ]
        `);

        expect(contextText3WithOpenModelResponse.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialTokensText",
              "value": "<<SYS>>
          ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialTokensText",
              "value": "
          <</SYS>>

          ",
            },
            {
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialTokensText",
              "value": "[INST] ",
            },
            "Hi there!",
            {
              "type": "specialTokensText",
              "value": " [/INST] ",
            },
            "Hello!

          ",
          ]
        `);

        const {contextText: contextText4} = chatWrapper.generateContextState({chatHistory: conversationHistory3});

        expect(contextText4.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialTokensText",
              "value": "[INST] ",
            },
            "Hi there!",
            {
              "type": "specialTokensText",
              "value": " [/INST] ",
            },
            "Hello!",
            {
              "type": "specialTokensText",
              "value": " ",
            },
            {
              "type": "specialToken",
              "value": "EOS",
            },
            {
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialTokensText",
              "value": "[INST] ",
            },
            "How are you?",
            {
              "type": "specialTokensText",
              "value": " [/INST]",
            },
          ]
        `);
    });

    test("without system prompt support", () => {
        const chatWrapper = new JinjaTemplateChatWrapper({
            template: template1
        });
        const {contextText} = chatWrapper.generateContextState({chatHistory: conversationHistory});

        expect(contextText.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialTokensText",
              "value": "[INST] ",
            },
            "### System message

          You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.

          ----

          Hi there!",
            {
              "type": "specialTokensText",
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
        const {contextText} = chatWrapper.generateContextState({chatHistory: conversationHistory});

        expect(contextText.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialTokensText",
              "value": "[INST] ",
            },
            "### System message

          You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.

          ----

          Hi there!",
            {
              "type": "specialTokensText",
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
        const {contextText} = chatWrapper.generateContextState({chatHistory: conversationHistory});

        expect(contextText.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialTokensText",
              "value": "[INST] ",
            },
            "### System message

          You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.

          ----

          Hi there!",
            {
              "type": "specialTokensText",
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
        const {contextText} = chatWrapper.generateContextState({chatHistory: [conversationHistory[0], ...conversationHistory]});

        expect(contextText.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialTokensText",
              "value": "<<SYS>>
          ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialTokensText",
              "value": "
          <</SYS>>

          <<SYS>>
          ",
            },
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            {
              "type": "specialTokensText",
              "value": "
          <</SYS>>

          ",
            },
            {
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialTokensText",
              "value": "[INST] ",
            },
            "Hi there!",
            {
              "type": "specialTokensText",
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
        const {contextText} = chatWrapper.generateContextState({
            chatHistory: conversationHistory,
            availableFunctions: exampleFunctions
        });

        expect(contextText.values).toMatchInlineSnapshot(`
          [
            {
              "type": "specialTokensText",
              "value": "<<SYS>>
          ",
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
          <</SYS>>

          ",
            },
            {
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialTokensText",
              "value": "[INST] ",
            },
            "Hi there!",
            {
              "type": "specialTokensText",
              "value": " [/INST] ",
            },
            "Hello!",
          ]
        `);
    });

    test("functions template", () => {
        const chatWrapper = new JinjaTemplateChatWrapper({
            template: template3,
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
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialTokensText",
              "value": "[INST] ",
            },
            "### System message

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
          [[call: getSomeInfo({"someKey":"someValue"})]]

          Note that the || prefix is mandatory
          The assistant does not inform the user about using functions and does not explain anything before calling a function.
          After calling a function, the raw result appears afterwards and is not part of the conversation
          To make information be part of the conversation, the assistant paraphrases and repeats the information without the function syntax.

          ----

          Hi there!",
            {
              "type": "specialTokensText",
              "value": " [/INST] ",
            },
            "Hello![[call: func2({"message":"Hello","feeling":"good","words":1})]] [[result: {"yes":true,"message":"ok"}]]",
            {
              "type": "specialTokensText",
              "value": " ",
            },
            {
              "type": "specialToken",
              "value": "EOS",
            },
            {
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialTokensText",
              "value": "[INST] ",
            },
            "How are you?",
            {
              "type": "specialTokensText",
              "value": " [/INST]",
            },
          ]
        `);
    });

    test("functions template 2", () => {
        const chatWrapper = new JinjaTemplateChatWrapper({
            template: template3,
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
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialTokensText",
              "value": "[INST] ",
            },
            "### System message

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

          Call function: getSomeInfo with params {"someKey":"someValue"}.

          Note that the || prefix is mandatory
          The assistant does not inform the user about using functions and does not explain anything before calling a function.
          After calling a function, the raw result appears afterwards and is not part of the conversation
          To make information be part of the conversation, the assistant paraphrases and repeats the information without the function syntax.

          ----

          Hi there!",
            {
              "type": "specialTokensText",
              "value": " [/INST] ",
            },
            "Hello!
          Call function: func2 with params {"message":"Hello","feeling":"good","words":1}.
          Function result: {"yes":true,"message":"ok"}
          ",
            {
              "type": "specialTokensText",
              "value": " ",
            },
            {
              "type": "specialToken",
              "value": "EOS",
            },
            {
              "type": "specialToken",
              "value": "BOS",
            },
            {
              "type": "specialTokensText",
              "value": "[INST] ",
            },
            "How are you?",
            {
              "type": "specialTokensText",
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
