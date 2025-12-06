import {describe, expect, test} from "vitest";
import {
    AlpacaChatWrapper, ChatMLChatWrapper, DeepSeekChatWrapper, FalconChatWrapper, FunctionaryChatWrapper, GemmaChatWrapper,
    GeneralChatWrapper, Llama2ChatWrapper, Llama3_1ChatWrapper, MistralChatWrapper, QwenChatWrapper, resolveChatWrapper, HarmonyChatWrapper
} from "../../../../src/index.js";
import {harmonyJinjaTemplate, harmonyJinjaTemplate2, harmonyJinjaTemplate3, harmonyJinjaTemplate4} from "./jinjaTemplates.js";


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
const funcationaryJinjaTemplateV2Llama3 = "{% for message in messages %}\n{% if message['role'] == 'user' or message['role'] == 'system' %}\n{{ '<|start_header_id|>' + message['role'] + '<|end_header_id|>\n\n' + message['content'] + '<|eot_id|>' }}{% elif message['role'] == 'tool' %}\n{{ '<|start_header_id|>' + message['role'] + '<|end_header_id|>\n\n' + 'name=' + message['name'] + '\n' + message['content'] + '<|eot_id|>' }}{% else %}\n{{ '<|start_header_id|>' + message['role'] + '<|end_header_id|>\n\n'}}{% if message['content'] is not none %}\n{{ message['content'] }}{% endif %}\n{% if 'tool_calls' in message and message['tool_calls'] is not none %}\n{% for tool_call in message['tool_calls'] %}\n{{ '<|reserved_special_token_249|>' + tool_call['function']['name'] + '\n' + tool_call['function']['arguments'] }}{% endfor %}\n{% endif %}\n{{ '<|eot_id|>' }}{% endif %}\n{% endfor %}\n{% if add_generation_prompt %}{{ '<|start_header_id|>{role}<|end_header_id|>\n\n' }}{% endif %}";
const funcationaryJinjaTemplateV3 = "{% for message in messages %}\n{% if message['role'] == 'user' or message['role'] == 'system' %}\n{{ '<|start_header_id|>' + message['role'] + '<|end_header_id|>\n\n' + message['content'] + '<|eot_id|>' }}{% elif message['role'] == 'tool' %}\n{{ '<|start_header_id|>' + message['role'] + '<|end_header_id|>\n\n' + message['content'] + '<|eot_id|>' }}{% else %}\n{{ '<|start_header_id|>' + message['role'] + '<|end_header_id|>\n\n'}}{% if message['content'] is not none %}\n{{ '>>>all\n' + message['content'] }}{% endif %}\n{% if 'tool_calls' in message and message['tool_calls'] is not none %}\n{% for tool_call in message['tool_calls'] %}\n{{ '>>>' + tool_call['function']['name'] + '\n' + tool_call['function']['arguments'] }}{% endfor %}\n{% endif %}\n{{ '<|eot_id|>' }}{% endif %}\n{% endfor %}\n{% if add_generation_prompt %}{{ '<|start_header_id|>{role}<|end_header_id|>\n\n' }}{% endif %}";

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
    {%- set content = '<|start_header_id|>' + message['role'] + '<|end_header_id|>\n\n'+ message['content'] | trim + '<|eot_id|>' -%}
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
{{- '<|eot_id|>' }}

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
    {{- first_user_message + '<|eot_id|>'}}
{%- endif %}

{%- for message in messages %}
    {%- if not (message.role == 'ipython' or message.role == 'tool' or 'tool_calls' in message) %}
        {{- '<|start_header_id|>' + message['role'] + '<|end_header_id|>\\n\\n'+ message['content'] | trim + '<|eot_id|>' }}
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
            {{- '<|eot_id|>' }}
        {%- endif %}
    {%- elif message.role == "tool" or message.role == "ipython" %}
        {{- "<|start_header_id|>ipython<|end_header_id|>\\n\\n" }}
        {%- if message.content is mapping or message.content is iterable %}
            {{- message.content | tojson }}
        {%- else %}
            {{- message.content }}
        {%- endif %}
        {{- '<|eot_id|>' }}
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

const deepSeekJinjaTemplate = `
{%- if not add_generation_prompt is defined -%}
    {%- set add_generation_prompt = false -%}
{%- endif -%}
{%- set ns = namespace(is_first=false, is_tool=false, is_output_first=true, system_prompt='') -%}
{%- for message in messages -%}
    {%- if message['role'] == 'system' -%}
        {%- set ns.system_prompt = message['content'] -%}
    {%- endif -%}
{%- endfor -%}
{{- bos_token -}}
{{- ns.system_prompt -}}
{%- for message in messages -%}
    {%- if message['role'] == 'user' -%}
        {%- set ns.is_tool = false -%}
        {{- '<｜User｜>' + message['content'] -}}
    {%- endif -%}
    {%- if message['role'] == 'assistant' and message['content'] is none -%}
        {%- set ns.is_tool = false -%}
        {%- for tool in message['tool_calls'] -%}
            {%- if not ns.is_first -%}
                {{- '<｜Assistant｜><｜tool▁calls▁begin｜><｜tool▁call▁begin｜>' + tool['type'] + '<｜tool▁sep｜>' + tool['function']['name'] + '\\n' + '\`\`\`json' + '\\n' + tool['function']['arguments'] + '\\n' + '\`\`\`' + '<｜tool▁call▁end｜>' -}}
                {%- set ns.is_first = true -%}
            {%- else -%}
                {{- '\\n' + '<｜tool▁call▁begin｜>' + tool['type'] + '<｜tool▁sep｜>' + tool['function']['name'] + '\\n' + '\`\`\`json' + '\\n' + tool['function']['arguments'] + '\\n' + '\`\`\`' + '<｜tool▁call▁end｜>' -}}
                {{- '<｜tool▁calls▁end｜><｜end▁of▁sentence｜>' -}}
            {%- endif -%}
        {%- endfor -%}
    {%- endif -%}
    {%- if message['role'] == 'assistant' and message['content'] is not none -%}
        {%- if ns.is_tool -%}
            {{- '<｜tool▁outputs▁end｜>' + message['content'] + '<｜end▁of▁sentence｜>' -}}
            {%- set ns.is_tool = false -%}
        {%- else -%}
            {%- set content = message['content'] -%}
            {%- if '</think>' in content -%}
                {%- set content = content.split('</think>')[-1] -%}
            {%- endif -%}
            {{- '<｜Assistant｜>' + content + '<｜end▁of▁sentence｜>' -}}
        {%- endif -%}
    {%- endif -%}
    {%- if message['role'] == 'tool' -%}
        {%- set ns.is_tool = true -%}
        {%- if ns.is_output_first -%}
            {{- '<｜tool▁outputs▁begin｜><｜tool▁output▁begin｜>' + message['content'] + '<｜tool▁output▁end｜>' -}}
            {%- set ns.is_output_first = false -%}
        {%- else -%}
            {{- '\\n<｜tool▁output▁begin｜>' + message['content'] + '<｜tool▁output▁end｜>' -}}
        {%- endif -%}
    {%- endif -%}
{%- endfor -%}
{%- if ns.is_tool -%}
    {{- '<｜tool▁outputs▁end｜>' -}}
{%- endif -%}
{%- if add_generation_prompt and not ns.is_tool -%}
    {{- '<｜Assistant｜>' -}}
{%- endif -%}
`.slice(1, -1);

const qwqJinjaTemplate = `
{%- if tools %}
    {{- '<|im_start|>system\\n' }}
    {%- if messages[0]['role'] == 'system' %}
        {{- messages[0]['content'] }}
    {%- else %}
        {{- '' }}
    {%- endif %}
    {{- "\\n\\n# Tools\\n\\nYou may call one or more functions to assist with the user query.\\n\\nYou are provided with function signatures within <tools></tools> XML tags:\\n<tools>" }}
    {%- for tool in tools %}
        {{- "\\n" }}
        {{- tool | tojson }}
    {%- endfor %}
    {{- "\\n</tools>\\n\\nFor each function call, return a json object with function name and arguments within <tool_call></tool_call> XML tags:\\n<tool_call>\\n{\\"name\\": <function-name>, \\"arguments\\": <args-json-object>}\\n</tool_call><|im_end|>\\n" }}
{%- else %}
    {%- if messages[0]['role'] == 'system' %}
        {{- '<|im_start|>system\\n' + messages[0]['content'] + '<|im_end|>\\n' }}
  {%- endif %}
{%- endif %}
{%- for message in messages %}
    {%- if (message.role == "user") or (message.role == "system" and not loop.first) %}
        {{- '<|im_start|>' + message.role + '\\n' + message.content + '<|im_end|>' + '\\n' }}
    {%- elif message.role == "assistant" and not message.tool_calls %}
        {%- set content = message.content.split('</think>')[-1].lstrip('\\n') %}
        {{- '<|im_start|>' + message.role + '\\n' + content + '<|im_end|>' + '\\n' }}
    {%- elif message.role == "assistant" %}
        {%- set content = message.content.split('</think>')[-1].lstrip('\\n') %}
        {{- '<|im_start|>' + message.role }}
        {%- if message.content %}
            {{- '\\n' + content }}
        {%- endif %}
        {%- for tool_call in message.tool_calls %}
            {%- if tool_call.function is defined %}
                {%- set tool_call = tool_call.function %}
            {%- endif %}
            {{- '\\n<tool_call>\\n{"name": "' }}
            {{- tool_call.name }}
            {{- '", "arguments": ' }}
            {{- tool_call.arguments | tojson }}
            {{- '}\\n</tool_call>' }}
        {%- endfor %}
        {{- '<|im_end|>\\n' }}
    {%- elif message.role == "tool" %}
        {%- if (loop.index0 == 0) or (messages[loop.index0 - 1].role != "tool") %}
            {{- '<|im_start|>user' }}
        {%- endif %}
        {{- '\\n<tool_response>\\n' }}
        {{- message.content }}
        {{- '\\n</tool_response>' }}
        {%- if loop.last or (messages[loop.index0 + 1].role != "tool") %}
            {{- '<|im_end|>\\n' }}
        {%- endif %}
    {%- endif %}
{%- endfor %}
{%- if add_generation_prompt %}
    {{- '<|im_start|>assistant\\n' }}
{%- endif %}
`.slice(1, -1);

const qwen3Template = `
{%- if tools %}
    {{- '<|im_start|>system\\n' }}
    {%- if messages[0].role == 'system' %}
        {{- messages[0].content + '\\n\\n' }}
    {%- endif %}
    {{- "# Tools\\n\\nYou may call one or more functions to assist with the user query.\\n\\nYou are provided with function signatures within <tools></tools> XML tags:\\n<tools>" }}
    {%- for tool in tools %}
        {{- "\\n" }}
        {{- tool | tojson }}
    {%- endfor %}
    {{- "\\n</tools>\\n\\nFor each function call, return a json object with function name and arguments within <tool_call></tool_call> XML tags:\\n<tool_call>\\n{\\"name\\": <function-name>, \\"arguments\\": <args-json-object>}\\n</tool_call><|im_end|>\\n" }}
{%- else %}
    {%- if messages[0].role == 'system' %}
        {{- '<|im_start|>system\\n' + messages[0].content + '<|im_end|>\\n' }}
    {%- endif %}
{%- endif %}
{%- set ns = namespace(multi_step_tool=true, last_query_index=messages|length - 1) %}
{%- for index in range(ns.last_query_index, -1, -1) %}
    {%- set message = messages[index] %}
    {%- if ns.multi_step_tool and message.role == "user" and not('<tool_response>' in message.content and '</tool_response>' in message.content) %}
        {%- set ns.multi_step_tool = false %}
        {%- set ns.last_query_index = index %}
    {%- endif %}
{%- endfor %}
{%- for message in messages %}
    {%- if (message.role == "user") or (message.role == "system" and not loop.first) %}
        {{- '<|im_start|>' + message.role + '\\n' + message.content + '<|im_end|>' + '\\n' }}
    {%- elif message.role == "assistant" %}
        {%- set content = message.content %}
        {%- set reasoning_content = '' %}
        {%- if message.reasoning_content is defined and message.reasoning_content is not none %}
            {%- set reasoning_content = message.reasoning_content %}
        {%- else %}
            {%- if '</think>' in message.content %}
                {%- set content = message.content.split('</think>')[-1].lstrip('\\n') %}
                {%- set reasoning_content = message.content.split('</think>')[0].rstrip('\\n').split('<think>')[-1].lstrip('\\n') %}
            {%- endif %}
        {%- endif %}
        {%- if loop.index0 > ns.last_query_index %}
            {%- if loop.last or (not loop.last and reasoning_content) %}
                {{- '<|im_start|>' + message.role + '\\n<think>\\n' + reasoning_content.strip('\\n') + '\\n</think>\\n\\n' + content.lstrip('\\n') }}
            {%- else %}
                {{- '<|im_start|>' + message.role + '\\n' + content }}
            {%- endif %}
        {%- else %}
            {{- '<|im_start|>' + message.role + '\\n' + content }}
        {%- endif %}
        {%- if message.tool_calls %}
            {%- for tool_call in message.tool_calls %}
                {%- if (loop.first and content) or (not loop.first) %}
                    {{- '\\n' }}
                {%- endif %}
                {%- if tool_call.function %}
                    {%- set tool_call = tool_call.function %}
                {%- endif %}
                {{- '<tool_call>\\n{"name": "' }}
                {{- tool_call.name }}
                {{- '", "arguments": ' }}
                {%- if tool_call.arguments is string %}
                    {{- tool_call.arguments }}
                {%- else %}
                    {{- tool_call.arguments | tojson }}
                {%- endif %}
                {{- '}\\n</tool_call>' }}
            {%- endfor %}
        {%- endif %}
        {{- '<|im_end|>\\n' }}
    {%- elif message.role == "tool" %}
        {%- if loop.first or (messages[loop.index0 - 1].role != "tool") %}
            {{- '<|im_start|>user' }}
        {%- endif %}
        {{- '\\n<tool_response>\\n' }}
        {{- message.content }}
        {{- '\\n</tool_response>' }}
        {%- if loop.last or (messages[loop.index0 + 1].role != "tool") %}
            {{- '<|im_end|>\\n' }}
        {%- endif %}
    {%- endif %}
{%- endfor %}
{%- if add_generation_prompt %}
    {{- '<|im_start|>assistant\\n' }}
    {%- if enable_thinking is defined and enable_thinking is false %}
        {{- '<think>\\n\\n</think>\\n\\n' }}
    {%- endif %}
{%- endif %}
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

    test("should resolve to specialized DeepSeekChatWrapper", {timeout: 1000 * 60 * 60 * 2}, async () => {
        const chatWrapper = resolveChatWrapper({
            customWrapperSettings: {
                jinjaTemplate: {
                    template: deepSeekJinjaTemplate
                }
            },
            fallbackToOtherWrappersOnJinjaError: false
        });
        expect(chatWrapper).to.be.instanceof(DeepSeekChatWrapper);
    });

    test("should resolve to specialized QwenChatWrapper", {timeout: 1000 * 60 * 60 * 2}, async () => {
        const chatWrapper = resolveChatWrapper({
            customWrapperSettings: {
                jinjaTemplate: {
                    template: qwqJinjaTemplate
                }
            },
            fallbackToOtherWrappersOnJinjaError: false
        });
        expect(chatWrapper).to.be.instanceof(QwenChatWrapper);
    });

    test("should resolve to specialized QwenChatWrapper 2", {timeout: 1000 * 60 * 60 * 2}, async () => {
        const chatWrapper = resolveChatWrapper({
            customWrapperSettings: {
                jinjaTemplate: {
                    template: qwen3Template
                }
            },
            fallbackToOtherWrappersOnJinjaError: false
        });
        expect(chatWrapper).to.be.instanceof(QwenChatWrapper);
    });

    test("should resolve to specialized HarmonyChatWrapper", {timeout: 1000 * 60 * 60 * 2}, async () => {
        const chatWrapper = resolveChatWrapper({
            customWrapperSettings: {
                jinjaTemplate: {
                    template: harmonyJinjaTemplate
                }
            },
            fallbackToOtherWrappersOnJinjaError: false
        });
        expect(chatWrapper).to.be.instanceof(HarmonyChatWrapper);
    });

    test("should resolve to specialized HarmonyChatWrapper 2", {timeout: 1000 * 60 * 60 * 2}, async () => {
        const chatWrapper = resolveChatWrapper({
            customWrapperSettings: {
                jinjaTemplate: {
                    template: harmonyJinjaTemplate2
                }
            },
            fallbackToOtherWrappersOnJinjaError: false
        });
        expect(chatWrapper).to.be.instanceof(HarmonyChatWrapper);
    });

    test("should resolve to specialized HarmonyChatWrapper 3", {timeout: 1000 * 60 * 60 * 2}, async () => {
        const chatWrapper = resolveChatWrapper({
            customWrapperSettings: {
                jinjaTemplate: {
                    template: harmonyJinjaTemplate3
                }
            },
            fallbackToOtherWrappersOnJinjaError: false
        });
        expect(chatWrapper).to.be.instanceof(HarmonyChatWrapper);
    });

    test("should resolve to specialized HarmonyChatWrapper 4", {timeout: 1000 * 60 * 60 * 2}, async () => {
        const chatWrapper = resolveChatWrapper({
            customWrapperSettings: {
                jinjaTemplate: {
                    template: harmonyJinjaTemplate4
                }
            },
            fallbackToOtherWrappersOnJinjaError: false
        });
        expect(chatWrapper).to.be.instanceof(HarmonyChatWrapper);
    });
});
