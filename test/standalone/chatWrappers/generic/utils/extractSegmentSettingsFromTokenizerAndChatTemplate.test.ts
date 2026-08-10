import {describe, expect, test} from "vitest";
import {JinjaTemplateChatWrapper} from "../../../../../src/index.js";
import {functionGemma270mJinjaTemplate, glm4_5airJinjaTemplate, glm4_7flashJinjaTemplate, LagunaXS2_1JinjaTemplate, lfm2_5JinjaTemplate} from "../../utils/jinjaTemplates.js";


describe("JinjaTemplateChatWrapper", () => {
    describe("extractSegmentSettingsFromTokenizerAndChatTemplate", () => {
        test("lfm2_5JinjaTemplate", () => {
            const chatWrapper = new JinjaTemplateChatWrapper({
                template: lfm2_5JinjaTemplate
            });
            expect(chatWrapper.settings.segments).toMatchInlineSnapshot(`
              {
                "thought": {
                  "prefix": LlamaText([
                    new SpecialTokensText("<think>"),
                  ]),
                  "suffix": LlamaText([
                    new SpecialTokensText("</think>"),
                  ]),
                },
              }
            `);
        });

        test("functionGemma270mJinjaTemplate", () => {
            const chatWrapper = new JinjaTemplateChatWrapper({
                template: functionGemma270mJinjaTemplate
            });
            expect(chatWrapper.settings.segments).toMatchInlineSnapshot("{}");
        });

        test("glm4_7flashJinjaTemplate", () => {
            const chatWrapper = new JinjaTemplateChatWrapper({
                template: glm4_7flashJinjaTemplate
            });
            expect(chatWrapper.settings.segments).toMatchInlineSnapshot(`
              {
                "thought": {
                  "prefix": LlamaText([
                    new SpecialTokensText("<think>"),
                  ]),
                  "suffix": LlamaText([
                    new SpecialTokensText("</think>"),
                  ]),
                },
              }
            `);
        });

        test("glm4_5airJinjaTemplate", () => {
            const chatWrapper = new JinjaTemplateChatWrapper({
                template: glm4_5airJinjaTemplate
            });
            expect(chatWrapper.settings.segments).toMatchInlineSnapshot(`
              {
                "thought": {
                  "openOnResponseStart": true,
                  "prefix": {
                    "type": "openedOnStart",
                  },
                  "reopenAfterFunctionCalls": true,
                  "suffix": LlamaText([
                    new SpecialTokensText("</think>
              "),
                  ]),
                },
              }
            `);
        });



        test("LagunaXS2_1JinjaTemplate", () => {
            const chatWrapper = new JinjaTemplateChatWrapper({
                template: LagunaXS2_1JinjaTemplate
            });
            expect(chatWrapper.settings.segments).toMatchInlineSnapshot(`
              {
                "thought": {
                  "openOnResponseStart": true,
                  "prefix": {
                    "type": "openedOnStart",
                  },
                  "reopenAfterFunctionCalls": true,
                  "suffix": LlamaText([
                    new SpecialTokensText("</think>"),
                  ]),
                },
              }
            `);
        });
    });
});
