import {describe, expect, test} from "vitest";
import {
    templateSegmentOptionsToChatWrapperSettings
} from "../../../../../src/chatWrappers/generic/utils/templateSegmentOptionsToChatWrapperSettings.js";


describe("getChatWrapperSegmentsOptionsFromTemplateOption", () => {
    test("no options", () => {
        expect(templateSegmentOptionsToChatWrapperSettings()).to.eql({});
        expect(templateSegmentOptionsToChatWrapperSettings(undefined)).to.eql({});
        expect(templateSegmentOptionsToChatWrapperSettings({})).to.eql({});
    });

    test("no thought content", () => {
        try {
            templateSegmentOptionsToChatWrapperSettings({
                thoughtTemplate: "text" as any
            });
            expect.unreachable("Parsing a thought template without a prefix should throw an error");
        } catch (err) {
            expect(err).toMatchInlineSnapshot('[Error: Template must contain "{{content}}" at the beginning]');
        }
    });

    test("no thought prefix", () => {
        try {
            templateSegmentOptionsToChatWrapperSettings({
                thoughtTemplate: "{{content}}suffix"
            });
            expect.unreachable("Parsing a thought template without a prefix should throw an error");
        } catch (err) {
            expect(err).toMatchInlineSnapshot('[Error: Thought template must have text before "{{content}}"]');
        }
    });

    test("valid thought prefix", () => {
        expect(templateSegmentOptionsToChatWrapperSettings({
            thoughtTemplate: "prefix{{content}}"
        })).to.eql({
            thought: {
                prefix: "prefix"
            }
        });
    });

    test("valid thought suffix", () => {
        expect(templateSegmentOptionsToChatWrapperSettings({
            thoughtTemplate: "prefix{{content}}suffix"
        })).to.eql({
            thought: {
                prefix: "prefix",
                suffix: "suffix"
            }
        });
    });

    test("reopenThoughtAfterFunctionCalls", () => {
        expect(templateSegmentOptionsToChatWrapperSettings({
            thoughtTemplate: "prefix{{content}}suffix",
            reopenThoughtAfterFunctionCalls: true
        })).to.eql({
            thought: {
                prefix: "prefix",
                suffix: "suffix",
                reopenAfterFunctionCalls: true
            }
        });
    });

    test("closeAllSegmentsTemplate", () => {
        expect(templateSegmentOptionsToChatWrapperSettings({
            thoughtTemplate: "prefix{{content}}suffix",
            reopenThoughtAfterFunctionCalls: true,
            closeAllSegmentsTemplate: "closeAll"
        })).to.eql({
            closeAllSegments: "closeAll",
            thought: {
                prefix: "prefix",
                suffix: "suffix",
                reopenAfterFunctionCalls: true
            }
        });
    });

    test("empty closeAllSegmentsTemplate", () => {
        expect(templateSegmentOptionsToChatWrapperSettings({
            thoughtTemplate: "prefix{{content}}suffix",
            reopenThoughtAfterFunctionCalls: true,
            closeAllSegmentsTemplate: ""
        })).to.eql({
            thought: {
                prefix: "prefix",
                suffix: "suffix",
                reopenAfterFunctionCalls: true
            }
        });
    });

    test("reiterateStackAfterFunctionCalls", () => {
        expect(templateSegmentOptionsToChatWrapperSettings({
            thoughtTemplate: "prefix{{content}}suffix",
            reopenThoughtAfterFunctionCalls: true,
            closeAllSegmentsTemplate: "closeAll",
            reiterateStackAfterFunctionCalls: true
        })).to.eql({
            closeAllSegments: "closeAll",
            reiterateStackAfterFunctionCalls: true,
            thought: {
                prefix: "prefix",
                suffix: "suffix",
                reopenAfterFunctionCalls: true
            }
        });
    });
});
