import {describe, expect, test} from "vitest";
import {GbnfStringValue} from "../../../src/utils/gbnfJson/terminals/GbnfStringValue.js";
import {getGbnfGrammarForGbnfJsonSchema} from "../../../src/utils/gbnfJson/getGbnfGrammarForGbnfJsonSchema.js";


// the grammar literal for a string value is the JSON representation of the value,
// with `\` and `"` escaped again, since it is placed inside a GBNF string literal
function getExpectedGrammarLiteral(value: string) {
    return '"' + JSON.stringify(value).replaceAll("\\", "\\\\")
        .replaceAll('"', '\\"') + '"';
}

// reverses the escaping of a GBNF string literal, to get the text that the grammar makes the model generate
function getGeneratedTextOfGrammarLiteral(literal: string) {
    return literal.slice(1, -1).replaceAll('\\"', '"')
        .replaceAll("\\\\", "\\");
}

const rawControlCharacterRegex = /[\u0000-\u001f]/;

describe("utils", () => {
    describe("GbnfStringValue", () => {
        test("escapes backspace and form feed", () => {
            expect(new GbnfStringValue("a\bb").getGrammar()).toBe(getExpectedGrammarLiteral("a\bb"));
            expect(new GbnfStringValue("a\fb").getGrammar()).toBe(getExpectedGrammarLiteral("a\fb"));
            expect(new GbnfStringValue("a\bb").getGrammar()).toBe('"\\"a\\\\bb\\""');
            expect(new GbnfStringValue("a\fb").getGrammar()).toBe('"\\"a\\\\fb\\""');
        });

        test("escapes the other control characters as \\u00XX", () => {
            expect(new GbnfStringValue("a\u0000b").getGrammar()).toBe('"\\"a\\\\u0000b\\""');
            expect(new GbnfStringValue("a\u0001b").getGrammar()).toBe('"\\"a\\\\u0001b\\""');
            expect(new GbnfStringValue("a\u001fb").getGrammar()).toBe('"\\"a\\\\u001fb\\""');
        });

        test("keeps the existing escaping of tab, carriage return, line feed, quote and backslash", () => {
            const value = "t\tr\rn\nq\"b\\";

            expect(new GbnfStringValue(value).getGrammar()).toBe(getExpectedGrammarLiteral(value));
        });

        test("does not escape characters that are valid in a JSON string", () => {
            expect(new GbnfStringValue("a b\u007fé ").getGrammar()).toBe('"\\"a b\u007fé \\""');
        });

        test("every control character is escaped the same way JSON.stringify does and has no raw form in the grammar", () => {
            for (let code = 0; code < 0x20; code++) {
                const value = "a" + String.fromCharCode(code) + "b";
                const grammarLiteral = new GbnfStringValue(value).getGrammar();

                expect(grammarLiteral).not.toMatch(rawControlCharacterRegex);
                expect(grammarLiteral).toBe(getExpectedGrammarLiteral(value));
                expect(JSON.parse(getGeneratedTextOfGrammarLiteral(grammarLiteral))).toBe(value);
            }
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
