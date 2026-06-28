import {describe, expect, test} from "vitest";
import {JinjaTemplateChatWrapper} from "../../../../../src/index.js";
import {functionGemma270mJinjaTemplate, glm4_5airJinjaTemplate, glm4_7flashJinjaTemplate, lfm2_5JinjaTemplate} from "../../utils/jinjaTemplates.js";


describe("JinjaTemplateChatWrapper", () => {
    describe("extractFunctionCallSettingsFromJinjaTemplate", () => {
        test("lfm2_5JinjaTemplate", () => {
            const chatWrapper = new JinjaTemplateChatWrapper({
                template: lfm2_5JinjaTemplate
            });
            expect(chatWrapper.settings.functions).toMatchInlineSnapshot(`
              {
                "call": {
                  "emptyCallParamsPlaceholder": {},
                  "optionalPrefixSpace": true,
                  "paramsPrefix": LlamaText([
                    new SpecialTokensText("(params="),
                  ]),
                  "prefix": LlamaText([]),
                  "suffix": LlamaText([
                    new SpecialTokensText(")"),
                  ]),
                },
                "parallelism": {
                  "call": {
                    "betweenCalls": LlamaText([
                      new SpecialTokensText(", "),
                    ]),
                    "sectionPrefix": LlamaText([
                      new SpecialTokensText("<|tool_call_start|>["),
                    ]),
                    "sectionPrefixAlternateMatches": undefined,
                    "sectionSuffix": LlamaText([
                      new SpecialTokensText("]<|tool_call_end|>"),
                    ]),
                  },
                  "result": {
                    "betweenResults": LlamaText([]),
                    "sectionPrefix": LlamaText([]),
                    "sectionSuffix": LlamaText([
                      new SpecialTokensText("assistant
              "),
                    ]),
                  },
                },
                "result": {
                  "prefix": LlamaText([
                    new SpecialTokensText("<|im_end|>
              <|im_start|>tool
              "),
                  ]),
                  "suffix": LlamaText([
                    new SpecialTokensText("<|im_end|>
              <|im_start|>"),
                  ]),
                },
              }
            `);
        });

        test("functionGemma270mJinjaTemplate", () => {
            const chatWrapper = new JinjaTemplateChatWrapper({
                template: functionGemma270mJinjaTemplate
            });
            expect(chatWrapper.settings.functions).toMatchInlineSnapshot(`
              {
                "call": {
                  "emptyCallParamsPlaceholder": {},
                  "optionalPrefixSpace": true,
                  "paramsPrefix": LlamaText([
                    new SpecialTokensText("{                    "),
                  ]),
                  "prefix": LlamaText([
                    new SpecialTokensText("<start_function_call>call:"),
                  ]),
                  "suffix": LlamaText([
                    new SpecialTokensText("}<end_function_call>"),
                  ]),
                },
                "parallelism": {
                  "call": {
                    "betweenCalls": LlamaText([]),
                    "sectionPrefix": LlamaText([]),
                    "sectionPrefixAlternateMatches": undefined,
                    "sectionSuffix": LlamaText([]),
                  },
                  "result": {
                    "betweenResults": LlamaText([]),
                    "sectionPrefix": LlamaText([]),
                    "sectionSuffix": LlamaText([]),
                  },
                },
                "result": {
                  "prefix": LlamaText([
                    new SpecialTokensText("<start_function_response>response:"),
                    "{{functionName}}",
                    new SpecialTokensText("{value:<escape>"),
                  ]),
                  "suffix": LlamaText([
                    new SpecialTokensText("<escape>}<end_function_response>"),
                  ]),
                },
              }
            `);
        });

        test("glm4_7flashJinjaTemplate", () => {
            const chatWrapper = new JinjaTemplateChatWrapper({
                template: glm4_7flashJinjaTemplate
            });
            expect(chatWrapper.settings.functions).toMatchInlineSnapshot(`
              {
                "call": {
                  "emptyCallParamsPlaceholder": {},
                  "optionalPrefixSpace": true,
                  "paramsPrefix": LlamaText([
                    new SpecialTokensText("<arg_key>params</arg_key><arg_value>"),
                  ]),
                  "prefix": LlamaText([
                    new SpecialTokensText("<tool_call>"),
                  ]),
                  "suffix": LlamaText([
                    new SpecialTokensText("</arg_value></tool_call>"),
                  ]),
                },
                "parallelism": {
                  "call": {
                    "betweenCalls": LlamaText([]),
                    "sectionPrefix": LlamaText([]),
                    "sectionPrefixAlternateMatches": undefined,
                    "sectionSuffix": LlamaText([
                      new SpecialTokensText("<|observation|"),
                    ]),
                  },
                  "result": {
                    "betweenResults": LlamaText([]),
                    "sectionPrefix": LlamaText([]),
                    "sectionSuffix": LlamaText([
                      new SpecialTokensText("|assistant|></think>"),
                    ]),
                  },
                },
                "result": {
                  "prefix": LlamaText([
                    new SpecialTokensText("><tool_response>"),
                  ]),
                  "suffix": LlamaText([
                    new SpecialTokensText("</tool_response><"),
                  ]),
                },
              }
            `);
        });

        test("glm4_5airJinjaTemplate", () => {
            const chatWrapper = new JinjaTemplateChatWrapper({
                template: glm4_5airJinjaTemplate
            });
            expect(chatWrapper.settings).toMatchInlineSnapshot(`
              {
                "functions": {
                  "call": {
                    "emptyCallParamsPlaceholder": {},
                    "optionalPrefixSpace": true,
                    "paramsPrefix": LlamaText([
                      new SpecialTokensText("
              <arg_key>params</arg_key>
              <arg_value>"),
                    ]),
                    "prefix": LlamaText([
                      new SpecialTokensText("<tool_call>"),
                    ]),
                    "suffix": LlamaText([
                      new SpecialTokensText("</arg_value>
              </tool_call>"),
                    ]),
                  },
                  "parallelism": {
                    "call": {
                      "betweenCalls": LlamaText([
                        new SpecialTokensText("
              "),
                      ]),
                      "sectionPrefix": LlamaText([]),
                      "sectionPrefixAlternateMatches": undefined,
                      "sectionSuffix": LlamaText([
                        new SpecialTokensText("<|observation|>"),
                      ]),
                    },
                    "result": {
                      "betweenResults": LlamaText([]),
                      "sectionPrefix": LlamaText([]),
                      "sectionSuffix": LlamaText([
                        new SpecialTokensText("<|assistant|>
              <think></think>
              "),
                      ]),
                    },
                  },
                  "result": {
                    "prefix": LlamaText([
                      new SpecialTokensText("
              <tool_response>
              "),
                    ]),
                    "suffix": LlamaText([
                      new SpecialTokensText("
              </tool_response>"),
                    ]),
                  },
                },
                "segments": {
                  "thought": {
                    "prefix": LlamaText([
                      new SpecialTokensText("<think>"),
                    ]),
                    "suffix": LlamaText([
                      new SpecialTokensText("</think>"),
                    ]),
                  },
                },
                "supportsSystemMessages": true,
              }
            `);
        });
    });
});
