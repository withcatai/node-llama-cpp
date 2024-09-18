import {describe, expect, test} from "vitest";
import {
    AlpacaChatWrapper, ChatMLChatWrapper, FalconChatWrapper, FunctionaryChatWrapper, GemmaChatWrapper, GeneralChatWrapper,
    Llama2ChatWrapper, Llama3_1ChatWrapper, MistralChatWrapper, resolveChatWrapper
} from "../../../../src/index.js";


const alpacaJinjaTemplate = `
{%- for message in messages %}
    {%- if message['role'] == 'system' -%}
        {{- message['content'] + '\\n\\n' -}}
    {%- elif message['role'] == 'user' -%}
        {{- '### Instruction:\\n' + message['content'] + '\\n\\n'-}}
    {%- else -%}
        {{- '### Response:\\n' + message['content'] + '\\n\\n' -}}
    {%- endif -%}
{%- endfor -%}
{%- if add_generation_prompt -%}
    {{- '### Response:\\n'-}}
{%- endif -%}
`.slice(1, -1);

const chatMLJinjaTemplate = `
{%- for message in messages %}
    {%- if message['role'] == 'system' -%}
        {{- '<|im_start|>system\\n' + message['content'].strip() + '<|im_end|>\\n' -}}
    {%- elif message['role'] == 'user' -%}
        {{- '<|im_start|>user\\n' + message['content'].strip() + '<|im_end|>\\n'-}}
    {%- else -%}
        {{- '<|im_start|>assistant\\n' + message['content'] + '<|im_end|>\\n' -}}
    {%- endif -%}
{%- endfor -%}
{%- if add_generation_prompt -%}
    {{- '<|im_start|>assistant\\n'-}}
{%- endif -%}
`.slice(1, -1);

const falconJinjaTemplate = `
{%- if messages[0]['role'] == 'system' %}
    {%- set loop_messages = messages[1:] %}
    {%- set system_message = messages[0]['content'] %}
{%- else %}
    {%- set loop_messages = messages %}
    {%- set system_message = '' %}
{%- endif %}
{%- for message in loop_messages %}
    {%- if (message['role'] == 'user') != (loop.index0 % 2 == 0) %}
        {{- raise_exception('Conversation roles must alternate user/assistant/user/assistant/...') }}
    {%- endif %}
    {%- if loop.index0 == 0 %}
        {{- system_message.strip() }}
    {%- endif %}
    {%- if message['role'] == 'user' %}
        {{- '\n\nUser: ' + message['content'].strip() }}
    {%- elif message['role'] == 'assistant' %}
        {{- '\n\nAssistant: ' + message['content'].strip() }}
    {%- endif %}
{%- endfor %}
{%- if add_generation_prompt %}
    {{- '\n\nAssistant:' }}
{%- endif %}
`.slice(1, -1);

const funcationaryJinjaTemplateV2 = "{% for message in messages %}\n{% if message['role'] == 'user' or message['role'] == 'system' %}\n{{ '<|from|>' + message['role'] + '\n<|recipient|>all\n<|content|>' + message['content'] + '\n' }}{% elif message['role'] == 'tool' %}\n{{ '<|from|>' + message['name'] + '\n<|recipient|>all\n<|content|>' + message['content'] + '\n' }}{% else %}\n{% set contain_content='no'%}\n{% if message['content'] is not none %}\n{{ '<|from|>assistant\n<|recipient|>all\n<|content|>' + message['content'] }}{% set contain_content='yes'%}\n{% endif %}\n{% if 'tool_calls' in message and message['tool_calls'] is not none %}\n{% for tool_call in message['tool_calls'] %}\n{% set prompt='<|from|>assistant\n<|recipient|>' + tool_call['function']['name'] + '\n<|content|>' + tool_call['function']['arguments'] %}\n{% if loop.index == 1 and contain_content == \"no\" %}\n{{ prompt }}{% else %}\n{{ '\n' + prompt}}{% endif %}\n{% endfor %}\n{% endif %}\n{{ '<|stop|>\n' }}{% endif %}\n{% endfor %}\n{% if add_generation_prompt %}{{ '<|from|>assistant\n<|recipient|>' }}{% endif %}";
const funcationaryJinjaTemplateV2Llama3 = "{% for message in messages %}\n{% if message['role'] == 'user' or message['role'] == 'system' %}\n{{ '<|start_header_id|>' + message['role'] + '<|end_header_id|>\n\n' + message['content'] + eot_token }}{% elif message['role'] == 'tool' %}\n{{ '<|start_header_id|>' + message['role'] + '<|end_header_id|>\n\n' + 'name=' + message['name'] + '\n' + message['content'] + eot_token }}{% else %}\n{{ '<|start_header_id|>' + message['role'] + '<|end_header_id|>\n\n'}}{% if message['content'] is not none %}\n{{ message['content'] }}{% endif %}\n{% if 'tool_calls' in message and message['tool_calls'] is not none %}\n{% for tool_call in message['tool_calls'] %}\n{{ '<|reserved_special_token_249|>' + tool_call['function']['name'] + '\n' + tool_call['function']['arguments'] }}{% endfor %}\n{% endif %}\n{{ eot_token }}{% endif %}\n{% endfor %}\n{% if add_generation_prompt %}{{ '<|start_header_id|>{role}<|end_header_id|>\n\n' }}{% endif %}";
const funcationaryJinjaTemplateV3 = "{% for message in messages %}\n{% if message['role'] == 'user' or message['role'] == 'system' %}\n{{ '<|start_header_id|>' + message['role'] + '<|end_header_id|>\n\n' + message['content'] + eot_token }}{% elif message['role'] == 'tool' %}\n{{ '<|start_header_id|>' + message['role'] + '<|end_header_id|>\n\n' + message['content'] + eot_token }}{% else %}\n{{ '<|start_header_id|>' + message['role'] + '<|end_header_id|>\n\n'}}{% if message['content'] is not none %}\n{{ '>>>all\n' + message['content'] }}{% endif %}\n{% if 'tool_calls' in message and message['tool_calls'] is not none %}\n{% for tool_call in message['tool_calls'] %}\n{{ '>>>' + tool_call['function']['name'] + '\n' + tool_call['function']['arguments'] }}{% endfor %}\n{% endif %}\n{{ eot_token }}{% endif %}\n{% endfor %}\n{% if add_generation_prompt %}{{ '<|start_header_id|>{role}<|end_header_id|>\n\n' }}{% endif %}";

const gemmaJinjaTemplate = `
{%- if messages[0]['role'] == 'system' %}
    {{- raise_exception('System role not supported') }}
{%- endif %}
{%- for message in messages %}
    {%- if (message['role'] == 'user') != (loop.index0 % 2 == 0) %}
        {{- raise_exception('Conversation roles must alternate user/assistant/user/assistant/...') }}
    {%- endif %}
    {%- if (message['role'] == 'assistant') %}
        {%- set role = 'model' %}
    {%- else %}
        {%- set role = message['role'] %}
    {%- endif %}
    {{- '<start_of_turn>' + role + '\n' + message['content'] | trim + '<end_of_turn>\n' }}
{%- endfor %}
{%- if add_generation_prompt %}
    {{- '<start_of_turn>model\n' }}
{%- endif %}
`.slice(1, -1);

const generalJinjaTemplate = `
{%- for message in messages %}
    {%- if message['role'] == 'system' -%}
        {{- message['content'] + '\\n\\n' -}}
    {%- elif message['role'] == 'user' -%}
        {{- '### Human\\n' + message['content'] + '\\n\\n'-}}
    {%- else -%}
        {{- '### Assistant\\n' + message['content'] + '\\n\\n' -}}
    {%- endif -%}
{%- endfor -%}
{%- if add_generation_prompt -%}
    {{- '### Assistant\\n'-}}
{%- endif -%}
`.slice(1, -1);

const llama2ChatJinjaTemplate = `
{%- set ns = namespace(found=false) -%}
{%- for message in messages -%}
    {%- if message['role'] == 'system' -%}
        {%- set ns.found = true -%}
    {%- endif -%}
{%- endfor -%}
{%- if not ns.found -%}
    {{- '[INST] <<SYS>>\n' + 'Answer the questions.' + '\n<</SYS>>\n\n' -}}
{%- endif %}
{%- for message in messages %}
    {%- if message['role'] == 'system' -%}
        {{- '[INST] <<SYS>>\n' + message['content'] + '\n<</SYS>>\n\n' -}}
    {%- elif message['role'] == 'user' -%}
        {{- message['content'] + ' [/INST] '-}}
    {%- else -%}
        {{- message['content'] + eos_token + bos_token + '[INST] ' -}}
    {%- endif -%}
{%- endfor -%}
`.slice(1, -1);

const llama3ChatJinjaTemplate = `
{%- set loop_messages = messages -%}
{%- for message in loop_messages -%}
    {%- set content = '<|start_header_id|>' + message['role'] + '<|end_header_id|>\n\n'+ message['content'] | trim + eot_token -%}
    {%- if loop.index0 == 0 -%}
        {%- set content = bos_token + content -%}
    {%- endif -%}
    {{- content -}}
{%- endfor -%}
{{- '<|start_header_id|>assistant<|end_header_id|>\n\n' -}}
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


describe("resolveChatWrapper", () => {
    test("should resolve to specialized AlpacaChatWrapper", () => {
        const chatWrapper = resolveChatWrapper({
            customWrapperSettings: {
                jinjaTemplate: {
                    template: alpacaJinjaTemplate
                }
            },
            fallbackToOtherWrappersOnJinjaError: false
        });
        expect(chatWrapper).to.be.instanceof(AlpacaChatWrapper);
    });

    test("should resolve to specialized ChatMLChatWrapper", () => {
        const chatWrapper = resolveChatWrapper({
            customWrapperSettings: {
                jinjaTemplate: {
                    template: chatMLJinjaTemplate
                }
            },
            fallbackToOtherWrappersOnJinjaError: false
        });
        expect(chatWrapper).to.be.instanceof(ChatMLChatWrapper);
    });

    test("should resolve to specialized FalconChatWrapper", () => {
        const chatWrapper = resolveChatWrapper({
            customWrapperSettings: {
                jinjaTemplate: {
                    template: falconJinjaTemplate
                }
            },
            fallbackToOtherWrappersOnJinjaError: false
        });
        expect(chatWrapper).to.be.instanceof(FalconChatWrapper);
    });

    test("should resolve to specialized FunctionaryChatWrapper v2", () => {
        const chatWrapper = resolveChatWrapper({
            customWrapperSettings: {
                jinjaTemplate: {
                    template: funcationaryJinjaTemplateV2
                }
            },
            fallbackToOtherWrappersOnJinjaError: false,
            filename: "functionary-small-v2.2.q4_0.gguf"
        });
        expect(chatWrapper).to.be.instanceof(FunctionaryChatWrapper);
    });

    test("should resolve to specialized FunctionaryChatWrapper v2.llama3", () => {
        const chatWrapper = resolveChatWrapper({
            customWrapperSettings: {
                jinjaTemplate: {
                    template: funcationaryJinjaTemplateV2Llama3
                }
            },
            fallbackToOtherWrappersOnJinjaError: false,
            filename: "functionary-small-v2.5.Q4_0.gguf"
        });
        expect(chatWrapper).to.be.instanceof(FunctionaryChatWrapper);
    });

    test("should resolve to specialized FunctionaryChatWrapper v3", () => {
        const chatWrapper = resolveChatWrapper({
            customWrapperSettings: {
                jinjaTemplate: {
                    template: funcationaryJinjaTemplateV3
                }
            },
            fallbackToOtherWrappersOnJinjaError: false,
            filename: "functionary-small-v3.2.Q4_0.gguf"
        });
        expect(chatWrapper).to.be.instanceof(FunctionaryChatWrapper);
    });

    test("should resolve to specialized GemmaChatWrapper", () => {
        const chatWrapper = resolveChatWrapper({
            customWrapperSettings: {
                jinjaTemplate: {
                    template: gemmaJinjaTemplate
                }
            },
            fallbackToOtherWrappersOnJinjaError: false
        });
        expect(chatWrapper).to.be.instanceof(GemmaChatWrapper);
    });

    test("should resolve to specialized GeneralChatWrapper", () => {
        const chatWrapper = resolveChatWrapper({
            customWrapperSettings: {
                jinjaTemplate: {
                    template: generalJinjaTemplate
                }
            },
            fallbackToOtherWrappersOnJinjaError: false
        });
        expect(chatWrapper).to.be.instanceof(GeneralChatWrapper);
    });

    test("should resolve to specialized Llama2ChatWrapper", async () => {
        const chatWrapper = resolveChatWrapper({
            customWrapperSettings: {
                jinjaTemplate: {
                    template: llama2ChatJinjaTemplate
                }
            },
            fallbackToOtherWrappersOnJinjaError: false
        });
        expect(chatWrapper).to.be.instanceof(Llama2ChatWrapper);
    });

    test("should resolve to specialized Llama3_1ChatWrapper", {timeout: 1000 * 60 * 60 * 2}, async () => {
        const chatWrapper = resolveChatWrapper({
            customWrapperSettings: {
                jinjaTemplate: {
                    template: llama3ChatJinjaTemplate
                }
            },
            fallbackToOtherWrappersOnJinjaError: false
        });
        expect(chatWrapper).to.be.instanceof(Llama3_1ChatWrapper);
    });

    test("should resolve to specialized Llama3_1ChatWrapper 2", {timeout: 1000 * 60 * 60 * 2}, async () => {
        const chatWrapper = resolveChatWrapper({
            customWrapperSettings: {
                jinjaTemplate: {
                    template: llama3_1ChatJinjaTemplate
                }
            },
            fallbackToOtherWrappersOnJinjaError: false
        });

        expect(chatWrapper).to.be.instanceof(Llama3_1ChatWrapper);
    });

    test("should resolve to specialized MistralChatWrapper", {timeout: 1000 * 60 * 60 * 2}, async () => {
        const chatWrapper = resolveChatWrapper({
            customWrapperSettings: {
                jinjaTemplate: {
                    template: mistralJinjaTemplate
                }
            },
            fallbackToOtherWrappersOnJinjaError: false
        });
        expect(chatWrapper).to.be.instanceof(MistralChatWrapper);
    });
});
