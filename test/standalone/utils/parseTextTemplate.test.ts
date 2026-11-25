import {describe, expect, test} from "vitest";
import {parseTextTemplate} from "../../../src/utils/parseTextTemplate.js";


describe("utils", () => {
    describe("parseTextTemplate", () => {
        test.each(["{{name}}", "{{thing}}"])("rejects trailing duplicate %s", (part) => {
            expect(() => parseTextTemplate(
                `Hello, {{name}}! What is the {{thing}}? ${part} ignored text`,
                [{key: "name", text: "{{name}}"}, {key: "thing", text: "{{thing}}"}]
            )).toThrow(`Template must contain exactly one "${part}"`);
        });

        test("rejects a duplicate in a single-part template", () => {
            expect(() => parseTextTemplate(
                "{{message}} / {{message}} trailing text",
                [{key: "message", text: "{{message}}"}]
            )).toThrow('Template must contain exactly one "{{message}}"');
        });

        test("rejects a duplicate before a trailing optional part", () => {
            expect(() => parseTextTemplate(
                "{{name}} / {{name}} trailing text",
                [{key: "name", text: "{{name}}"}, {key: "thing", text: "{{thing}}", optional: true}]
            )).toThrow('Template must contain exactly one "{{name}}"');
        });

        test("rejects a skipped optional part after later parts", () => {
            expect(() => parseTextTemplate(
                "{{thing}} / {{name}} trailing text",
                [{key: "name", text: "{{name}}", optional: true}, {key: "thing", text: "{{thing}}"}]
            )).toThrow('Template must contain "{{name}}" before "{{thing}}"');
        });

        test("normal", async () => {
            const res = parseTextTemplate(
                "Hello, {{name}}! What is the {{thing}}?",
                [{
                    key: "name",
                    text: "{{name}}"
                }, {
                    key: "thing",
                    text: "{{thing}}"
                }]
            );
            expect(res).to.eql({
                name: {
                    prefix: "Hello, ",
                    suffix: "! What is the "
                },
                thing: {
                    prefix: "! What is the ",
                    suffix: "?"
                }
            });
        });

        test("optional param", async () => {
            const res2 = parseTextTemplate(
                "What is the {{thing}}?",
                [{
                    key: "name",
                    text: "{{name}}",
                    optional: true
                }, {
                    key: "thing",
                    text: "{{thing}}"
                }]
            );
            expect(res2).to.eql({
                name: undefined,
                thing: {
                    prefix: "What is the ",
                    suffix: "?"
                }
            });
        });

        test("throws when missing a part at the beginning", () => {
            try {
                parseTextTemplate(
                    "Hello there! What is the {{thing}}?",
                    [{
                        key: "name",
                        text: "{{name}}"
                    }, {
                        key: "thing",
                        text: "{{thing}}"
                    }]
                );
                expect.unreachable("Should have thrown an error");
            } catch (err) {
                expect(String(err)).to.eql('Error: Template must contain "{{name}}" at the beginning');
            }
        });

        test("throws when missing a part after a found part", () => {
            try {
                parseTextTemplate(
                    "Hello, {{name}}!",
                    [{
                        key: "name",
                        text: "{{name}}"
                    }, {
                        key: "thing",
                        text: "{{thing}}"
                    }]
                );
                expect.unreachable("Should have thrown an error");
            } catch (err) {
                expect(String(err)).to.eql('Error: Template must contain "{{thing}}" after "{{name}}"');
            }
        });

        test("throws when no parts are found", () => {
            try {
                parseTextTemplate(
                    "Hi!",
                    [{
                        key: "name",
                        text: "{{name}}"
                    }, {
                        key: "thing",
                        text: "{{thing}}"
                    }]
                );
                expect.unreachable("Should have thrown an error");
            } catch (err) {
                expect(String(err)).to.eql('Error: Template must contain "{{name}}" at the beginning');
            }
        });
    });
});
