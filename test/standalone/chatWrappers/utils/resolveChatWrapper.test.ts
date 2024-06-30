import {describe, expect, test} from "vitest";
import {
    AlpacaChatWrapper, ChatMLChatWrapper, FalconChatWrapper, FunctionaryChatWrapper, GemmaChatWrapper, GeneralChatWrapper,
    Llama2ChatWrapper, Llama3ChatWrapper, resolveChatWrapper
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

    test("should resolve to specialized Llama3ChatWrapper", {timeout: 1000 * 60 * 60 * 2}, async () => {
        const chatWrapper = resolveChatWrapper({
            customWrapperSettings: {
                jinjaTemplate: {
                    template: llama3ChatJinjaTemplate
                }
            },
            fallbackToOtherWrappersOnJinjaError: false
        });
        expect(chatWrapper).to.be.instanceof(Llama3ChatWrapper);
    });
});
