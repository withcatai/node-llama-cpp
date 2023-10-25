import {describe, expect, test, expectTypeOf} from "vitest";
import {LlamaJsonSchemaGrammar} from "../../../src/index.js";


describe("grammar for JSON schema", () => {
    test("object", () => {
        const grammar = new LlamaJsonSchemaGrammar({
            type: "object",
            properties: {
                "message": {
                    type: ["string", "null"]
                },
                "numberOfWordsInMessage": {
                    type: "integer"
                },
                "feelingGoodPercentage": {
                    type: ["number"]
                },
                "feelingGood": {
                    type: "boolean"
                },
                "feelingOverall": {
                    enum: ["good", "bad"]
                },
                "verbsInMessage": {
                    type: "array",
                    items: {
                        type: "string"
                    }
                }
            }
        } as const);
        type schemaType = {
            "message": string | null,
            "numberOfWordsInMessage": number,
            "feelingGoodPercentage": number,
            "feelingGood": boolean,
            "feelingOverall": "good" | "bad",
            "verbsInMessage": string[]
        };
        const exampleValidValue = {
            "message": "Hello, world!",
            "numberOfWordsInMessage": 3,
            "feelingGoodPercentage": 0.5,
            "feelingGood": true,
            "feelingOverall": "good",
            "verbsInMessage": ["Hello", "world"]
        };
        const exampleValidValue2 = {
            "message": null,
            "numberOfWordsInMessage": 3,
            "feelingGoodPercentage": 0.5,
            "feelingGood": false,
            "feelingOverall": "bad",
            "verbsInMessage": ["Hello", "world"]
        };
        const exampleInvalidValue = {
            "message": "Hello, world!",
            "numberOfWordsInMessage": 3,
            "feelingGoodPercentage": 0.5,
            "feelingGood": true,
            "feelingOverall": "good",
            "verbsInMessage": ["Hello", 10]
        };
        const exampleInvalidValue2 = {
            "message": "Hello, world!",
            "numberOfWordsInMessage": 3,
            "feelingGoodPercentage": 0.5,
            "feelingGood": true,
            "feelingOverall": "average",
            "verbsInMessage": ["Hello", "world"]
        };
        const exampleInvalidValue3 = {
            "message": "Hello, world!",
            "numberOfWordsInMessage": 3,
            "feelingGoodPercentage": 0.5,
            "feelingGood": true,
            "feelingOverall": "good",
            "verbsInMessage": ["Hello", "world", true]
        };
        const exampleInvalidValue4 = {
            "message": "Hello, world!",
            "numberOfWordsInMessage": 3,
            "feelingGoodPercentage": 0.5,
            "feelingGood": true,
            "feelingOverall": "good",
            "verbsInMessage": ["Hello", "world", {}]
        };
        const exampleInvalidValue5 = {
            "message": "Hello, world!",
            "numberOfWordsInMessage": 3,
            "feelingGoodPercentage": 0.5,
            "feelingGood": true,
            "feelingOverall": "good",
            "verbsInMessage": ["Hello", "world", null]
        };
        const exampleInvalidValue6 = {
            "message": false,
            "numberOfWordsInMessage": 3,
            "feelingGoodPercentage": 0.5,
            "feelingGood": true,
            "feelingOverall": "good",
            "verbsInMessage": ["Hello", "world"]
        };

        expect(grammar.grammar).toMatchInlineSnapshot(`
          "root ::= \\"{\\" whitespace-new-lines-rule \\"\\\\\\"message\\\\\\"\\" \\":\\" [ ]? rule0 \\",\\" whitespace-new-lines-rule \\"\\\\\\"numberOfWordsInMessage\\\\\\"\\" \\":\\" [ ]? integer-number-rule \\",\\" whitespace-new-lines-rule \\"\\\\\\"feelingGoodPercentage\\\\\\"\\" \\":\\" [ ]? fractional-number-rule \\",\\" whitespace-new-lines-rule \\"\\\\\\"feelingGood\\\\\\"\\" \\":\\" [ ]? boolean-rule \\",\\" whitespace-new-lines-rule \\"\\\\\\"feelingOverall\\\\\\"\\" \\":\\" [ ]? rule5 \\",\\" whitespace-new-lines-rule \\"\\\\\\"verbsInMessage\\\\\\"\\" \\":\\" [ ]? rule6 whitespace-new-lines-rule \\"}\\" [\\\\n] [\\\\n] [\\\\n] [\\\\n] [\\\\n]*
          whitespace-new-lines-rule ::= [\\\\n]? [ \\\\t]* [\\\\n]?
          string-rule ::= \\"\\\\\\"\\" ( [^\\"\\\\\\\\] | \\"\\\\\\\\\\" ([\\"\\\\\\\\/bfnrt] | \\"u\\" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]))* \\"\\\\\\"\\"
          null-rule ::= \\"null\\"
          rule0 ::= ( string-rule | null-rule )
          integer-number-rule ::= (\\"-\\"? ([0-9] | [1-9] [0-9]*))
          fractional-number-rule ::= (\\"-\\"? ([0-9] | [1-9] [0-9]*)) (\\".\\" [0-9]+)? ([eE] [-+]? [0-9]+)?
          rule1 ::= \\"true\\"
          rule2 ::= \\"false\\"
          boolean-rule ::= ( rule1 | rule2 )
          rule3 ::= \\"\\\\\\"good\\\\\\"\\"
          rule4 ::= \\"\\\\\\"bad\\\\\\"\\"
          rule5 ::= ( rule3 | rule4 )
          rule7 ::= ( string-rule ) ( \\",\\" whitespace-new-lines-rule string-rule )*
          rule8 ::= ( string-rule )?
          rule6 ::= \\"[\\" whitespace-new-lines-rule ( rule7 | rule8 ) whitespace-new-lines-rule \\"]\\""
        `);

        const parsedValue = grammar.parse(JSON.stringify(exampleValidValue));

        expectTypeOf(parsedValue).toMatchTypeOf<schemaType>();
        expect(parsedValue).toEqual(exampleValidValue);

        const parsedValue2 = grammar.parse(JSON.stringify(exampleValidValue2));

        expectTypeOf(parsedValue2).toMatchTypeOf<schemaType>();
        expect(parsedValue2).toEqual(exampleValidValue2);

        try {
            grammar.parse(JSON.stringify(exampleInvalidValue));
            expect.unreachable("Parsing should have failed");
        } catch (err) {
            expect(err).toMatchInlineSnapshot('[Error: Expected "string" but got "number"]');
        }

        try {
            grammar.parse(JSON.stringify(exampleInvalidValue2));
            expect.unreachable("Parsing should have failed");
        } catch (err) {
            expect(err).toMatchInlineSnapshot('[Error: Expected one of ["good", "bad"] but got "average"]');
        }

        try {
            grammar.parse(JSON.stringify(exampleInvalidValue3));
            expect.unreachable("Parsing should have failed");
        } catch (err) {
            expect(err).toMatchInlineSnapshot('[Error: Expected "string" but got "boolean"]');
        }

        try {
            grammar.parse(JSON.stringify(exampleInvalidValue4));
            expect.unreachable("Parsing should have failed");
        } catch (err) {
            expect(err).toMatchInlineSnapshot('[Error: Expected "string" but got "object"]');
        }

        try {
            grammar.parse(JSON.stringify(exampleInvalidValue5));
            expect.unreachable("Parsing should have failed");
        } catch (err) {
            expect(err).toMatchInlineSnapshot('[Error: Expected "string" but got "null"]');
        }

        try {
            grammar.parse(JSON.stringify(exampleInvalidValue6));
            expect.unreachable("Parsing should have failed");
        } catch (err) {
            expect(err).toMatchInlineSnapshot('[Error: Expected one type of ["string", "null"] but got type "boolean"]');
        }
    });

    test("array", () => {
        const grammar = new LlamaJsonSchemaGrammar({
            type: "array",
            items: {
                oneOf: [{
                    type: "object",
                    properties: {
                        "message": {
                            type: "string"
                        }
                    }
                }, {
                    type: "string"
                }]
            }
        } as const);
        type schemaType = Array<{
            "message": string
        } | string>;
        const exampleValidValue = [{
            "message": "Hello, world!"
        }];
        const exampleValidValue2 = ["Hello, world!"];

        const exampleInvalidValue = [{
            "message": "Hello, world!"
        }, 10];
        const exampleInvalidValue2 = {
            "message": "Hello, world!"
        };

        expect(grammar.grammar).toMatchInlineSnapshot(`
          "root ::= \\"[\\" whitespace-new-lines-rule ( rule2 | rule3 ) whitespace-new-lines-rule \\"]\\" [\\\\n] [\\\\n] [\\\\n] [\\\\n] [\\\\n]*
          whitespace-new-lines-rule ::= [\\\\n]? [ \\\\t]* [\\\\n]?
          string-rule ::= \\"\\\\\\"\\" ( [^\\"\\\\\\\\] | \\"\\\\\\\\\\" ([\\"\\\\\\\\/bfnrt] | \\"u\\" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]))* \\"\\\\\\"\\"
          rule0 ::= \\"{\\" whitespace-new-lines-rule \\"\\\\\\"message\\\\\\"\\" \\":\\" [ ]? string-rule whitespace-new-lines-rule \\"}\\"
          rule1 ::= ( rule0 | string-rule )
          rule2 ::= ( rule1 ) ( \\",\\" whitespace-new-lines-rule rule1 )*
          rule3 ::= ( rule1 )?"
        `);

        const parsedValue = grammar.parse(JSON.stringify(exampleValidValue));

        expectTypeOf(parsedValue).toMatchTypeOf<schemaType>();
        expect(parsedValue).toEqual(exampleValidValue);

        const parsedValue2 = grammar.parse(JSON.stringify(exampleValidValue2));

        expectTypeOf(parsedValue2).toMatchTypeOf<schemaType>();
        expect(parsedValue2).toEqual(exampleValidValue2);

        try {
            grammar.parse(JSON.stringify(exampleInvalidValue));
            expect.unreachable("Parsing should have failed");
        } catch (err) {
            expect(err).toMatchInlineSnapshot('[Error: Expected "string" but got "number"]');
        }

        try {
            grammar.parse(JSON.stringify(exampleInvalidValue2));
            expect.unreachable("Parsing should have failed");
        } catch (err) {
            expect(err).toMatchInlineSnapshot('[Error: Expected an array but got "object"]');
        }
    });

    test("const", () => {
        const grammar = new LlamaJsonSchemaGrammar({
            type: "object",
            properties: {
                "onlyPositiveText": {
                    const: true
                },
                "onlyNegativeText": {
                    const: false
                },
                "onlyVibe": {
                    const: "good"
                },
                "onlyNumber": {
                    const: 10
                },
                "worstThing": {
                    const: null
                },
                "withNewLine": {
                    const: "Hooray!\nYes!\t/\\"
                },
                "withQuotes": {
                    const: 'The message is "Hi!".'
                }
            }
        } as const);
        type schemaType = {
            "onlyPositiveText": true,
            "onlyNegativeText": false,
            "onlyVibe": "good",
            "onlyNumber": 10,
            "worstThing": null,
            "withNewLine": "Hooray!\nYes!\t/\\",
            "withQuotes": 'The message is "Hi!".'
        };
        const exampleValidValue = {
            "onlyPositiveText": true,
            "onlyNegativeText": false,
            "onlyVibe": "good",
            "onlyNumber": 10,
            "worstThing": null,
            "withNewLine": "Hooray!\nYes!\t/\\",
            "withQuotes": 'The message is "Hi!".'
        };
        const exampleInvalidValue = {
            "onlyPositiveText": true,
            "onlyNegativeText": false,
            "onlyVibe": "good",
            "onlyNumber": 10.1,
            "worstThing": null,
            "withNewLine": "Hooray!\nYes!\t/\\",
            "withQuotes": 'The message is "Hi!".'
        };

        expect(grammar.grammar).toMatchInlineSnapshot(`
          "root ::= \\"{\\" whitespace-new-lines-rule \\"\\\\\\"onlyPositiveText\\\\\\"\\" \\":\\" [ ]? \\"true\\" \\",\\" whitespace-new-lines-rule \\"\\\\\\"onlyNegativeText\\\\\\"\\" \\":\\" [ ]? \\"false\\" \\",\\" whitespace-new-lines-rule \\"\\\\\\"onlyVibe\\\\\\"\\" \\":\\" [ ]? rule0 \\",\\" whitespace-new-lines-rule \\"\\\\\\"onlyNumber\\\\\\"\\" \\":\\" [ ]? \\"10\\" \\",\\" whitespace-new-lines-rule \\"\\\\\\"worstThing\\\\\\"\\" \\":\\" [ ]? null-rule \\",\\" whitespace-new-lines-rule \\"\\\\\\"withNewLine\\\\\\"\\" \\":\\" [ ]? rule1 \\",\\" whitespace-new-lines-rule \\"\\\\\\"withQuotes\\\\\\"\\" \\":\\" [ ]? rule2 whitespace-new-lines-rule \\"}\\" [\\\\n] [\\\\n] [\\\\n] [\\\\n] [\\\\n]*
          whitespace-new-lines-rule ::= [\\\\n]? [ \\\\t]* [\\\\n]?
          rule0 ::= \\"\\\\\\"good\\\\\\"\\"
          null-rule ::= \\"null\\"
          rule1 ::= \\"\\\\\\"Hooray!\\\\nYes!\\\\t/\\\\\\\\\\\\\\"\\"
          rule2 ::= \\"\\\\\\"The message is \\\\\\\\\\\\\\"Hi!\\\\\\\\\\\\\\".\\\\\\"\\""
        `);

        const parsedValue = grammar.parse(JSON.stringify(exampleValidValue));

        expectTypeOf(parsedValue).toMatchTypeOf<schemaType>();
        expect(parsedValue).toEqual(exampleValidValue);

        try {
            grammar.parse(JSON.stringify(exampleInvalidValue));
            expect.unreachable("Parsing should have failed");
        } catch (err) {
            expect(err).toMatchInlineSnapshot("[Error: Expected 10 but got 10.1]");
        }
    });

    test("missing keys", () => {
        const grammar = new LlamaJsonSchemaGrammar({
            type: "object",
            properties: {
                "onlyPositiveText": {
                    const: true
                },
                "onlyNegativeText": {
                    const: false
                },
                "onlyVibe": {
                    const: "good"
                },
                "onlyNumber": {
                    const: 10
                },
                "worstThing": {
                    const: null
                },
                "withNewLine": {
                    const: "Hooray!\nYes!\t/\\"
                },
                "withQuotes": {
                    const: 'The message is "Hi!".'
                }
            }
        } as const);
        type schemaType = {
            "onlyPositiveText": true,
            "onlyNegativeText": false,
            "onlyVibe": "good",
            "onlyNumber": 10,
            "worstThing": null,
            "withNewLine": "Hooray!\nYes!\t/\\",
            "withQuotes": 'The message is "Hi!".'
        };
        const exampleValidValue = {
            "onlyPositiveText": true,
            "onlyNegativeText": false,
            "onlyVibe": "good",
            "onlyNumber": 10,
            "worstThing": null,
            "withNewLine": "Hooray!\nYes!\t/\\",
            "withQuotes": 'The message is "Hi!".'
        };
        const exampleInvalidValue = {
            "onlyPositiveText": true,
            "onlyNegativeText": false,
            // "onlyVibe": "good",
            "onlyNumber": 10,
            "worstThing": null,
            "withNewLine": "Hooray!\nYes!\t/\\",
            "withQuotes": 'The message is "Hi!".'
        };

        expect(grammar.grammar).toMatchInlineSnapshot(`
          "root ::= \\"{\\" whitespace-new-lines-rule \\"\\\\\\"onlyPositiveText\\\\\\"\\" \\":\\" [ ]? \\"true\\" \\",\\" whitespace-new-lines-rule \\"\\\\\\"onlyNegativeText\\\\\\"\\" \\":\\" [ ]? \\"false\\" \\",\\" whitespace-new-lines-rule \\"\\\\\\"onlyVibe\\\\\\"\\" \\":\\" [ ]? rule0 \\",\\" whitespace-new-lines-rule \\"\\\\\\"onlyNumber\\\\\\"\\" \\":\\" [ ]? \\"10\\" \\",\\" whitespace-new-lines-rule \\"\\\\\\"worstThing\\\\\\"\\" \\":\\" [ ]? null-rule \\",\\" whitespace-new-lines-rule \\"\\\\\\"withNewLine\\\\\\"\\" \\":\\" [ ]? rule1 \\",\\" whitespace-new-lines-rule \\"\\\\\\"withQuotes\\\\\\"\\" \\":\\" [ ]? rule2 whitespace-new-lines-rule \\"}\\" [\\\\n] [\\\\n] [\\\\n] [\\\\n] [\\\\n]*
          whitespace-new-lines-rule ::= [\\\\n]? [ \\\\t]* [\\\\n]?
          rule0 ::= \\"\\\\\\"good\\\\\\"\\"
          null-rule ::= \\"null\\"
          rule1 ::= \\"\\\\\\"Hooray!\\\\nYes!\\\\t/\\\\\\\\\\\\\\"\\"
          rule2 ::= \\"\\\\\\"The message is \\\\\\\\\\\\\\"Hi!\\\\\\\\\\\\\\".\\\\\\"\\""
        `);

        const parsedValue = grammar.parse(JSON.stringify(exampleValidValue));

        expectTypeOf(parsedValue).toMatchTypeOf<schemaType>();
        expect(parsedValue).toEqual(exampleValidValue);

        try {
            grammar.parse(JSON.stringify(exampleInvalidValue));
            expect.unreachable("Parsing should have failed");
        } catch (err) {
            expect(err).toMatchInlineSnapshot('[Error: Missing keys: "onlyVibe"]');
        }
    });

    test("unexpected keys", () => {
        const grammar = new LlamaJsonSchemaGrammar({
            type: "object",
            properties: {
                "onlyPositiveText": {
                    const: true
                },
                "onlyNegativeText": {
                    const: false
                },
                "onlyVibe": {
                    const: "good"
                },
                "onlyNumber": {
                    const: 10
                },
                "worstThing": {
                    const: null
                },
                "withNewLine": {
                    const: "Hooray!\nYes!\t/\\"
                },
                "withQuotes": {
                    const: 'The message is "Hi!".'
                }
            }
        } as const);
        type schemaType = {
            "onlyPositiveText": true,
            "onlyNegativeText": false,
            "onlyVibe": "good",
            "onlyNumber": 10,
            "worstThing": null,
            "withNewLine": "Hooray!\nYes!\t/\\",
            "withQuotes": 'The message is "Hi!".'
        };
        const exampleValidValue = {
            "onlyPositiveText": true,
            "onlyNegativeText": false,
            "onlyVibe": "good",
            "onlyNumber": 10,
            "worstThing": null,
            "withNewLine": "Hooray!\nYes!\t/\\",
            "withQuotes": 'The message is "Hi!".'
        };
        const exampleInvalidValue = {
            "onlyPositiveText": true,
            "onlyNegativeText": false,
            "onlyVibe": "good",
            "onlyFeeling": "good", // unexpected key
            "onlyNumber": 10,
            "worstThing": null,
            "withNewLine": "Hooray!\nYes!\t/\\",
            "withQuotes": 'The message is "Hi!".'
        };

        expect(grammar.grammar).toMatchInlineSnapshot(`
          "root ::= \\"{\\" whitespace-new-lines-rule \\"\\\\\\"onlyPositiveText\\\\\\"\\" \\":\\" [ ]? \\"true\\" \\",\\" whitespace-new-lines-rule \\"\\\\\\"onlyNegativeText\\\\\\"\\" \\":\\" [ ]? \\"false\\" \\",\\" whitespace-new-lines-rule \\"\\\\\\"onlyVibe\\\\\\"\\" \\":\\" [ ]? rule0 \\",\\" whitespace-new-lines-rule \\"\\\\\\"onlyNumber\\\\\\"\\" \\":\\" [ ]? \\"10\\" \\",\\" whitespace-new-lines-rule \\"\\\\\\"worstThing\\\\\\"\\" \\":\\" [ ]? null-rule \\",\\" whitespace-new-lines-rule \\"\\\\\\"withNewLine\\\\\\"\\" \\":\\" [ ]? rule1 \\",\\" whitespace-new-lines-rule \\"\\\\\\"withQuotes\\\\\\"\\" \\":\\" [ ]? rule2 whitespace-new-lines-rule \\"}\\" [\\\\n] [\\\\n] [\\\\n] [\\\\n] [\\\\n]*
          whitespace-new-lines-rule ::= [\\\\n]? [ \\\\t]* [\\\\n]?
          rule0 ::= \\"\\\\\\"good\\\\\\"\\"
          null-rule ::= \\"null\\"
          rule1 ::= \\"\\\\\\"Hooray!\\\\nYes!\\\\t/\\\\\\\\\\\\\\"\\"
          rule2 ::= \\"\\\\\\"The message is \\\\\\\\\\\\\\"Hi!\\\\\\\\\\\\\\".\\\\\\"\\""
        `);

        const parsedValue = grammar.parse(JSON.stringify(exampleValidValue));

        expectTypeOf(parsedValue).toMatchTypeOf<schemaType>();
        expect(parsedValue).toEqual(exampleValidValue);

        try {
            grammar.parse(JSON.stringify(exampleInvalidValue));
            expect.unreachable("Parsing should have failed");
        } catch (err) {
            expect(err).toMatchInlineSnapshot('[Error: Unexpected keys: "onlyFeeling"]');
        }
    });
});
