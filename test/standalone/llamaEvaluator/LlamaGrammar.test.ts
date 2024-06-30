import {describe, expect, test, expectTypeOf} from "vitest";
import {LlamaJsonSchemaGrammar} from "../../../src/index.js";
import {getTestLlama} from "../../utils/getTestLlama.js";


describe("grammar for JSON schema", () => {
    test("object", async () => {
        const llama = await getTestLlama();
        const grammar = new LlamaJsonSchemaGrammar(llama, {
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
          "root ::= "{" whitespace-b-1-4-rule "\\"message\\"" ":" [ ]? rule0 "," whitespace-b-1-4-rule "\\"numberOfWordsInMessage\\"" ":" [ ]? integer-number-rule "," whitespace-b-1-4-rule "\\"feelingGoodPercentage\\"" ":" [ ]? fractional-number-rule "," whitespace-b-1-4-rule "\\"feelingGood\\"" ":" [ ]? boolean-rule "," whitespace-b-1-4-rule "\\"feelingOverall\\"" ":" [ ]? rule5 "," whitespace-b-1-4-rule "\\"verbsInMessage\\"" ":" [ ]? rule6 whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
          whitespace-b-1-4-rule ::= ([\\n] ("    " | "\\t") | [ ]?)
          string-rule ::= "\\"" ([^"\\\\\\x7F\\x00-\\x1F] | "\\\\" (["\\\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]))* "\\""
          null-rule ::= "null"
          rule0 ::= ( string-rule | null-rule )
          integer-number-rule ::= ("-"? ([0-9] | [1-9] [0-9]*))
          fractional-number-rule ::= ("-"? ([0-9] | [1-9] [0-9]*)) ("." [0-9]+)? ([eE] [-+]? [0-9]+)?
          rule1 ::= "true"
          rule2 ::= "false"
          boolean-rule ::= ( rule1 | rule2 )
          rule3 ::= "\\"good\\""
          rule4 ::= "\\"bad\\""
          rule5 ::= ( rule3 | rule4 )
          whitespace-b-2-4-rule ::= ([\\n] ("        " | "\\t\\t") | [ ]?)
          rule7 ::= ( string-rule ) ( "," whitespace-b-2-4-rule string-rule )*
          rule8 ::= ( string-rule )?
          rule6 ::= "[" whitespace-b-2-4-rule ( rule7 | rule8 ) whitespace-b-1-4-rule "]"
          whitespace-b-0-4-rule ::= ([\\n] | [ ]?)"
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

    test("array", async () => {
        const llama = await getTestLlama();
        const grammar = new LlamaJsonSchemaGrammar(llama, {
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
          "root ::= "[" whitespace-b-1-4-rule ( rule2 | rule3 ) whitespace-b-0-4-rule "]" "\\n\\n\\n\\n" [\\n]*
          whitespace-b-1-4-rule ::= ([\\n] ("    " | "\\t") | [ ]?)
          string-rule ::= "\\"" ([^"\\\\\\x7F\\x00-\\x1F] | "\\\\" (["\\\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]))* "\\""
          whitespace-b-0-4-rule ::= ([\\n] | [ ]?)
          rule0 ::= "{" whitespace-b-1-4-rule "\\"message\\"" ":" [ ]? string-rule whitespace-b-0-4-rule "}"
          rule1 ::= ( rule0 | string-rule )
          rule2 ::= ( rule1 ) ( "," whitespace-b-1-4-rule rule1 )*
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
            expect(err).toMatchInlineSnapshot("[Error: Expected one of 2 schemas but got 10]");
        }

        try {
            grammar.parse(JSON.stringify(exampleInvalidValue2));
            expect.unreachable("Parsing should have failed");
        } catch (err) {
            expect(err).toMatchInlineSnapshot('[Error: Expected an array but got "object"]');
        }
    });

    test("const", async () => {
        const llama = await getTestLlama();
        const grammar = new LlamaJsonSchemaGrammar(llama, {
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
          "root ::= "{" whitespace-b-1-4-rule "\\"onlyPositiveText\\"" ":" [ ]? "true" "," whitespace-b-1-4-rule "\\"onlyNegativeText\\"" ":" [ ]? "false" "," whitespace-b-1-4-rule "\\"onlyVibe\\"" ":" [ ]? rule0 "," whitespace-b-1-4-rule "\\"onlyNumber\\"" ":" [ ]? "10" "," whitespace-b-1-4-rule "\\"worstThing\\"" ":" [ ]? null-rule "," whitespace-b-1-4-rule "\\"withNewLine\\"" ":" [ ]? rule1 "," whitespace-b-1-4-rule "\\"withQuotes\\"" ":" [ ]? rule2 whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
          whitespace-b-1-4-rule ::= ([\\n] ("    " | "\\t") | [ ]?)
          rule0 ::= "\\"good\\""
          null-rule ::= "null"
          rule1 ::= "\\"Hooray!\\nYes!\\t/\\\\\\""
          rule2 ::= "\\"The message is \\\\\\"Hi!\\\\\\".\\""
          whitespace-b-0-4-rule ::= ([\\n] | [ ]?)"
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

    test("missing keys", async () => {
        const llama = await getTestLlama();
        const grammar = new LlamaJsonSchemaGrammar(llama, {
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
          "root ::= "{" whitespace-b-1-4-rule "\\"onlyPositiveText\\"" ":" [ ]? "true" "," whitespace-b-1-4-rule "\\"onlyNegativeText\\"" ":" [ ]? "false" "," whitespace-b-1-4-rule "\\"onlyVibe\\"" ":" [ ]? rule0 "," whitespace-b-1-4-rule "\\"onlyNumber\\"" ":" [ ]? "10" "," whitespace-b-1-4-rule "\\"worstThing\\"" ":" [ ]? null-rule "," whitespace-b-1-4-rule "\\"withNewLine\\"" ":" [ ]? rule1 "," whitespace-b-1-4-rule "\\"withQuotes\\"" ":" [ ]? rule2 whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
          whitespace-b-1-4-rule ::= ([\\n] ("    " | "\\t") | [ ]?)
          rule0 ::= "\\"good\\""
          null-rule ::= "null"
          rule1 ::= "\\"Hooray!\\nYes!\\t/\\\\\\""
          rule2 ::= "\\"The message is \\\\\\"Hi!\\\\\\".\\""
          whitespace-b-0-4-rule ::= ([\\n] | [ ]?)"
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

    test("unexpected keys", async () => {
        const llama = await getTestLlama();
        const grammar = new LlamaJsonSchemaGrammar(llama, {
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
          "root ::= "{" whitespace-b-1-4-rule "\\"onlyPositiveText\\"" ":" [ ]? "true" "," whitespace-b-1-4-rule "\\"onlyNegativeText\\"" ":" [ ]? "false" "," whitespace-b-1-4-rule "\\"onlyVibe\\"" ":" [ ]? rule0 "," whitespace-b-1-4-rule "\\"onlyNumber\\"" ":" [ ]? "10" "," whitespace-b-1-4-rule "\\"worstThing\\"" ":" [ ]? null-rule "," whitespace-b-1-4-rule "\\"withNewLine\\"" ":" [ ]? rule1 "," whitespace-b-1-4-rule "\\"withQuotes\\"" ":" [ ]? rule2 whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
          whitespace-b-1-4-rule ::= ([\\n] ("    " | "\\t") | [ ]?)
          rule0 ::= "\\"good\\""
          null-rule ::= "null"
          rule1 ::= "\\"Hooray!\\nYes!\\t/\\\\\\""
          rule2 ::= "\\"The message is \\\\\\"Hi!\\\\\\".\\""
          whitespace-b-0-4-rule ::= ([\\n] | [ ]?)"
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
