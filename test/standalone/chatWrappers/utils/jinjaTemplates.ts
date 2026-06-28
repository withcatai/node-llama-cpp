// source: https://huggingface.co/openai/gpt-oss-20b/blob/main/chat_template.jinja
export const harmonyJinjaTemplate = `
{# 
  In addition to the normal inputs of \`messages\` and \`tools\`, this template also accepts the
  following kwargs:
  - "builtin_tools": A list, can contain "browser" and/or "python".
  - "model_identity": A string that optionally describes the model identity.
  - "reasoning_effort": A string that describes the reasoning effort, defaults to "medium".
  #}
{#  Tool Definition Rendering ==============================================  #}
{%- macro render_typescript_type(param_spec, required_params, is_nullable=false) -%}
    {%- if param_spec.type == "array" -%}
        {%- if param_spec["items"] -%}
            {%- if param_spec["items"]["type"] == "string" -%}
                {{- "string[]" -}}
            {%- elif param_spec["items"]["type"] == "number" -%}
                {{- "number[]" -}}
            {%- elif param_spec["items"]["type"] == "integer" -%}
                {{- "number[]" -}}
            {%- elif param_spec["items"]["type"] == "boolean" -%}
                {{- "boolean[]" -}}
            {%- else -%}
                {%- set inner_type = render_typescript_type(param_spec["items"], required_params) -%}
                {%- if inner_type == "object | object" or inner_type | length > 50 -%}
                    {{- "any[]" -}}
                {%- else -%}
                    {{- inner_type + "[]" -}}
                {%- endif -%}
            {%- endif -%}
            {%- if param_spec.nullable -%}
                {{- " | null" -}}
            {%- endif -%}
        {%- else -%}
            {{- "any[]" -}}
            {%- if param_spec.nullable -%}
                {{- " | null" -}}
            {%- endif -%}
        {%- endif -%}
    {%- elif param_spec.type is defined and param_spec.type is iterable and param_spec.type is not string and param_spec.type is not mapping and param_spec.type[0] is defined -%}
        {#  Handle array of types like ["object", "object"] from Union[dict, list]  #}
        {%- if param_spec.type | length > 1 -%}
            {{- param_spec.type | join(" | ") -}}
        {%- else -%}
            {{- param_spec.type[0] -}}
        {%- endif -%}
    {%- elif param_spec.oneOf -%}
        {#  Handle oneOf schemas - check for complex unions and fallback to any  #}
        {%- set has_object_variants = false -%}
        {%- for variant in param_spec.oneOf -%}
            {%- if variant.type == "object" -%}
                {%- set has_object_variants = true -%}
            {%- endif -%}
        {%- endfor -%}
        {%- if has_object_variants and param_spec.oneOf | length > 1 -%}
            {{- "any" -}}
        {%- else -%}
            {%- for variant in param_spec.oneOf -%}
                {{- render_typescript_type(variant, required_params) -}}
                {%- if variant.description -%}
                    {{- "// " + variant.description -}}
                {%- endif -%}
                {%- if variant.default is defined -%}
                    {{- "                    " -}}
                    {{- "// default: " + variant.default | tojson -}}
                {%- endif -%}
                {%- if not loop.last -%}
                    {{- " | " -}}
                    {{- "\\n" -}}
                {%- endif -%}
            {%- endfor -%}
        {%- endif -%}
    {%- elif param_spec.type == "string" -%}
        {%- if param_spec.enum -%}
            {{- "\\"" + param_spec.enum | join("\\" | \\"") + "\\"" -}}
        {%- else -%}
            {{- "string" -}}
            {%- if param_spec.nullable -%}
                {{- " | null" -}}
            {%- endif -%}
        {%- endif -%}
    {%- elif param_spec.type == "number" -%}
        {{- "number" -}}
    {%- elif param_spec.type == "integer" -%}
        {{- "number" -}}
    {%- elif param_spec.type == "boolean" -%}
        {{- "boolean" -}}
    {%- elif param_spec.type == "object" -%}
        {%- if param_spec.properties -%}
            {{- "{\\n" -}}
            {%- for (prop_name, prop_spec) in param_spec.properties.items() -%}
                {{- prop_name -}}
                {%- if prop_name not in (param_spec.required or []) -%}
                    {{- "?" -}}
                {%- endif -%}
                {{- ": " -}}
                {{- "\\n                " -}}
                {{- render_typescript_type(prop_spec, (param_spec.required or [])) -}}
                {%- if not loop.last -%}
                    {{- ", " -}}
                {%- endif -%}
            {%- endfor -%}
            {{- "}" -}}
        {%- else -%}
            {{- "object" -}}
        {%- endif -%}
    {%- else -%}
        {{- "any" -}}
    {%- endif -%}
{%- endmacro -%}
{%- macro render_tool_namespace(namespace_name, tools) -%}
    {{- "## " + namespace_name + "\\n\\n" -}}
    {{- "namespace " + namespace_name + " {\\n\\n" -}}
    {%- for tool in tools -%}
        {%- set tool = tool.function -%}
        {{- "// " + tool.description + "\\n" -}}
        {{- "type " + tool.name + " = " -}}
        {%- if tool.parameters and tool.parameters.properties -%}
            {{- "(_: {\\n" -}}
            {%- for (param_name, param_spec) in tool.parameters.properties.items() -%}
                {%- if param_spec.description -%}
                    {{- "// " + param_spec.description + "\\n" -}}
                {%- endif -%}
                {{- param_name -}}
                {%- if param_name not in (tool.parameters.required or []) -%}
                    {{- "?" -}}
                {%- endif -%}
                {{- ": " -}}
                {{- render_typescript_type(param_spec, (tool.parameters.required or [])) -}}
                {%- if param_spec.default is defined -%}
                    {%- if param_spec.enum -%}
                        {{- ", // default: " + param_spec.default -}}
                    {%- elif param_spec.oneOf -%}
                        {{- "// default: " + param_spec.default -}}
                    {%- else -%}
                        {{- ", // default: " + param_spec.default | tojson -}}
                    {%- endif -%}
                {%- endif -%}
                {%- if not loop.last -%}
                    {{- ",\\n" -}}
                {%- else -%}
                    {{- ",\\n" -}}
                {%- endif -%}
            {%- endfor -%}
            {{- "}) => any;\\n\\n" -}}
        {%- else -%}
            {{- "() => any;\\n\\n" -}}
        {%- endif -%}
    {%- endfor -%}
    {{- "} // namespace " + namespace_name -}}
{%- endmacro -%}
{%- macro render_builtin_tools(browser_tool, python_tool) -%}
    {%- if browser_tool -%}
        {{- "## browser\\n\\n" -}}
        {{- "// Tool for browsing.\\n" -}}
        {{- "// The \`cursor\` appears in brackets before each browsing display: \`[{cursor}]\`.\\n" -}}
        {{- "// Cite information from the tool using the following format:\\n" -}}
        {{- "// \`【{cursor}†L{line_start}(-L{line_end})?】\`, for example: \`【6†L9-L11】\` or \`【8†L3】\`.\\n" -}}
        {{- "// Do not quote more than 10 words directly from the tool output.\\n" -}}
        {{- "// sources=web (default: web)\\n" -}}
        {{- "namespace browser {\\n\\n" -}}
        {{- "// Searches for information related to \`query\` and displays \`topn\` results.\\n" -}}
        {{- "type search = (_: {\\n" -}}
        {{- "query: string,\\n" -}}
        {{- "topn?: number, // default: 10\\n" -}}
        {{- "source?: string,\\n" -}}
        {{- "}) => any;\\n\\n" -}}
        {{- "// Opens the link \`id\` from the page indicated by \`cursor\` starting at line number \`loc\`, showing \`num_lines\` lines.\\n" -}}
        {{- "// Valid link ids are displayed with the formatting: \`【{id}†.*】\`.\\n" -}}
        {{- "// If \`cursor\` is not provided, the most recent page is implied.\\n" -}}
        {{- "// If \`id\` is a string, it is treated as a fully qualified URL associated with \`source\`.\\n" -}}
        {{- "// If \`loc\` is not provided, the viewport will be positioned at the beginning of the document or centered on the most relevant passage, if available.\\n" -}}
        {{- "// Use this function without \`id\` to scroll to a new location of an opened page.\\n" -}}
        {{- "type open = (_: {\\n" -}}
        {{- "id?: number | string, // default: -1\\n" -}}
        {{- "cursor?: number, // default: -1\\n" -}}
        {{- "loc?: number, // default: -1\\n" -}}
        {{- "num_lines?: number, // default: -1\\n" -}}
        {{- "view_source?: boolean, // default: false\\n" -}}
        {{- "source?: string,\\n" -}}
        {{- "}) => any;\\n\\n" -}}
        {{- "// Finds exact matches of \`pattern\` in the current page, or the page given by \`cursor\`.\\n" -}}
        {{- "type find = (_: {\\n" -}}
        {{- "pattern: string,\\n" -}}
        {{- "cursor?: number, // default: -1\\n" -}}
        {{- "}) => any;\\n\\n" -}}
        {{- "} // namespace browser\\n\\n" -}}
    {%- endif -%}
    {%- if python_tool -%}
        {{- "## python\\n\\n" -}}
        {{- "Use this tool to execute Python code in your chain of thought. The code will not be shown to the user. This tool should be used for internal reasoning, but not for code that is intended to be visible to the user (e.g. when creating plots, tables, or files).\\n\\n" -}}
        {{- "When you send a message containing Python code to python, it will be executed in a stateful Jupyter notebook environment. python will respond with the output of the execution or time out after 120.0 seconds. The drive at '/mnt/data' can be used to save and persist user files. Internet access for this session is UNKNOWN. Depends on the cluster.\\n\\n" -}}
    {%- endif -%}
{%- endmacro -%}
{#  System Message Construction ============================================  #}
{%- macro build_system_message() -%}
    {%- if model_identity is not defined -%}
        {%- set model_identity = "You are ChatGPT, a large language model trained by OpenAI." -%}
    {%- endif -%}
    {{- model_identity + "\\n" -}}
    {{- "Knowledge cutoff: 2024-06\\n" -}}
    {{- "Current date: " + strftime_now("%Y-%m-%d") + "\\n\\n" -}}
    {%- if reasoning_effort is not defined -%}
        {%- set reasoning_effort = "medium" -%}
    {%- endif -%}
    {{- "Reasoning: " + reasoning_effort + "\\n\\n" -}}
    {%- if builtin_tools -%}
        {{- "# Tools\\n\\n" -}}
        {%- set available_builtin_tools = namespace(browser=false, python=false) -%}
        {%- for tool in builtin_tools -%}
            {%- if tool == "browser" -%}
                {%- set available_builtin_tools.browser = true -%}
            {%- elif tool == "python" -%}
                {%- set available_builtin_tools.python = true -%}
            {%- endif -%}
        {%- endfor -%}
        {{- render_builtin_tools(available_builtin_tools.browser, available_builtin_tools.python) -}}
    {%- endif -%}
    {{- "# Valid channels: analysis, commentary, final. Channel must be included for every message." -}}
    {%- if tools -%}
        {{- "\\nCalls to these tools must go to the commentary channel: 'functions'." -}}
    {%- endif -%}
{%- endmacro -%}
{#  Main Template Logic =================================================  #}
{#  Set defaults  #}
{#  Render system message  #}
{{- "<|start|>system<|message|>" -}}
{{- build_system_message() -}}
{{- "<|end|>" -}}
{#  Extract developer message  #}
{%- if messages[0].role == "developer" or messages[0].role == "system" -%}
    {%- set developer_message = messages[0].content -%}
    {%- set loop_messages = messages[1:] -%}
{%- else -%}
    {%- set developer_message = "" -%}
    {%- set loop_messages = messages -%}
{%- endif -%}
{#  Render developer message  #}
{%- if developer_message or tools -%}
    {{- "<|start|>developer<|message|>" -}}
    {%- if developer_message -%}
        {{- "# Instructions\\n\\n" -}}
        {{- developer_message -}}
    {%- endif -%}
    {%- if tools -%}
        {{- "\\n\\n" -}}
        {{- "# Tools\\n\\n" -}}
        {{- render_tool_namespace("functions", tools) -}}
    {%- endif -%}
    {{- "<|end|>" -}}
{%- endif -%}
{#  Render messages  #}
{%- set last_tool_call = namespace(name=none) -%}
{%- for message in loop_messages -%}
    {#  At this point only assistant/user/tool messages should remain  #}
    {%- if message.role == "assistant" -%}
        {#  Checks to ensure the messages are being passed in the format we expect  #}
        {%- if "content" in message -%}
            {%- if "<|channel|>analysis<|message|>" in message.content or "<|channel|>final<|message|>" in message.content -%}
                {{- raise_exception("You have passed a message containing <|channel|> tags in the content field. Instead of doing this, you should pass analysis messages (the string between '<|message|>' and '<|end|>') in the 'thinking' field, and final messages (the string between '<|message|>' and '<|end|>') in the 'content' field.") -}}
            {%- endif -%}
        {%- endif -%}
        {%- if "thinking" in message -%}
            {%- if "<|channel|>analysis<|message|>" in message.thinking or "<|channel|>final<|message|>" in message.thinking -%}
                {{- raise_exception("You have passed a message containing <|channel|> tags in the thinking field. Instead of doing this, you should pass analysis messages (the string between '<|message|>' and '<|end|>') in the 'thinking' field, and final messages (the string between '<|message|>' and '<|end|>') in the 'content' field.") -}}
            {%- endif -%}
        {%- endif -%}
        {%- if "tool_calls" in message -%}
            {#  We need very careful handling here - we want to drop the tool call analysis message if the model  #}
            {#  has output a later <|final|> message, but otherwise we want to retain it. This is the only case  #}
            {#  when we render CoT/analysis messages in inference.  #}
            {%- set future_final_message = namespace(found=false) -%}
            {%- for future_message in loop_messages[loop.index:] -%}
                {%- if future_message.role == "assistant" and "tool_calls" not in future_message -%}
                    {%- set future_final_message.found = true -%}
                {%- endif -%}
            {%- endfor -%}
            {#  We assume max 1 tool call per message, and so we infer the tool call name  #}
            {#  in "tool" messages from the most recent assistant tool call name  #}
            {%- set tool_call = message.tool_calls[0] -%}
            {%- if tool_call.function -%}
                {%- set tool_call = tool_call.function -%}
            {%- endif -%}
            {%- if message.content and message.thinking -%}
                {{- raise_exception("Cannot pass both content and thinking in an assistant message with tool calls! Put the analysis message in one or the other, but not both.") -}}
            {%- elif message.content and not future_final_message.found -%}
                {{- "<|start|>assistant<|channel|>analysis<|message|>" + message.content + "<|end|>" -}}
            {%- elif message.thinking and not future_final_message.found -%}
                {{- "<|start|>assistant<|channel|>analysis<|message|>" + message.thinking + "<|end|>" -}}
            {%- endif -%}
            {{- "<|start|>assistant to=" -}}
            {{- "functions." + tool_call.name + "<|channel|>commentary " -}}
            {{- (tool_call.content_type if tool_call.content_type is defined else "json") + "<|message|>" -}}
            {{- tool_call.arguments | tojson -}}
            {{- "<|call|>" -}}
            {%- set last_tool_call.name = tool_call.name -%}
        {%- elif loop.last and not add_generation_prompt -%}
            {#  Only render the CoT if the final turn is an assistant turn and add_generation_prompt is false  #}
            {#  This is a situation that should only occur in training, never in inference.  #}
            {%- if "thinking" in message -%}
                {{- "<|start|>assistant<|channel|>analysis<|message|>" + message.thinking + "<|end|>" -}}
            {%- endif -%}
            {#  <|return|> indicates the end of generation, but <|end|> does not  #}
            {#  <|return|> should never be an input to the model, but we include it as the final token  #}
            {#  when training, so the model learns to emit it.  #}
            {{- "<|start|>assistant<|channel|>final<|message|>" + message.content + "<|return|>" -}}
        {%- else -%}
            {#  CoT is dropped during all previous turns, so we never render it for inference  #}
            {{- "<|start|>assistant<|channel|>final<|message|>" + message.content + "<|end|>" -}}
            {%- set last_tool_call.name = none -%}
        {%- endif -%}
    {%- elif message.role == "tool" -%}
        {%- if last_tool_call.name is none -%}
            {{- raise_exception("Message has tool role, but there was no previous assistant message with a tool call!") -}}
        {%- endif -%}
        {{- "<|start|>functions." + last_tool_call.name -}}
        {{- " to=assistant<|channel|>commentary<|message|>" + message.content | tojson + "<|end|>" -}}
    {%- elif message.role == "user" -%}
        {{- "<|start|>user<|message|>" + message.content + "<|end|>" -}}
    {%- endif -%}
{%- endfor -%}
{#  Generation prompt  #}
{%- if add_generation_prompt -%}
    {{- "<|start|>assistant" -}}
{%- endif -%}
`.slice(1, -1);

export const harmonyJinjaTemplate2 = `
{# Copyright 2025-present Unsloth. Apache 2.0 License. Unsloth chat template fixes. Edited from ggml-org & OpenAI #}
{#-
  In addition to the normal inputs of \`messages\` and \`tools\`, this template also accepts the
  following kwargs:
  - "builtin_tools": A list, can contain "browser" and/or "python".
  - "model_identity": A string that optionally describes the model identity.
  - "reasoning_effort": A string that describes the reasoning effort, defaults to "medium".
 #}

{#- Tool Definition Rendering ============================================== #}
{%- macro render_typescript_type(param_spec, required_params, is_nullable=false) -%}
    {%- if param_spec.type == "array" -%}
        {%- if param_spec['items'] -%}
            {%- if param_spec['items']['type'] == "string" -%}
                {{- "string[]" }}
            {%- elif param_spec['items']['type'] == "number" -%}
                {{- "number[]" }}
            {%- elif param_spec['items']['type'] == "integer" -%}
                {{- "number[]" }}
            {%- elif param_spec['items']['type'] == "boolean" -%}
                {{- "boolean[]" }}
            {%- else -%}
                {%- set inner_type = render_typescript_type(param_spec['items'], required_params) -%}
                {%- if inner_type == "object | object" or inner_type|length > 50 -%}
                    {{- "any[]" }}
                {%- else -%}
                    {{- inner_type + "[]" }}
                {%- endif -%}
            {%- endif -%}
            {%- if param_spec.nullable -%}
                {{- " | null" }}
            {%- endif -%}
        {%- else -%}
            {{- "any[]" }}
            {%- if param_spec.nullable -%}
                {{- " | null" }}
            {%- endif -%}
        {%- endif -%}
    {%- elif param_spec.type is defined and param_spec.type is iterable and param_spec.type is not string and param_spec.type is not mapping and param_spec.type[0] is defined -%}
        {#- Handle array of types like ["object", "object"] from Union[dict, list] #}
        {%- if param_spec.type | length > 1 -%}
            {{- param_spec.type | join(" | ") }}
        {%- else -%}
            {{- param_spec.type[0] }}
        {%- endif -%}
    {%- elif param_spec.oneOf -%}
        {#- Handle oneOf schemas - check for complex unions and fallback to any #}
        {%- set has_object_variants = false -%}
        {%- for variant in param_spec.oneOf -%}
            {%- if variant.type == "object" -%}
                {%- set has_object_variants = true -%}
            {%- endif -%}
        {%- endfor -%}
        {%- if has_object_variants and param_spec.oneOf|length > 1 -%}
            {{- "any" }}
        {%- else -%}
            {%- for variant in param_spec.oneOf -%}
                {{- render_typescript_type(variant, required_params) -}}
                {%- if variant.description %}
                    {{- "// " + variant.description }}
                {%- endif -%}
                {%- if variant.default is defined %}
                    {{ "// default: " + variant.default|tojson }}
                {%- endif -%}
                {%- if not loop.last %}
                    {{- " | " }}
                {% endif -%}
            {%- endfor -%}
        {%- endif -%}
    {%- elif param_spec.type == "string" -%}
        {%- if param_spec.enum -%}
            {{- '"' + param_spec.enum|join('" | "') + '"' -}}
        {%- else -%}
            {{- "string" }}
            {%- if param_spec.nullable %}
                {{- " | null" }}
            {%- endif -%}
        {%- endif -%}
    {%- elif param_spec.type == "number" -%}
        {{- "number" }}
    {%- elif param_spec.type == "integer" -%}
        {{- "number" }}
    {%- elif param_spec.type == "boolean" -%}
        {{- "boolean" }}

    {%- elif param_spec.type == "object" -%}
        {%- if param_spec.properties -%}
            {{- "{\\n" }}
            {%- for prop_name, prop_spec in param_spec.properties.items() -%}
                {{- prop_name -}}
                {%- if prop_name not in (param_spec.required or []) -%}
                    {{- "?" }}
                {%- endif -%}
                {{- ": " }}
                {{ render_typescript_type(prop_spec, param_spec.required or []) }}
                {%- if not loop.last -%}
                    {{-", " }}
                {%- endif -%}
            {%- endfor -%}
            {{- "}" }}
        {%- else -%}
            {{- "object" }}
        {%- endif -%}
    {%- else -%}
        {{- "any" }}
    {%- endif -%}
{%- endmacro -%}

{%- macro render_tool_namespace(namespace_name, tools) -%}
    {{- "## " + namespace_name + "\\n\\n" }}
    {{- "namespace " + namespace_name + " {\\n\\n" }}
    {%- for tool in tools %}
        {%- set tool = tool.function %}
        {{- "// " + tool.description + "\\n" }}
        {{- "type "+ tool.name + " = " }}
        {%- if tool.parameters and tool.parameters.properties -%}
            {{- "(_: " }}
            {{- "{\\n" }}
            {%- for param_name, param_spec in tool.parameters.properties.items() %}
                {{- "// " + param_spec.description + "\\n" }}
                {{- param_name }}
                {%- if param_name not in (tool.parameters.required or []) -%}
                    {{- "?" }}
                {%- endif -%}
                {{- ": " }}
                {{- render_typescript_type(param_spec, tool.parameters.required or []) }}
                {%- if param_spec.default is defined -%}
                    {%- if param_spec.enum %}
                        {{- ", // default: " + param_spec.default }}
                    {%- elif param_spec.oneOf %}
                        {{- "// default: " + param_spec.default }}
                    {%- else %}
                        {{- ", // default: " + param_spec.default|tojson }}
                    {%- endif -%}
                {%- endif -%}
                {%- if not loop.last %}
                    {{- ",\\n" }}
                {%- else %}
                    {{- "\\n" }}
                {%- endif -%}
            {%- endfor %}
            {{- "}) => any;\\n\\n" }}
        {%- else -%}
            {{- "() => any;\\n\\n" }}
        {%- endif -%}
    {%- endfor %}
    {{- "} // namespace " + namespace_name }}
{%- endmacro -%}

{%- macro render_builtin_tools(browser_tool, python_tool) -%}
    {%- if browser_tool %}
        {{- "## browser\\n\\n" }}
        {{- "// Tool for browsing.\\n" }}
        {{- "// The \`cursor\` appears in brackets before each browsing display: \`[{cursor}]\`.\\n" }}
        {{- "// Cite information from the tool using the following format:\\n" }}
        {{- "// \`【{cursor}†L{line_start}(-L{line_end})?】\`, for example: \`【6†L9-L11】\` or \`【8†L3】\`.\\n" }}
        {{- "// Do not quote more than 10 words directly from the tool output.\\n" }}
        {{- "// sources=web (default: web)\\n" }}
        {{- "namespace browser {\\n\\n" }}
        {{- "// Searches for information related to \`query\` and displays \`topn\` results.\\n" }}
        {{- "type search = (_: {\\n" }}
        {{- "query: string,\\n" }}
        {{- "topn?: number, // default: 10\\n" }}
        {{- "source?: string,\\n" }}
        {{- "}) => any;\\n\\n" }}
        {{- "// Opens the link \`id\` from the page indicated by \`cursor\` starting at line number \`loc\`, showing \`num_lines\` lines.\\n" }}
        {{- "// Valid link ids are displayed with the formatting: \`【{id}†.*】\`.\\n" }}
        {{- "// If \`cursor\` is not provided, the most recent page is implied.\\n" }}
        {{- "// If \`id\` is a string, it is treated as a fully qualified URL associated with \`source\`.\\n" }}
        {{- "// If \`loc\` is not provided, the viewport will be positioned at the beginning of the document or centered on the most relevant passage, if available.\\n" }}
        {{- "// Use this function without \`id\` to scroll to a new location of an opened page.\\n" }}
        {{- "type open = (_: {\\n" }}
        {{- "id?: number | string, // default: -1\\n" }}
        {{- "cursor?: number, // default: -1\\n" }}
        {{- "loc?: number, // default: -1\\n" }}
        {{- "num_lines?: number, // default: -1\\n" }}
        {{- "view_source?: boolean, // default: false\\n" }}
        {{- "source?: string,\\n" }}
        {{- "}) => any;\\n\\n" }}
        {{- "// Finds exact matches of \`pattern\` in the current page, or the page given by \`cursor\`.\\n" }}
        {{- "type find = (_: {\\n" }}
        {{- "pattern: string,\\n" }}
        {{- "cursor?: number, // default: -1\\n" }}
        {{- "}) => any;\\n\\n" }}
        {{- "} // namespace browser\\n\\n" }}
    {%- endif -%}

    {%- if python_tool %}
        {{- "## python\\n\\n" }}
        {{- "Use this tool to execute Python code in your chain of thought. The code will not be shown to the user. This tool should be used for internal reasoning, but not for code that is intended to be visible to the user (e.g. when creating plots, tables, or files).\\n\\n" }}
        {{- "When you send a message containing Python code to python, it will be executed in a stateful Jupyter notebook environment. python will respond with the output of the execution or time out after 120.0 seconds. The drive at '/mnt/data' can be used to save and persist user files. Internet access for this session is UNKNOWN. Depends on the cluster.\\n\\n" }}
    {%- endif -%}
{%- endmacro -%}

{#- System Message Construction ============================================ #}
{%- macro build_system_message() -%}
    {%- if model_identity is not defined %}
        {{- "You are ChatGPT, a large language model trained by OpenAI." -}}
    {%- else %}
        {{- model_identity }}
    {%- endif %}
    {{- "\\nKnowledge cutoff: 2024-06\\n" }}
    {{- "Current date: " + strftime_now("%Y-%m-%d") + "\\n\\n" }}
    {%- if reasoning_effort is not defined %}
        {%- set reasoning_effort = "medium" %}
    {%- endif %}
    {{- "Reasoning: " + reasoning_effort + "\\n\\n" }}
    {%- if builtin_tools is defined and builtin_tools is none %}
        {{- "# Tools\\n\\n" }}
        {%- set available_builtin_tools = namespace(browser=false, python=false) %}
        {%- for tool in builtin_tools %}
            {%- if tool == "browser" %}
                {%- set available_builtin_tools.browser = true %}
            {%- elif tool == "python" %}
                {%- set available_builtin_tools.python = true %}
            {%- endif %}
        {%- endfor %}
        {{- render_builtin_tools(available_builtin_tools.browser, available_builtin_tools.python) }}
    {%- endif -%}
    {{- "# Valid channels: analysis, commentary, final. Channel must be included for every message." }}
    {%- if tools is defined and tools is not none -%}
        {{- "\\nCalls to these tools must go to the commentary channel: 'functions'." }}
    {%- endif -%}
{%- endmacro -%}

{#- Main Template Logic ================================================= #}
{#- Set defaults #}

{#- Render system message #}
{{- "<|start|>system<|message|>" }}
{{- build_system_message() }}
{{- "<|end|>" }}

{#- Extract developer message #}
{%- if messages[0].role == "developer" or messages[0].role == "system" %}
    {%- set developer_message = messages[0].content %}
    {%- set loop_messages = messages[1:] %}
{%- else %}
    {%- set developer_message = "" %}
    {%- set loop_messages = messages %}
{%- endif %}

{#- Render developer message #}
{%- if developer_message or tools %}
    {{- "<|start|>developer<|message|>" }}
    {%- if developer_message %}
        {{- "# Instructions\\n\\n" }}
        {{- developer_message }}
    {%- endif %}
    {%- if tools -%}
        {{- "\\n\\n" }}
        {{- "# Tools\\n\\n" }}
        {{- render_tool_namespace("functions", tools) }}
    {%- endif -%}
    {{- "<|end|>" }}
{%- endif %}

{#- Render messages #}
{%- set last_tool_call = namespace(name=none) %}
{%- for message in loop_messages -%}
    {#- At this point only assistant/user/tool messages should remain #}
    {%- if message.role == 'assistant' -%}
        {%- if "tool_calls" in message %}
            {#- We assume max 1 tool call per message, and so we infer the tool call name #}
            {#- in "tool" messages from the most recent assistant tool call name #}
            {%- set tool_call = message.tool_calls[0] %}
            {%- if tool_call.function %}
                {%- set tool_call = tool_call.function %}
            {%- endif %}
            {%- if message.content %}
                {{- "<|start|>assistant<|channel|>analysis<|message|>" + message.content + "<|end|>" }}
            {%- endif %}
            {{- "<|start|>assistant to=" }}
            {{- "functions." + tool_call.name + "<|channel|>commentary json<|message|>" }}
            {{- tool_call.arguments|tojson }}
            {{- "<|call|>" }}
            {%- set last_tool_call.name = tool_call.name %}
        {%- elif "thinking" in message and loop.last and not add_generation_prompt %}
            {#- Only render the CoT if the final turn is an assistant turn and add_generation_prompt is false #}
            {#- This is a situation that should only occur in training, never in inference. #}
            {{- "<|start|>assistant<|channel|>analysis<|message|>" + message.thinking + "<|end|>" }}
            {#- <|return|> indicates the end of generation, but <|end|> does not #}
            {#- <|return|> should never be an input to the model, but we include it as the final token #}
            {#- when training, so the model learns to emit it. #}
            {{- "<|start|>assistant<|channel|>final<|message|>" + message.content + "<|return|>" }}
            {%- set last_tool_call.name = none %}
        {%- elif "thinking" in message %}
            {#- CoT is dropped during all previous turns, so we never render it for inference #}
            {{- "<|start|>assistant<|channel|>final<|message|>" + message.content + "<|end|>" }}
            {%- set last_tool_call.name = none %}
        {%- elif loop.last and not add_generation_prompt %}
            {#- <|return|> indicates the end of generation, but <|end|> does not #}
            {#- <|return|> should never be an input to the model, but we include it as the final token #}
            {#- when training, so the model learns to emit it. #}
            {{- "<|start|>assistant<|message|>" + message.content + "<|return|>" }}
        {%- else %}
            {{- "<|start|>assistant<|message|>" + message.content + "<|end|>" }}
            {%- set last_tool_call.name = none %}
        {%- endif %}
    {%- elif message.role == 'tool' -%}
        {%- if last_tool_call.name is none %}
            {{- raise_exception("Message has tool role, but there was no previous assistant message with a tool call!") }}
        {%- endif %}
        {{- "<|start|>functions." + last_tool_call.name }}
        {{- " to=assistant<|channel|>commentary<|message|>" + message.content|tojson + "<|end|>" }}
    {%- else -%}
        {{- "<|start|>user<|message|>" + message.content + "<|end|>" }}
    {%- endif -%}
{%- endfor -%}

{#- Generation prompt #}
{%- if add_generation_prompt -%}
<|start|>assistant
{%- endif -%}
{# Copyright 2025-present Unsloth. Apache 2.0 License. Unsloth chat template fixes. Edited from ggml-org & OpenAI #}
`.slice(1, -1);


export const harmonyJinjaTemplate3 = `
{#-
  In addition to the normal inputs of \`messages\` and \`tools\`, this template also accepts the
  following kwargs:
  - "builtin_tools": A list, can contain "browser" and/or "python".
  - "model_identity": A string that optionally describes the model identity.
  - "reasoning_effort": A string that describes the reasoning effort, defaults to "medium".
 #}

{#- Tool Definition Rendering ============================================== #}
{%- macro render_typescript_type(param_spec, required_params, is_nullable=false) -%}
    {%- if param_spec.type == "array" -%}
        {%- if param_spec['items'] -%}
            {%- if param_spec['items']['type'] == "string" -%}
                {{- "string[]" }}
            {%- elif param_spec['items']['type'] == "number" -%}
                {{- "number[]" }}
            {%- elif param_spec['items']['type'] == "integer" -%}
                {{- "number[]" }}
            {%- elif param_spec['items']['type'] == "boolean" -%}
                {{- "boolean[]" }}
            {%- else -%}
                {%- set inner_type = render_typescript_type(param_spec['items'], required_params) -%}
                {%- if inner_type == "object | object" or inner_type|length > 50 -%}
                    {{- "any[]" }}
                {%- else -%}
                    {{- inner_type + "[]" }}
                {%- endif -%}
            {%- endif -%}
            {%- if param_spec.nullable -%}
                {{- " | null" }}
            {%- endif -%}
        {%- else -%}
            {{- "any[]" }}
            {%- if param_spec.nullable -%}
                {{- " | null" }}
            {%- endif -%}
        {%- endif -%}
    {%- elif param_spec.type is defined and param_spec.type is iterable and param_spec.type is not string and param_spec.type is not mapping and param_spec.type[0] is defined -%}
        {#- Handle array of types like ["object", "object"] from Union[dict, list] #}
        {%- if param_spec.type | length > 1 -%}
            {{- param_spec.type | join(" | ") }}
        {%- else -%}
            {{- param_spec.type[0] }}
        {%- endif -%}
    {%- elif param_spec.oneOf -%}
        {#- Handle oneOf schemas - check for complex unions and fallback to any #}
        {%- set has_object_variants = false -%}
        {%- for variant in param_spec.oneOf -%}
            {%- if variant.type == "object" -%}
                {%- set has_object_variants = true -%}
            {%- endif -%}
        {%- endfor -%}
        {%- if has_object_variants and param_spec.oneOf|length > 1 -%}
            {{- "any" }}
        {%- else -%}
            {%- for variant in param_spec.oneOf -%}
                {{- render_typescript_type(variant, required_params) -}}
                {%- if variant.description %}
                    {{- "// " + variant.description }}
                {%- endif -%}
                {%- if variant.default is defined %}
                    {{ "// default: " + variant.default|tojson }}
                {%- endif -%}
                {%- if not loop.last %}
                    {{- " | " }}
                {% endif -%}
            {%- endfor -%}
        {%- endif -%}
    {%- elif param_spec.type == "string" -%}
        {%- if param_spec.enum -%}
            {{- '"' + param_spec.enum|join('" | "') + '"' -}}
        {%- else -%}
            {{- "string" }}
            {%- if param_spec.nullable %}
                {{- " | null" }}
            {%- endif -%}
        {%- endif -%}
    {%- elif param_spec.type == "number" -%}
        {{- "number" }}
    {%- elif param_spec.type == "integer" -%}
        {{- "number" }}
    {%- elif param_spec.type == "boolean" -%}
        {{- "boolean" }}

    {%- elif param_spec.type == "object" -%}
        {%- if param_spec.properties -%}
            {{- "{\\n" }}
            {%- for prop_name, prop_spec in param_spec.properties.items() -%}
                {{- prop_name -}}
                {%- if prop_name not in (param_spec.required or []) -%}
                    {{- "?" }}
                {%- endif -%}
                {{- ": " }}
                {{ render_typescript_type(prop_spec, param_spec.required or []) }}
                {%- if not loop.last -%}
                    {{-", " }}
                {%- endif -%}
            {%- endfor -%}
            {{- "}" }}
        {%- else -%}
            {{- "object" }}
        {%- endif -%}
    {%- else -%}
        {{- "any" }}
    {%- endif -%}
{%- endmacro -%}

{%- macro render_tool_namespace(namespace_name, tools) -%}
    {{- "## " + namespace_name + "\\n\\n" }}
    {{- "namespace " + namespace_name + " {\\n\\n" }}
    {%- for tool in tools %}
        {%- set tool = tool.function %}
        {{- "// " + tool.description + "\\n" }}
        {{- "type "+ tool.name + " = (" }}
        {%- if tool.parameters and tool.parameters.properties -%}
            {{- "_: " }}
            {{- "{\\n" }}
            {%- for param_name, param_spec in tool.parameters.properties.items() %}
                {{- "// " + param_spec.description + "\\n" }}
                {{- param_name }}
                {%- if param_name not in (tool.parameters.required or []) -%}
                    {{- "?" }}
                {%- endif -%}
                {{- ": " }}
                {{- render_typescript_type(param_spec, tool.parameters.required or []) }}
                {%- if param_spec.default is defined -%}
                    {%- if param_spec.oneOf %}
                        {{- "// default: " + param_spec.default }}
                    {%- else %}
                        {{- ", // default: " + param_spec.default|tojson }}
                    {%- endif -%}
                {%- endif -%}
                {%- if not loop.last %}
                    {{- ",\\n" }}
                {%- endif -%}
            {%- endfor %}
            {{- ",\\n}) => any;\\n" }}
        {%- else -%}
            {{- "\\n}) => any;\\n" }}
        {%- endif -%}
    {%- endfor %}
    {{- "\\n} // namespace " + namespace_name }}
{%- endmacro -%}

{%- macro render_builtin_tools(browser_tool, python_tool) -%}
    {%- if browser_tool %}
        {{- "## browser\\n\\n" }}
        {{- "// Tool for browsing.\\n" }}
        {{- "// The \`cursor\` appears in brackets before each browsing display: \`[{cursor}]\`.\\n" }}
        {{- "// Cite information from the tool using the following format:\\n" }}
        {{- "// \`【{cursor}†L{line_start}(-L{line_end})?】\`, for example: \`【6†L9-L11】\` or \`【8†L3】\`.\\n" }}
        {{- "// Do not quote more than 10 words directly from the tool output.\\n" }}
        {{- "// sources=web (default: web)\\n" }}
        {{- "namespace browser {\\n\\n" }}
        {{- "// Searches for information related to \`query\` and displays \`topn\` results.\\n" }}
        {{- "type search = (_: {\\n" }}
        {{- "query: string,\\n" }}
        {{- "topn?: number, // default: 10\\n" }}
        {{- "source?: string,\\n" }}
        {{- "}) => any;\\n\\n" }}
        {{- "// Opens the link \`id\` from the page indicated by \`cursor\` starting at line number \`loc\`, showing \`num_lines\` lines.\\n" }}
        {{- "// Valid link ids are displayed with the formatting: \`【{id}†.*】\`.\\n" }}
        {{- "// If \`cursor\` is not provided, the most recent page is implied.\\n" }}
        {{- "// If \`id\` is a string, it is treated as a fully qualified URL associated with \`source\`.\\n" }}
        {{- "// If \`loc\` is not provided, the viewport will be positioned at the beginning of the document or centered on the most relevant passage, if available.\\n" }}
        {{- "// Use this function without \`id\` to scroll to a new location of an opened page.\\n" }}
        {{- "type open = (_: {\\n" }}
        {{- "id?: number | string, // default: -1\\n" }}
        {{- "cursor?: number, // default: -1\\n" }}
        {{- "loc?: number, // default: -1\\n" }}
        {{- "num_lines?: number, // default: -1\\n" }}
        {{- "view_source?: boolean, // default: false\\n" }}
        {{- "source?: string,\\n" }}
        {{- "}) => any;\\n\\n" }}
        {{- "// Finds exact matches of \`pattern\` in the current page, or the page given by \`cursor\`.\\n" }}
        {{- "type find = (_: {\\n" }}
        {{- "pattern: string,\\n" }}
        {{- "cursor?: number, // default: -1\\n" }}
        {{- "}) => any;\\n\\n" }}
        {{- "} // namespace browser\\n\\n" }}
    {%- endif -%}

    {%- if python_tool %}
        {{- "## python\\n\\n" }}
        {{- "Use this tool to execute Python code in your chain of thought. The code will not be shown to the user. This tool should be used for internal reasoning, but not for code that is intended to be visible to the user (e.g. when creating plots, tables, or files).\\n\\n" }}
        {{- "When you send a message containing Python code to python, it will be executed in a stateful Jupyter notebook environment. python will respond with the output of the execution or time out after 120.0 seconds. The drive at '/mnt/data' can be used to save and persist user files. Internet access for this session is UNKNOWN. Depends on the cluster.\\n\\n" }}
    {%- endif -%}
{%- endmacro -%}

{#- System Message Construction ============================================ #}
{%- macro build_system_message() -%}
    {%- if model_identity is not defined %}
        {{- "You are ChatGPT, a large language model trained by OpenAI.\\n" -}}
    {%- else %}
        {{- model_identity }}
    {%- endif %}
    {{- "Knowledge cutoff: 2024-06\\n" }}
    {{- "Current date: " + strftime_now("%Y-%m-%d") + "\\n\\n" }}
    {%- if reasoning_effort is not defined %}
        {%- set reasoning_effort = "medium" %}
    {%- endif %}
    {{- "reasoning: " + reasoning_effort + "\\n\\n" }}
    {%- if builtin_tools %}
        {{- "# Tools\\n\\n" }}
        {%- set available_builtin_tools = namespace(browser=false, python=false) %}
        {%- for tool in builtin_tools %}
            {%- if tool == "browser" %}
                {%- set available_builtin_tools.browser = true %}
            {%- elif tool == "python" %}
                {%- set available_builtin_tools.python = true %}
            {%- endif %}
        {%- endfor %}
        {{- render_builtin_tools(available_builtin_tools.browser, available_builtin_tools.python) }}
    {%- endif -%}
    {{- "# Valid channels: analysis, commentary, final. Channel must be included for every message.\\n" }}
    {{- "Calls to these tools must go to the commentary channel: 'functions'." }}
{%- endmacro -%}

{#- Main Template Logic ================================================= #}
{#- Set defaults #}

{#- Render system message #}
{{- "<|start|>system<|message|>" }}
{{- build_system_message() }}
{{- "<|end|>" }}

{#- Extract developer message #}
{%- if messages[0].role == "developer" or messages[0].role == "system" %}
    {%- set developer_message = messages[0].content %}
    {%- set loop_messages = messages[1:] %}
{%- else %}
    {%- set developer_message = "" %}
    {%- set loop_messages = messages %}
{%- endif %}

{#- Render developer message #}
{%- if developer_message or tools %}
    {{- "<|start|>developer<|message|>" }}
    {%- if developer_message %}
        {{- "# Instructions\\n\\n" }}
        {{- developer_message }}
    {%- endif %}
    {%- if tools -%}
        {{- "\\n\\n" }}
        {{- "# Tools\\n\\n" }}
        {{- render_tool_namespace("functions", tools) }}
    {%- endif -%}
    {{- "<|end|>" }}
{%- endif %}

{#- Render messages #}
{%- set last_tool_call = namespace(name=none) %}
{%- for message in loop_messages -%}
    {#- At this point only assistant/user/tool messages should remain #}
    {%- if message.role == 'assistant' -%}
        {%- if "tool_calls" in message %}
            {#- We assume max 1 tool call per message, and so we infer the tool call name #}
            {#- in "tool" messages from the most recent assistant tool call name #}
            {%- set tool_call = message.tool_calls[0] %}
            {%- if tool_call.function %}
                {%- set tool_call = tool_call.function %}
            {%- endif %}
            {%- if message.content %}
                {{- "<|start|>assistant<|channel|>analysis<|message|>" + message.content + "<|end|>" }}
            {%- endif %}
            {{- "<|start|>assistant to=" }}
            {{- "functions." + tool_call.name + "<|channel|>commentary json<|message|>" }}
            {{- tool_call.arguments|tojson }}
            {{- "<|end|>" }}
            {%- set last_tool_call.name = tool_call.name %}
        {%- elif "thinking" in message and loop.last and not add_generation_prompt %}
            {#- Only render the CoT if the final turn is an assistant turn and add_generation_prompt is false #}
            {#- This is a situation that should only occur in training, never in inference. #}
            {{- "<|start|>assistant<|channel|>analysis<|message|>" + message.thinking + "<|end|>" }}
            {#- <|return|> indicates the end of generation, but <|end|> does not #}
            {#- <|return|> should never be an input to the model, but we include it as the final token #}
            {#- when training, so the model learns to emit it. #}
            {{- "<|start|>assistant<|channel|>final<|message|>" + message.content + "<|return|>" }}
            {%- set last_tool_call.name = none %}
        {%- elif "thinking" in message %}
            {#- CoT is dropped during all previous turns, so we never render it for inference #}
            {{- "<|start|>assistant<|channel|>final<|message|>" + message.content + "<|end|>" }}
            {%- set last_tool_call.name = none %}
        {%- elif loop.last and not add_generation_prompt %}
            {#- <|return|> indicates the end of generation, but <|end|> does not #}
            {#- <|return|> should never be an input to the model, but we include it as the final token #}
            {#- when training, so the model learns to emit it. #}
            {{- "<|start|>assistant<|message|>" + message.content + "<|return|>" }}
        {%- else %}
            {{- "<|start|>assistant<|message|>" + message.content + "<|end|>" }}
            {%- set last_tool_call.name = none %}
        {%- endif %}
    {%- elif message.role == 'tool' -%}
        {%- if last_tool_call.name is none %}
            {{- raise_exception("Message has tool role, but there was no previous assistant message with a tool call!") }}
        {%- endif %}
        {{- "<|start|>functions." + last_tool_call.name }}
        {{- " to=assistant<|channel|>commentary<|message|>" + message.content|tojson + "<|end|>" }}
    {%- else -%}
        {{- "<|start|>user<|message|>" + message.content + "<|end|>" }}
    {%- endif -%}
{%- endfor -%}

{#- Generation prompt #}
{%- if add_generation_prompt -%}
<|start|>assistant
{%- endif -%}
`.slice(1, -1);


export const harmonyJinjaTemplate4 = `
{# Chat template fixes by Unsloth #}
{#-
  In addition to the normal inputs of \`messages\` and \`tools\`, this template also accepts the
  following kwargs:
  - "builtin_tools": A list, can contain "browser" and/or "python".
  - "model_identity": A string that optionally describes the model identity.
  - "reasoning_effort": A string that describes the reasoning effort, defaults to "medium".
 #}

{#- Tool Definition Rendering ============================================== #}
{%- macro render_typescript_type(param_spec, required_params, is_nullable=false) -%}
    {%- if param_spec.type == "array" -%}
        {%- if param_spec['items'] -%}
            {%- if param_spec['items']['type'] == "string" -%}
                {{- "string[]" }}
            {%- elif param_spec['items']['type'] == "number" -%}
                {{- "number[]" }}
            {%- elif param_spec['items']['type'] == "integer" -%}
                {{- "number[]" }}
            {%- elif param_spec['items']['type'] == "boolean" -%}
                {{- "boolean[]" }}
            {%- else -%}
                {%- set inner_type = render_typescript_type(param_spec['items'], required_params) -%}
                {%- if inner_type == "object | object" or inner_type|length > 50 -%}
                    {{- "any[]" }}
                {%- else -%}
                    {{- inner_type + "[]" }}
                {%- endif -%}
            {%- endif -%}
            {%- if param_spec.nullable -%}
                {{- " | null" }}
            {%- endif -%}
        {%- else -%}
            {{- "any[]" }}
            {%- if param_spec.nullable -%}
                {{- " | null" }}
            {%- endif -%}
        {%- endif -%}
    {%- elif param_spec.type is defined and param_spec.type is iterable and param_spec.type is not string and param_spec.type is not mapping and param_spec.type[0] is defined -%}
        {#- Handle array of types like ["object", "object"] from Union[dict, list] #}
        {%- if param_spec.type | length > 1 -%}
            {{- param_spec.type | join(" | ") }}
        {%- else -%}
            {{- param_spec.type[0] }}
        {%- endif -%}
    {%- elif param_spec.oneOf -%}
        {#- Handle oneOf schemas - check for complex unions and fallback to any #}
        {%- set has_object_variants = false -%}
        {%- for variant in param_spec.oneOf -%}
            {%- if variant.type == "object" -%}
                {%- set has_object_variants = true -%}
            {%- endif -%}
        {%- endfor -%}
        {%- if has_object_variants and param_spec.oneOf|length > 1 -%}
            {{- "any" }}
        {%- else -%}
            {%- for variant in param_spec.oneOf -%}
                {{- render_typescript_type(variant, required_params) -}}
                {%- if variant.description %}
                    {{- "// " + variant.description }}
                {%- endif -%}
                {%- if variant.default is defined %}
                    {{ "// default: " + variant.default|tojson }}
                {%- endif -%}
                {%- if not loop.last %}
                    {{- " | " }}
                {% endif -%}
            {%- endfor -%}
        {%- endif -%}
    {%- elif param_spec.type == "string" -%}
        {%- if param_spec.enum -%}
            {{- '"' + param_spec.enum|join('" | "') + '"' -}}
        {%- else -%}
            {{- "string" }}
            {%- if param_spec.nullable %}
                {{- " | null" }}
            {%- endif -%}
        {%- endif -%}
    {%- elif param_spec.type == "number" -%}
        {{- "number" }}
    {%- elif param_spec.type == "integer" -%}
        {{- "number" }}
    {%- elif param_spec.type == "boolean" -%}
        {{- "boolean" }}

    {%- elif param_spec.type == "object" -%}
        {%- if param_spec.properties -%}
            {{- "{\\n" }}
            {%- for prop_name, prop_spec in param_spec.properties.items() -%}
                {{- prop_name -}}
                {%- if prop_name not in (param_spec.required or []) -%}
                    {{- "?" }}
                {%- endif -%}
                {{- ": " }}
                {{ render_typescript_type(prop_spec, param_spec.required or []) }}
                {%- if not loop.last -%}
                    {{-", " }}
                {%- endif -%}
            {%- endfor -%}
            {{- "}" }}
        {%- else -%}
            {{- "object" }}
        {%- endif -%}
    {%- else -%}
        {{- "any" }}
    {%- endif -%}
{%- endmacro -%}

{%- macro render_tool_namespace(namespace_name, tools) -%}
    {{- "## " + namespace_name + "\\n\\n" }}
    {{- "namespace " + namespace_name + " {\\n\\n" }}
    {%- for tool in tools %}
        {%- set tool = tool.function %}
        {{- "// " + tool.description + "\\n" }}
        {{- "type "+ tool.name + " = " }}
        {%- if tool.parameters and tool.parameters.properties %}
            {{- "(_: {\\n" }}
            {%- for param_name, param_spec in tool.parameters.properties.items() %}
                {%- if param_spec.description %}
                    {{- "// " + param_spec.description + "\\n" }}
                {%- endif %}
                {{- param_name }}
                {%- if param_name not in (tool.parameters.required or []) -%}
                    {{- "?" }}
                {%- endif -%}
                {{- ": " }}
                {{- render_typescript_type(param_spec, tool.parameters.required or []) }}
                {%- if param_spec.default is defined -%}
                    {%- if param_spec.enum %}
                        {{- ", // default: " + param_spec.default }}
                    {%- elif param_spec.oneOf %}
                        {{- "// default: " + param_spec.default }}
                    {%- else %}
                        {{- ", // default: " + param_spec.default|tojson }}
                    {%- endif -%}
                {%- endif -%}
                {%- if not loop.last %}
                    {{- ",\\n" }}
                {%- else %}
                    {{- ",\\n" }}
                {%- endif -%}
            {%- endfor %}
            {{- "}) => any;\\n\\n" }}
        {%- else -%}
            {{- "() => any;\\n\\n" }}
        {%- endif -%}
    {%- endfor %}
    {{- "} // namespace " + namespace_name }}
{%- endmacro -%}

{%- macro render_builtin_tools(browser_tool, python_tool) -%}
    {%- if browser_tool %}
        {{- "## browser\\n\\n" }}
        {{- "// Tool for browsing.\\n" }}
        {{- "// The \`cursor\` appears in brackets before each browsing display: \`[{cursor}]\`.\\n" }}
        {{- "// Cite information from the tool using the following format:\\n" }}
        {{- "// \`【{cursor}†L{line_start}(-L{line_end})?】\`, for example: \`【6†L9-L11】\` or \`【8†L3】\`.\\n" }}
        {{- "// Do not quote more than 10 words directly from the tool output.\\n" }}
        {{- "// sources=web (default: web)\\n" }}
        {{- "namespace browser {\\n\\n" }}
        {{- "// Searches for information related to \`query\` and displays \`topn\` results.\\n" }}
        {{- "type search = (_: {\\n" }}
        {{- "query: string,\\n" }}
        {{- "topn?: number, // default: 10\\n" }}
        {{- "source?: string,\\n" }}
        {{- "}) => any;\\n\\n" }}
        {{- "// Opens the link \`id\` from the page indicated by \`cursor\` starting at line number \`loc\`, showing \`num_lines\` lines.\\n" }}
        {{- "// Valid link ids are displayed with the formatting: \`【{id}†.*】\`.\\n" }}
        {{- "// If \`cursor\` is not provided, the most recent page is implied.\\n" }}
        {{- "// If \`id\` is a string, it is treated as a fully qualified URL associated with \`source\`.\\n" }}
        {{- "// If \`loc\` is not provided, the viewport will be positioned at the beginning of the document or centered on the most relevant passage, if available.\\n" }}
        {{- "// Use this function without \`id\` to scroll to a new location of an opened page.\\n" }}
        {{- "type open = (_: {\\n" }}
        {{- "id?: number | string, // default: -1\\n" }}
        {{- "cursor?: number, // default: -1\\n" }}
        {{- "loc?: number, // default: -1\\n" }}
        {{- "num_lines?: number, // default: -1\\n" }}
        {{- "view_source?: boolean, // default: false\\n" }}
        {{- "source?: string,\\n" }}
        {{- "}) => any;\\n\\n" }}
        {{- "// Finds exact matches of \`pattern\` in the current page, or the page given by \`cursor\`.\\n" }}
        {{- "type find = (_: {\\n" }}
        {{- "pattern: string,\\n" }}
        {{- "cursor?: number, // default: -1\\n" }}
        {{- "}) => any;\\n\\n" }}
        {{- "} // namespace browser\\n\\n" }}
    {%- endif -%}

    {%- if python_tool %}
        {{- "## python\\n\\n" }}
        {{- "Use this tool to execute Python code in your chain of thought. The code will not be shown to the user. This tool should be used for internal reasoning, but not for code that is intended to be visible to the user (e.g. when creating plots, tables, or files).\\n\\n" }}
        {{- "When you send a message containing Python code to python, it will be executed in a stateful Jupyter notebook environment. python will respond with the output of the execution or time out after 120.0 seconds. The drive at '/mnt/data' can be used to save and persist user files. Internet access for this session is UNKNOWN. Depends on the cluster.\\n\\n" }}
    {%- endif -%}
{%- endmacro -%}

{#- System Message Construction ============================================ #}
{%- macro build_system_message() -%}
    {%- if model_identity is not defined %}
        {%- set model_identity = "You are ChatGPT, a large language model trained by OpenAI." %}
    {%- endif %}
    {{- model_identity + "\\n" }}
    {{- "Knowledge cutoff: 2024-06\\n" }}
    {{- "Current date: " + strftime_now("%Y-%m-%d") + "\\n\\n" }}
    {%- if reasoning_effort is not defined %}
        {%- set reasoning_effort = "medium" %}
    {%- endif %}
    {{- "Reasoning: " + reasoning_effort + "\\n\\n" }}
    {%- if builtin_tools is defined and builtin_tools is not none %}
        {{- "# Tools\\n\\n" }}
        {%- set available_builtin_tools = namespace(browser=false, python=false) %}
        {%- for tool in builtin_tools %}
            {%- if tool == "browser" %}
                {%- set available_builtin_tools.browser = true %}
            {%- elif tool == "python" %}
                {%- set available_builtin_tools.python = true %}
            {%- endif %}
        {%- endfor %}
        {{- render_builtin_tools(available_builtin_tools.browser, available_builtin_tools.python) }}
    {%- endif -%}
    {{- "# Valid channels: analysis, commentary, final. Channel must be included for every message." }}
    {%- if tools -%}
        {{- "\\nCalls to these tools must go to the commentary channel: 'functions'." }}
    {%- endif -%}
{%- endmacro -%}

{#- Main Template Logic ================================================= #}
{#- Set defaults #}

{#- Render system message #}
{{- "<|start|>system<|message|>" }}
{{- build_system_message() }}
{{- "<|end|>" }}

{#- Extract developer message #}
{%- if developer_instructions is defined and developer_instructions is not none %}
    {%- set developer_message = developer_instructions %}
    {%- set loop_messages = messages %}
{%- elif messages[0].role == "developer" or messages[0].role == "system" %}
    {%- set developer_message = messages[0].content %}
    {%- set loop_messages = messages[1:] %}
{%- else %}
    {%- set developer_message = "" %}
    {%- set loop_messages = messages %}
{%- endif %}

{#- Render developer message #}
{%- if developer_message or tools %}
    {{- "<|start|>developer<|message|>" }}
    {%- if developer_message %}
        {{- "# Instructions\\n\\n" }}
        {{- developer_message }}
    {%- endif %}
    {%- if tools -%}
        {%- if developer_message %}
            {{- "\\n\\n" }}
        {%- endif %}
        {{- "# Tools\\n\\n" }}
        {{- render_tool_namespace("functions", tools) }}
    {%- endif -%}
    {{- "<|end|>" }}
{%- endif %}

{#- Render messages #}
{%- set last_tool_call = namespace(name=none) %}
{%- for message in loop_messages -%}
    {#- At this point only assistant/user/tool messages should remain #}
    {%- if message.role == 'assistant' -%}
        {#- Checks to ensure the messages are being passed in the format we expect #}
        {%- if "thinking" in message %}
            {%- if "<|channel|>analysis<|message|>" in message.thinking or "<|channel|>final<|message|>" in message.thinking %}
                {{- raise_exception("You have passed a message containing <|channel|> tags in the thinking field. Instead of doing this, you should pass analysis messages (the string between '<|message|>' and '<|end|>') in the 'thinking' field, and final messages (the string between '<|message|>' and '<|end|>') in the 'content' field.") }}
            {%- endif %}
        {%- endif %}
        {%- if "tool_calls" in message %}
            {#- We need very careful handling here - we want to drop the tool call analysis message if the model #}
            {#- has output a later <|final|> message, but otherwise we want to retain it. This is the only case #}
            {#- when we render CoT/analysis messages in inference. #}
            {%- set future_final_message = namespace(found=false) %}
            {%- for future_message in loop_messages[loop.index:] %}
                {%- if future_message.role == 'assistant' and "tool_calls" not in future_message %}
                    {%- set future_final_message.found = true %}
                {%- endif %}
            {%- endfor %}
            {#- We assume max 1 tool call per message, and so we infer the tool call name #}
            {#- in "tool" messages from the most recent assistant tool call name #}
            {%- set tool_call = message.tool_calls[0] %}
            {%- if tool_call.function %}
                {%- set tool_call = tool_call.function %}
            {%- endif %}
            {%- if message.content and message.thinking %}
                {{- raise_exception("Cannot pass both content and thinking in an assistant message with tool calls! Put the analysis message in one or the other, but not both.") }}
            {%- elif message.content and not future_final_message.found %}
                {{- "<|start|>assistant<|channel|>analysis<|message|>" + message.content + "<|end|>" }}
            {%- elif message.thinking and not future_final_message.found %}
                {{- "<|start|>assistant<|channel|>analysis<|message|>" + message.thinking + "<|end|>" }}
            {%- endif %}
            {{- "<|start|>assistant to=" }}
            {{- "functions." + tool_call.name + "<|channel|>commentary " }}
            {{- (tool_call.content_type if tool_call.content_type is defined else "json") + "<|message|>" }}
            {%- if tool_call.arguments is string %}
                {{- tool_call.arguments }}
            {%- else %}
                {{- tool_call.arguments|tojson }}
            {%- endif %}
            {{- "<|call|>" }}
            {%- set last_tool_call.name = tool_call.name %}
        {%- elif loop.last and not add_generation_prompt %}
            {#- Only render the CoT if the final turn is an assistant turn and add_generation_prompt is false #}
            {#- This is a situation that should only occur in training, never in inference. #}
            {%- if "thinking" in message %}
                {{- "<|start|>assistant<|channel|>analysis<|message|>" + message.thinking + "<|end|>" }}
            {%- endif %}
            {#- <|return|> indicates the end of generation, but <|end|> does not #}
            {#- <|return|> should never be an input to the model, but we include it as the final token #}
            {#- when training, so the model learns to emit it. #}
            {{- "<|start|>assistant<|channel|>final<|message|>" + message.content + "<|end|>" }}
        {%- elif "thinking" in message %}
            {#- CoT is dropped during all previous turns, so we never render it for inference #}
            {{- "<|start|>assistant<|channel|>analysis<|message|>" + message.content + "<|end|>" }}
            {%- set last_tool_call.name = none %}
        {%- else %}
            {#- CoT is dropped during all previous turns, so we never render it for inference #}
            {{- "<|start|>assistant<|channel|>final<|message|>" + message.content + "<|end|>" }}
            {%- set last_tool_call.name = none %}
        {%- endif %}
    {%- elif message.role == 'tool' -%}
        {%- if last_tool_call.name is none %}
            {{- raise_exception("Message has tool role, but there was no previous assistant message with a tool call!") }}
        {%- endif %}
        {{- "<|start|>functions." + last_tool_call.name }}
        {%- if message.content is string %}
            {{- " to=assistant<|channel|>commentary<|message|>" + message.content + "<|end|>" }}
        {%- else %}
            {{- " to=assistant<|channel|>commentary<|message|>" + message.content|tojson + "<|end|>" }}
        {%- endif %}
    {%- elif message.role == 'user' -%}
        {{- "<|start|>user<|message|>" + message.content + "<|end|>" }}
    {%- endif -%}
{%- endfor -%}

{#- Generation prompt #}
{%- if add_generation_prompt -%}
<|start|>assistant
{%- endif -%}
{# Copyright 2025-present Unsloth. Apache 2.0 License. Unsloth chat template fixes. Edited from ggml-org & OpenAI #}
`.slice(1, -1);


export const harmonyJinjaTemplate5 = `
{#-
  In addition to the normal inputs of \`messages\` and \`tools\`, this template also accepts the
  following kwargs:
  - "builtin_tools": A list, can contain "browser" and/or "python".
  - "model_identity": A string that optionally describes the model identity.
  - "reasoning_effort": A string that describes the reasoning effort, defaults to "medium".
 #}

{#- Tool Definition Rendering ============================================== #}
{%- macro render_typescript_type(param_spec, required_params, is_nullable=false) -%}
    {%- if param_spec.type == "array" -%}
        {%- if param_spec['items'] -%}
            {%- if param_spec['items']['type'] == "string" -%}
                {{- "string[]" }}
            {%- elif param_spec['items']['type'] == "number" -%}
                {{- "number[]" }}
            {%- elif param_spec['items']['type'] == "integer" -%}
                {{- "number[]" }}
            {%- elif param_spec['items']['type'] == "boolean" -%}
                {{- "boolean[]" }}
            {%- else -%}
                {%- set inner_type = render_typescript_type(param_spec['items'], required_params) -%}
                {%- if inner_type == "object | object" or inner_type|length > 50 -%}
                    {{- "any[]" }}
                {%- else -%}
                    {{- inner_type + "[]" }}
                {%- endif -%}
            {%- endif -%}
            {%- if param_spec.nullable -%}
                {{- " | null" }}
            {%- endif -%}
        {%- else -%}
            {{- "any[]" }}
            {%- if param_spec.nullable -%}
                {{- " | null" }}
            {%- endif -%}
        {%- endif -%}
    {%- elif param_spec.type is defined and param_spec.type is iterable and param_spec.type is not string and param_spec.type is not mapping and param_spec.type[0] is defined -%}
        {#- Handle array of types like ["object", "object"] from Union[dict, list] #}
        {%- if param_spec.type | length > 1 -%}
            {{- param_spec.type | join(" | ") }}
        {%- else -%}
            {{- param_spec.type[0] }}
        {%- endif -%}
    {%- elif param_spec.oneOf -%}
        {#- Handle oneOf schemas - check for complex unions and fallback to any #}
        {%- set has_object_variants = false -%}
        {%- for variant in param_spec.oneOf -%}
            {%- if variant.type == "object" -%}
                {%- set has_object_variants = true -%}
            {%- endif -%}
        {%- endfor -%}
        {%- if has_object_variants and param_spec.oneOf|length > 1 -%}
            {{- "any" }}
        {%- else -%}
            {%- for variant in param_spec.oneOf -%}
                {{- render_typescript_type(variant, required_params) -}}
                {%- if variant.description %}
                    {{- "// " + variant.description }}
                {%- endif -%}
                {%- if variant.default is defined %}
                    {{ "// default: " + variant.default|tojson }}
                {%- endif -%}
                {%- if not loop.last %}
                    {{- " | " }}
                {% endif -%}
            {%- endfor -%}
        {%- endif -%}
    {%- elif param_spec.type == "string" -%}
        {%- if param_spec.enum -%}
            {{- '"' + param_spec.enum|join('" | "') + '"' -}}
        {%- else -%}
            {{- "string" }}
            {%- if param_spec.nullable %}
                {{- " | null" }}
            {%- endif -%}
        {%- endif -%}
    {%- elif param_spec.type == "number" -%}
        {{- "number" }}
    {%- elif param_spec.type == "integer" -%}
        {{- "number" }}
    {%- elif param_spec.type == "boolean" -%}
        {{- "boolean" }}

    {%- elif param_spec.type == "object" -%}
        {%- if param_spec.properties -%}
            {{- "{\\n" }}
            {%- for prop_name, prop_spec in param_spec.properties.items() -%}
                {{- prop_name -}}
                {%- if prop_name not in (param_spec.required or []) -%}
                    {{- "?" }}
                {%- endif -%}
                {{- ": " }}
                {{ render_typescript_type(prop_spec, param_spec.required or []) }}
                {%- if not loop.last -%}
                    {{-", " }}
                {%- endif -%}
            {%- endfor -%}
            {{- "}" }}
        {%- else -%}
            {{- "object" }}
        {%- endif -%}
    {%- else -%}
        {{- "any" }}
    {%- endif -%}
{%- endmacro -%}

{%- macro render_tool_namespace(namespace_name, tools) -%}
    {{- "## " + namespace_name + "\\n\\n" }}
    {{- "namespace " + namespace_name + " {\\n\\n" }}
    {%- for tool in tools %}
        {%- set tool = tool.function %}
        {{- "// " + tool.description + "\\n" }}
        {{- "type "+ tool.name + " = " }}
        {%- if tool.parameters and tool.parameters.properties %}
            {{- "(_: {\\n" }}
            {%- for param_name, param_spec in tool.parameters.properties.items() %}
                {%- if param_spec.description %}
                    {{- "// " + param_spec.description + "\\n" }}
                {%- endif %}
                {{- param_name }}
                {%- if param_name not in (tool.parameters.required or []) -%}
                    {{- "?" }}
                {%- endif -%}
                {{- ": " }}
                {{- render_typescript_type(param_spec, tool.parameters.required or []) }}
                {%- if param_spec.default is defined -%}
                    {%- if param_spec.enum %}
                        {{- ", // default: " + param_spec.default }}
                    {%- elif param_spec.oneOf %}
                        {{- "// default: " + param_spec.default }}
                    {%- else %}
                        {{- ", // default: " + param_spec.default|tojson }}
                    {%- endif -%}
                {%- endif -%}
                {%- if not loop.last %}
                    {{- ",\\n" }}
                {%- else %}
                    {{- ",\\n" }}
                {%- endif -%}
            {%- endfor %}
            {{- "}) => any;\\n\\n" }}
        {%- else -%}
            {{- "() => any;\\n\\n" }}
        {%- endif -%}
    {%- endfor %}
    {{- "} // namespace " + namespace_name }}
{%- endmacro -%}

{%- macro render_builtin_tools(browser_tool, python_tool) -%}
    {%- if browser_tool %}
        {{- "## browser\\n\\n" }}
        {{- "// Tool for browsing.\\n" }}
        {{- "// The \`cursor\` appears in brackets before each browsing display: \`[{cursor}]\`.\\n" }}
        {{- "// Cite information from the tool using the following format:\\n" }}
        {{- "// \`【{cursor}†L{line_start}(-L{line_end})?】\`, for example: \`【6†L9-L11】\` or \`【8†L3】\`.\\n" }}
        {{- "// Do not quote more than 10 words directly from the tool output.\\n" }}
        {{- "// sources=web (default: web)\\n" }}
        {{- "namespace browser {\\n\\n" }}
        {{- "// Searches for information related to \`query\` and displays \`topn\` results.\\n" }}
        {{- "type search = (_: {\\n" }}
        {{- "query: string,\\n" }}
        {{- "topn?: number, // default: 10\\n" }}
        {{- "source?: string,\\n" }}
        {{- "}) => any;\\n\\n" }}
        {{- "// Opens the link \`id\` from the page indicated by \`cursor\` starting at line number \`loc\`, showing \`num_lines\` lines.\\n" }}
        {{- "// Valid link ids are displayed with the formatting: \`【{id}†.*】\`.\\n" }}
        {{- "// If \`cursor\` is not provided, the most recent page is implied.\\n" }}
        {{- "// If \`id\` is a string, it is treated as a fully qualified URL associated with \`source\`.\\n" }}
        {{- "// If \`loc\` is not provided, the viewport will be positioned at the beginning of the document or centered on the most relevant passage, if available.\\n" }}
        {{- "// Use this function without \`id\` to scroll to a new location of an opened page.\\n" }}
        {{- "type open = (_: {\\n" }}
        {{- "id?: number | string, // default: -1\\n" }}
        {{- "cursor?: number, // default: -1\\n" }}
        {{- "loc?: number, // default: -1\\n" }}
        {{- "num_lines?: number, // default: -1\\n" }}
        {{- "view_source?: boolean, // default: false\\n" }}
        {{- "source?: string,\\n" }}
        {{- "}) => any;\\n\\n" }}
        {{- "// Finds exact matches of \`pattern\` in the current page, or the page given by \`cursor\`.\\n" }}
        {{- "type find = (_: {\\n" }}
        {{- "pattern: string,\\n" }}
        {{- "cursor?: number, // default: -1\\n" }}
        {{- "}) => any;\\n\\n" }}
        {{- "} // namespace browser\\n\\n" }}
    {%- endif -%}

    {%- if python_tool %}
        {{- "## python\\n\\n" }}
        {{- "Use this tool to execute Python code in your chain of thought. The code will not be shown to the user. This tool should be used for internal reasoning, but not for code that is intended to be visible to the user (e.g. when creating plots, tables, or files).\\n\\n" }}
        {{- "When you send a message containing Python code to python, it will be executed in a stateful Jupyter notebook environment. python will respond with the output of the execution or time out after 120.0 seconds. The drive at '/mnt/data' can be used to save and persist user files. Internet access for this session is UNKNOWN. Depends on the cluster.\\n\\n" }}
    {%- endif -%}
{%- endmacro -%}

{#- System Message Construction ============================================ #}
{%- macro build_system_message() -%}
    {%- if model_identity is not defined %}
        {%- set model_identity = "You are ChatGPT, a large language model trained by OpenAI." %}
    {%- endif %}
    {{- model_identity + "\\n" }}
    {{- "Knowledge cutoff: 2024-06\\n" }}
    {{- "Current date: " + strftime_now("%Y-%m-%d") + "\\n\\n" }}
    {%- if reasoning_effort is not defined %}
        {%- set reasoning_effort = "medium" %}
    {%- endif %}
    {{- "Reasoning: " + reasoning_effort + "\\n\\n" }}
    {%- if builtin_tools %}
        {{- "# Tools\\n\\n" }}
        {%- set available_builtin_tools = namespace(browser=false, python=false) %}
        {%- for tool in builtin_tools %}
            {%- if tool == "browser" %}
                {%- set available_builtin_tools.browser = true %}
            {%- elif tool == "python" %}
                {%- set available_builtin_tools.python = true %}
            {%- endif %}
        {%- endfor %}
        {{- render_builtin_tools(available_builtin_tools.browser, available_builtin_tools.python) }}
    {%- endif -%}
    {{- "# Valid channels: analysis, commentary, final. Channel must be included for every message." }}
    {%- if tools -%}
        {{- "\\nCalls to these tools must go to the commentary channel: 'functions'." }}
    {%- endif -%}
{%- endmacro -%}

{#- Main Template Logic ================================================= #}
{#- Set defaults #}

{#- Render system message #}
{{- "<|start|>system<|message|>" }}
{{- build_system_message() }}
{{- "<|end|>" }}

{#- Extract developer message #}
{%- if messages[0].role == "developer" or messages[0].role == "system" %}
    {%- set developer_message = messages[0].content %}
    {%- set loop_messages = messages[1:] %}
{%- else %}
    {%- set developer_message = "" %}
    {%- set loop_messages = messages %}
{%- endif %}

{#- Render developer message #}
{%- if developer_message or tools %}
    {{- "<|start|>developer<|message|>" }}
    {%- if developer_message %}
        {{- "# Instructions\\n\\n" }}
        {{- developer_message }}
        {{- "\\n\\n" }}
    {%- endif %}
    {%- if tools -%}
        {{- "# Tools\\n\\n" }}
        {{- render_tool_namespace("functions", tools) }}
    {%- endif -%}
    {{- "<|end|>" }}
{%- endif %}

{#- Render messages #}
{%- set last_tool_call = namespace(name=none) %}
{%- for message in loop_messages -%}
    {#- At this point only assistant/user/tool messages should remain #}
    {%- if message.role == 'assistant' -%}
        {#- Checks to ensure the messages are being passed in the format we expect #}
        {%- if "content" in message %}
            {%- if "<|channel|>analysis<|message|>" in message.content or "<|channel|>final<|message|>" in message.content %}
                {{- raise_exception("You have passed a message containing <|channel|> tags in the content field. Instead of doing this, you should pass analysis messages (the string between '<|message|>' and '<|end|>') in the 'thinking' field, and final messages (the string between '<|message|>' and '<|end|>') in the 'content' field.") }}
            {%- endif %}
        {%- endif %}
        {%- if "thinking" in message %}
            {%- if "<|channel|>analysis<|message|>" in message.thinking or "<|channel|>final<|message|>" in message.thinking %}
                {{- raise_exception("You have passed a message containing <|channel|> tags in the thinking field. Instead of doing this, you should pass analysis messages (the string between '<|message|>' and '<|end|>') in the 'thinking' field, and final messages (the string between '<|message|>' and '<|end|>') in the 'content' field.") }}
            {%- endif %}
        {%- endif %}
        {%- if "tool_calls" in message %}
            {#- We need very careful handling here - we want to drop the tool call analysis message if the model #}
            {#- has output a later <|final|> message, but otherwise we want to retain it. This is the only case #}
            {#- when we render CoT/analysis messages in inference. #}
            {%- set future_final_message = namespace(found=false) %}
            {%- for future_message in loop_messages[loop.index:] %}
                {%- if future_message.role == 'assistant' and "tool_calls" not in future_message %}
                    {%- set future_final_message.found = true %}
                {%- endif %}
            {%- endfor %}
            {#- We assume max 1 tool call per message, and so we infer the tool call name #}
            {#- in "tool" messages from the most recent assistant tool call name #}
            {%- set tool_call = message.tool_calls[0] %}
            {%- if tool_call.function %}
                {%- set tool_call = tool_call.function %}
            {%- endif %}
            {%- if message.content and message.thinking %}
                {{- raise_exception("Cannot pass both content and thinking in an assistant message with tool calls! Put the analysis message in one or the other, but not both.") }}
            {%- elif message.content and not future_final_message.found %}
                {{- "<|start|>assistant<|channel|>analysis<|message|>" + message.content + "<|end|>" }}
            {%- elif message.thinking and not future_final_message.found %}
                {{- "<|start|>assistant<|channel|>analysis<|message|>" + message.thinking + "<|end|>" }}
            {%- endif %}
            {{- "<|start|>assistant to=" }}
            {{- "functions." + tool_call.name + "<|channel|>commentary " }}
            {{- (tool_call.content_type if tool_call.content_type is defined else "json") + "<|message|>" }}
            {{- tool_call.arguments|tojson }}
            {{- "<|call|>" }}
            {%- set last_tool_call.name = tool_call.name %}
        {%- elif loop.last and not add_generation_prompt %}
            {#- Only render the CoT if the final turn is an assistant turn and add_generation_prompt is false #}
            {#- This is a situation that should only occur in training, never in inference. #}
            {%- if "thinking" in message %}
                {{- "<|start|>assistant<|channel|>analysis<|message|>" + message.thinking + "<|end|>" }}
            {%- endif %}
            {#- <|return|> indicates the end of generation, but <|end|> does not #}
            {#- <|return|> should never be an input to the model, but we include it as the final token #}
            {#- when training, so the model learns to emit it. #}
            {{- "<|start|>assistant<|channel|>final<|message|>" + message.content + "<|return|>" }}
        {%- else %}
            {#- CoT is dropped during all previous turns, so we never render it for inference #}
            {{- "<|start|>assistant<|channel|>final<|message|>" + message.content + "<|end|>" }}
            {%- set last_tool_call.name = none %}
        {%- endif %}
    {%- elif message.role == 'tool' -%}
        {%- if last_tool_call.name is none %}
            {{- raise_exception("Message has tool role, but there was no previous assistant message with a tool call!") }}
        {%- endif %}
        {{- "<|start|>functions." + last_tool_call.name }}
        {{- " to=assistant<|channel|>commentary<|message|>" + message.content|tojson + "<|end|>" }}
    {%- elif message.role == 'user' -%}
        {{- "<|start|>user<|message|>" + message.content + "<|end|>" }}
    {%- endif -%}
{%- endfor -%}

{#- Generation prompt #}
{%- if add_generation_prompt -%}
<|start|>assistant
{%- endif -%}
`.slice(1, -1);

export const gemma4JinjaTemplate1 = `
{%- macro format_parameters(properties, required) -%}
    {%- set standard_keys = ['description', 'type', 'properties', 'required', 'nullable'] -%}
    {%- set ns = namespace(found_first=false) -%}
    {%- for key, value in properties | dictsort -%}
        {%- set add_comma = false -%}
        {%- if key not in standard_keys -%}
            {%- if ns.found_first %},{% endif -%}
            {%- set ns.found_first = true -%}
            {{ key }}:{
            {%- if value['description'] -%}
                description:<|"|>{{ value['description'] }}<|"|>
                {%- set add_comma = true -%}
            {%- endif -%}
            {%- if value['nullable'] %}
                {%- if add_comma %},{%- else -%} {%- set add_comma = true -%} {% endif -%}
                nullable:true
            {%- endif -%}
            {%- if value['type'] | upper == 'STRING' -%}
                {%- if value['enum'] -%}
                    {%- if add_comma %},{%- else -%} {%- set add_comma = true -%} {% endif -%}
                    enum:{{ format_argument(value['enum']) }}
                {%- endif -%}
            {%- elif value['type'] | upper == 'OBJECT' -%}
                ,properties:{
                {%- if value['properties'] is defined and value['properties'] is mapping -%}
                    {{- format_parameters(value['properties'], value['required'] | default([])) -}}
                {%- elif value is mapping -%}
                    {{- format_parameters(value, value['required'] | default([])) -}}
                {%- endif -%}
                }
                {%- if value['required'] -%}
                    ,required:[
                    {%- for item in value['required'] | default([]) -%}
                        <|"|>{{- item -}}<|"|>
                        {%- if not loop.last %},{% endif -%}
                    {%- endfor -%}
                    ]
                {%- endif -%}
            {%- elif value['type'] | upper == 'ARRAY' -%}
                {%- if value['items'] is mapping and value['items'] -%}
                    ,items:{
                    {%- set ns_items = namespace(found_first=false) -%}
                    {%- for item_key, item_value in value['items'] | dictsort -%}
                        {%- if item_value is not none -%}
                            {%- if ns_items.found_first %},{% endif -%}
                            {%- set ns_items.found_first = true -%}
                            {%- if item_key == 'properties' -%}
                                properties:{
                                {%- if item_value is mapping -%}
                                    {{- format_parameters(item_value, value['items']['required'] | default([])) -}}
                                {%- endif -%}
                                }
                            {%- elif item_key == 'required' -%}
                                required:[
                                {%- for req_item in item_value -%}
                                    <|"|>{{- req_item -}}<|"|>
                                    {%- if not loop.last %},{% endif -%}
                                {%- endfor -%}
                                ]
                            {%- elif item_key == 'type' -%}
                                {%- if item_value is string -%}
                                    type:{{ format_argument(item_value | upper) }}
                                {%- else -%}
                                    type:{{ format_argument(item_value | map('upper') | list) }}
                                {%- endif -%}
                            {%- else -%}
                                {{ item_key }}:{{ format_argument(item_value) }}
                            {%- endif -%}
                        {%- endif -%}
                    {%- endfor -%}
                    }
                {%- endif -%}
            {%- endif -%}
            {%- if add_comma %},{%- else -%} {%- set add_comma = true -%} {% endif -%}
            type:<|"|>{{ value['type'] | upper }}<|"|>}
        {%- endif -%}
    {%- endfor -%}
{%- endmacro -%}
{%- macro format_function_declaration(tool_data) -%}
    declaration:{{- tool_data['function']['name'] -}}{description:<|"|>{{- tool_data['function']['description'] -}}<|"|>
    {%- set params = tool_data['function']['parameters'] -%}
    {%- if params -%}
        ,parameters:{
        {%- if params['properties'] -%}
            properties:{ {{- format_parameters(params['properties'], params['required']) -}} },
        {%- endif -%}
        {%- if params['required'] -%}
            required:[
            {%- for item in params['required'] -%}
                <|"|>{{- item -}}<|"|>
                {{- ',' if not loop.last -}}
            {%- endfor -%}
            ],
        {%- endif -%}
        {%- if params['type'] -%}
            type:<|"|>{{- params['type'] | upper -}}<|"|>}
        {%- endif -%}
    {%- endif -%}
    {%- if 'response' in tool_data['function'] -%}
        {%- set response_declaration = tool_data['function']['response'] -%}
        ,response:{
        {%- if response_declaration['description'] -%}
            description:<|"|>{{- response_declaration['description'] -}}<|"|>,
        {%- endif -%}
        {%- if response_declaration['type'] | upper == 'OBJECT' -%}
            type:<|"|>{{- response_declaration['type'] | upper -}}<|"|>}
        {%- endif -%}
    {%- endif -%}
    }
{%- endmacro -%}
{%- macro format_argument(argument, escape_keys=True) -%}
    {%- if argument is string -%}
        {{- '<|"|>' + argument + '<|"|>' -}}
    {%- elif argument is boolean -%}
        {{- 'true' if argument else 'false' -}}
    {%- elif argument is mapping -%}
        {{- '{' -}}
        {%- set ns = namespace(found_first=false) -%}
        {%- for key, value in argument | dictsort -%}
            {%- if ns.found_first %},{% endif -%}
            {%- set ns.found_first = true -%}
            {%- if escape_keys -%}
                {{- '<|"|>' + key + '<|"|>' -}}
            {%- else -%}
                {{- key -}}
            {%- endif -%}
            :{{- format_argument(value, escape_keys=escape_keys) -}}
        {%- endfor -%}
        {{- '}' -}}
    {%- elif argument is sequence -%}
        {{- '[' -}}
        {%- for item in argument -%}
            {{- format_argument(item, escape_keys=escape_keys) -}}
            {%- if not loop.last %},{% endif -%}
        {%- endfor -%}
        {{- ']' -}}
    {%- else -%}
        {{- argument -}}
    {%- endif -%}
{%- endmacro -%}
{%- macro strip_thinking(text) -%}
    {%- set ns = namespace(result='') -%}
    {%- for part in text.split('<channel|>') -%}
        {%- if '<|channel>' in part -%}
            {%- set ns.result = ns.result + part.split('<|channel>')[0] -%}
        {%- else -%}
            {%- set ns.result = ns.result + part -%}
        {%- endif -%}
    {%- endfor -%}
    {{- ns.result | trim -}}
{%- endmacro -%}

{%- set ns = namespace(prev_message_type=None) -%}
{%- set loop_messages = messages -%}
{{ bos_token }}
{#- Handle System/Tool Definitions Block -#}
{%- if (enable_thinking is defined and enable_thinking) or tools or messages[0]['role'] in ['system', 'developer'] -%}
    {{- '<|turn>system\n' -}}

    {#- Inject Thinking token at the very top of the FIRST system turn -#}
    {%- if enable_thinking is defined and enable_thinking -%}
        {{- '<|think|>' -}}
        {%- set ns.prev_message_type = 'think' -%}
    {%- endif -%}

    {%- if messages[0]['role'] in ['system', 'developer'] -%}
        {{- messages[0]['content'] | trim -}}
        {%- set loop_messages = messages[1:] -%}
    {%- endif -%}

    {%- if tools -%}
        {%- for tool in tools %}
            {{- '<|tool>' -}}
            {{- format_function_declaration(tool) | trim -}}
            {{- '<tool|>' -}}
        {%- endfor %}
        {%- set ns.prev_message_type = 'tool' -%}
    {%- endif -%}

    {{- '<turn|>\n' -}}
{%- endif %}

{#- Loop through messages -#}
{%- for message in loop_messages -%}
    {%- set ns.prev_message_type = None -%}
    {%- set role = 'model' if message['role'] == 'assistant' else message['role'] -%}
        {{- '<|turn>' + role + '\n' }}

            {%- if message['tool_calls'] -%}
                {%- for tool_call in message['tool_calls'] -%}
                    {%- set function = tool_call['function'] -%}
                    {{- '<|tool_call>call:' + function['name'] + '{' -}}
                    {%- if function['arguments'] is mapping -%}
                        {%- set ns_args = namespace(found_first=false) -%}
                        {%- for key, value in function['arguments'] | dictsort -%}
                            {%- if ns_args.found_first %},{% endif -%}
                            {%- set ns_args.found_first = true -%}
                            {{- key -}}:{{- format_argument(value, escape_keys=False) -}}
                        {%- endfor -%}
                    {%- elif function['arguments'] is string -%}
                        {{- function['arguments'] -}}
                    {%- endif -%}
                    {{- '}<tool_call|>' -}}
                {%- endfor -%}
                {%- set ns.prev_message_type = 'tool_call' -%}
            {%- endif -%}

            {%- if message['tool_responses'] -%}
                {#- Tool Response handling -#}
                {%- for tool_response in message['tool_responses'] -%}
                    {{- '<|tool_response>' -}}
                    {%- if tool_response['response'] is mapping -%}
                        {{- 'response:' + tool_response['name'] | default('unknown') + '{' -}}
                        {%- for key, value in tool_response['response'] | dictsort -%}
                            {{- key -}}:{{- format_argument(value, escape_keys=False) -}}
                            {%- if not loop.last %},{% endif -%}
                        {%- endfor -%}
                        {{- '}' -}}
                    {%- else -%}
                        {{- 'response:' + tool_response['name'] | default('unknown') + '{value:' + format_argument(tool_response['response'], escape_keys=False) + '}' -}}
                    {%- endif -%}
                    {{- '<tool_response|>' -}}
                {%- endfor -%}
                {%- set ns.prev_message_type = 'tool_response' -%}
            {%- endif -%}

            {%- if message['content'] is string -%}
                {%- if role == 'model' -%}
                    {{- strip_thinking(message['content']) -}}
                {%- else -%}
                    {{- message['content'] | trim -}}
                {%- endif -%}
            {%- elif message['content'] is sequence -%}
                {%- for item in message['content'] -%}
                    {%- if item['type'] == 'text' -%}
                        {%- if role == 'model' -%}
                            {{- strip_thinking(item['text']) -}}
                        {%- else -%}
                            {{- item['text'] | trim -}}
                        {%- endif -%}
                    {%- elif item['type'] == 'image' -%}
                        {{- '\n\n<|image|>\n\n' -}}
                        {%- set ns.prev_message_type = 'image' -%}
                    {%- elif item['type'] == 'audio' -%}
                        {{- '<|audio|>' -}}
                        {%- set ns.prev_message_type = 'audio' -%}
                    {%- elif item['type'] == 'video' -%}
                        {{- '\n\n<|video|>\n\n' -}}
                        {%- set ns.prev_message_type = 'video' -%}
                    {%- endif -%}
                {%- endfor -%}
            {%- endif -%}

        {%- if not (message['tool_responses'] and not message['content']) -%}
            {{- '<turn|>\n' -}}
        {%- endif -%}
{%- endfor -%}

{%- if add_generation_prompt -%}
    {%- if ns.prev_message_type != 'tool_response' -%}
        {{- '<|turn>model\n' -}}
    {%- endif -%}
{%- endif -%}
`.slice(1);

export const gemma4JinjaTemplate2 = `
{%- macro format_parameters(properties, required) -%}
    {%- set standard_keys = ['description', 'type', 'properties', 'required', 'nullable'] -%}
    {%- set ns = namespace(found_first=false) -%}
    {%- for key, value in properties | dictsort -%}
        {%- set add_comma = false -%}
        {%- if key not in standard_keys -%}
            {%- if ns.found_first %},{% endif -%}
            {%- set ns.found_first = true -%}
            {{ key }}:{
            {%- if value['description'] -%}
                description:<|"|>{{ value['description'] }}<|"|>
                {%- set add_comma = true -%}
            {%- endif -%}
            {%- if value['nullable'] %}
                {%- if add_comma %},{%- else -%} {%- set add_comma = true -%} {% endif -%}
                nullable:true
            {%- endif -%}
            {%- if value['type'] | upper == 'STRING' -%}
                {%- if value['enum'] -%}
                    {%- if add_comma %},{%- else -%} {%- set add_comma = true -%} {% endif -%}
                    enum:{{ format_argument(value['enum']) }}
                {%- endif -%}
            {%- elif value['type'] | upper == 'OBJECT' -%}
                ,properties:{
                {%- if value['properties'] is defined and value['properties'] is mapping -%}
                    {{- format_parameters(value['properties'], value['required'] | default([])) -}}
                {%- elif value is mapping -%}
                    {{- format_parameters(value, value['required'] | default([])) -}}
                {%- endif -%}
                }
                {%- if value['required'] -%}
                    ,required:[
                    {%- for item in value['required'] | default([]) -%}
                        <|"|>{{- item -}}<|"|>
                        {%- if not loop.last %},{% endif -%}
                    {%- endfor -%}
                    ]
                {%- endif -%}
            {%- elif value['type'] | upper == 'ARRAY' -%}
                {%- if value['items'] is mapping and value['items'] -%}
                    ,items:{
                    {%- set ns_items = namespace(found_first=false) -%}
                    {%- for item_key, item_value in value['items'] | dictsort -%}
                        {%- if item_value is not none -%}
                            {%- if ns_items.found_first %},{% endif -%}
                            {%- set ns_items.found_first = true -%}
                            {%- if item_key == 'properties' -%}
                                properties:{
                                {%- if item_value is mapping -%}
                                    {{- format_parameters(item_value, value['items']['required'] | default([])) -}}
                                {%- endif -%}
                                }
                            {%- elif item_key == 'required' -%}
                                required:[
                                {%- for req_item in item_value -%}
                                    <|"|>{{- req_item -}}<|"|>
                                    {%- if not loop.last %},{% endif -%}
                                {%- endfor -%}
                                ]
                            {%- elif item_key == 'type' -%}
                                {%- if item_value is string -%}
                                    type:{{ format_argument(item_value | upper) }}
                                {%- else -%}
                                    type:{{ format_argument(item_value | map('upper') | list) }}
                                {%- endif -%}
                            {%- else -%}
                                {{ item_key }}:{{ format_argument(item_value) }}
                            {%- endif -%}
                        {%- endif -%}
                    {%- endfor -%}
                    }
                {%- endif -%}
            {%- endif -%}
            {%- if add_comma %},{%- else -%} {%- set add_comma = true -%} {% endif -%}
            type:<|"|>{{ value['type'] | upper }}<|"|>}
        {%- endif -%}
    {%- endfor -%}
{%- endmacro -%}
{%- macro format_function_declaration(tool_data) -%}
    declaration:{{- tool_data['function']['name'] -}}{description:<|"|>{{- tool_data['function']['description'] -}}<|"|>
    {%- set params = tool_data['function']['parameters'] -%}
    {%- if params -%}
        ,parameters:{
        {%- if params['properties'] -%}
            properties:{ {{- format_parameters(params['properties'], params['required']) -}} },
        {%- endif -%}
        {%- if params['required'] -%}
            required:[
            {%- for item in params['required'] -%}
                <|"|>{{- item -}}<|"|>
                {{- ',' if not loop.last -}}
            {%- endfor -%}
            ],
        {%- endif -%}
        {%- if params['type'] -%}
            type:<|"|>{{- params['type'] | upper -}}<|"|>}
        {%- endif -%}
    {%- endif -%}
    {%- if 'response' in tool_data['function'] -%}
        {%- set response_declaration = tool_data['function']['response'] -%}
        ,response:{
        {%- if response_declaration['description'] -%}
            description:<|"|>{{- response_declaration['description'] -}}<|"|>,
        {%- endif -%}
        {%- if response_declaration['type'] | upper == 'OBJECT' -%}
            type:<|"|>{{- response_declaration['type'] | upper -}}<|"|>}
        {%- endif -%}
    {%- endif -%}
    }
{%- endmacro -%}
{%- macro format_argument(argument, escape_keys=True) -%}
    {%- if argument is string -%}
        {{- '<|"|>' + argument + '<|"|>' -}}
    {%- elif argument is boolean -%}
        {{- 'true' if argument else 'false' -}}
    {%- elif argument is mapping -%}
        {{- '{' -}}
        {%- set ns = namespace(found_first=false) -%}
        {%- for key, value in argument | dictsort -%}
            {%- if ns.found_first %},{% endif -%}
            {%- set ns.found_first = true -%}
            {%- if escape_keys -%}
                {{- '<|"|>' + key + '<|"|>' -}}
            {%- else -%}
                {{- key -}}
            {%- endif -%}
            :{{- format_argument(value, escape_keys=escape_keys) -}}
        {%- endfor -%}
        {{- '}' -}}
    {%- elif argument is sequence -%}
        {{- '[' -}}
        {%- for item in argument -%}
            {{- format_argument(item, escape_keys=escape_keys) -}}
            {%- if not loop.last %},{% endif -%}
        {%- endfor -%}
        {{- ']' -}}
    {%- else -%}
        {{- argument -}}
    {%- endif -%}
{%- endmacro -%}
{%- macro strip_thinking(text) -%}
    {%- set ns = namespace(result='') -%}
    {%- for part in text.split('<channel|>') -%}
        {%- if '<|channel>' in part -%}
            {%- set ns.result = ns.result + part.split('<|channel>')[0] -%}
        {%- else -%}
            {%- set ns.result = ns.result + part -%}
        {%- endif -%}
    {%- endfor -%}
    {{- ns.result | trim -}}
{%- endmacro -%}

{%- set ns = namespace(prev_message_type=None) -%}
{%- set loop_messages = messages -%}
{{ bos_token }}
{#- Handle System/Tool Definitions Block -#}
{%- if (enable_thinking is defined and enable_thinking) or tools or messages[0]['role'] in ['system', 'developer'] -%}
    {{- '<|turn>system\n' -}}

    {#- Inject Thinking token at the very top of the FIRST system turn -#}
    {%- if enable_thinking is defined and enable_thinking -%}
        {{- '<|think|>' -}}
        {%- set ns.prev_message_type = 'think' -%}
    {%- endif -%}

    {%- if messages[0]['role'] in ['system', 'developer'] -%}
        {{- messages[0]['content'] | trim -}}
        {%- set loop_messages = messages[1:] -%}
    {%- endif -%}

    {%- if tools -%}
        {%- for tool in tools %}
            {{- '<|tool>' -}}
            {{- format_function_declaration(tool) | trim -}}
            {{- '<tool|>' -}}
        {%- endfor %}
        {%- set ns.prev_message_type = 'tool' -%}
    {%- endif -%}

    {{- '<turn|>\n' -}}
{%- endif %}

{#- Loop through messages -#}
{%- for message in loop_messages -%}
    {%- set ns.prev_message_type = None -%}
    {%- set role = 'model' if message['role'] == 'assistant' else message['role'] -%}
        {{- '<|turn>' + role + '\n' }}

            {%- if message['tool_calls'] -%}
                {%- for tool_call in message['tool_calls'] -%}
                    {%- set function = tool_call['function'] -%}
                    {{- '<|tool_call>call:' + function['name'] + '{' -}}
                    {%- if function['arguments'] is mapping -%}
                        {%- set ns_args = namespace(found_first=false) -%}
                        {%- for key, value in function['arguments'] | dictsort -%}
                            {%- if ns_args.found_first %},{% endif -%}
                            {%- set ns_args.found_first = true -%}
                            {{- key -}}:{{- format_argument(value, escape_keys=False) -}}
                        {%- endfor -%}
                    {%- elif function['arguments'] is string -%}
                        {{- function['arguments'] -}}
                    {%- endif -%}
                    {{- '}<tool_call|>' -}}
                {%- endfor -%}
                {%- set ns.prev_message_type = 'tool_call' -%}
            {%- endif -%}

            {%- if message['tool_responses'] -%}
                {#- Tool Response handling -#}
                {%- for tool_response in message['tool_responses'] -%}
                    {{- '<|tool_response>' -}}
                    {%- if tool_response['response'] is mapping -%}
                        {{- 'response:' + tool_response['name'] | default('unknown') + '{' -}}
                        {%- for key, value in tool_response['response'] | dictsort -%}
                            {{- key -}}:{{- format_argument(value, escape_keys=False) -}}
                            {%- if not loop.last %},{% endif -%}
                        {%- endfor -%}
                        {{- '}' -}}
                    {%- else -%}
                        {{- 'response:' + tool_response['name'] | default('unknown') + '{value:' + format_argument(tool_response['response'], escape_keys=False) + '}' -}}
                    {%- endif -%}
                    {{- '<tool_response|>' -}}
                {%- endfor -%}
                {%- set ns.prev_message_type = 'tool_response' -%}
            {%- endif -%}

            {%- if message['content'] is string -%}
                {%- if role == 'model' -%}
                    {{- strip_thinking(message['content']) -}}
                {%- else -%}
                    {{- message['content'] | trim -}}
                {%- endif -%}
            {%- elif message['content'] is sequence -%}
                {%- for item in message['content'] -%}
                    {%- if item['type'] == 'text' -%}
                        {%- if role == 'model' -%}
                            {{- strip_thinking(item['text']) -}}
                        {%- else -%}
                            {{- item['text'] | trim -}}
                        {%- endif -%}
                    {%- elif item['type'] == 'image' -%}
                        {{- '\n\n<|image|>\n\n' -}}
                        {%- set ns.prev_message_type = 'image' -%}
                    {%- elif item['type'] == 'audio' -%}
                        {{- '<|audio|>' -}}
                        {%- set ns.prev_message_type = 'audio' -%}
                    {%- elif item['type'] == 'video' -%}
                        {{- '\n\n<|video|>\n\n' -}}
                        {%- set ns.prev_message_type = 'video' -%}
                    {%- endif -%}
                {%- endfor -%}
            {%- endif -%}

        {%- if not (message['tool_responses'] and not message['content']) -%}
            {{- '<turn|>\n' -}}
        {%- endif -%}
{%- endfor -%}

{%- if add_generation_prompt -%}
    {%- if ns.prev_message_type != 'tool_response' -%}
        {{- '<|turn>model\n' -}}
    {%- endif -%}
    {%- if not enable_thinking | default(false) -%}
        {{- '<|channel>thought\n<channel|>' -}}
    {%- endif -%}
{%- endif -%}
`.slice(1);

export const lfm2_5JinjaTemplate = `
{{- bos_token -}}
{%- set preserve_thinking = preserve_thinking | default(false) -%}
{%- macro format_arg_value(arg_value) -%}
    {%- if arg_value is string -%}
        {{- "'" + arg_value + "'" -}}
    {%- elif arg_value is mapping -%}
        {{- arg_value | tojson -}}
    {%- else -%}
        {{- arg_value | string -}}
    {%- endif -%}
{%- endmacro -%}
{%- macro parse_content(content) -%}
    {%- if content is string -%}
        {{- content -}}
    {%- else -%}
        {%- set _ns = namespace(result="") -%}
        {%- for item in content -%}
            {%- if item["type"] == "image" -%}
                {%- set _ns.result = _ns.result + "<image>" -%}
            {%- elif item["type"] == "text" -%}
                {%- set _ns.result = _ns.result + item["text"] -%}
            {%- else -%}
                {%- set _ns.result = _ns.result + item | tojson -%}
            {%- endif -%}
        {%- endfor -%}
        {{- _ns.result -}}
    {%- endif -%}
{%- endmacro -%}
{%- macro render_tool_calls(tool_calls) -%}
    {%- set tool_calls_ns = namespace(tool_calls=[]) -%}
    {%- for tool_call in tool_calls -%}
        {%- set func_name = tool_call["function"]["name"] -%}
        {%- set func_args = tool_call["function"]["arguments"] -%}
        {%- set args_ns = namespace(arg_strings=[]) -%}
        {%- for (arg_name, arg_value) in func_args.items() -%}
            {%- set args_ns.arg_strings = args_ns.arg_strings + [arg_name + "=" + format_arg_value(arg_value)] -%}
        {%- endfor -%}
        {%- set tool_calls_ns.tool_calls = tool_calls_ns.tool_calls + [func_name + "(" + args_ns.arg_strings | join(", ") + ")"] -%}
    {%- endfor -%}
    {{- "<|tool_call_start|>[" + tool_calls_ns.tool_calls | join(", ") + "]<|tool_call_end|>" -}}
{%- endmacro -%}
{%- set ns = namespace(system_prompt="", last_user_index=-1) -%}
{%- if messages[0]["role"] == "system" -%}
    {%- if messages[0].get("content") -%}
        {%- set ns.system_prompt = parse_content(messages[0]["content"]) -%}
    {%- endif -%}
    {%- set messages = messages[1:] -%}
{%- endif -%}
{%- if tools -%}
    {%- set ns.system_prompt = ns.system_prompt + ("\n" if ns.system_prompt else "") + "List of tools: [" -%}
    {%- for tool in tools -%}
        {%- if tool is not string -%}
            {%- set tool = tool | tojson -%}
        {%- endif -%}
        {%- set ns.system_prompt = ns.system_prompt + tool -%}
        {%- if not loop.last -%}
            {%- set ns.system_prompt = ns.system_prompt + ", " -%}
        {%- endif -%}
    {%- endfor -%}
    {%- set ns.system_prompt = ns.system_prompt + "]" -%}
{%- endif -%}
{%- if ns.system_prompt -%}
    {{- "<|im_start|>system\n" + ns.system_prompt + "<|im_end|>\n" -}}
{%- endif -%}
{%- for message in messages -%}
    {%- if message["role"] == "user" -%}
        {%- set ns.last_user_index = loop.index0 -%}
    {%- endif -%}
{%- endfor -%}
{%- for message in messages -%}
    {{- "<|im_start|>" + message.role + "\n" -}}
    {%- if message.role == "assistant" -%}
        {%- if message.thinking is defined and (preserve_thinking or loop.index0 > ns.last_user_index) -%}
            {{- "<think>" + message.thinking + "</think>" -}}
        {%- endif -%}
        {%- set _cfm_tag = "CONTINUE_FINAL_MESSAGE_TAG " -%}
        {%- set _has_cfm = false -%}
        {%- if message.content is defined -%}
            {%- set content = parse_content(message.content) -%}
            {%- if not (preserve_thinking or loop.index0 > ns.last_user_index) -%}
                {%- if "</think>" in content -%}
                    {%- set content = content.split("</think>")[-1] | trim -%}
                {%- endif -%}
            {%- endif -%}
            {%- if message.tool_calls is defined and content.endswith(_cfm_tag) -%}
                {%- set _has_cfm = true -%}
                {%- set _trunc_len = content | length - _cfm_tag | length -%}
                {{- content[:_trunc_len] -}}
            {%- else -%}
                {{- content -}}
            {%- endif -%}
        {%- endif -%}
        {%- if message.tool_calls is defined -%}
            {{- render_tool_calls(message.tool_calls) -}}
        {%- endif -%}
        {%- if _has_cfm -%}
            {{- _cfm_tag -}}
        {%- endif -%}
        {{- "<|im_end|>\n" -}}
    {%- else -%}
        {%- if message.get("content") -%}
            {{- parse_content(message["content"]) -}}
        {%- endif -%}
        {{- "<|im_end|>\n" -}}
    {%- endif -%}
{%- endfor -%}
{%- if add_generation_prompt -%}
    {{- "<|im_start|>assistant\n" -}}
{%- endif -%}
`.slice(1, -1);


export const functionGemma270mJinjaTemplate = `
{%- macro format_parameters(properties, required) -%}
    {%- set standard_keys = ["description", "type", "properties", "required", "nullable"] -%}
    {%- set ns = namespace(found_first=false) -%}
    {%- for (key, value) in properties | dictsort -%}
        {%- if key not in standard_keys -%}
            {%- if ns.found_first -%}
                {{- "," -}}
            {%- endif -%}
            {%- set ns.found_first = true -%}
            {{- key -}}
            {{- ":{description:<escape>" -}}
            {{- value["description"] -}}
            {{- "<escape>" -}}
            {%- if value["type"] | upper == "STRING" -%}
                {%- if value["enum"] -%}
                    {{- ",enum:" -}}
                    {{- format_argument(value["enum"]) -}}
                {%- endif -%}
            {%- elif value["type"] | upper == "OBJECT" -%}
                {{- ",properties:{" -}}
                {%- if value["properties"] is defined and value["properties"] is mapping -%}
                    {{- format_parameters(value["properties"], value["required"] | default([])) -}}
                {%- elif value is mapping -%}
                    {{- format_parameters(value, value["required"] | default([])) -}}
                {%- endif -%}
                {{- "}" -}}
                {%- if value["required"] -%}
                    {{- ",required:[" -}}
                    {%- for item in value["required"] | default([]) -%}
                        {{- "<escape>" -}}
                        {{- item -}}
                        {{- "<escape>" -}}
                        {%- if not loop.last -%}
                            {{- "," -}}
                        {%- endif -%}
                    {%- endfor -%}
                    {{- "]" -}}
                {%- endif -%}
            {%- elif value["type"] | upper == "ARRAY" -%}
                {%- if value["items"] is mapping and value["items"] -%}
                    {{- ",items:{" -}}
                    {%- set ns_items = namespace(found_first=false) -%}
                    {%- for (item_key, item_value) in value["items"] | dictsort -%}
                        {%- if item_value is not none -%}
                            {%- if ns_items.found_first -%}
                                {{- "," -}}
                            {%- endif -%}
                            {%- set ns_items.found_first = true -%}
                            {%- if item_key == "properties" -%}
                                {{- "properties:{" -}}
                                {%- if item_value is mapping -%}
                                    {{- format_parameters(item_value, value["items"]["required"] | default([])) -}}
                                {%- endif -%}
                                {{- "}" -}}
                            {%- elif item_key == "required" -%}
                                {{- "required:[" -}}
                                {%- for req_item in item_value -%}
                                    {{- "<escape>" -}}
                                    {{- req_item -}}
                                    {{- "<escape>" -}}
                                    {%- if not loop.last -%}
                                        {{- "," -}}
                                    {%- endif -%}
                                {%- endfor -%}
                                {{- "]" -}}
                            {%- elif item_key == "type" -%}
                                {%- if item_value is string -%}
                                    {{- "type:" -}}
                                    {{- format_argument(item_value | upper) -}}
                                {%- else -%}
                                    {{- "type:" -}}
                                    {{- format_argument(item_value | map("upper") | list) -}}
                                {%- endif -%}
                            {%- else -%}
                                {{- item_key -}}
                                {{- ":" -}}
                                {{- format_argument(item_value) -}}
                            {%- endif -%}
                        {%- endif -%}
                    {%- endfor -%}
                    {{- "}" -}}
                {%- endif -%}
            {%- endif -%}
            {{- ",type:<escape>" -}}
            {{- value["type"] | upper -}}
            {{- "<escape>}" -}}
        {%- endif -%}
    {%- endfor -%}
{%- endmacro -%}
{%- macro format_function_declaration(tool_data) -%}
    {{- "declaration:" -}}
    {{- tool_data["function"]["name"] -}}
    {{- "{description:<escape>" -}}
    {{- tool_data["function"]["description"] -}}
    {{- "<escape>" -}}
    {%- set params = tool_data["function"]["parameters"] -%}
    {%- if params -%}
        {{- ",parameters:{" -}}
        {%- if params["properties"] -%}
            {{- "properties:{" -}}
            {{- format_parameters(params["properties"], params["required"]) -}}
            {{- "}," -}}
        {%- endif -%}
        {%- if params["required"] -%}
            {{- "required:[" -}}
            {%- for item in params["required"] -%}
                {{- "<escape>" -}}
                {{- item -}}
                {{- "<escape>" -}}
                {{- "," if not loop.last -}}
            {%- endfor -%}
            {{- "]," -}}
        {%- endif -%}
        {%- if params["type"] -%}
            {{- "type:<escape>" -}}
            {{- params["type"] | upper -}}
            {{- "<escape>}" -}}
        {%- endif -%}
    {%- endif -%}
    {{- "}" -}}
{%- endmacro -%}
{%- macro format_argument(argument, escape_keys=True) -%}
    {%- if argument is string -%}
        {{- "<escape>" + argument + "<escape>" -}}
    {%- elif argument is boolean -%}
        {%- if argument -%}
            {{- "true" -}}
        {%- else -%}
            {{- "false" -}}
        {%- endif -%}
    {%- elif argument is mapping -%}
        {{- "{" -}}
        {%- set ns = namespace(found_first=false) -%}
        {%- for (key, value) in argument | dictsort -%}
            {%- if ns.found_first -%}
                {{- "," -}}
            {%- endif -%}
            {%- set ns.found_first = true -%}
            {%- if escape_keys -%}
                {{- "<escape>" + key + "<escape>" -}}
            {%- else -%}
                {{- key -}}
            {%- endif -%}
            {{- ":" -}}
            {{- format_argument(value, escape_keys=escape_keys) -}}
        {%- endfor -%}
        {{- "}" -}}
    {%- elif argument is sequence -%}
        {{- "[" -}}
        {%- for item in argument -%}
            {{- format_argument(item, escape_keys=escape_keys) -}}
            {%- if not loop.last -%}
                {{- "," -}}
            {%- endif -%}
        {%- endfor -%}
        {{- "]" -}}
    {%- else -%}
        {{- argument -}}
    {%- endif -%}
{%- endmacro -%}
{{- bos_token -}}
{%- set ns = namespace(prev_message_type=None) -%}
{#  Tool Declarations  #}
{%- set loop_messages = messages -%}
{%- if tools or messages[0]["role"] == "system" or messages[0]["role"] == "developer" -%}
    {{- "<start_of_turn>developer\n" -}}
    {%- if messages[0]["role"] == "system" or messages[0]["role"] == "developer" -%}
        {%- if messages[0]["content"] is string -%}
            {{- messages[0]["content"] | trim -}}
        {%- elif messages[0]["content"] is sequence -%}
            {%- for item in messages[0]["content"] -%}
                {%- if item["type"] == "text" -%}
                    {{- item["text"] | trim -}}
                {%- endif -%}
            {%- endfor -%}
        {%- endif -%}
        {%- set loop_messages = messages[1:] -%}
    {%- else -%}
        {{- "You are a model that can do function calling with the following functions" -}}
        {%- set loop_messages = messages -%}
    {%- endif -%}
    {%- if tools -%}
        {%- for tool in tools -%}
            {{- "<start_function_declaration>" -}}
            {{- format_function_declaration(tool) | trim -}}
            {{- "<end_function_declaration>" -}}
        {%- endfor -%}
    {%- endif -%}
    {{- "<end_of_turn>\n" -}}
{%- endif -%}
{#  Loop through messages.  #}
{%- for message in loop_messages -%}
    {%- if message["role"] == "assistant" -%}
        {#  Rename "assistant" to "model".  #}
        {%- set role = "model" -%}
    {%- else -%}
        {%- set role = message["role"] -%}
    {%- endif -%}
    {%- if role != "tool" -%}
        {%- if ns.prev_message_type != "tool_response" -%}
            {{- "<start_of_turn>" + role + "\n" -}}
        {%- endif -%}
        {%- set ns.prev_message_type = None -%}
        {%- if "content" in message and message["content"] is not none -%}
            {%- if message["content"] is string -%}
                {{- message["content"] | trim -}}
            {%- elif message["content"] is sequence -%}
                {%- for item in message["content"] -%}
                    {%- if item["type"] == "image" -%}
                        {{- "<start_of_image>" -}}
                    {%- elif item["type"] == "text" -%}
                        {{- item["text"] | trim -}}
                    {%- endif -%}
                {%- endfor -%}
            {%- else -%}
                {{- raise_exception("Invalid content type in user/assistant message") -}}
            {%- endif -%}
            {%- set ns.prev_message_type = "content" -%}
        {%- endif -%}
        {%- if "tool_calls" in message and message["tool_calls"] and message["tool_calls"] is iterable -%}
            {#  Tool Calls  #}
            {%- for tool_call in message["tool_calls"] -%}
                {%- set function = tool_call["function"] -%}
                {{- "<start_function_call>call:" + function["name"] + "{" -}}
                {%- if "arguments" in function -%}
                    {%- if function["arguments"] is mapping -%}
                        {%- set ns = namespace(found_first=false) -%}
                        {%- for (key, value) in function["arguments"] | dictsort -%}
                            {%- if ns.found_first -%}
                                {{- "," -}}
                            {%- endif -%}
                            {%- set ns.found_first = true -%}
                            {{- key -}}
                            {{- ":" -}}
                            {{- format_argument(value, escape_keys=False) -}}
                        {%- endfor -%}
                    {%- elif function["arguments"] is string -%}
                        {#  This handles string-JSON, just in case  #}
                        {{- "                    " -}}
                        {{- function["arguments"] -}}
                    {%- endif -%}
                {%- endif -%}
                {{- "}<end_function_call>" -}}
            {%- endfor -%}
            {%- if loop.last -%}
                {{- "<start_function_response>" -}}
            {%- endif -%}
            {%- set ns.prev_message_type = "tool_call" -%}
        {%- endif -%}
    {%- else -%}
        {#  Tool Responses  #}
        {%- if "content" in message and message["content"] -%}
            {%- if message["content"] is mapping -%}
                {%- if "name" in message["content"] and "response" in message["content"] -%}
                    {{- "<start_function_response>response:" + message["content"]["name"] | trim + "{" -}}
                    {%- set response_ns = namespace(found_first=false) -%}
                    {%- for (key, value) in message["content"]["response"] | dictsort -%}
                        {%- if response_ns.found_first -%}
                            {{- "," -}}
                        {%- endif -%}
                        {%- set response_ns.found_first = true -%}
                        {{- key -}}
                        {{- ":" -}}
                        {{- format_argument(value, escape_keys=False) -}}
                    {%- endfor -%}
                    {{- "}<end_function_response>" -}}
                {%- elif "name" in message -%}
                    {{- "<start_function_response>response:" + message["name"] | trim + "{" -}}
                    {%- set response_ns = namespace(found_first=false) -%}
                    {%- for (key, value) in message["content"] | dictsort -%}
                        {%- if response_ns.found_first -%}
                            {{- "," -}}
                        {%- endif -%}
                        {%- set response_ns.found_first = true -%}
                        {{- key -}}
                        {{- ":" -}}
                        {{- format_argument(value, escape_keys=False) -}}
                    {%- endfor -%}
                    {{- "}<end_function_response>" -}}
                {%- else -%}
                    {{- raise_exception("Invalid tool response mapping: must contain 'name' and 'response' keys, or 'name' must be in the message.") -}}
                {%- endif -%}
            {%- elif message["content"] is string -%}
                {%- if "name" in message -%}
                    {{- "<start_function_response>response:" + message["name"] | trim + "{value:" + format_argument(message["content"], escape_keys=False) + "}<end_function_response>" -}}
                {%- else -%}
                    {{- raise_exception("Invalid tool response: 'name' must be provided.") -}}
                {%- endif -%}
            {%- elif message["content"] is sequence -%}
                {%- for item in message["content"] -%}
                    {%- if item is mapping -%}
                        {%- if "name" in item and "response" in item -%}
                            {{- "<start_function_response>response:" + item["name"] | trim + "{" -}}
                            {%- set response_ns = namespace(found_first=false) -%}
                            {%- for (key, value) in item["response"] | dictsort -%}
                                {%- if response_ns.found_first -%}
                                    {{- "," -}}
                                {%- endif -%}
                                {%- set response_ns.found_first = true -%}
                                {{- key -}}
                                {{- ":" -}}
                                {{- format_argument(value, escape_keys=False) -}}
                            {%- endfor -%}
                            {{- "}<end_function_response>" -}}
                        {%- elif "name" in message -%}
                            {{- "<start_function_response>response:" + message["name"] | trim + "{" -}}
                            {%- set response_ns = namespace(found_first=false) -%}
                            {%- for (key, value) in item | dictsort -%}
                                {%- if response_ns.found_first -%}
                                    {{- "," -}}
                                {%- endif -%}
                                {%- set response_ns.found_first = true -%}
                                {{- key -}}
                                {{- ":" -}}
                                {{- format_argument(value, escape_keys=False) -}}
                            {%- endfor -%}
                            {{- "}<end_function_response>" -}}
                        {%- else -%}
                            {{- raise_exception("Invalid tool response mapping: must contain 'name' and 'response' keys, or 'name' must be in the message.") -}}
                        {%- endif -%}
                    {%- else -%}
                        {{- raise_exception("Invalid tool response message: multiple responses must all be mappings") -}}
                    {%- endif -%}
                {%- endfor -%}
            {%- else -%}
                {{- raise_exception("Invalid content type in tool message: must be mapping, sequence of mappings, or string.") -}}
            {%- endif -%}
        {%- endif -%}
        {%- set ns.prev_message_type = "tool_response" -%}
    {%- endif -%}
    {%- if ns.prev_message_type not in ["tool_call", "tool_response"] -%}
        {{- "<end_of_turn>\n" -}}
    {%- endif -%}
{%- endfor -%}
{%- if add_generation_prompt -%}
    {%- if ns.prev_message_type != "tool_response" -%}
        {{- "<start_of_turn>model\n" -}}
    {%- endif -%}
{%- endif -%}
`.slice(1, -1);

export const glm4_7flashJinjaTemplate = `
[gMASK]<sop>
{%- if tools -%}
<|system|>
# Tools

You may call one or more functions to assist with the user query.

You are provided with function signatures within <tools></tools> XML tags:
<tools>
{% for tool in tools %}
{{ tool | tojson(ensure_ascii=False) }}
{% endfor %}
</tools>

For each function call, output the function name and arguments within the following XML format:
<tool_call>{function-name}<arg_key>{arg-key-1}</arg_key><arg_value>{arg-value-1}</arg_value><arg_key>{arg-key-2}</arg_key><arg_value>{arg-value-2}</arg_value>...</tool_call>{%- endif -%}
{%- macro visible_text(content) -%}
    {%- if content is string -%}
        {{- content }}
    {%- elif content is iterable and content is not mapping -%}
        {%- for item in content -%}
            {%- if item is mapping and item.type == 'text' -%}
                {{- item.text }}
            {%- elif item is string -%}
                {{- item }}
            {%- endif -%}
        {%- endfor -%}
    {%- else -%}
        {{- content }}
    {%- endif -%}
{%- endmacro -%}
{%- set ns = namespace(last_user_index=-1) %}
{%- for m in messages %}
    {%- if m.role == 'user' %}
        {% set ns.last_user_index = loop.index0 -%}
    {%- endif %}
{%- endfor %}
{% for m in messages %}
{%- if m.role == 'user' -%}<|user|>{{ visible_text(m.content) }}
{%- elif m.role == 'assistant' -%}
<|assistant|>
{%- set reasoning_content = '' %}
{%- set content = visible_text(m.content) %}
{%- if m.reasoning_content is string %}
    {%- set reasoning_content = m.reasoning_content %}
{%- else %}
    {%- if '</think>' in content %}
        {%- set reasoning_content = content.split('</think>')[0].rstrip('\n').split('<think>')[-1].lstrip('\n') %}
        {%- set content = content.split('</think>')[-1].lstrip('\n') %}
    {%- endif %}
{%- endif %}
{%- if ((clear_thinking is defined and not clear_thinking) or loop.index0 > ns.last_user_index) and reasoning_content -%}
{{ '<think>' + reasoning_content.strip() +  '</think>'}}
{%- else -%}
{{ '</think>' }}
{%- endif -%}
{%- if content.strip() -%}
{{ content.strip() }}
{%- endif -%}
{% if m.tool_calls %}
{% for tc in m.tool_calls %}
{%- if tc.function %}
    {%- set tc = tc.function %}
{%- endif %}
{{- '<tool_call>' + tc.name -}}
{% set _args = tc.arguments %}{% for k, v in _args.items() %}<arg_key>{{ k }}</arg_key><arg_value>{{ v | tojson(ensure_ascii=False) if v is not string else v }}</arg_value>{% endfor %}</tool_call>{% endfor %}
{% endif %}
{%- elif m.role == 'tool' -%}
{%- if m.content is string -%}
{%- if loop.first or (messages[loop.index0 - 1].role != "tool") %}
    {{- '<|observation|>' }}
{%- endif %}
{{- '<tool_response>' }}
{{- m.content }}
{{- '</tool_response>' }}
{%- else -%}
<|observation|>{% for tr in m.content %}
<tool_response>{{ tr.output if tr.output is defined else tr }}</tool_response>{% endfor -%}
{% endif -%}
{%- elif m.role == 'system' -%}
<|system|>{{ visible_text(m.content) }}
{%- endif -%}
{%- endfor -%}
{%- if add_generation_prompt -%}
    <|assistant|>{{- '</think>' if (enable_thinking is defined and not enable_thinking) else '<think>' -}}
{%- endif -%}
`.slice(1, -1);
