import {describe, expect, test} from "vitest";
import {
    LlamaJsonSchemaValidationError, validateObjectAgainstGbnfSchema
} from "../../../src/utils/gbnfJson/utils/validateObjectAgainstGbnfSchema.js";
import {getGbnfGrammarForGbnfJsonSchema} from "../../../src/utils/gbnfJson/getGbnfGrammarForGbnfJsonSchema.js";


describe("utils", () => {
    describe("validateObjectAgainstGbnfSchema", () => {
        describe("format string", () => {
            test("time with a valid timezone offset", () => {
                const schema = {type: "string", format: "time"} as const;

                expect(validateObjectAgainstGbnfSchema("12:00:00Z", schema)).toBe(true);
                expect(validateObjectAgainstGbnfSchema("12:00:00+05:30", schema)).toBe(true);
                expect(validateObjectAgainstGbnfSchema("12:00:00.123-23:59", schema)).toBe(true);
            });

            test("time rejects a timezone offset without an hour", () => {
                const schema = {type: "string", format: "time"} as const;

                expect(() => validateObjectAgainstGbnfSchema("12:00:00+:30", schema)).toThrowError(LlamaJsonSchemaValidationError);
                expect(() => validateObjectAgainstGbnfSchema("12:00:00-:00", schema)).toThrowError(LlamaJsonSchemaValidationError);
                expect(() => validateObjectAgainstGbnfSchema("12:00:00+24:00", schema)).toThrowError(LlamaJsonSchemaValidationError);
            });

            test("date-time with a valid timezone offset", () => {
                const schema = {type: "string", format: "date-time"} as const;

                expect(validateObjectAgainstGbnfSchema("2024-01-01T10:00:00Z", schema)).toBe(true);
                expect(validateObjectAgainstGbnfSchema("2024-01-01T10:00:00-08:00", schema)).toBe(true);
            });

            test("date-time rejects a timezone offset without an hour", () => {
                const schema = {type: "string", format: "date-time"} as const;

                expect(() => validateObjectAgainstGbnfSchema("2024-01-01T10:00:00-:00", schema)).toThrowError(
                    LlamaJsonSchemaValidationError
                );
                expect(() => validateObjectAgainstGbnfSchema("2024-01-01T10:00:00+:30", schema)).toThrowError(
                    LlamaJsonSchemaValidationError
                );
            });

            test("the grammar requires an hour in the timezone offset as well", () => {
                for (const format of ["time", "date-time"] as const) {
                    const grammar = getGbnfGrammarForGbnfJsonSchema({type: "string", format});

                    expect(grammar).toContain('("+" | "-") ([01] [0-9] | "2" [0-3]) ":" [0-5] [0-9]');
                }
            });
        });

        describe("object", () => {
            test("accepts a plain object", () => {
                expect(validateObjectAgainstGbnfSchema({}, {type: "object", properties: {}})).toBe(true);
                expect(validateObjectAgainstGbnfSchema(
                    {a: "b"},
                    {type: "object", properties: {a: {type: "string"}}}
                )).toBe(true);
            });

            test("rejects an array", () => {
                const schema = {type: "object", properties: {}} as const;

                expect(() => validateObjectAgainstGbnfSchema([], schema)).toThrowError(LlamaJsonSchemaValidationError);
                expect(() => validateObjectAgainstGbnfSchema([1, 2], schema)).toThrowError(LlamaJsonSchemaValidationError);
                expect(() => validateObjectAgainstGbnfSchema([], schema)).toThrowError('Expected an object but got "array"');
            });

            test("rejects null and primitives", () => {
                const schema = {type: "object", properties: {}} as const;

                expect(() => validateObjectAgainstGbnfSchema(null, schema)).toThrowError('Expected an object but got "null"');
                expect(() => validateObjectAgainstGbnfSchema("a", schema)).toThrowError('Expected an object but got "string"');
            });

            test("an empty array does not satisfy a oneOf of an object and null", () => {
                const schema = {oneOf: [{type: "object", properties: {}}, {type: "null"}]} as const;

                expect(validateObjectAgainstGbnfSchema({}, schema)).toBe(true);
                expect(validateObjectAgainstGbnfSchema(null, schema)).toBe(true);
                expect(() => validateObjectAgainstGbnfSchema([], schema)).toThrowError(LlamaJsonSchemaValidationError);
            });

            test("the grammar of an object schema starts with an opening brace", () => {
                const grammar = getGbnfGrammarForGbnfJsonSchema({type: "object", properties: {}});

                expect(grammar).toMatch(/^root ::= "\{"/);
            });
        });
    });
});
