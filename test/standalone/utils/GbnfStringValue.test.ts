import {describe, expect, test} from "vitest";
import {GbnfStringValue} from "../../../src/utils/gbnfJson/terminals/GbnfStringValue.js";
import {getGbnfGrammarForGbnfJsonSchema} from "../../../src/utils/gbnfJson/getGbnfGrammarForGbnfJsonSchema.js";


describe("utils", () => {
    describe("GbnfStringValue", () => {
        test("escapes backspace and form feed", () => {
            expect(new GbnfStringValue("a\bb").getGrammar()).toBe('"\\"a\\\\bb\\""');
            expect(new GbnfStringValue("a\fb").getGrammar()).toBe('"\\"a\\\\fb\\""');
        });

        test("escapes the other control characters as \\u00XX", () => {
            expect(new GbnfStringValue("a\u0000b").getGrammar()).toBe('"\\"a\\\\u0000b\\""');
            expect(new GbnfStringValue("a\u0001b").getGrammar()).toBe('"\\"a\\\\u0001b\\""');
            expect(new GbnfStringValue("a\u000bb").getGrammar()).toBe('"\\"a\\\\u000bb\\""');
            expect(new GbnfStringValue("a\u001bb").getGrammar()).toBe('"\\"a\\\\u001bb\\""');
            expect(new GbnfStringValue("a\u001fb").getGrammar()).toBe('"\\"a\\\\u001fb\\""');
        });

        test("keeps the existing escaping of tab, carriage return, line feed, quote and backslash", () => {
            expect(new GbnfStringValue("t\tr\rn\nq\"b\\").getGrammar()).toBe('"\\"t\\\\tr\\\\rn\\\\nq\\\\\\"b\\\\\\\\\\""');
        });

        test("does not escape characters that are valid in a JSON string", () => {
            expect(new GbnfStringValue("a b\u007fé ").getGrammar()).toBe('"\\"a b\u007fé \\""');
        });

        test("enum, const and property names with control characters in a JSON schema grammar", () => {
            const enumGrammar = getGbnfGrammarForGbnfJsonSchema({enum: ["a\bb"]});
            expect(enumGrammar).toContain('val0 ::= "\\"a\\\\bb\\""');
            expect(enumGrammar).not.toMatch(/\u0008/);

            const constGrammar = getGbnfGrammarForGbnfJsonSchema({const: "x\u001f"});
            expect(constGrammar).toContain('"\\"x\\\\u001f\\""');
            expect(constGrammar.includes(String.fromCharCode(0x1f))).toBe(false);

            const objectGrammar = getGbnfGrammarForGbnfJsonSchema({
                type: "object",
                properties: {
                    "k\f": {type: "string"}
                }
            });
            expect(objectGrammar).toContain('"\\"k\\\\f\\""');
            expect(objectGrammar).not.toMatch(/\u000c/);
        });
    });
});
