import {describe, expect, test} from "vitest";
import {Template} from "@huggingface/jinja";
import {ChatHistoryItem, ChatModelFunctions, JinjaTemplateChatWrapper} from "../../../../src/index.js";
import {defaultChatSystemPrompt} from "../../../../src/config.js";
import {LlamaText} from "../../../../src/utils/LlamaText.js";
import {fromChatHistoryToIntermediateOpenAiMessages, fromIntermediateToCompleteOpenAiMessages} from "../../../../src/utils/OpenAIFormat.js";
import {removeUndefinedFields} from "../../../../src/utils/removeNullFields.js";

const mistralJinjaTemplate = `
{%- if messages[0]["role"] == "system" -%}
    {%- set system_message = messages[0]["content"] -%}
    {%- set loop_messages = messages[1:] -%}
{%- else -%}
    {%- set loop_messages = messages -%}
{%- endif -%}
{%- if not tools is defined -%}
    {%- set tools = none -%}
{%- endif -%}
{%- set user_messages = loop_messages | selectattr("role", "equalto", "user") | list -%}
{{- bos_token -}}
{%- for message in loop_messages -%}
    {%- if message["role"] == "user" -%}
        {%- if tools is not none and (message == user_messages[-1]) -%}
            {{- "[AVAILABLE_TOOLS][" -}}
            {%- for tool in tools -%}
                {%- set tool = tool.function -%}
                {{- '{"type": "function", "function": {' -}}
                {%- for key, val in tool.items() if key != "return" -%}
                    {%- if val is string -%}
                        {{- '"' + key + '": "' + val + '"' -}}
                    {%- else -%}
                        {{- '"' + key + '": ' + val|tojson -}}
                    {%- endif -%}
                    {%- if not loop.last -%}
                        {{- ", " -}}
                    {%- endif -%}
                {%- endfor -%}
                {{- "}}" -}}
                {%- if not loop.last -%}
                    {{- ", " -}}
                {%- else -%}
                    {{- "]" -}}
                {%- endif -%}
            {%- endfor -%}
            {{- "[/AVAILABLE_TOOLS]" -}}
        {%- endif -%}
        {%- if loop.last and system_message is defined -%}
            {{- "[INST]" + system_message + "\\n\\n" + message["content"] + "[/INST]" -}}
        {%- else -%}
            {{- "[INST]" + message["content"] + "[/INST]" -}}
        {%- endif -%}
    {%- elif message["role"] == "tool_calls" or message.tool_calls is defined -%}
        {%- if message.tool_calls is defined -%}
            {%- set tool_calls = message.tool_calls -%}
        {%- else -%}
            {%- set tool_calls = message.content -%}
        {%- endif -%}
        {{- "[TOOL_CALLS][" -}}
        {%- for tool_call in tool_calls -%}
            {%- set out = tool_call.function|tojson -%}
            {{- out[:-1] -}}
            {%- if not tool_call.id is defined or tool_call.id|length != 9 -%}
                {{- raise_exception("Tool call IDs should be alphanumeric strings with length 9!") -}}
            {%- endif -%}
            {{- ', "id": "' + tool_call.id + '"}' -}}
            {%- if not loop.last -%}
                {{- ", " -}}
            {%- else -%}
                {{- "]" + eos_token -}}
            {%- endif -%}
        {%- endfor -%}
    {%- elif message["role"] == "assistant" -%}
        {{- message["content"] + eos_token -}}
    {%- elif message["role"] == "tool_results" or message["role"] == "tool" -%}
        {%- if message.content is defined and message.content.content is defined -%}
            {%- set content = message.content.content -%}
        {%- else -%}
            {%- set content = message.content -%}
        {%- endif -%}
        {{- '[TOOL_RESULTS]{"content": ' + content|string + ", " -}}
        {%- if not message.tool_call_id is defined or message.tool_call_id|length != 9 -%}
            {{- raise_exception("Tool call IDs should be alphanumeric strings with length 9!") -}}
        {%- endif -%}
        {{- '"call_id": "' + message.tool_call_id + '"}[/TOOL_RESULTS]' -}}
    {%- else -%}
        {{- raise_exception("Only user and assistant roles are supported, with the exception of an initial optional system message!") -}}
    {%- endif -%}
{%- endfor -%}
`.slice(1, -1);

const llama3_1ChatJinjaTemplate = `
{{- bos_token }}
{%- if custom_tools is defined %}
    {%- set tools = custom_tools %}
{%- endif %}
{%- if not tools_in_user_message is defined %}
    {%- set tools_in_user_message = true %}
{%- endif %}
{%- if not date_string is defined %}
    {%- set date_string = "26 Jul 2024" %}
{%- endif %}
{%- if not tools is defined %}
    {%- set tools = none %}
{%- endif %}

{#- This block extracts the system message, so we can slot it into the right place. #}
{%- if messages[0]['role'] == 'system' %}
    {%- set system_message = messages[0]['content']|trim %}
    {%- set messages = messages[1:] %}
{%- else %}
    {%- set system_message = "" %}
{%- endif %}

{#- System message + builtin tools #}
{{- "<|start_header_id|>system<|end_header_id|>\\n\\n" }}
{%- if builtin_tools is defined or tools is not none %}
    {{- "Environment: ipython\\n" }}
{%- endif %}
{%- if builtin_tools is defined %}
    {{- "Tools: " + builtin_tools | reject('equalto', 'code_interpreter') | join(", ") + "\\n\\n"}}
{%- endif %}
{{- "Cutting Knowledge Date: December 2023\\n" }}
{{- "Today Date: " + date_string + "\\n\\n" }}
{%- if tools is not none and not tools_in_user_message %}
    {{- "You have access to the following functions. To call a function, please respond with JSON for a function call." }}
    {{- 'Respond in the format {"name": function name, "parameters": dictionary of argument name and its value}.' }}
    {{- "Do not use variables.\\n\\n" }}
    {%- for t in tools %}
        {{- t | tojson(indent=4) }}
        {{- "\\n\\n" }}
    {%- endfor %}
{%- endif %}
{{- system_message }}
{{- eot_token }}

{#- Custom tools are passed in a user message with some extra guidance #}
{%- if tools_in_user_message and not tools is none %}
    {#- Extract the first user message so we can plug it in here #}
    {%- if messages | length != 0 %}
        {%- set first_user_message = messages[0]['content']|trim %}
        {%- set messages = messages[1:] %}
    {%- else %}
        {{- raise_exception("Cannot put tools in the first user message when there's no first user message!") }}
{%- endif %}
    {{- '<|start_header_id|>user<|end_header_id|>\\n\\n' -}}
    {{- "Given the following functions, please respond with a JSON for a function call " }}
    {{- "with its proper arguments that best answers the given prompt.\\n\\n" }}
    {{- 'Respond in the format {"name": function name, "parameters": dictionary of argument name and its value}.' }}
    {{- "Do not use variables.\\n\\n" }}
    {%- for t in tools %}
        {{- t | tojson(indent=4) }}
        {{- "\\n\\n" }}
    {%- endfor %}
    {{- first_user_message + eot_token}}
{%- endif %}

{%- for message in messages %}
    {%- if not (message.role == 'ipython' or message.role == 'tool' or 'tool_calls' in message) %}
        {{- '<|start_header_id|>' + message['role'] + '<|end_header_id|>\\n\\n'+ message['content'] | trim + eot_token }}
    {%- elif 'tool_calls' in message %}
        {%- if not message.tool_calls|length == 1 %}
            {{- raise_exception("This model only supports single tool-calls at once!") }}
        {%- endif %}
        {%- set tool_call = message.tool_calls[0].function %}
        {%- if builtin_tools is defined and tool_call.name in builtin_tools %}
            {{- '<|start_header_id|>assistant<|end_header_id|>\\n\\n' -}}
            {{- "<|python_tag|>" + tool_call.name + ".call(" }}
            {%- for arg_name, arg_val in tool_call.arguments | items %}
                {{- arg_name + '="' + arg_val + '"' }}
                {%- if not loop.last %}
                    {{- ", " }}
                {%- endif %}
                {%- endfor %}
            {{- ")" }}
        {%- else  %}
            {{- '<|start_header_id|>assistant<|end_header_id|>\\n\\n' -}}
            {{- '{"name": "' + tool_call.name + '", ' }}
            {{- '"parameters": ' }}
            {{- tool_call.arguments | tojson }}
            {{- "}" }}
        {%- endif %}
        {%- if builtin_tools is defined %}
            {#- This means we're in ipython mode #}
            {{- "<|eom_id|>" }}
        {%- else %}
            {{- eot_token }}
        {%- endif %}
    {%- elif message.role == "tool" or message.role == "ipython" %}
        {{- "<|start_header_id|>ipython<|end_header_id|>\\n\\n" }}
        {%- if message.content is mapping or message.content is iterable %}
            {{- message.content | tojson }}
        {%- else %}
            {{- message.content }}
        {%- endif %}
        {{- eot_token }}
    {%- endif %}
{%- endfor %}
{%- if add_generation_prompt %}
    {{- '<|start_header_id|>assistant<|end_header_id|>\\n\\n' }}
{%- endif %}
`.slice(1, -1);

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
        },
        func4: {
            description: "Some description here",
            params: {
                type: "array",
                prefixItems: [
                    {type: "string"},
                    {type: "boolean"},
                    {type: "number"},
                    {type: "null"},
                    {type: "object", properties: {message: {type: "string"}}},
                    {type: "array", items: {type: "string"}}
                ],
                items: {
                    enum: ["1", -6]
                },
                minItems: 8
            }
        },
        func5: {
            description: "Some description here",
            params: {
                type: "array",
                prefixItems: [
                    {type: "string"},
                    {type: "boolean"},
                    {type: "number"}
                ],
                maxItems: 3
            }
        },
        func6: {
            description: "Some description here",
            params: {
                type: "array",
                items: {
                    type: "string"
                },
                minItems: 2
            }
        },
        func7: {
            description: "Some description here",
            params: {
                type: "array",
                items: {
                    type: "string"
                },
                minItems: 2,
                maxItems: 2
            }
        },
        func8: {
            params: {
                type: "object",
                properties: {
                    message: {
                        description: "The main message",
                        type: "string"
                    },
                    feeling: {
                        description: "The feeling",
                        enum: ["good", "bad"]
                    },
                    words: {
                        description: "The number of words.\nFor example, 6",
                        type: "number"
                    }
                }
            }
        }
    } as const;

    const conversationHistory4: ChatHistoryItem[] = [{
        type: "system",
        text: LlamaText(defaultChatSystemPrompt).toJSON()
    }, {
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
    }];
    const functions4: ChatModelFunctions = {
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

    // last model message is a function call
    const conversationHistory5: ChatHistoryItem[] = [{
        type: "system",
        text: LlamaText(defaultChatSystemPrompt).toJSON()
    }, {
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
        }]
    }];
    const functions5: ChatModelFunctions = {
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

    const sanity1ChatHistory: ChatHistoryItem[] = [{
        type: "system",
        text: "systemMessage"
    }, {
        type: "user",
        text: "userMessage1"
    }, {
        type: "model",
        response: [
            // "modelMessage1",
            {
                type: "functionCall",
                name: "func1name",
                params: "func1params",
                result: "func1result",
                startsNewChunk: true
            },
            {
                type: "functionCall",
                name: "func2name",
                params: "func2params",
                result: "func2result",
                startsNewChunk: false
            },
            "modelMessage2"
        ]
    }, {
        type: "model",
        response: ["modelMessage3"]
    }, {
        type: "model",
        response: ["modelMessage4"]
    }];
    const sanity1Functions: ChatModelFunctions = {
        ["func1name"]: {
            description: "func1description",
            params: {
                type: "number"
            }
        },
        ["func2name"]: {
            description: "func2description",
            params: {
                type: "number"
            }
        }
    };

    test("with system prompt support", () => {
        const chatWrapper = new JinjaTemplateChatWrapper({
            template: template2
        });
        const {contextText, stopGenerationTriggers} = chatWrapper.generateContextState({chatHistory: conversationHistory});

        expect(contextText).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialTokensText("<<SYS>>
          "),
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            new SpecialTokensText("
          <</SYS>>

          "),
            new SpecialToken("BOS"),
            new SpecialTokensText("[INST] "),
            "Hi there!",
            new SpecialTokensText(" [/INST] "),
            "Hello!",
          ])
        `);
        expect(stopGenerationTriggers).toMatchInlineSnapshot(`
          [
            LlamaText([
              new SpecialToken("EOS"),
            ]),
            LlamaText([
              new SpecialTokensText(" "),
              new SpecialToken("EOS"),
            ]),
          ]
        `);

        const {contextText: contextText2} = chatWrapper.generateContextState({chatHistory: conversationHistory2});

        expect(contextText2).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialTokensText("<<SYS>>
          "),
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            new SpecialTokensText("
          <</SYS>>

          "),
            new SpecialToken("BOS"),
            new SpecialTokensText("[INST] "),
            "Hi there!",
            new SpecialTokensText(" [/INST] "),
            "Hello!",
            new SpecialTokensText(" "),
            new SpecialToken("EOS"),
            new SpecialToken("BOS"),
            new SpecialTokensText("[INST] "),
            "How are you?",
            new SpecialTokensText(" [/INST] "),
            "I'm good, how are you?",
          ])
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

        expect(contextText3).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialTokensText("<<SYS>>
          "),
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            new SpecialTokensText("
          <</SYS>>

          "),
            new SpecialToken("BOS"),
            new SpecialTokensText("[INST] "),
            "Hi there!",
            new SpecialTokensText(" [/INST] "),
            "Hello!",
          ])
        `);

        expect(contextText3WithOpenModelResponse).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialTokensText("<<SYS>>
          "),
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            new SpecialTokensText("
          <</SYS>>

          "),
            new SpecialToken("BOS"),
            new SpecialTokensText("[INST] "),
            "Hi there!",
            new SpecialTokensText(" [/INST] "),
            "Hello!

          ",
          ])
        `);

        const {contextText: contextText4} = chatWrapper.generateContextState({chatHistory: conversationHistory3});

        expect(contextText4).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialToken("BOS"),
            new SpecialTokensText("[INST] "),
            "Hi there!",
            new SpecialTokensText(" [/INST] "),
            "Hello!",
            new SpecialTokensText(" "),
            new SpecialToken("EOS"),
            new SpecialToken("BOS"),
            new SpecialTokensText("[INST] "),
            "How are you?",
            new SpecialTokensText(" [/INST]"),
          ])
        `);
    });

    test("without system prompt support", () => {
        const chatWrapper = new JinjaTemplateChatWrapper({
            template: template1
        });
        const {contextText} = chatWrapper.generateContextState({chatHistory: conversationHistory});

        expect(contextText).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialToken("BOS"),
            new SpecialTokensText("[INST] "),
            "### System message

          You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.

          ----

          Hi there!",
            new SpecialTokensText(" [/INST]"),
            "Hello!",
          ])
        `);
    });

    test("without system prompt support with no exception from the template", () => {
        const chatWrapper = new JinjaTemplateChatWrapper({
            template: template3
        });
        const {contextText} = chatWrapper.generateContextState({chatHistory: conversationHistory});

        expect(contextText).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialToken("BOS"),
            new SpecialTokensText("[INST] "),
            "### System message

          You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.

          ----

          Hi there!",
            new SpecialTokensText(" [/INST] "),
            "Hello!",
          ])
        `);
    });

    test("without system prompt support with no exception from the template 2", () => {
        const chatWrapper = new JinjaTemplateChatWrapper({
            template: template2,
            systemRoleName: "something1"
        });
        const {contextText} = chatWrapper.generateContextState({chatHistory: conversationHistory});

        expect(contextText).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialToken("BOS"),
            new SpecialTokensText("[INST] "),
            "### System message

          You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.

          ----

          Hi there!",
            new SpecialTokensText(" [/INST] "),
            "Hello!",
          ])
        `);
    });

    test("without joining adjacent messages of the same type", () => {
        const chatWrapper = new JinjaTemplateChatWrapper({
            template: template2,
            joinAdjacentMessagesOfTheSameType: false
        });
        const {contextText} = chatWrapper.generateContextState({chatHistory: [conversationHistory[0]!, ...conversationHistory]});

        expect(contextText).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialTokensText("<<SYS>>
          "),
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            new SpecialTokensText("
          <</SYS>>

          <<SYS>>
          "),
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
            new SpecialTokensText("
          <</SYS>>

          "),
            new SpecialToken("BOS"),
            new SpecialTokensText("[INST] "),
            "Hi there!",
            new SpecialTokensText(" [/INST] "),
            "Hello!",
          ])
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

        expect(contextText).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialTokensText("<<SYS>>
          "),
            "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
          If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.

          The assistant calls the provided functions as needed to retrieve information instead of relying on existing knowledge.
          To fulfill a request, the assistant calls relevant functions in advance when needed before responding to the request, and does not tell the user prior to calling a function.
          Provided functions:
          \`\`\`typescript
          function func1();

          function func2(params: {message: string, feeling: "good" | "bad", words: number});

          // Some description here
          function func3(params: string[]);

          // Some description here
          function func4(params: [string, boolean, number, null, {message: string}, string[], "1" | -6, "1" | -6, ...("1" | -6)[]]);

          // Some description here
          function func5(params: [string, boolean, number]);

          // Some description here
          function func6(params: [string, string, ...string[]]);

          // Some description here
          function func7(params: [string, string]);

          function func8(params: {
              // The main message
              message: string,
              
              // The feeling
              feeling: "good" | "bad",
              
              // The number of words.
              // For example, 6
              words: number
          });
          \`\`\`

          Calling any of the provided functions can be done like this:
          ||call: getSomeInfo",
            new SpecialTokensText("("),
            "{"someKey": "someValue"}",
            new SpecialTokensText(")"),
            "

          Note that the || prefix is mandatory.
          The assistant does not inform the user about using functions and does not explain anything before calling a function.
          After calling a function, the raw result appears afterwards and is not part of the conversation.
          To make information be part of the conversation, the assistant paraphrases and repeats the information without the function syntax.",
            new SpecialTokensText("
          <</SYS>>

          "),
            new SpecialToken("BOS"),
            new SpecialTokensText("[INST] "),
            "Hi there!",
            new SpecialTokensText(" [/INST] "),
            "Hello!",
          ])
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

        expect(contextText).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialToken("BOS"),
            new SpecialTokensText("[INST] "),
            "### System message

          The assistant calls the provided functions as needed to retrieve information instead of relying on existing knowledge.
          To fulfill a request, the assistant calls relevant functions in advance when needed before responding to the request, and does not tell the user prior to calling a function.
          Provided functions:
          \`\`\`typescript
          function func1();

          function func2(params: {message: string, feeling: "good" | "bad", words: number});

          // Some description here
          function func3(params: string[]);

          // Some description here
          function func4(params: [string, boolean, number, null, {message: string}, string[], "1" | -6, "1" | -6, ...("1" | -6)[]]);

          // Some description here
          function func5(params: [string, boolean, number]);

          // Some description here
          function func6(params: [string, string, ...string[]]);

          // Some description here
          function func7(params: [string, string]);

          function func8(params: {
              // The main message
              message: string,
              
              // The feeling
              feeling: "good" | "bad",
              
              // The number of words.
              // For example, 6
              words: number
          });
          \`\`\`

          Calling any of the provided functions can be done like this:
          [[call: getSomeInfo({"someKey": "someValue"})]]

          Note that the || prefix is mandatory.
          The assistant does not inform the user about using functions and does not explain anything before calling a function.
          After calling a function, the raw result appears afterwards and is not part of the conversation.
          To make information be part of the conversation, the assistant paraphrases and repeats the information without the function syntax.

          ----

          Hi there!",
            new SpecialTokensText(" [/INST] "),
            "Hello![[call: func2({"message": "Hello", "feeling": "good", "words": 1})]] [[result: {"yes": true, "message": "ok"}]]",
            new SpecialTokensText(" "),
            new SpecialToken("EOS"),
            new SpecialToken("BOS"),
            new SpecialTokensText("[INST] "),
            "How are you?",
            new SpecialTokensText(" [/INST]"),
          ])
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

        expect(contextText).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialToken("BOS"),
            new SpecialTokensText("[INST] "),
            "### System message

          The assistant calls the provided functions as needed to retrieve information instead of relying on existing knowledge.
          To fulfill a request, the assistant calls relevant functions in advance when needed before responding to the request, and does not tell the user prior to calling a function.
          Provided functions:
          \`\`\`typescript
          function func1();

          function func2(params: {message: string, feeling: "good" | "bad", words: number});

          // Some description here
          function func3(params: string[]);

          // Some description here
          function func4(params: [string, boolean, number, null, {message: string}, string[], "1" | -6, "1" | -6, ...("1" | -6)[]]);

          // Some description here
          function func5(params: [string, boolean, number]);

          // Some description here
          function func6(params: [string, string, ...string[]]);

          // Some description here
          function func7(params: [string, string]);

          function func8(params: {
              // The main message
              message: string,
              
              // The feeling
              feeling: "good" | "bad",
              
              // The number of words.
              // For example, 6
              words: number
          });
          \`\`\`

          Calling any of the provided functions can be done like this:

          Call function: getSomeInfo with params {"someKey": "someValue"}.

          Note that the || prefix is mandatory.
          The assistant does not inform the user about using functions and does not explain anything before calling a function.
          After calling a function, the raw result appears afterwards and is not part of the conversation.
          To make information be part of the conversation, the assistant paraphrases and repeats the information without the function syntax.

          ----

          Hi there!",
            new SpecialTokensText(" [/INST] "),
            "Hello!
          Call function: func2 with params {"message": "Hello", "feeling": "good", "words": 1}.
          Function result: {"yes": true, "message": "ok"}
          ",
            new SpecialTokensText(" "),
            new SpecialToken("EOS"),
            new SpecialToken("BOS"),
            new SpecialTokensText("[INST] "),
            "How are you?",
            new SpecialTokensText(" [/INST]"),
          ])
        `);
    });

    describe("native function calling", () => {
        test("sanity - template renders", () => {
            const chatWrapper = new JinjaTemplateChatWrapper({
                template: mistralJinjaTemplate
            });

            const {messages: intermediateMessages, tools} = fromChatHistoryToIntermediateOpenAiMessages({
                chatHistory: sanity1ChatHistory,
                chatWrapperSettings: chatWrapper.settings,
                useRawValues: false,
                functions: sanity1Functions,
                stringifyFunctionParams: false,
                stringifyFunctionResults: true,
                combineModelMessageAndToolCalls: false,
                squashModelTextResponses: false
            });
            const messages = fromIntermediateToCompleteOpenAiMessages(intermediateMessages);

            const jinjaTemplate = new Template(mistralJinjaTemplate);
            const res = jinjaTemplate.render({
                messages,
                "bos_token": "|BOS|",
                "eos_token": "|EOS|",
                "eot_token": "|EOT|",
                ...removeUndefinedFields({tools})
            });
            expect(res).toMatchInlineSnapshot("\"|BOS|[AVAILABLE_TOOLS][{\"type\": \"function\", \"function\": {\"name\": \"func1name\", \"description\": \"func1description\", \"parameters\": {\"type\": \"number\"}}}, {\"type\": \"function\", \"function\": {\"name\": \"func2name\", \"description\": \"func2description\", \"parameters\": {\"type\": \"number\"}}}][/AVAILABLE_TOOLS][INST]userMessage1[/INST][TOOL_CALLS][{\"name\": \"func1name\", \"arguments\": \"func1params\", \"id\": \"fc_2_0000\"}, {\"name\": \"func2name\", \"arguments\": \"func2params\", \"id\": \"fc_2_0001\"}]|EOS|[TOOL_RESULTS]{\"content\": \"func1result\", \"call_id\": \"fc_2_0000\"}[/TOOL_RESULTS][TOOL_RESULTS]{\"content\": \"func2result\", \"call_id\": \"fc_2_0001\"}[/TOOL_RESULTS]modelMessage2|EOS|modelMessage3|EOS|modelMessage4|EOS|\"");
        });

        test("mistral template", () => {
            const chatWrapper = new JinjaTemplateChatWrapper({
                template: mistralJinjaTemplate
            });

            expect(chatWrapper.settings.functions).toMatchInlineSnapshot(`
              {
                "call": {
                  "emptyCallParamsPlaceholder": {},
                  "optionalPrefixSpace": true,
                  "paramsPrefix": LlamaText([
                    new SpecialTokensText("", "arguments": "),
                  ]),
                  "prefix": LlamaText([
                    new SpecialTokensText("{"name": ""),
                  ]),
                  "suffix": LlamaText([
                    new SpecialTokensText("}"),
                  ]),
                },
                "parallelism": {
                  "call": {
                    "betweenCalls": LlamaText([
                      new SpecialTokensText(", "),
                    ]),
                    "sectionPrefix": LlamaText([
                      new SpecialTokensText("[TOOL_CALLS]["),
                    ]),
                    "sectionPrefixAlternateMatches": undefined,
                    "sectionSuffix": LlamaText([
                      new SpecialTokensText("]"),
                      new SpecialToken("EOS"),
                    ]),
                  },
                  "result": {
                    "betweenResults": LlamaText([]),
                    "sectionPrefix": LlamaText([]),
                    "sectionSuffix": LlamaText([]),
                  },
                },
                "result": {
                  "prefix": LlamaText([
                    new SpecialTokensText("[TOOL_RESULTS]{"content": "),
                  ]),
                  "suffix": LlamaText([
                    new SpecialTokensText("}[/TOOL_RESULTS]"),
                  ]),
                },
              }
            `);

            const {contextText} = chatWrapper.generateContextState({
                chatHistory: conversationHistoryWithFunctionCalls,
                availableFunctions: exampleFunctions
            });

            expect(contextText).toMatchInlineSnapshot(`
              LlamaText([
                new SpecialToken("BOS"),
                new SpecialTokensText("[INST]"),
                "Hi there!",
                new SpecialTokensText("[/INST]"),
                "Hello!",
                new SpecialTokensText("[TOOL_CALLS][{"name": ""),
                "func2",
                new SpecialTokensText("", "arguments": "),
                "{"message": "Hello", "feeling": "good", "words": 1}",
                new SpecialTokensText("}]"),
                new SpecialToken("EOS"),
                new SpecialTokensText("[TOOL_RESULTS]{"content": "),
                ""{\\"yes\\": true, \\"message\\": \\"ok\\"}"",
                new SpecialTokensText("}[/TOOL_RESULTS]"),
                new SpecialToken("EOS"),
                new SpecialTokensText("[AVAILABLE_TOOLS][{"type": "function", "function": {"name": "func1"}}, {"type": "function", "function": {"name": "func2", "parameters": {"type": "object", "properties": {"message": {"type": "string"}, "feeling": {"enum": ["good", "bad"]}, "words": {"type": "number"}}}}}, {"type": "function", "function": {"name": "func3", "description": "Some description here", "parameters": {"type": "array", "items": {"type": "string"}}}}, {"type": "function", "function": {"name": "func4", "description": "Some description here", "parameters": {"type": "array", "prefixItems": [{"type": "string"}, {"type": "boolean"}, {"type": "number"}, {"type": "null"}, {"type": "object", "properties": {"message": {"type": "string"}}}, {"type": "array", "items": {"type": "string"}}], "items": {"enum": ["1", -6]}, "minItems": 8}}}, {"type": "function", "function": {"name": "func5", "description": "Some description here", "parameters": {"type": "array", "prefixItems": [{"type": "string"}, {"type": "boolean"}, {"type": "number"}], "maxItems": 3}}}, {"type": "function", "function": {"name": "func6", "description": "Some description here", "parameters": {"type": "array", "items": {"type": "string"}, "minItems": 2}}}, {"type": "function", "function": {"name": "func7", "description": "Some description here", "parameters": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 2}}}, {"type": "function", "function": {"name": "func8", "parameters": {"type": "object", "properties": {"message": {"description": "The main message", "type": "string"}, "feeling": {"description": "The feeling", "enum": ["good", "bad"]}, "words": {"description": "The number of words.\\nFor example, 6", "type": "number"}}}}}][/AVAILABLE_TOOLS][INST]"),
                "How are you?",
                new SpecialTokensText("[/INST]"),
              ])
            `);
        });

        test("mistral template 2", () => {
            const chatWrapper = new JinjaTemplateChatWrapper({
                template: mistralJinjaTemplate
            });

            expect(chatWrapper.settings.functions).toMatchInlineSnapshot(`
              {
                "call": {
                  "emptyCallParamsPlaceholder": {},
                  "optionalPrefixSpace": true,
                  "paramsPrefix": LlamaText([
                    new SpecialTokensText("", "arguments": "),
                  ]),
                  "prefix": LlamaText([
                    new SpecialTokensText("{"name": ""),
                  ]),
                  "suffix": LlamaText([
                    new SpecialTokensText("}"),
                  ]),
                },
                "parallelism": {
                  "call": {
                    "betweenCalls": LlamaText([
                      new SpecialTokensText(", "),
                    ]),
                    "sectionPrefix": LlamaText([
                      new SpecialTokensText("[TOOL_CALLS]["),
                    ]),
                    "sectionPrefixAlternateMatches": undefined,
                    "sectionSuffix": LlamaText([
                      new SpecialTokensText("]"),
                      new SpecialToken("EOS"),
                    ]),
                  },
                  "result": {
                    "betweenResults": LlamaText([]),
                    "sectionPrefix": LlamaText([]),
                    "sectionSuffix": LlamaText([]),
                  },
                },
                "result": {
                  "prefix": LlamaText([
                    new SpecialTokensText("[TOOL_RESULTS]{"content": "),
                  ]),
                  "suffix": LlamaText([
                    new SpecialTokensText("}[/TOOL_RESULTS]"),
                  ]),
                },
              }
            `);

            const {contextText} = chatWrapper.generateContextState({
                chatHistory: conversationHistory4,
                availableFunctions: functions4
            });

            expect(contextText).toMatchInlineSnapshot(`
              LlamaText([
                new SpecialToken("BOS"),
                new SpecialTokensText("[INST]"),
                "### System message

              You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
              If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.

              ----

              Hi there!",
                new SpecialTokensText("[/INST]"),
                "Hello!",
                new SpecialToken("EOS"),
                new SpecialTokensText("[AVAILABLE_TOOLS][{"type": "function", "function": {"name": "getTime", "description": "Retrieve the current time", "parameters": {"type": "object", "properties": {"hours": {"enum": ["24", "12"]}, "seconds": {"type": "boolean"}}}}}][/AVAILABLE_TOOLS][INST]"),
                "What is the time?",
                new SpecialTokensText("[/INST][TOOL_CALLS][{"name": "getTime", "arguments": {"hours": "24", "seconds": true}, "id": "fc_3_0000"}]"),
                new SpecialToken("EOS"),
                new SpecialTokensText("[TOOL_RESULTS]{"content": "),
                ""22:00:00"",
                new SpecialTokensText(", "call_id": "fc_3_0000"}[/TOOL_RESULTS]"),
                "I'm good, how are you?",
              ])
            `);
        });

        test("mistral template - last model message is a function call", () => {
            const chatWrapper = new JinjaTemplateChatWrapper({
                template: mistralJinjaTemplate
            });

            expect(chatWrapper.settings.functions).toMatchInlineSnapshot(`
              {
                "call": {
                  "emptyCallParamsPlaceholder": {},
                  "optionalPrefixSpace": true,
                  "paramsPrefix": LlamaText([
                    new SpecialTokensText("", "arguments": "),
                  ]),
                  "prefix": LlamaText([
                    new SpecialTokensText("{"name": ""),
                  ]),
                  "suffix": LlamaText([
                    new SpecialTokensText("}"),
                  ]),
                },
                "parallelism": {
                  "call": {
                    "betweenCalls": LlamaText([
                      new SpecialTokensText(", "),
                    ]),
                    "sectionPrefix": LlamaText([
                      new SpecialTokensText("[TOOL_CALLS]["),
                    ]),
                    "sectionPrefixAlternateMatches": undefined,
                    "sectionSuffix": LlamaText([
                      new SpecialTokensText("]"),
                      new SpecialToken("EOS"),
                    ]),
                  },
                  "result": {
                    "betweenResults": LlamaText([]),
                    "sectionPrefix": LlamaText([]),
                    "sectionSuffix": LlamaText([]),
                  },
                },
                "result": {
                  "prefix": LlamaText([
                    new SpecialTokensText("[TOOL_RESULTS]{"content": "),
                  ]),
                  "suffix": LlamaText([
                    new SpecialTokensText("}[/TOOL_RESULTS]"),
                  ]),
                },
              }
            `);

            const {contextText} = chatWrapper.generateContextState({
                chatHistory: conversationHistory5,
                availableFunctions: functions5
            });

            expect(contextText).toMatchInlineSnapshot(`
              LlamaText([
                new SpecialToken("BOS"),
                new SpecialTokensText("[INST]"),
                "### System message

              You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
              If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.

              ----

              Hi there!",
                new SpecialTokensText("[/INST]"),
                "Hello!",
                new SpecialToken("EOS"),
                new SpecialTokensText("[AVAILABLE_TOOLS][{"type": "function", "function": {"name": "getTime", "description": "Retrieve the current time", "parameters": {"type": "object", "properties": {"hours": {"enum": ["24", "12"]}, "seconds": {"type": "boolean"}}}}}][/AVAILABLE_TOOLS][INST]"),
                "What is the time?",
                new SpecialTokensText("[/INST][TOOL_CALLS][{"name": "getTime", "arguments": {"hours": "24", "seconds": true}, "id": "fc_3_0000"}]"),
                new SpecialToken("EOS"),
                new SpecialTokensText("[TOOL_RESULTS]{"content": "),
                ""22:00:00"",
                new SpecialTokensText(", "call_id": "fc_3_0000"}[/TOOL_RESULTS]"),
              ])
            `);
        });

        test("llama 3.1 template", () => {
            const chatWrapper = new JinjaTemplateChatWrapper({
                template: llama3_1ChatJinjaTemplate
            });

            expect(chatWrapper.settings.functions).toMatchInlineSnapshot(`
              {
                "call": {
                  "emptyCallParamsPlaceholder": {},
                  "optionalPrefixSpace": true,
                  "paramsPrefix": LlamaText([
                    new SpecialTokensText("", "parameters": "),
                  ]),
                  "prefix": LlamaText([
                    new SpecialTokensText("{"name": ""),
                  ]),
                  "suffix": "",
                },
                "result": {
                  "prefix": LlamaText([
                    new SpecialTokensText("}"),
                    new SpecialToken("EOT"),
                    new SpecialTokensText("<|start_header_id|>ipython<|end_header_id|>

              "),
                  ]),
                  "suffix": LlamaText([
                    new SpecialToken("EOT"),
                    new SpecialTokensText("<|start_header_id|>assistant<|end_header_id|>

              "),
                  ]),
                },
              }
            `);

            const {contextText} = chatWrapper.generateContextState({
                chatHistory: conversationHistoryWithFunctionCalls,
                availableFunctions: exampleFunctions
            });

            expect(contextText).toMatchInlineSnapshot(`
              LlamaText([
                new SpecialToken("BOS"),
                new SpecialTokensText("<|start_header_id|>system<|end_header_id|>

              Environment: ipython
              Cutting Knowledge Date: December 2023
              Today Date: 26 Jul 2024

              "),
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>user<|end_header_id|>

              Given the following functions, please respond with a JSON for a function call with its proper arguments that best answers the given prompt.

              Respond in the format {"name": function name, "parameters": dictionary of argument name and its value}.Do not use variables.

              {
                  "type": "function",
                  "function": {
                      "name": "func1"
                  }
              }

              {
                  "type": "function",
                  "function": {
                      "name": "func2",
                      "parameters": {
                          "type": "object",
                          "properties": {
                              "message": {
                                  "type": "string"
                              },
                              "feeling": {
                                  "enum": [
                                      "good",
                                      "bad"
                                  ]
                              },
                              "words": {
                                  "type": "number"
                              }
                          }
                      }
                  }
              }

              {
                  "type": "function",
                  "function": {
                      "name": "func3",
                      "description": "Some description here",
                      "parameters": {
                          "type": "array",
                          "items": {
                              "type": "string"
                          }
                      }
                  }
              }

              {
                  "type": "function",
                  "function": {
                      "name": "func4",
                      "description": "Some description here",
                      "parameters": {
                          "type": "array",
                          "prefixItems": [
                              {
                                  "type": "string"
                              },
                              {
                                  "type": "boolean"
                              },
                              {
                                  "type": "number"
                              },
                              {
                                  "type": "null"
                              },
                              {
                                  "type": "object",
                                  "properties": {
                                      "message": {
                                          "type": "string"
                                      }
                                  }
                              },
                              {
                                  "type": "array",
                                  "items": {
                                      "type": "string"
                                  }
                              }
                          ],
                          "items": {
                              "enum": [
                                  "1",
                                  -6
                              ]
                          },
                          "minItems": 8
                      }
                  }
              }

              {
                  "type": "function",
                  "function": {
                      "name": "func5",
                      "description": "Some description here",
                      "parameters": {
                          "type": "array",
                          "prefixItems": [
                              {
                                  "type": "string"
                              },
                              {
                                  "type": "boolean"
                              },
                              {
                                  "type": "number"
                              }
                          ],
                          "maxItems": 3
                      }
                  }
              }

              {
                  "type": "function",
                  "function": {
                      "name": "func6",
                      "description": "Some description here",
                      "parameters": {
                          "type": "array",
                          "items": {
                              "type": "string"
                          },
                          "minItems": 2
                      }
                  }
              }

              {
                  "type": "function",
                  "function": {
                      "name": "func7",
                      "description": "Some description here",
                      "parameters": {
                          "type": "array",
                          "items": {
                              "type": "string"
                          },
                          "minItems": 2,
                          "maxItems": 2
                      }
                  }
              }

              {
                  "type": "function",
                  "function": {
                      "name": "func8",
                      "parameters": {
                          "type": "object",
                          "properties": {
                              "message": {
                                  "description": "The main message",
                                  "type": "string"
                              },
                              "feeling": {
                                  "description": "The feeling",
                                  "enum": [
                                      "good",
                                      "bad"
                                  ]
                              },
                              "words": {
                                  "description": "The number of words.\\nFor example, 6",
                                  "type": "number"
                              }
                          }
                      }
                  }
              }

              "),
                "Hi there!",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>assistant<|end_header_id|>

              "),
                "Hello!",
                new SpecialTokensText("{"name": ""),
                "func2",
                new SpecialTokensText("", "parameters": "),
                "{"message": "Hello", "feeling": "good", "words": 1}",
                new SpecialTokensText("}"),
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>ipython<|end_header_id|>

              "),
                "{"yes": true, "message": "ok"}",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>assistant<|end_header_id|>

              "),
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>user<|end_header_id|>

              "),
                "How are you?",
                new SpecialToken("EOT"),
              ])
            `);
        });
    });

    test("Fails when messages are not present in the render output", () => {
        try {
            new JinjaTemplateChatWrapper({
                template: template2,
                userRoleName: "something1"
            });
            expect.unreachable("Should have thrown an error");
        } catch (err) {
            expect(String(err)).toMatchInlineSnapshot('"Error: The provided Jinja template failed the sanity test: Error: Some input messages are not present in the generated Jinja template output. Inspect the Jinja template to find out what went wrong"');
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
            expect(String(err)).toMatchInlineSnapshot('"Error: The provided Jinja template failed the sanity test: Error: Some input messages are not present in the generated Jinja template output. Inspect the Jinja template to find out what went wrong"');
        }
    });
});
