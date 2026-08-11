import {describe, expect, test} from "vitest";
import {ChatHistoryItem, ChatModelFunctions, MuseChatWrapper} from "../../../src/index.js";


describe("MuseChatWrapper", () => {
    test("should generate valid context text with a configurable reasoning strength", () => {
        const chatWrapper = new MuseChatWrapper({reasoningStrength: "medium"});
        const chatHistory: ChatHistoryItem[] = [{
            type: "system",
            text: "Be concise."
        }, {
            type: "user",
            text: "Hello"
        }, {
            type: "model",
            response: ["Hi!"]
        }];

        const {contextText} = chatWrapper.generateContextState({chatHistory});

        expect(contextText).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialToken("BOS"),
            new SpecialTokensText("<|start|>system<|message|>"),
            "Be concise.

          Reasoning strength: medium.

          # Valid recipients: "self", "user".",
            new SpecialTokensText("<|eot|><|start|>user<|message|>"),
            "Hello",
            new SpecialTokensText("<|eot|><|start|>assistant to=user<|message|>"),
            "Hi!",
          ])
        `);
    });

    test("should generate the default system message", () => {
        const chatWrapper = new MuseChatWrapper({
            reasoningStrength: "low",
            todayDate: new Date("2026-08-11T00:00:00Z")
        });

        const {contextText} = chatWrapper.generateContextState({
            chatHistory: [{type: "user", text: "Hello"}]
        });

        expect(contextText).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialToken("BOS"),
            new SpecialTokensText("<|start|>system<|message|>"),
            "You are a helpful AI assistant.
          Knowledge cutoff: 04-01-2026.
          Current date: 11-08-2026.
          Reasoning strength: low.

          # Valid recipients: "self", "user".",
            new SpecialTokensText("<|eot|><|start|>user<|message|>"),
            "Hello",
          ])
        `);
    });

    test("should replay reasoning and ATEM function calls", () => {
        const chatWrapper = new MuseChatWrapper();
        const availableFunctions: ChatModelFunctions = {
            "get_weather": {
                description: "Get the current weather for a city.",
                params: {
                    type: "object",
                    properties: {
                        city: {type: "string"},
                        includeForecast: {type: "boolean"}
                    },
                    required: ["city"]
                }
            }
        };
        const chatHistory: ChatHistoryItem[] = [{
            type: "system",
            text: "Answer weather questions."
        }, {
            type: "user",
            text: "What is the weather?"
        }, {
            type: "model",
            response: [{
                type: "segment",
                segmentType: "thought",
                text: "I should check the weather.",
                ended: true
            }, {
                type: "functionCall",
                name: "get_weather",
                params: {city: "Tokyo", includeForecast: false},
                result: {temperature: 24}
            }, "It is 24 degrees in Tokyo."]
        }];

        const {contextText} = chatWrapper.generateContextState({chatHistory, availableFunctions});
        expect(contextText).toMatchInlineSnapshot(`
          LlamaText([
            new SpecialToken("BOS"),
            new SpecialTokensText("<|start|>system<|message|>"),
            "Answer weather questions.

          Reasoning strength: high.

          In this environment you have access to a set of tools you can use to answer the user's question.

          You can invoke a function by writing a ",
            new SpecialTokensText(""<atem:function_calls>""),
            " block like the following:
          ",
            new SpecialTokensText("<atem:function_calls>"),
            "
          ",
            new SpecialTokensText("<atem:invoke name="$FUNCTION_NAME">"),
            "
          ",
            new SpecialTokensText("<atem:parameter name="$PARAMETER_NAME">$PARAMETER_VALUE</atem:parameter>"),
            "
          ...
          ",
            new SpecialTokensText("</atem:invoke>"),
            "
          ",
            new SpecialTokensText("</atem:function_calls>"),
            "

          String and scalar parameters should be specified as is, while lists and objects should use JSON format. Note that spaces for string values are not stripped. The output is not expected to be valid XML and is parsed with regular expressions.
          Here are the functions available in JSONSchema format:
          // Tool metadata
          {"name": "get_weather", "description": ""}
          // Function schemas
          {"name": "get_weather", "description": "Get the current weather for a city.", "parameters": {"type": "object", "properties": {"city": {"type": "string"}, "includeForecast": {"type": "boolean"}}, "required": ["city"]}}
          Here's an example of how to call a function in the tool set:
          (If the tool namespace is not specified, invoke the function directly as \`example_function_name\` rather than \`example_tool_name.example_function_name\`)

          to=example_tool_name.example_function_name

          ",
            new SpecialTokensText("<atem:function_calls>"),
            "
          ",
            new SpecialTokensText("<atem:invoke name="example_tool_name.example_function_name">"),
            "
          ",
            new SpecialTokensText("<atem:parameter name="example_parameter_1">"),
            "value_1",
            new SpecialTokensText("</atem:parameter>"),
            "
          ",
            new SpecialTokensText("<atem:parameter name="example_parameter_2">"),
            "This is the value for the second parameter
          that can span
          "multiple" lines
          ",
            new SpecialTokensText("</atem:parameter>"),
            "
          ",
            new SpecialTokensText("</atem:invoke>"),
            "
          ",
            new SpecialTokensText("</atem:function_calls>"),
            "

          # Valid recipients: "self", "get_weather.*", "user".",
            new SpecialTokensText("<|eot|><|start|>user<|message|>"),
            "What is the weather?",
            new SpecialTokensText("<|eot|><|start|>assistant to=self<|message|>"),
            "I should check the weather.",
            new SpecialTokensText("<|eom|><|start|>assistant to="),
            "get_weather",
            new SpecialTokensText("<|message|><atem:function_calls>
          <atem:invoke name=""),
            "get_weather",
            new SpecialTokensText("">
          <atem:parameter name="params">"),
            "{"city": "Tokyo", "includeForecast": false}",
            new SpecialTokensText("</atem:parameter>
          </atem:invoke>
          </atem:function_calls>"),
            new SpecialToken("EOT"),
            new SpecialTokensText("<|start|>tool "),
            "get_weather",
            new SpecialTokensText("<|message|><tool_output name=""),
            "get_weather",
            new SpecialTokensText("">
          "),
            "{"temperature": 24}",
            new SpecialTokensText("
          </tool_output>"),
            new SpecialToken("EOT"),
            new SpecialTokensText("<|start|>assistant to=user<|message|>"),
            "It is 24 degrees in Tokyo.",
          ])
        `);
    });
});
