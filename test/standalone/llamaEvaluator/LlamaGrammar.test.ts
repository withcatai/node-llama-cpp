import {describe, expect, test, expectTypeOf} from "vitest";
import {jsonDumps, LlamaJsonSchemaGrammar} from "../../../src/index.js";
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
          "root ::= "{" whitespace-b-1-4-rule "\\"message\\"" ":" [ ]? rule0 comma-whitespace-b-1-4-rule "\\"numberOfWordsInMessage\\"" ":" [ ]? integer-number-rule comma-whitespace-b-1-4-rule "\\"feelingGoodPercentage\\"" ":" [ ]? fractional-number-rule comma-whitespace-b-1-4-rule "\\"feelingGood\\"" ":" [ ]? boolean-rule comma-whitespace-b-1-4-rule "\\"feelingOverall\\"" ":" [ ]? rule1 comma-whitespace-b-1-4-rule "\\"verbsInMessage\\"" ":" [ ]? rule2 whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
          string-char-rule ::= [^"\\\\\\x7F\\x00-\\x1F] | "\\\\" ["\\\\/bfnrt] | "\\\\u" [0-9a-fA-F]{4}
          string-rule ::= "\\"" string-char-rule* "\\""
          null-rule ::= "null"
          rule0 ::= ( string-rule | null-rule )
          comma-whitespace-b-1-4-rule ::= "," ([\\n] ("    " | "\\t") | [ ]?)
          integer-number-rule ::= "-"? ("0" | [1-9] [0-9]{0,15}) ([eE] [-+]? ("0" | [1-9] [0-9]{0,15}))?
          fractional-number-rule ::= "-"? ("0" | [1-9] [0-9]{0,15}) ("." [0-9]{1,16})? ([eE] [-+]? ("0" | [1-9] [0-9]{0,15}))?
          boolean-rule ::= "true" | "false"
          val0 ::= "\\"good\\""
          val1 ::= "\\"bad\\""
          rule1 ::= ( val0 | val1 )
          comma-whitespace-b-2-4-rule ::= "," ([\\n] (" "{8} | "\\t\\t") | [ ]?)
          whitespace-b-2-4-rule ::= [\\n] (" "{8} | "\\t\\t") | [ ]?
          whitespace-b-1-4-rule ::= [\\n] ("    " | "\\t") | [ ]?
          rule2 ::= "[" whitespace-b-2-4-rule ( string-rule ( comma-whitespace-b-2-4-rule string-rule )* )? whitespace-b-1-4-rule "]"
          whitespace-b-0-4-rule ::= [\\n] | [ ]?"
        `);

        const parsedValue = grammar.parse(JSON.stringify(exampleValidValue));

        expectTypeOf(parsedValue).toMatchTypeOf<schemaType>();
        expect(parsedValue).toEqual(exampleValidValue);
        expect(testGrammar(grammar, exampleValidValue)).to.eql(true);
        expect(testGrammar(grammar, exampleValidValue, "pretty")).to.eql(true);
        expect(testGrammar(grammar, exampleValidValue, "dumps")).to.eql(true);

        const parsedValue2 = grammar.parse(JSON.stringify(exampleValidValue2));

        expectTypeOf(parsedValue2).toMatchTypeOf<schemaType>();
        expect(parsedValue2).toEqual(exampleValidValue2);
        expect(testGrammar(grammar, exampleValidValue2)).to.eql(true);
        expect(testGrammar(grammar, exampleValidValue2, "pretty")).to.eql(true);
        expect(testGrammar(grammar, exampleValidValue2, "dumps")).to.eql(true);

        try {
            grammar.parse(JSON.stringify(exampleInvalidValue));
            expect.unreachable("Parsing should have failed");
        } catch (err) {
            expect(err).toMatchInlineSnapshot("[Error: Expected type \"string\" but got \"number\"]");
            expect(testGrammar(grammar, exampleInvalidValue)).to.eql(false);
        }

        try {
            grammar.parse(JSON.stringify(exampleInvalidValue2));
            expect.unreachable("Parsing should have failed");
        } catch (err) {
            expect(err).toMatchInlineSnapshot('[Error: Expected one of ["good", "bad"] but got "average"]');
            expect(testGrammar(grammar, exampleInvalidValue2)).to.eql(false);
        }

        try {
            grammar.parse(JSON.stringify(exampleInvalidValue3));
            expect.unreachable("Parsing should have failed");
        } catch (err) {
            expect(err).toMatchInlineSnapshot("[Error: Expected type \"string\" but got \"boolean\"]");
            expect(testGrammar(grammar, exampleInvalidValue3)).to.eql(false);
        }

        try {
            grammar.parse(JSON.stringify(exampleInvalidValue4));
            expect.unreachable("Parsing should have failed");
        } catch (err) {
            expect(err).toMatchInlineSnapshot("[Error: Expected type \"string\" but got \"object\"]");
            expect(testGrammar(grammar, exampleInvalidValue4)).to.eql(false);
        }

        try {
            grammar.parse(JSON.stringify(exampleInvalidValue5));
            expect.unreachable("Parsing should have failed");
        } catch (err) {
            expect(err).toMatchInlineSnapshot("[Error: Expected type \"string\" but got \"null\"]");
            expect(testGrammar(grammar, exampleInvalidValue5)).to.eql(false);
        }

        try {
            grammar.parse(JSON.stringify(exampleInvalidValue6));
            expect.unreachable("Parsing should have failed");
        } catch (err) {
            expect(err).toMatchInlineSnapshot('[Error: Expected one type of ["string", "null"] but got type "boolean"]');
            expect(testGrammar(grammar, exampleInvalidValue6)).to.eql(false);
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
          "root ::= "[" whitespace-b-1-4-rule ( rule1 ( comma-whitespace-b-1-4-rule rule1 )* )? whitespace-b-0-4-rule "]" "\\n\\n\\n\\n" [\\n]*
          string-char-rule ::= [^"\\\\\\x7F\\x00-\\x1F] | "\\\\" ["\\\\/bfnrt] | "\\\\u" [0-9a-fA-F]{4}
          string-rule ::= "\\"" string-char-rule* "\\""
          whitespace-b-2-4-rule ::= [\\n] (" "{8} | "\\t\\t") | [ ]?
          whitespace-b-1-4-rule ::= [\\n] ("    " | "\\t") | [ ]?
          rule0 ::= "{" whitespace-b-2-4-rule "\\"message\\"" ":" [ ]? string-rule whitespace-b-1-4-rule "}"
          rule1 ::= ( rule0 | string-rule )
          comma-whitespace-b-1-4-rule ::= "," ([\\n] ("    " | "\\t") | [ ]?)
          whitespace-b-0-4-rule ::= [\\n] | [ ]?"
        `);

        const parsedValue = grammar.parse(JSON.stringify(exampleValidValue));

        expectTypeOf(parsedValue).toMatchTypeOf<schemaType>();
        expect(parsedValue).toEqual(exampleValidValue);
        expect(testGrammar(grammar, exampleValidValue)).to.eql(true);
        expect(testGrammar(grammar, exampleValidValue, "pretty")).to.eql(true);
        expect(testGrammar(grammar, exampleValidValue, "dumps")).to.eql(true);

        const parsedValue2 = grammar.parse(JSON.stringify(exampleValidValue2));

        expectTypeOf(parsedValue2).toMatchTypeOf<schemaType>();
        expect(parsedValue2).toEqual(exampleValidValue2);
        expect(testGrammar(grammar, exampleValidValue2)).to.eql(true);
        expect(testGrammar(grammar, exampleValidValue2, "pretty")).to.eql(true);
        expect(testGrammar(grammar, exampleValidValue2, "dumps")).to.eql(true);

        try {
            grammar.parse(JSON.stringify(exampleInvalidValue));
            expect.unreachable("Parsing should have failed");
        } catch (err) {
            expect(err).toMatchInlineSnapshot("[Error: Expected one of 2 schemas but got 10]");
            expect(testGrammar(grammar, exampleInvalidValue)).to.eql(false);
        }

        try {
            grammar.parse(JSON.stringify(exampleInvalidValue2));
            expect.unreachable("Parsing should have failed");
        } catch (err) {
            expect(err).toMatchInlineSnapshot('[Error: Expected an array but got "object"]');
            expect(testGrammar(grammar, exampleInvalidValue2)).to.eql(false);
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
                    const: "Hooray!\nYes!\t/\\and\"and\'"
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
            "withNewLine": "Hooray!\nYes!\t/\\and\"and\'",
            "withQuotes": 'The message is "Hi!".'
        };
        const exampleValidValue = {
            "onlyPositiveText": true,
            "onlyNegativeText": false,
            "onlyVibe": "good",
            "onlyNumber": 10,
            "worstThing": null,
            "withNewLine": "Hooray!\nYes!\t/\\and\"and\'",
            "withQuotes": 'The message is "Hi!".'
        };
        const exampleInvalidValue = {
            "onlyPositiveText": true,
            "onlyNegativeText": false,
            "onlyVibe": "good",
            "onlyNumber": 10.1,
            "worstThing": null,
            "withNewLine": "Hooray!\nYes!\t/\\and\"and\'",
            "withQuotes": 'The message is "Hi!".'
        };

        expect(grammar.grammar).toMatchInlineSnapshot(`
          "root ::= "{" whitespace-b-1-4-rule "\\"onlyPositiveText\\"" ":" [ ]? "true" comma-whitespace-b-1-4-rule "\\"onlyNegativeText\\"" ":" [ ]? "false" comma-whitespace-b-1-4-rule "\\"onlyVibe\\"" ":" [ ]? val0 comma-whitespace-b-1-4-rule "\\"onlyNumber\\"" ":" [ ]? "10" comma-whitespace-b-1-4-rule "\\"worstThing\\"" ":" [ ]? null-rule comma-whitespace-b-1-4-rule "\\"withNewLine\\"" ":" [ ]? val1 comma-whitespace-b-1-4-rule "\\"withQuotes\\"" ":" [ ]? val2 whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
          comma-whitespace-b-1-4-rule ::= "," ([\\n] ("    " | "\\t") | [ ]?)
          val0 ::= "\\"good\\""
          null-rule ::= "null"
          val1 ::= "\\"Hooray!\\\\nYes!\\\\t/\\\\\\\\and\\\\\\"and'\\""
          val2 ::= "\\"The message is \\\\\\"Hi!\\\\\\".\\""
          whitespace-b-1-4-rule ::= [\\n] ("    " | "\\t") | [ ]?
          whitespace-b-0-4-rule ::= [\\n] | [ ]?"
        `);

        const parsedValue = grammar.parse(JSON.stringify(exampleValidValue));

        expectTypeOf(parsedValue).toMatchTypeOf<schemaType>();
        expect(parsedValue).toEqual(exampleValidValue);
        expect(testGrammar(grammar, exampleValidValue)).to.eql(true);
        expect(testGrammar(grammar, exampleValidValue, "pretty")).to.eql(true);
        expect(testGrammar(grammar, exampleValidValue, "dumps")).to.eql(true);

        try {
            grammar.parse(JSON.stringify(exampleInvalidValue));
            expect.unreachable("Parsing should have failed");
        } catch (err) {
            expect(err).toMatchInlineSnapshot("[Error: Expected 10 but got 10.1]");
            expect(testGrammar(grammar, exampleInvalidValue)).to.eql(false);
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
          "root ::= "{" whitespace-b-1-4-rule "\\"onlyPositiveText\\"" ":" [ ]? "true" comma-whitespace-b-1-4-rule "\\"onlyNegativeText\\"" ":" [ ]? "false" comma-whitespace-b-1-4-rule "\\"onlyVibe\\"" ":" [ ]? val0 comma-whitespace-b-1-4-rule "\\"onlyNumber\\"" ":" [ ]? "10" comma-whitespace-b-1-4-rule "\\"worstThing\\"" ":" [ ]? null-rule comma-whitespace-b-1-4-rule "\\"withNewLine\\"" ":" [ ]? val1 comma-whitespace-b-1-4-rule "\\"withQuotes\\"" ":" [ ]? val2 whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
          comma-whitespace-b-1-4-rule ::= "," ([\\n] ("    " | "\\t") | [ ]?)
          val0 ::= "\\"good\\""
          null-rule ::= "null"
          val1 ::= "\\"Hooray!\\\\nYes!\\\\t/\\\\\\\\\\""
          val2 ::= "\\"The message is \\\\\\"Hi!\\\\\\".\\""
          whitespace-b-1-4-rule ::= [\\n] ("    " | "\\t") | [ ]?
          whitespace-b-0-4-rule ::= [\\n] | [ ]?"
        `);

        const parsedValue = grammar.parse(JSON.stringify(exampleValidValue));

        expectTypeOf(parsedValue).toMatchTypeOf<schemaType>();
        expect(parsedValue).toEqual(exampleValidValue);
        expect(testGrammar(grammar, exampleValidValue)).to.eql(true);
        expect(testGrammar(grammar, exampleValidValue, "pretty")).to.eql(true);
        expect(testGrammar(grammar, exampleValidValue, "dumps")).to.eql(true);

        try {
            grammar.parse(JSON.stringify(exampleInvalidValue));
            expect.unreachable("Parsing should have failed");
        } catch (err) {
            expect(err).toMatchInlineSnapshot('[Error: Missing keys: "onlyVibe"]');
            expect(testGrammar(grammar, exampleInvalidValue)).to.eql(false);
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
          "root ::= "{" whitespace-b-1-4-rule "\\"onlyPositiveText\\"" ":" [ ]? "true" comma-whitespace-b-1-4-rule "\\"onlyNegativeText\\"" ":" [ ]? "false" comma-whitespace-b-1-4-rule "\\"onlyVibe\\"" ":" [ ]? val0 comma-whitespace-b-1-4-rule "\\"onlyNumber\\"" ":" [ ]? "10" comma-whitespace-b-1-4-rule "\\"worstThing\\"" ":" [ ]? null-rule comma-whitespace-b-1-4-rule "\\"withNewLine\\"" ":" [ ]? val1 comma-whitespace-b-1-4-rule "\\"withQuotes\\"" ":" [ ]? val2 whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
          comma-whitespace-b-1-4-rule ::= "," ([\\n] ("    " | "\\t") | [ ]?)
          val0 ::= "\\"good\\""
          null-rule ::= "null"
          val1 ::= "\\"Hooray!\\\\nYes!\\\\t/\\\\\\\\\\""
          val2 ::= "\\"The message is \\\\\\"Hi!\\\\\\".\\""
          whitespace-b-1-4-rule ::= [\\n] ("    " | "\\t") | [ ]?
          whitespace-b-0-4-rule ::= [\\n] | [ ]?"
        `);

        const parsedValue = grammar.parse(JSON.stringify(exampleValidValue));

        expectTypeOf(parsedValue).toMatchTypeOf<schemaType>();
        expect(parsedValue).toEqual(exampleValidValue);
        expect(testGrammar(grammar, exampleValidValue)).to.eql(true);
        expect(testGrammar(grammar, exampleValidValue, "pretty")).to.eql(true);
        expect(testGrammar(grammar, exampleValidValue, "dumps")).to.eql(true);

        try {
            grammar.parse(JSON.stringify(exampleInvalidValue));
            expect.unreachable("Parsing should have failed");
        } catch (err) {
            expect(err).toMatchInlineSnapshot('[Error: Unexpected keys: "onlyFeeling"]');
            expect(testGrammar(grammar, exampleInvalidValue)).to.eql(false);
        }
    });

    describe("array options", () => {
        test("no type", async () => {
            const llama = await getTestLlama();
            const grammar = new LlamaJsonSchemaGrammar(llama, {
                type: "object",
                properties: {
                    "simple": {
                        type: "array"
                    },
                    "withMinItems": {
                        type: "array",
                        minItems: 2
                    }
                }
            } as const);
            type schemaType = {
                "simple": any[],
                "withMinItems": [any, any, ...any[]]
            };

            const exampleValidValue = {
                "simple": [],
                "withMinItems": [1, true]
            };
            const exampleValidValue2 = {
                "simple": [false],
                "withMinItems": [1, null, "text"]
            };

            const exampleInvalidValue = {
                "simple": "not an array",
                "withMinItems": [1, true]
            };
            const exampleInvalidValue2 = {
                "simple": [],
                "withMinItems": [1]
            };
            const exampleInvalidValue3 = {
                "simple": [],
                "withMinItems": []
            };

            expect(grammar.grammar).toMatchInlineSnapshot(`
              "root ::= "{" whitespace-b-1-4-rule "\\"simple\\"" ":" [ ]? rule5 comma-whitespace-b-1-4-rule "\\"withMinItems\\"" ":" [ ]? rule6 whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
              string-char-rule ::= [^"\\\\\\x7F\\x00-\\x1F] | "\\\\" ["\\\\/bfnrt] | "\\\\u" [0-9a-fA-F]{4}
              string-rule ::= "\\"" string-char-rule* "\\""
              fractional-number-rule ::= "-"? ("0" | [1-9] [0-9]{0,15}) ("." [0-9]{1,16})? ([eE] [-+]? ("0" | [1-9] [0-9]{0,15}))?
              boolean-rule ::= "true" | "false"
              null-rule ::= "null"
              comma-whitespace-no-new-lines-rule ::= "," [ ]?
              whitespace-no-new-lines-rule ::= [ ]?
              rule0 ::= "[" whitespace-no-new-lines-rule ( any-json-s-0-4-rule ( comma-whitespace-no-new-lines-rule any-json-s-0-4-rule )* )? whitespace-no-new-lines-rule "]"
              rule1 ::= string-rule ":" [ ]? any-json-s-0-4-rule
              rule2 ::= "{" whitespace-no-new-lines-rule ( rule1 ( comma-whitespace-no-new-lines-rule rule1 )* )? whitespace-no-new-lines-rule "}"
              any-json-s-0-4-rule ::= ( string-rule | fractional-number-rule | boolean-rule | null-rule | rule0 | rule2 )
              comma-whitespace-b-1-4-rule ::= "," ([\\n] ("    " | "\\t") | [ ]?)
              whitespace-b-1-4-rule ::= [\\n] ("    " | "\\t") | [ ]?
              whitespace-b-0-4-rule ::= [\\n] | [ ]?
              rule3 ::= "[" whitespace-b-1-4-rule ( any-json-s-0-4-rule ( comma-whitespace-b-1-4-rule any-json-s-0-4-rule )* )? whitespace-b-0-4-rule "]"
              rule4 ::= "{" whitespace-b-1-4-rule ( rule1 ( comma-whitespace-b-1-4-rule rule1 )* )? whitespace-b-0-4-rule "}"
              any-json-0-4-rule ::= ( string-rule | fractional-number-rule | boolean-rule | null-rule | rule3 | rule4 )
              comma-whitespace-b-2-4-rule ::= "," ([\\n] (" "{8} | "\\t\\t") | [ ]?)
              whitespace-b-2-4-rule ::= [\\n] (" "{8} | "\\t\\t") | [ ]?
              rule5 ::= "[" whitespace-b-2-4-rule ( any-json-0-4-rule ( comma-whitespace-b-2-4-rule any-json-0-4-rule )* )? whitespace-b-1-4-rule "]"
              rule6 ::= "[" whitespace-b-2-4-rule any-json-0-4-rule ( comma-whitespace-b-2-4-rule any-json-0-4-rule ){1,} whitespace-b-1-4-rule "]""
            `);

            const parsedValue = grammar.parse(JSON.stringify(exampleValidValue));
            expectTypeOf(parsedValue).toMatchTypeOf<schemaType>();
            expect(parsedValue).toEqual(exampleValidValue);
            expect(testGrammar(grammar, exampleValidValue)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue, "dumps")).to.eql(true);

            const parsedValue2 = grammar.parse(JSON.stringify(exampleValidValue2));
            expectTypeOf(parsedValue2).toMatchTypeOf<schemaType>();
            expect(parsedValue2).toEqual(exampleValidValue2);
            expect(testGrammar(grammar, exampleValidValue2)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue2, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue2, "dumps")).to.eql(true);

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot('[Error: Expected an array but got "string"]');
                expect(testGrammar(grammar, exampleInvalidValue)).to.eql(false);
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue2));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected at least 2 items but got 1]");
                expect(testGrammar(grammar, exampleInvalidValue2)).to.eql(false);
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue3));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected at least 2 items but got 0]");
                expect(testGrammar(grammar, exampleInvalidValue3)).to.eql(false);
            }
        });

        test("string items", async () => {
            const llama = await getTestLlama();
            const grammar = new LlamaJsonSchemaGrammar(llama, {
                type: "object",
                properties: {
                    "simple": {
                        type: "array",
                        items: {
                            type: "string"
                        }
                    },
                    "withMinItems": {
                        type: "array",
                        items: {
                            type: "string"
                        },
                        minItems: 2
                    },
                    "withMaxItems": {
                        type: "array",
                        items: {
                            type: "string"
                        },
                        maxItems: 3
                    },
                    "withMinAndMaxItems": {
                        type: "array",
                        items: {
                            type: "string"
                        },
                        minItems: 2,
                        maxItems: 3
                    },
                    "withEqualMinAndMaxItems": {
                        type: "array",
                        items: {
                            type: "string"
                        },
                        minItems: 3,
                        maxItems: 3
                    }
                }
            } as const);
            type schemaType = {
                "simple": string[],
                "withMinItems": [string, string, ...any[]],
                "withMaxItems": string[],
                "withMinAndMaxItems": [string, string, ...any[]],
                "withEqualMinAndMaxItems": [string, string, string]
            };

            const exampleValidValue = {
                "simple": [],
                "withMinItems": ["1", "2"],
                "withMaxItems": ["1", "2", "3"],
                "withMinAndMaxItems": ["1", "2", "3"],
                "withEqualMinAndMaxItems": ["1", "2", "3"]
            };
            const exampleValidValue2 = {
                "simple": ["1"],
                "withMinItems": ["1", "2", "3"],
                "withMaxItems": ["1", "2"],
                "withMinAndMaxItems": ["1", "2"],
                "withEqualMinAndMaxItems": ["1", "2", "3"]
            };

            const exampleInvalidValue = {
                "simple": [],
                "withMinItems": ["1", 2],
                "withMaxItems": ["1", "2", "3", "4"],
                "withMinAndMaxItems": ["1"],
                "withEqualMinAndMaxItems": ["1", "2"]
            };
            const exampleInvalidValue2 = {
                "simple": [],
                "withMinItems": ["1"],
                "withMaxItems": ["1", "2", "3", "4"],
                "withMinAndMaxItems": ["1", "2", "3", "4"],
                "withEqualMinAndMaxItems": ["1", "2"]
            };
            const exampleInvalidValue3 = {
                "simple": [],
                "withMinItems": ["1", "2"],
                "withMaxItems": ["1", "2", "3"],
                "withMinAndMaxItems": ["1", "2"],
                "withEqualMinAndMaxItems": ["1", 3]
            };

            expect(grammar.grammar).toMatchInlineSnapshot(`
              "root ::= "{" whitespace-b-1-4-rule "\\"simple\\"" ":" [ ]? rule0 comma-whitespace-b-1-4-rule "\\"withMinItems\\"" ":" [ ]? rule1 comma-whitespace-b-1-4-rule "\\"withMaxItems\\"" ":" [ ]? rule2 comma-whitespace-b-1-4-rule "\\"withMinAndMaxItems\\"" ":" [ ]? rule3 comma-whitespace-b-1-4-rule "\\"withEqualMinAndMaxItems\\"" ":" [ ]? rule4 whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
              string-char-rule ::= [^"\\\\\\x7F\\x00-\\x1F] | "\\\\" ["\\\\/bfnrt] | "\\\\u" [0-9a-fA-F]{4}
              string-rule ::= "\\"" string-char-rule* "\\""
              comma-whitespace-b-2-4-rule ::= "," ([\\n] (" "{8} | "\\t\\t") | [ ]?)
              whitespace-b-2-4-rule ::= [\\n] (" "{8} | "\\t\\t") | [ ]?
              whitespace-b-1-4-rule ::= [\\n] ("    " | "\\t") | [ ]?
              rule0 ::= "[" whitespace-b-2-4-rule ( string-rule ( comma-whitespace-b-2-4-rule string-rule )* )? whitespace-b-1-4-rule "]"
              comma-whitespace-b-1-4-rule ::= "," ([\\n] ("    " | "\\t") | [ ]?)
              rule1 ::= "[" whitespace-b-2-4-rule string-rule ( comma-whitespace-b-2-4-rule string-rule ){1,} whitespace-b-1-4-rule "]"
              rule2 ::= "[" whitespace-b-2-4-rule ( string-rule ( comma-whitespace-b-2-4-rule string-rule ){0,2} )? whitespace-b-1-4-rule "]"
              rule3 ::= "[" whitespace-b-2-4-rule string-rule ( comma-whitespace-b-2-4-rule string-rule ){1,2} whitespace-b-1-4-rule "]"
              rule4 ::= "[" whitespace-b-2-4-rule string-rule ( comma-whitespace-b-2-4-rule string-rule ){2} whitespace-b-1-4-rule "]"
              whitespace-b-0-4-rule ::= [\\n] | [ ]?"
            `);

            const parsedValue = grammar.parse(JSON.stringify(exampleValidValue));
            expectTypeOf(parsedValue).toMatchTypeOf<schemaType>();
            expect(parsedValue).toEqual(exampleValidValue);
            expect(testGrammar(grammar, exampleValidValue)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue, "dumps")).to.eql(true);

            const parsedValue2 = grammar.parse(JSON.stringify(exampleValidValue2));
            expectTypeOf(parsedValue2).toMatchTypeOf<schemaType>();
            expect(parsedValue2).toEqual(exampleValidValue2);
            expect(testGrammar(grammar, exampleValidValue2)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue2, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue2, "dumps")).to.eql(true);

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected type \"string\" but got \"number\"]");
                expect(testGrammar(grammar, exampleInvalidValue)).to.eql(false);
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue2));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected at least 2 items but got 1]");
                expect(testGrammar(grammar, exampleInvalidValue2)).to.eql(false);
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue3));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected exactly 3 items but got 2]");
                expect(testGrammar(grammar, exampleInvalidValue2)).to.eql(false);
            }
        });

        test("with prefix items", async () => {
            const llama = await getTestLlama();
            const grammar = new LlamaJsonSchemaGrammar(llama, {
                type: "object",
                properties: {
                    simple: {
                        type: "array",
                        prefixItems: [
                            {type: "string"},
                            {type: "boolean"},
                            {type: "number"},
                            {type: "null"},
                            {type: "object", properties: {message: {type: "string"}}},
                            {type: "array", items: {type: "string"}}
                        ]
                    },
                    withAdditionalItems: {
                        type: "array",
                        prefixItems: [
                            {type: "string"},
                            {type: "boolean"},
                            {type: "number"},
                            {type: "null"},
                            {type: "object", properties: {message: {type: "string"}}},
                            {type: "array", items: {type: "string"}}
                        ],
                        items: {
                            enum: ["1", -6]
                        }
                    },
                    withAdditionalItemsAndMin: {
                        type: "array",
                        prefixItems: [
                            {type: "string"},
                            {type: "boolean"},
                            {type: "number"},
                            {type: "null"},
                            {type: "object", properties: {message: {type: "string"}}},
                            {type: "array", items: {type: "string"}}
                        ],
                        items: {
                            enum: ["1", -600]
                        },
                        minItems: 8
                    },
                    withAdditionalItemsAndMax: {
                        type: "array",
                        prefixItems: [
                            {type: "string"},
                            {type: "boolean"},
                            {type: "number"},
                            {type: "null"},
                            {type: "object", properties: {message: {type: "string"}}},
                            {type: "array", items: {type: "string"}}
                        ],
                        items: {
                            enum: ["1", -6]
                        },
                        maxItems: 8
                    },
                    withMaxSizeOfPrefixItems: {
                        type: "array",
                        prefixItems: [
                            {type: "string"},
                            {type: "boolean"},
                            {type: "number"},
                            {type: "null"},
                            {type: "object", properties: {message: {type: "string"}}},
                            {type: "array", items: {type: "string"}}
                        ],
                        maxItems: 6
                    },
                    withAdditionalItemsAndMaxSizeOfPrefixItems: {
                        type: "array",
                        prefixItems: [
                            {type: "string"},
                            {type: "boolean"},
                            {type: "number"},
                            {type: "null"},
                            {type: "object", properties: {message: {type: "string"}}},
                            {type: "array", items: {type: "string"}}
                        ],
                        items: {
                            enum: ["1", -6]
                        },
                        maxItems: 6
                    },
                    withAdditionalItemsAndMinAndMax: {
                        type: "array",
                        prefixItems: [
                            {type: "string"},
                            {type: "boolean"},
                            {type: "number"},
                            {type: "null"},
                            {type: "object", properties: {message: {type: "string"}}},
                            {type: "array", items: {type: "string"}}
                        ],
                        items: {
                            enum: ["1", -6]
                        },
                        minItems: 8,
                        maxItems: 10
                    },
                    withAdditionalItemsAndMinAndMaxEquals: {
                        type: "array",
                        prefixItems: [
                            {type: "string"},
                            {type: "boolean"},
                            {type: "number"},
                            {type: "null"},
                            {type: "object", properties: {message: {type: "string"}}},
                            {type: "array", items: {type: "string"}}
                        ],
                        items: {
                            enum: ["1", -6]
                        },
                        minItems: 10,
                        maxItems: 10
                    }
                }
            } as const);
            type schemaType = {
                simple: [string, boolean, number, null, {message: string}, string[], ...any[]],
                withAdditionalItems: [string, boolean, number, null, {message: string}, string[], ...("1" | -6)[]],
                withAdditionalItemsAndMin: [string, boolean, number, null, {message: string}, string[], "1" | -600, "1" | -600, ...("1" | -600)[]],
                withAdditionalItemsAndMax: [string, boolean, number, null, {message: string}, string[], ...("1" | -6)[]],
                withMaxSizeOfPrefixItems: [string, boolean, number, null, {message: string}, string[]],
                withAdditionalItemsAndMaxSizeOfPrefixItems: [string, boolean, number, null, {message: string}, string[]],
                withAdditionalItemsAndMinAndMax: [string, boolean, number, null, {message: string}, string[], "1" | -6, "1" | -6, ...("1" | -6)[]],
                withAdditionalItemsAndMinAndMaxEquals: [string, boolean, number, null, {message: string}, string[], "1" | -6, "1" | -6, "1" | -6, "1" | -6]
            };

            const exampleValidValue = {
                simple: ["text", true, 10, null, {message: "Hello"}, ["1"]],
                withAdditionalItems: ["text", true, 10, null, {message: "Hello"}, ["1"], "1", -6],
                withAdditionalItemsAndMin: ["text", true, 10, null, {message: "Hello"}, ["1"], "1", -600, "1", -600],
                withAdditionalItemsAndMax: ["text", true, 10, null, {message: "Hello"}, ["1"], "1", -6],
                withMaxSizeOfPrefixItems: ["text", true, 10, null, {message: "Hello"}, ["1"]],
                withAdditionalItemsAndMaxSizeOfPrefixItems: ["text", true, 10, null, {message: "Hello"}, ["1"]],
                withAdditionalItemsAndMinAndMax: ["text", true, 10, null, {message: "Hello"}, ["1"], "1", -6, "1", -6],
                withAdditionalItemsAndMinAndMaxEquals: ["text", true, 10, null, {message: "Hello"}, ["1"], "1", -6, "1", -6]
            };
            const exampleValidValue2 = {
                simple: ["text", true, 10, null, {message: "Hello"}, ["1"], "extra"],
                withAdditionalItems: ["text", true, 10, null, {message: "Hello"}, ["1"], "1", -6],
                withAdditionalItemsAndMin: ["text", true, 10, null, {message: "Hello"}, ["1"], "1", -600, "1", -600],
                withAdditionalItemsAndMax: ["text", true, 10, null, {message: "Hello"}, ["1"], "1", -6],
                withMaxSizeOfPrefixItems: ["text", true, 10, null, {message: "Hello"}, ["1"]],
                withAdditionalItemsAndMaxSizeOfPrefixItems: ["text", true, 10, null, {message: "Hello"}, ["1"]],
                withAdditionalItemsAndMinAndMax: ["text", true, 10, null, {message: "Hello"}, ["1"], "1", -6, "1", -6],
                withAdditionalItemsAndMinAndMaxEquals: ["text", true, 10, null, {message: "Hello"}, ["1"], "1", -6, "1", -6]
            };

            const exampleInvalidValue = {
                simple: ["text", true, 10, null, {message: "Hello"}, ["1"]],
                withAdditionalItems: ["text", true, 10, null, {message: "Hello"}, ["1"], "1", -6, "extra"],
                withAdditionalItemsAndMin: ["text", true, 10, null, {message: "Hello"}, ["1"], "1", -600, "1", -600],
                withAdditionalItemsAndMax: ["text", true, 10, null, {message: "Hello"}, ["1"], "1", -6, "1", -6],
                withMaxSizeOfPrefixItems: ["text", true, 10, null, {message: "Hello"}, ["1"], "extra"],
                withAdditionalItemsAndMaxSizeOfPrefixItems: ["text", true, 10, null, {message: "Hello"}, ["1"], "extra"],
                withAdditionalItemsAndMinAndMax: ["text", true, 10, null, {message: "Hello"}, ["1"], "1", -6, "1", -6],
                withAdditionalItemsAndMinAndMaxEquals: ["text", true, 10, null, {message: "Hello"}, ["1"], "1", -6, "1", -6]
            };
            const exampleInvalidValue2 = {
                simple: ["text", true, 10, null, {message: "Hello"}, ["1"], "extra"],
                withAdditionalItems: ["text", true, 10, null, {message: "Hello"}, ["1"], "1", -6],
                withAdditionalItemsAndMin: ["text", true, 10, null, {message: "Hello"}, ["1"], "1", -600, "1", -600, "extra"],
                withAdditionalItemsAndMax: ["text", true, 10, null, {message: "Hello"}, ["1"], "1", -6, "extra"],
                withMaxSizeOfPrefixItems: ["text", true, 10, null, {message: "Hello"}, ["1"]],
                withAdditionalItemsAndMaxSizeOfPrefixItems: ["text", true, 10, null, {message: "Hello"}, ["1"]],
                withAdditionalItemsAndMinAndMax: ["text", true, 10, null, {message: "Hello"}, ["1"], "1", -6, "1", -6, "1", -6, "extra"],
                withAdditionalItemsAndMinAndMaxEquals: ["text", true, 10, null, {message: "Hello"}, ["1"], "1", -6, "1", -6, "1", -6]
            };
            const exampleInvalidValue3 = {
                simple: ["text", true, 10, null, {message: "Hello"}, ["1"]],
                withAdditionalItems: ["text", true, 10, null, {message: "Hello"}, ["1"], "1", -6],
                withAdditionalItemsAndMin: ["text", true, 10, null, {message: "Hello"}, ["1"], "1", -600, "1", -600],
                withAdditionalItemsAndMax: ["text", true, 10, null, {message: "Hello"}, ["1"], "1", -6, "1", -6],
                withMaxSizeOfPrefixItems: ["text", true, 10, null, {message: "Hello"}, ["1"], "extra"],
                withAdditionalItemsAndMaxSizeOfPrefixItems: ["text", true, 10, null, {message: "Hello"}, ["1"], "extra"],
                withAdditionalItemsAndMinAndMax: ["text", true, 10, null, {message: "Hello"}, ["1"], "1", -6, "1", -6],
                withAdditionalItemsAndMinAndMaxEquals: ["text", true, 10, null, {message: "Hello"}, ["1"], "1", -6, "1", -6]
            };

            expect(grammar.grammar).toMatchInlineSnapshot(`
              "root ::= "{" whitespace-b-1-4-rule "\\"simple\\"" ":" [ ]? rule7 comma-whitespace-b-1-4-rule "\\"withAdditionalItems\\"" ":" [ ]? rule9 comma-whitespace-b-1-4-rule "\\"withAdditionalItemsAndMin\\"" ":" [ ]? rule11 comma-whitespace-b-1-4-rule "\\"withAdditionalItemsAndMax\\"" ":" [ ]? rule12 comma-whitespace-b-1-4-rule "\\"withMaxSizeOfPrefixItems\\"" ":" [ ]? rule13 comma-whitespace-b-1-4-rule "\\"withAdditionalItemsAndMaxSizeOfPrefixItems\\"" ":" [ ]? rule13 comma-whitespace-b-1-4-rule "\\"withAdditionalItemsAndMinAndMax\\"" ":" [ ]? rule14 comma-whitespace-b-1-4-rule "\\"withAdditionalItemsAndMinAndMaxEquals\\"" ":" [ ]? rule15 whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
              string-char-rule ::= [^"\\\\\\x7F\\x00-\\x1F] | "\\\\" ["\\\\/bfnrt] | "\\\\u" [0-9a-fA-F]{4}
              string-rule ::= "\\"" string-char-rule* "\\""
              comma-whitespace-b-2-4-rule ::= "," ([\\n] (" "{8} | "\\t\\t") | [ ]?)
              boolean-rule ::= "true" | "false"
              fractional-number-rule ::= "-"? ("0" | [1-9] [0-9]{0,15}) ("." [0-9]{1,16})? ([eE] [-+]? ("0" | [1-9] [0-9]{0,15}))?
              null-rule ::= "null"
              whitespace-b-3-4-rule ::= [\\n] (" "{12} | "\\t"{3}) | [ ]?
              whitespace-b-2-4-rule ::= [\\n] (" "{8} | "\\t\\t") | [ ]?
              rule0 ::= "{" whitespace-b-3-4-rule "\\"message\\"" ":" [ ]? string-rule whitespace-b-2-4-rule "}"
              comma-whitespace-b-3-4-rule ::= "," ([\\n] (" "{12} | "\\t"{3}) | [ ]?)
              rule1 ::= "[" whitespace-b-3-4-rule ( string-rule ( comma-whitespace-b-3-4-rule string-rule )* )? whitespace-b-2-4-rule "]"
              comma-whitespace-no-new-lines-rule ::= "," [ ]?
              whitespace-no-new-lines-rule ::= [ ]?
              rule2 ::= "[" whitespace-no-new-lines-rule ( any-json-s-0-4-rule ( comma-whitespace-no-new-lines-rule any-json-s-0-4-rule )* )? whitespace-no-new-lines-rule "]"
              rule3 ::= string-rule ":" [ ]? any-json-s-0-4-rule
              rule4 ::= "{" whitespace-no-new-lines-rule ( rule3 ( comma-whitespace-no-new-lines-rule rule3 )* )? whitespace-no-new-lines-rule "}"
              any-json-s-0-4-rule ::= ( string-rule | fractional-number-rule | boolean-rule | null-rule | rule2 | rule4 )
              comma-whitespace-b-1-4-rule ::= "," ([\\n] ("    " | "\\t") | [ ]?)
              whitespace-b-1-4-rule ::= [\\n] ("    " | "\\t") | [ ]?
              whitespace-b-0-4-rule ::= [\\n] | [ ]?
              rule5 ::= "[" whitespace-b-1-4-rule ( any-json-s-0-4-rule ( comma-whitespace-b-1-4-rule any-json-s-0-4-rule )* )? whitespace-b-0-4-rule "]"
              rule6 ::= "{" whitespace-b-1-4-rule ( rule3 ( comma-whitespace-b-1-4-rule rule3 )* )? whitespace-b-0-4-rule "}"
              any-json-0-4-rule ::= ( string-rule | fractional-number-rule | boolean-rule | null-rule | rule5 | rule6 )
              rule7 ::= "[" whitespace-b-2-4-rule string-rule comma-whitespace-b-2-4-rule boolean-rule comma-whitespace-b-2-4-rule fractional-number-rule comma-whitespace-b-2-4-rule null-rule comma-whitespace-b-2-4-rule rule0 comma-whitespace-b-2-4-rule rule1 ( comma-whitespace-b-2-4-rule any-json-0-4-rule )* whitespace-b-1-4-rule "]"
              val0 ::= "\\"1\\""
              rule8 ::= ( val0 | "-6" )
              rule9 ::= "[" whitespace-b-2-4-rule string-rule comma-whitespace-b-2-4-rule boolean-rule comma-whitespace-b-2-4-rule fractional-number-rule comma-whitespace-b-2-4-rule null-rule comma-whitespace-b-2-4-rule rule0 comma-whitespace-b-2-4-rule rule1 ( comma-whitespace-b-2-4-rule rule8 )* whitespace-b-1-4-rule "]"
              val1 ::= "-600"
              rule10 ::= ( val0 | val1 )
              rule11 ::= "[" whitespace-b-2-4-rule string-rule comma-whitespace-b-2-4-rule boolean-rule comma-whitespace-b-2-4-rule fractional-number-rule comma-whitespace-b-2-4-rule null-rule comma-whitespace-b-2-4-rule rule0 comma-whitespace-b-2-4-rule rule1 ( comma-whitespace-b-2-4-rule rule10 ){2,} whitespace-b-1-4-rule "]"
              rule12 ::= "[" whitespace-b-2-4-rule string-rule comma-whitespace-b-2-4-rule boolean-rule comma-whitespace-b-2-4-rule fractional-number-rule comma-whitespace-b-2-4-rule null-rule comma-whitespace-b-2-4-rule rule0 comma-whitespace-b-2-4-rule rule1 ( comma-whitespace-b-2-4-rule rule8 ){0,2} whitespace-b-1-4-rule "]"
              rule13 ::= "[" whitespace-b-2-4-rule string-rule comma-whitespace-b-2-4-rule boolean-rule comma-whitespace-b-2-4-rule fractional-number-rule comma-whitespace-b-2-4-rule null-rule comma-whitespace-b-2-4-rule rule0 comma-whitespace-b-2-4-rule rule1 whitespace-b-1-4-rule "]"
              rule14 ::= "[" whitespace-b-2-4-rule string-rule comma-whitespace-b-2-4-rule boolean-rule comma-whitespace-b-2-4-rule fractional-number-rule comma-whitespace-b-2-4-rule null-rule comma-whitespace-b-2-4-rule rule0 comma-whitespace-b-2-4-rule rule1 ( comma-whitespace-b-2-4-rule rule8 ){2,4} whitespace-b-1-4-rule "]"
              rule15 ::= "[" whitespace-b-2-4-rule string-rule comma-whitespace-b-2-4-rule boolean-rule comma-whitespace-b-2-4-rule fractional-number-rule comma-whitespace-b-2-4-rule null-rule comma-whitespace-b-2-4-rule rule0 comma-whitespace-b-2-4-rule rule1 ( comma-whitespace-b-2-4-rule rule8 ){4} whitespace-b-1-4-rule "]""
            `);

            const parsedValue = grammar.parse(JSON.stringify(exampleValidValue));
            expectTypeOf(parsedValue).toMatchTypeOf<schemaType>();
            expect(parsedValue).toEqual(exampleValidValue);
            expect(testGrammar(grammar, exampleValidValue)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue, "dumps")).to.eql(true);

            const parsedValue2 = grammar.parse(JSON.stringify(exampleValidValue2));
            expectTypeOf(parsedValue2).toMatchTypeOf<schemaType>();
            expect(parsedValue2).toEqual(exampleValidValue2);
            expect(testGrammar(grammar, exampleValidValue2)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue2, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue2, "dumps")).to.eql(true);

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot('[Error: Expected one of ["1", -6] but got "extra"]');
                expect(testGrammar(grammar, exampleInvalidValue)).to.eql(false);
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue2));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot('[Error: Expected one of ["1", -600] but got "extra"]');
                expect(testGrammar(grammar, exampleInvalidValue2)).to.eql(false);
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue3));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected at most 8 items but got 10]");
                expect(testGrammar(grammar, exampleInvalidValue3)).to.eql(false);
            }
        });
    });

    describe("object options", () => {
        test("additionalProperties", async () => {
            const llama = await getTestLlama();
            const grammar = new LlamaJsonSchemaGrammar(llama, {
                type: "object",
                properties: {
                    message: {
                        type: "string"
                    },
                    percentage: {
                        type: "number"
                    }
                },
                additionalProperties: {
                    type: "boolean"
                }
            } as const);
            type schemaType = {
                message: string,
                percentage: number
            } & {
                [key: string]: boolean
            };

            const exampleValidValue = {
                message: "Hello",
                percentage: 10
            };
            const exampleValidValue2 = {
                message: "Hi",
                percentage: 11,
                extra1: true,
                extra2: false
            };

            const exampleInvalidValue = {
                message: "Hello",
                percentage: false
            };
            const exampleInvalidValue2 = {
                message: "Hi",
                percentage: 11,
                extra1: 10
            };
            const exampleInvalidValue3 = {
                message: "Hi",
                percentage: 11,
                extra1: true,
                extra2: 10
            };

            expect(grammar.grammar).toMatchInlineSnapshot(`
              "root ::= "{" whitespace-b-1-4-rule "\\"message\\"" ":" [ ]? string-rule comma-whitespace-b-1-4-rule "\\"percentage\\"" ":" [ ]? fractional-number-rule ( comma-whitespace-b-1-4-rule rule0 )* whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
              string-char-rule ::= [^"\\\\\\x7F\\x00-\\x1F] | "\\\\" ["\\\\/bfnrt] | "\\\\u" [0-9a-fA-F]{4}
              string-rule ::= "\\"" string-char-rule* "\\""
              comma-whitespace-b-1-4-rule ::= "," ([\\n] ("    " | "\\t") | [ ]?)
              fractional-number-rule ::= "-"? ("0" | [1-9] [0-9]{0,15}) ("." [0-9]{1,16})? ([eE] [-+]? ("0" | [1-9] [0-9]{0,15}))?
              boolean-rule ::= "true" | "false"
              rule0 ::= string-rule ":" [ ]? boolean-rule
              whitespace-b-1-4-rule ::= [\\n] ("    " | "\\t") | [ ]?
              whitespace-b-0-4-rule ::= [\\n] | [ ]?"
            `);

            const parsedValue = grammar.parse(JSON.stringify(exampleValidValue));
            expectTypeOf(parsedValue).toMatchTypeOf<schemaType>();
            expect(parsedValue).toEqual(exampleValidValue);
            expect(testGrammar(grammar, exampleValidValue)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue, "dumps")).to.eql(true);

            const parsedValue2 = grammar.parse(JSON.stringify(exampleValidValue2));
            expectTypeOf(parsedValue2).toMatchTypeOf<schemaType>();
            expect(parsedValue2).toEqual(exampleValidValue2);
            expect(testGrammar(grammar, exampleValidValue2)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue2, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue2, "dumps")).to.eql(true);

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot('[Error: Expected type "number" but got "boolean"]');
                expect(testGrammar(grammar, exampleInvalidValue)).to.eql(false);
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue2));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot('[Error: Expected type "boolean" but got "number"]');
                expect(testGrammar(grammar, exampleInvalidValue2)).to.eql(false);
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue3));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot('[Error: Expected type "boolean" but got "number"]');
                expect(testGrammar(grammar, exampleInvalidValue3)).to.eql(false);
            }
        });

        test("minProperties", async () => {
            const llama = await getTestLlama();
            const grammar = new LlamaJsonSchemaGrammar(llama, {
                type: "object",
                properties: {
                    message: {
                        type: "string"
                    },
                    percentage: {
                        type: "number"
                    }
                },
                minProperties: 4,
                additionalProperties: {
                    type: "boolean"
                }
            } as const);
            type schemaType = {
                message: string,
                percentage: number
            } & {
                [key: string]: boolean
            };

            const exampleValidValue = {
                message: "Hello",
                percentage: 10,
                extra1: true,
                extra2: true
            };
            const exampleValidValue2 = {
                message: "Hi",
                percentage: 11,
                extra1: true,
                extra2: false,
                extra3: false
            };

            const exampleInvalidValue = {
                message: "Hello",
                percentage: 10
            };
            const exampleInvalidValue2 = {
                message: "Hi",
                percentage: 11,
                extra1: true
            };
            const exampleInvalidValue3 = {
                message: "Hi",
                percentage: 11,
                extra1: 10
            };

            expect(grammar.grammar).toMatchInlineSnapshot(`
              "root ::= "{" whitespace-b-1-4-rule "\\"message\\"" ":" [ ]? string-rule comma-whitespace-b-1-4-rule "\\"percentage\\"" ":" [ ]? fractional-number-rule comma-whitespace-b-1-4-rule rule0 ( comma-whitespace-b-1-4-rule rule0 ){1,} whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
              string-char-rule ::= [^"\\\\\\x7F\\x00-\\x1F] | "\\\\" ["\\\\/bfnrt] | "\\\\u" [0-9a-fA-F]{4}
              string-rule ::= "\\"" string-char-rule* "\\""
              comma-whitespace-b-1-4-rule ::= "," ([\\n] ("    " | "\\t") | [ ]?)
              fractional-number-rule ::= "-"? ("0" | [1-9] [0-9]{0,15}) ("." [0-9]{1,16})? ([eE] [-+]? ("0" | [1-9] [0-9]{0,15}))?
              boolean-rule ::= "true" | "false"
              rule0 ::= string-rule ":" [ ]? boolean-rule
              whitespace-b-1-4-rule ::= [\\n] ("    " | "\\t") | [ ]?
              whitespace-b-0-4-rule ::= [\\n] | [ ]?"
            `);

            const parsedValue = grammar.parse(JSON.stringify(exampleValidValue));
            expectTypeOf(parsedValue).toMatchTypeOf<schemaType>();
            expect(parsedValue).toEqual(exampleValidValue);
            expect(testGrammar(grammar, exampleValidValue)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue, "dumps")).to.eql(true);

            const parsedValue2 = grammar.parse(JSON.stringify(exampleValidValue2));
            expectTypeOf(parsedValue2).toMatchTypeOf<schemaType>();
            expect(parsedValue2).toEqual(exampleValidValue2);
            expect(testGrammar(grammar, exampleValidValue2)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue2, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue2, "dumps")).to.eql(true);

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected at least 4 properties but got 2]");
                expect(testGrammar(grammar, exampleInvalidValue)).to.eql(false);
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue2));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected at least 4 properties but got 3]");
                expect(testGrammar(grammar, exampleInvalidValue2)).to.eql(false);
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue3));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot('[Error: Expected type "boolean" but got "number"]');
                expect(testGrammar(grammar, exampleInvalidValue3)).to.eql(false);
            }
        });

        test("maxProperties", async () => {
            const llama = await getTestLlama();
            const grammar = new LlamaJsonSchemaGrammar(llama, {
                type: "object",
                properties: {
                    message: {
                        type: "string"
                    },
                    percentage: {
                        type: "number"
                    }
                },
                maxProperties: 4,
                additionalProperties: {
                    type: "boolean"
                }
            } as const);
            type schemaType = {
                message: string,
                percentage: number
            } & {
                [key: string]: boolean
            };

            const exampleValidValue = {
                message: "Hello",
                percentage: 10,
                extra1: true
            };
            const exampleValidValue2 = {
                message: "Hi",
                percentage: 11,
                extra1: true,
                extra2: false
            };

            const exampleInvalidValue = {
                message: "Hello",
                percentage: 10,
                extra1: true,
                extra2: false,
                extra3: false
            };
            const exampleInvalidValue2 = {
                message: "Hi",
                percentage: 11,
                extra1: true,
                extra2: false,
                extra3: false,
                extra4: false
            };
            const exampleInvalidValue3 = {
                message: "Hi",
                percentage: 11,
                extra1: true,
                extra2: false,
                extra3: false,
                extra4: 10
            };

            expect(grammar.grammar).toMatchInlineSnapshot(`
              "root ::= "{" whitespace-b-1-4-rule "\\"message\\"" ":" [ ]? string-rule comma-whitespace-b-1-4-rule "\\"percentage\\"" ":" [ ]? fractional-number-rule ( comma-whitespace-b-1-4-rule rule0 ){0,2} whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
              string-char-rule ::= [^"\\\\\\x7F\\x00-\\x1F] | "\\\\" ["\\\\/bfnrt] | "\\\\u" [0-9a-fA-F]{4}
              string-rule ::= "\\"" string-char-rule* "\\""
              comma-whitespace-b-1-4-rule ::= "," ([\\n] ("    " | "\\t") | [ ]?)
              fractional-number-rule ::= "-"? ("0" | [1-9] [0-9]{0,15}) ("." [0-9]{1,16})? ([eE] [-+]? ("0" | [1-9] [0-9]{0,15}))?
              boolean-rule ::= "true" | "false"
              rule0 ::= string-rule ":" [ ]? boolean-rule
              whitespace-b-1-4-rule ::= [\\n] ("    " | "\\t") | [ ]?
              whitespace-b-0-4-rule ::= [\\n] | [ ]?"
            `);

            const parsedValue = grammar.parse(JSON.stringify(exampleValidValue));
            expectTypeOf(parsedValue).toMatchTypeOf<schemaType>();
            expect(parsedValue).toEqual(exampleValidValue);
            expect(testGrammar(grammar, exampleValidValue)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue, "dumps")).to.eql(true);

            const parsedValue2 = grammar.parse(JSON.stringify(exampleValidValue2));
            expectTypeOf(parsedValue2).toMatchTypeOf<schemaType>();
            expect(parsedValue2).toEqual(exampleValidValue2);
            expect(testGrammar(grammar, exampleValidValue2)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue2, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue2, "dumps")).to.eql(true);

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected at most 4 properties but got 5]");
                expect(testGrammar(grammar, exampleInvalidValue)).to.eql(false);
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue2));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected at most 4 properties but got 6]");
                expect(testGrammar(grammar, exampleInvalidValue2)).to.eql(false);
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue3));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot('[Error: Expected type "boolean" but got "number"]');
                expect(testGrammar(grammar, exampleInvalidValue3)).to.eql(false);
            }
        });

        test("minProperties and maxProperties", async () => {
            const llama = await getTestLlama();
            const grammar = new LlamaJsonSchemaGrammar(llama, {
                type: "object",
                properties: {
                    message: {
                        type: "string"
                    },
                    percentage: {
                        type: "number"
                    }
                },
                minProperties: 3,
                maxProperties: 4,
                additionalProperties: {
                    type: "boolean"
                }
            } as const);
            type schemaType = {
                message: string,
                percentage: number
            } & {
                [key: string]: boolean
            };

            const exampleValidValue = {
                message: "Hello",
                percentage: 10,
                extra1: true
            };
            const exampleValidValue2 = {
                message: "Hi",
                percentage: 11,
                extra1: true,
                extra2: false
            };

            const exampleInvalidValue = {
                message: "Hello",
                percentage: 10
            };
            const exampleInvalidValue2 = {
                message: "Hi",
                percentage: 11,
                extra1: true,
                extra2: false,
                extra3: false
            };
            const exampleInvalidValue3 = {
                message: "Hi",
                percentage: 11,
                extra1: true,
                extra2: false,
                extra3: 10
            };

            expect(grammar.grammar).toMatchInlineSnapshot(`
              "root ::= "{" whitespace-b-1-4-rule "\\"message\\"" ":" [ ]? string-rule comma-whitespace-b-1-4-rule "\\"percentage\\"" ":" [ ]? fractional-number-rule comma-whitespace-b-1-4-rule rule0 ( comma-whitespace-b-1-4-rule rule0 )? whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
              string-char-rule ::= [^"\\\\\\x7F\\x00-\\x1F] | "\\\\" ["\\\\/bfnrt] | "\\\\u" [0-9a-fA-F]{4}
              string-rule ::= "\\"" string-char-rule* "\\""
              comma-whitespace-b-1-4-rule ::= "," ([\\n] ("    " | "\\t") | [ ]?)
              fractional-number-rule ::= "-"? ("0" | [1-9] [0-9]{0,15}) ("." [0-9]{1,16})? ([eE] [-+]? ("0" | [1-9] [0-9]{0,15}))?
              boolean-rule ::= "true" | "false"
              rule0 ::= string-rule ":" [ ]? boolean-rule
              whitespace-b-1-4-rule ::= [\\n] ("    " | "\\t") | [ ]?
              whitespace-b-0-4-rule ::= [\\n] | [ ]?"
            `);

            const parsedValue = grammar.parse(JSON.stringify(exampleValidValue));
            expectTypeOf(parsedValue).toMatchTypeOf<schemaType>();
            expect(parsedValue).toEqual(exampleValidValue);
            expect(testGrammar(grammar, exampleValidValue)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue, "dumps")).to.eql(true);

            const parsedValue2 = grammar.parse(JSON.stringify(exampleValidValue2));
            expectTypeOf(parsedValue2).toMatchTypeOf<schemaType>();
            expect(parsedValue2).toEqual(exampleValidValue2);
            expect(testGrammar(grammar, exampleValidValue2)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue2, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue2, "dumps")).to.eql(true);

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected at least 3 properties but got 2]");
                expect(testGrammar(grammar, exampleInvalidValue)).to.eql(false);
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue2));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected at most 4 properties but got 5]");
                expect(testGrammar(grammar, exampleInvalidValue2)).to.eql(false);
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue3));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot('[Error: Expected type "boolean" but got "number"]');
                expect(testGrammar(grammar, exampleInvalidValue3)).to.eql(false);
            }
        });

        test("minProperties without type", async () => {
            const llama = await getTestLlama();
            const grammar = new LlamaJsonSchemaGrammar(llama, {
                type: "object",
                properties: {
                    message: {
                        type: "string"
                    },
                    percentage: {
                        type: "number"
                    }
                },
                minProperties: 4,
                additionalProperties: true
            } as const);
            type schemaType = {
                message: string,
                percentage: number
            } & {
                [key: string]: any
            };

            const exampleValidValue = {
                message: "Hello",
                percentage: 10,
                extra1: true,
                extra2: null
            };
            const exampleValidValue2 = {
                message: "Hi",
                percentage: 11,
                extra1: true,
                extra2: "hi",
                extra3: 6
            };

            const exampleInvalidValue = {
                message: "Hello",
                percentage: 10
            };
            const exampleInvalidValue2 = {
                message: "Hi",
                percentage: 11,
                extra1: true
            };
            const exampleInvalidValue3 = {
                message: "Hi",
                percentage: 11,
                extra1: 10
            };

            expect(grammar.grammar).toMatchInlineSnapshot(`
              "root ::= "{" whitespace-b-1-4-rule "\\"message\\"" ":" [ ]? string-rule comma-whitespace-b-1-4-rule "\\"percentage\\"" ":" [ ]? fractional-number-rule comma-whitespace-b-1-4-rule rule5 ( comma-whitespace-b-1-4-rule rule5 ){1,} whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
              string-char-rule ::= [^"\\\\\\x7F\\x00-\\x1F] | "\\\\" ["\\\\/bfnrt] | "\\\\u" [0-9a-fA-F]{4}
              string-rule ::= "\\"" string-char-rule* "\\""
              comma-whitespace-b-1-4-rule ::= "," ([\\n] ("    " | "\\t") | [ ]?)
              fractional-number-rule ::= "-"? ("0" | [1-9] [0-9]{0,15}) ("." [0-9]{1,16})? ([eE] [-+]? ("0" | [1-9] [0-9]{0,15}))?
              boolean-rule ::= "true" | "false"
              null-rule ::= "null"
              comma-whitespace-no-new-lines-rule ::= "," [ ]?
              whitespace-no-new-lines-rule ::= [ ]?
              rule0 ::= "[" whitespace-no-new-lines-rule ( any-json-s-1-4-rule ( comma-whitespace-no-new-lines-rule any-json-s-1-4-rule )* )? whitespace-no-new-lines-rule "]"
              rule1 ::= string-rule ":" [ ]? any-json-s-1-4-rule
              rule2 ::= "{" whitespace-no-new-lines-rule ( rule1 ( comma-whitespace-no-new-lines-rule rule1 )* )? whitespace-no-new-lines-rule "}"
              any-json-s-1-4-rule ::= ( string-rule | fractional-number-rule | boolean-rule | null-rule | rule0 | rule2 )
              comma-whitespace-b-2-4-rule ::= "," ([\\n] (" "{8} | "\\t\\t") | [ ]?)
              whitespace-b-2-4-rule ::= [\\n] (" "{8} | "\\t\\t") | [ ]?
              whitespace-b-1-4-rule ::= [\\n] ("    " | "\\t") | [ ]?
              rule3 ::= "[" whitespace-b-2-4-rule ( any-json-s-1-4-rule ( comma-whitespace-b-2-4-rule any-json-s-1-4-rule )* )? whitespace-b-1-4-rule "]"
              rule4 ::= "{" whitespace-b-2-4-rule ( rule1 ( comma-whitespace-b-2-4-rule rule1 )* )? whitespace-b-1-4-rule "}"
              any-json-1-4-rule ::= ( string-rule | fractional-number-rule | boolean-rule | null-rule | rule3 | rule4 )
              rule5 ::= string-rule ":" [ ]? any-json-1-4-rule
              whitespace-b-0-4-rule ::= [\\n] | [ ]?"
            `);

            const parsedValue = grammar.parse(JSON.stringify(exampleValidValue));
            expectTypeOf(parsedValue).toMatchTypeOf<schemaType>();
            expect(parsedValue).toEqual(exampleValidValue);
            expect(testGrammar(grammar, exampleValidValue)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue, "dumps")).to.eql(true);

            const parsedValue2 = grammar.parse(JSON.stringify(exampleValidValue2));
            expectTypeOf(parsedValue2).toMatchTypeOf<schemaType>();
            expect(parsedValue2).toEqual(exampleValidValue2);
            expect(testGrammar(grammar, exampleValidValue2)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue2, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue2, "dumps")).to.eql(true);

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected at least 4 properties but got 2]");
                expect(testGrammar(grammar, exampleInvalidValue)).to.eql(false);
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue2));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected at least 4 properties but got 3]");
                expect(testGrammar(grammar, exampleInvalidValue2)).to.eql(false);
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue3));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected at least 4 properties but got 3]");
                expect(testGrammar(grammar, exampleInvalidValue3)).to.eql(false);
            }
        });

        test("minProperties without setting additionalProperties", async () => {
            const llama = await getTestLlama();
            const grammar = new LlamaJsonSchemaGrammar(llama, {
                type: "object",
                properties: {
                    message: {
                        type: "string"
                    },
                    percentage: {
                        type: "number"
                    }
                },
                minProperties: 4
            } as const);
            type schemaType = {
                message: string,
                percentage: number
            };

            const exampleValidValue = {
                message: "Hello",
                percentage: 10
            };
            const exampleValidValue2 = {
                message: "Hi",
                percentage: 11
            };

            const exampleInvalidValue = {
                message: "Hello",
                percentage: 10,
                extra1: true,
                extra2: true
            };
            const exampleInvalidValue2 = {
                message: "Hi",
                percentage: 11,
                extra1: true
            };
            const exampleInvalidValue3 = {
                message: "Hi",
                percentage: 11,
                extra1: 10
            };

            expect(grammar.grammar).toMatchInlineSnapshot(`
              "root ::= "{" whitespace-b-1-4-rule "\\"message\\"" ":" [ ]? string-rule comma-whitespace-b-1-4-rule "\\"percentage\\"" ":" [ ]? fractional-number-rule whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
              string-char-rule ::= [^"\\\\\\x7F\\x00-\\x1F] | "\\\\" ["\\\\/bfnrt] | "\\\\u" [0-9a-fA-F]{4}
              string-rule ::= "\\"" string-char-rule* "\\""
              comma-whitespace-b-1-4-rule ::= "," ([\\n] ("    " | "\\t") | [ ]?)
              fractional-number-rule ::= "-"? ("0" | [1-9] [0-9]{0,15}) ("." [0-9]{1,16})? ([eE] [-+]? ("0" | [1-9] [0-9]{0,15}))?
              whitespace-b-1-4-rule ::= [\\n] ("    " | "\\t") | [ ]?
              whitespace-b-0-4-rule ::= [\\n] | [ ]?"
            `);

            const parsedValue = grammar.parse(JSON.stringify(exampleValidValue));
            expectTypeOf(parsedValue).toMatchTypeOf<schemaType>();
            expect(parsedValue).toEqual(exampleValidValue);
            expect(testGrammar(grammar, exampleValidValue)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue, "dumps")).to.eql(true);

            const parsedValue2 = grammar.parse(JSON.stringify(exampleValidValue2));
            expectTypeOf(parsedValue2).toMatchTypeOf<schemaType>();
            expect(parsedValue2).toEqual(exampleValidValue2);
            expect(testGrammar(grammar, exampleValidValue2)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue2, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue2, "dumps")).to.eql(true);

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot('[Error: Unexpected keys: "extra1", "extra2"]');
                expect(testGrammar(grammar, exampleInvalidValue)).to.eql(false);
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue2));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot('[Error: Unexpected keys: "extra1"]');
                expect(testGrammar(grammar, exampleInvalidValue2)).to.eql(false);
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue3));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot('[Error: Unexpected keys: "extra1"]');
                expect(testGrammar(grammar, exampleInvalidValue3)).to.eql(false);
            }
        });
    });

    describe("string options", () => {
        test("minLength", async () => {
            const llama = await getTestLlama();
            const grammar = new LlamaJsonSchemaGrammar(llama, {
                type: "object",
                properties: {
                    text: {
                        type: "string",
                        minLength: 2
                    }
                }
            } as const);
            type schemaType = {
                text: string
            };

            const exampleValidValue = {
                text: "12"
            };
            const exampleValidValue2 = {
                text: "1\n"
            };
            const exampleValidValue3 = {
                text: "1234"
            };

            const exampleInvalidValue = {
                text: "1"
            };
            const exampleInvalidValue2 = {
                text: ""
            };
            const exampleInvalidValue3 = {
                text: "\n"
            };

            expect(grammar.grammar).toMatchInlineSnapshot(`
              "root ::= "{" whitespace-b-1-4-rule "\\"text\\"" ":" [ ]? string-2-rule whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
              string-char-rule ::= [^"\\\\\\x7F\\x00-\\x1F] | "\\\\" ["\\\\/bfnrt] | "\\\\u" [0-9a-fA-F]{4}
              string-2-rule ::= "\\"" ( string-char-rule ){2,} "\\""
              whitespace-b-1-4-rule ::= [\\n] ("    " | "\\t") | [ ]?
              whitespace-b-0-4-rule ::= [\\n] | [ ]?"
            `);

            const parsedValue = grammar.parse(JSON.stringify(exampleValidValue));
            expectTypeOf(parsedValue).toMatchTypeOf<schemaType>();
            expect(parsedValue).toEqual(exampleValidValue);
            expect(testGrammar(grammar, exampleValidValue)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue, "dumps")).to.eql(true);

            const parsedValue2 = grammar.parse(JSON.stringify(exampleValidValue2));
            expectTypeOf(parsedValue2).toMatchTypeOf<schemaType>();
            expect(parsedValue2).toEqual(exampleValidValue2);
            expect(testGrammar(grammar, exampleValidValue2)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue2, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue2, "dumps")).to.eql(true);

            const parsedValue3 = grammar.parse(JSON.stringify(exampleValidValue3));
            expectTypeOf(parsedValue3).toMatchTypeOf<schemaType>();
            expect(parsedValue3).toEqual(exampleValidValue3);
            expect(testGrammar(grammar, exampleValidValue3)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue3, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue3, "dumps")).to.eql(true);

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected at least 2 characters but got 1]");
                expect(testGrammar(grammar, exampleInvalidValue)).to.eql(false);
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue2));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected at least 2 characters but got 0]");
                expect(testGrammar(grammar, exampleInvalidValue2)).to.eql(false);
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue3));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected at least 2 characters but got 1]");
                expect(testGrammar(grammar, exampleInvalidValue3)).to.eql(false);
            }
        });

        test("maxLength", async () => {
            const llama = await getTestLlama();
            const grammar = new LlamaJsonSchemaGrammar(llama, {
                type: "object",
                properties: {
                    text: {
                        type: "string",
                        maxLength: 4
                    }
                }
            } as const);
            type schemaType = {
                text: string
            };

            const exampleValidValue = {
                text: "12"
            };
            const exampleValidValue2 = {
                text: "1\n"
            };
            const exampleValidValue3 = {
                text: "1234"
            };

            const exampleInvalidValue = {
                text: "12345"
            };
            const exampleInvalidValue2 = {
                text: "1234\n"
            };
            const exampleInvalidValue3 = {
                text: "12 45"
            };

            expect(grammar.grammar).toMatchInlineSnapshot(`
              "root ::= "{" whitespace-b-1-4-rule "\\"text\\"" ":" [ ]? string-0-4-rule whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
              string-char-rule ::= [^"\\\\\\x7F\\x00-\\x1F] | "\\\\" ["\\\\/bfnrt] | "\\\\u" [0-9a-fA-F]{4}
              string-0-4-rule ::= "\\"" ( string-char-rule ){0,4} "\\""
              whitespace-b-1-4-rule ::= [\\n] ("    " | "\\t") | [ ]?
              whitespace-b-0-4-rule ::= [\\n] | [ ]?"
            `);

            const parsedValue = grammar.parse(JSON.stringify(exampleValidValue));
            expectTypeOf(parsedValue).toMatchTypeOf<schemaType>();
            expect(parsedValue).toEqual(exampleValidValue);
            expect(testGrammar(grammar, exampleValidValue)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue, "dumps")).to.eql(true);

            const parsedValue2 = grammar.parse(JSON.stringify(exampleValidValue2));
            expectTypeOf(parsedValue2).toMatchTypeOf<schemaType>();
            expect(parsedValue2).toEqual(exampleValidValue2);
            expect(testGrammar(grammar, exampleValidValue2)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue2, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue2, "dumps")).to.eql(true);

            const parsedValue3 = grammar.parse(JSON.stringify(exampleValidValue3));
            expectTypeOf(parsedValue3).toMatchTypeOf<schemaType>();
            expect(parsedValue3).toEqual(exampleValidValue3);
            expect(testGrammar(grammar, exampleValidValue3)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue3, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue3, "dumps")).to.eql(true);

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected at most 4 characters but got 5]");
                expect(testGrammar(grammar, exampleInvalidValue)).to.eql(false);
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue2));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected at most 4 characters but got 5]");
                expect(testGrammar(grammar, exampleInvalidValue2)).to.eql(false);
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue3));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected at most 4 characters but got 5]");
                expect(testGrammar(grammar, exampleInvalidValue3)).to.eql(false);
            }
        });

        test("minLength and maxLength", async () => {
            const llama = await getTestLlama();
            const grammar = new LlamaJsonSchemaGrammar(llama, {
                type: "object",
                properties: {
                    text: {
                        type: "string",
                        minLength: 2,
                        maxLength: 4
                    }
                }
            } as const);
            type schemaType = {
                text: string
            };

            const exampleValidValue = {
                text: "12"
            };
            const exampleValidValue2 = {
                text: "123"
            };
            const exampleValidValue3 = {
                text: "1234"
            };

            const exampleInvalidValue = {
                text: "1"
            };
            const exampleInvalidValue2 = {
                text: "12345"
            };
            const exampleInvalidValue3 = {
                text: "123456"
            };

            expect(grammar.grammar).toMatchInlineSnapshot(`
              "root ::= "{" whitespace-b-1-4-rule "\\"text\\"" ":" [ ]? string-2-4-rule whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
              string-char-rule ::= [^"\\\\\\x7F\\x00-\\x1F] | "\\\\" ["\\\\/bfnrt] | "\\\\u" [0-9a-fA-F]{4}
              string-2-4-rule ::= "\\"" ( string-char-rule ){2,4} "\\""
              whitespace-b-1-4-rule ::= [\\n] ("    " | "\\t") | [ ]?
              whitespace-b-0-4-rule ::= [\\n] | [ ]?"
            `);

            const parsedValue = grammar.parse(JSON.stringify(exampleValidValue));
            expectTypeOf(parsedValue).toMatchTypeOf<schemaType>();
            expect(parsedValue).toEqual(exampleValidValue);
            expect(testGrammar(grammar, exampleValidValue)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue, "dumps")).to.eql(true);

            const parsedValue2 = grammar.parse(JSON.stringify(exampleValidValue2));
            expectTypeOf(parsedValue2).toMatchTypeOf<schemaType>();
            expect(parsedValue2).toEqual(exampleValidValue2);
            expect(testGrammar(grammar, exampleValidValue2)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue2, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue2, "dumps")).to.eql(true);

            const parsedValue3 = grammar.parse(JSON.stringify(exampleValidValue3));
            expectTypeOf(parsedValue3).toMatchTypeOf<schemaType>();
            expect(parsedValue3).toEqual(exampleValidValue3);
            expect(testGrammar(grammar, exampleValidValue3)).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue3, "pretty")).to.eql(true);
            expect(testGrammar(grammar, exampleValidValue3, "dumps")).to.eql(true);

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected at least 2 characters but got 1]");
                expect(testGrammar(grammar, exampleInvalidValue)).to.eql(false);
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue2));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected at most 4 characters but got 5]");
                expect(testGrammar(grammar, exampleInvalidValue2)).to.eql(false);
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue3));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected at most 4 characters but got 6]");
                expect(testGrammar(grammar, exampleInvalidValue3)).to.eql(false);
            }
        });

        describe("formats", () => {
            test("date", async () => {
                const llama = await getTestLlama();
                const grammar = new LlamaJsonSchemaGrammar(llama, {
                    type: "object",
                    properties: {
                        text: {
                            type: "string",
                            format: "date"
                        }
                    }
                } as const);
                type schemaType = {
                    text: string
                };

                const exampleValidValue = {
                    text: "2024-12-01"
                };
                const exampleValidValue2 = {
                    text: "2000-01-01"
                };
                const exampleValidValue3 = {
                    text: "2020-10-20"
                };

                const exampleInvalidValue = {
                    text: "2024-12-32"
                };
                const exampleInvalidValue2 = {
                    text: "2024-13-20"
                };
                const exampleInvalidValue3 = {
                    text: "2024-00-20"
                };

                expect(grammar.grammar).toMatchInlineSnapshot(`
                  "root ::= "{" whitespace-b-1-4-rule "\\"text\\"" ":" [ ]? string-format-date-rule whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
                  string-format-date-rule ::= "\\"" [0-9]{4} "-" ("0" [1-9] | "1" [012]) "-" ("0" [1-9] | [12] [0-9] | "3" [01]) "\\""
                  whitespace-b-1-4-rule ::= [\\n] ("    " | "\\t") | [ ]?
                  whitespace-b-0-4-rule ::= [\\n] | [ ]?"
                `);

                const parsedValue = grammar.parse(JSON.stringify(exampleValidValue));
                expectTypeOf(parsedValue).toMatchTypeOf<schemaType>();
                expect(parsedValue).toEqual(exampleValidValue);
                expect(testGrammar(grammar, exampleValidValue)).to.eql(true);
                expect(testGrammar(grammar, exampleValidValue, "pretty")).to.eql(true);
                expect(testGrammar(grammar, exampleValidValue, "dumps")).to.eql(true);

                const parsedValue2 = grammar.parse(JSON.stringify(exampleValidValue2));
                expectTypeOf(parsedValue2).toMatchTypeOf<schemaType>();
                expect(parsedValue2).toEqual(exampleValidValue2);
                expect(testGrammar(grammar, exampleValidValue2)).to.eql(true);
                expect(testGrammar(grammar, exampleValidValue2, "pretty")).to.eql(true);
                expect(testGrammar(grammar, exampleValidValue2, "dumps")).to.eql(true);

                const parsedValue3 = grammar.parse(JSON.stringify(exampleValidValue3));
                expectTypeOf(parsedValue3).toMatchTypeOf<schemaType>();
                expect(parsedValue3).toEqual(exampleValidValue3);
                expect(testGrammar(grammar, exampleValidValue3)).to.eql(true);
                expect(testGrammar(grammar, exampleValidValue3, "pretty")).to.eql(true);
                expect(testGrammar(grammar, exampleValidValue3, "dumps")).to.eql(true);

                try {
                    grammar.parse(JSON.stringify(exampleInvalidValue));
                    expect.unreachable("Parsing should have failed");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot('[Error: Expected a valid date string but got "2024-12-32"]');
                    expect(testGrammar(grammar, exampleInvalidValue)).to.eql(false);
                }

                try {
                    grammar.parse(JSON.stringify(exampleInvalidValue2));
                    expect.unreachable("Parsing should have failed");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot('[Error: Expected a valid date string but got "2024-13-20"]');
                    expect(testGrammar(grammar, exampleInvalidValue2)).to.eql(false);
                }

                try {
                    grammar.parse(JSON.stringify(exampleInvalidValue3));
                    expect.unreachable("Parsing should have failed");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot('[Error: Expected a valid date string but got "2024-00-20"]');
                    expect(testGrammar(grammar, exampleInvalidValue3)).to.eql(false);
                }
            });

            test("time", async () => {
                const llama = await getTestLlama();
                const grammar = new LlamaJsonSchemaGrammar(llama, {
                    type: "object",
                    properties: {
                        text: {
                            type: "string",
                            format: "time"
                        }
                    }
                } as const);
                type schemaType = {
                    text: string
                };

                const exampleValidValue = {
                    text: "02:00:00.010Z"
                };
                const exampleValidValue2 = {
                    text: "12:00:00Z"
                };
                const exampleValidValue3 = {
                    text: "22:00:00+01:00"
                };
                const exampleValidValue4 = {
                    text: "12:00:00.001+01:00"
                };

                const exampleInvalidValue = {
                    text: "12:00:00.000"
                };
                const exampleInvalidValue2 = {
                    text: "12:00:00"
                };
                const exampleInvalidValue3 = {
                    text: "24:00:00Z"
                };
                const exampleInvalidValue4 = {
                    text: "22:60:00Z"
                };

                expect(grammar.grammar).toMatchInlineSnapshot(`
                  "root ::= "{" whitespace-b-1-4-rule "\\"text\\"" ":" [ ]? string-format-time-rule whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
                  string-format-time-rule ::= "\\"" ([01] [0-9] | "2" [0-3]) ":" [0-5] [0-9] ":" [0-5] [0-9] ( "." [0-9]{3} )? ("Z" | ("+" | "-") ([01] [0-9] | "2" [0-3]) ":" [0-5] [0-9]) "\\""
                  whitespace-b-1-4-rule ::= [\\n] ("    " | "\\t") | [ ]?
                  whitespace-b-0-4-rule ::= [\\n] | [ ]?"
                `);

                const parsedValue = grammar.parse(JSON.stringify(exampleValidValue));
                expectTypeOf(parsedValue).toMatchTypeOf<schemaType>();
                expect(parsedValue).toEqual(exampleValidValue);
                expect(testGrammar(grammar, exampleValidValue)).to.eql(true);
                expect(testGrammar(grammar, exampleValidValue, "pretty")).to.eql(true);
                expect(testGrammar(grammar, exampleValidValue, "dumps")).to.eql(true);

                const parsedValue2 = grammar.parse(JSON.stringify(exampleValidValue2));
                expectTypeOf(parsedValue2).toMatchTypeOf<schemaType>();
                expect(parsedValue2).toEqual(exampleValidValue2);
                expect(testGrammar(grammar, exampleValidValue2)).to.eql(true);
                expect(testGrammar(grammar, exampleValidValue2, "pretty")).to.eql(true);
                expect(testGrammar(grammar, exampleValidValue2, "dumps")).to.eql(true);

                const parsedValue3 = grammar.parse(JSON.stringify(exampleValidValue3));
                expectTypeOf(parsedValue3).toMatchTypeOf<schemaType>();
                expect(parsedValue3).toEqual(exampleValidValue3);
                expect(testGrammar(grammar, exampleValidValue3)).to.eql(true);
                expect(testGrammar(grammar, exampleValidValue3, "pretty")).to.eql(true);
                expect(testGrammar(grammar, exampleValidValue3, "dumps")).to.eql(true);

                const parsedValue4 = grammar.parse(JSON.stringify(exampleValidValue4));
                expectTypeOf(parsedValue4).toMatchTypeOf<schemaType>();
                expect(parsedValue4).toEqual(exampleValidValue4);
                expect(testGrammar(grammar, exampleValidValue4)).to.eql(true);
                expect(testGrammar(grammar, exampleValidValue4, "pretty")).to.eql(true);
                expect(testGrammar(grammar, exampleValidValue4, "dumps")).to.eql(true);

                try {
                    grammar.parse(JSON.stringify(exampleInvalidValue));
                    expect.unreachable("Parsing should have failed");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot('[Error: Expected a valid time string but got "12:00:00.000"]');
                    expect(testGrammar(grammar, exampleInvalidValue)).to.eql(false);
                }

                try {
                    grammar.parse(JSON.stringify(exampleInvalidValue2));
                    expect.unreachable("Parsing should have failed");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot('[Error: Expected a valid time string but got "12:00:00"]');
                    expect(testGrammar(grammar, exampleInvalidValue2)).to.eql(false);
                }

                try {
                    grammar.parse(JSON.stringify(exampleInvalidValue3));
                    expect.unreachable("Parsing should have failed");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot('[Error: Expected a valid time string but got "24:00:00Z"]');
                    expect(testGrammar(grammar, exampleInvalidValue3)).to.eql(false);
                }

                try {
                    grammar.parse(JSON.stringify(exampleInvalidValue4));
                    expect.unreachable("Parsing should have failed");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot('[Error: Expected a valid time string but got "22:60:00Z"]');
                    expect(testGrammar(grammar, exampleInvalidValue4)).to.eql(false);
                }
            });

            test("date-time", async () => {
                const llama = await getTestLlama();
                const grammar = new LlamaJsonSchemaGrammar(llama, {
                    type: "object",
                    properties: {
                        text: {
                            type: "string",
                            format: "date-time"
                        }
                    }
                } as const);
                type schemaType = {
                    text: string
                };

                const exampleValidValue = {
                    text: "2024-12-01T02:00:00.010Z"
                };
                const exampleValidValue2 = {
                    text: "2000-01-01T12:00:00Z"
                };
                const exampleValidValue3 = {
                    text: "2020-10-20T22:00:00+01:00"
                };
                const exampleValidValue4 = {
                    text: "2020-10-20T12:00:00.001+01:00"
                };

                const exampleInvalidValue = {
                    text: "2024-12-01T12:00:00.000"
                };
                const exampleInvalidValue2 = {
                    text: "2024-12-32T02:00:00.010Z"
                };
                const exampleInvalidValue3 = {
                    text: "2000-01-01T24:00:00Z"
                };
                const exampleInvalidValue4 = {
                    text: "2024-00-20T22:00:00+01:00"
                };

                expect(grammar.grammar).toMatchInlineSnapshot(`
                  "root ::= "{" whitespace-b-1-4-rule "\\"text\\"" ":" [ ]? string-format-date-time-rule whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
                  string-format-date-time-rule ::= "\\"" [0-9]{4} "-" ("0" [1-9] | "1" [012]) "-" ("0" [1-9] | [12] [0-9] | "3" [01]) "T" ([01] [0-9] | "2" [0-3]) ":" [0-5] [0-9] ":" [0-5] [0-9] ( "." [0-9]{3} )? ("Z" | ("+" | "-") ([01] [0-9] | "2" [0-3]) ":" [0-5] [0-9]) "\\""
                  whitespace-b-1-4-rule ::= [\\n] ("    " | "\\t") | [ ]?
                  whitespace-b-0-4-rule ::= [\\n] | [ ]?"
                `);

                const parsedValue = grammar.parse(JSON.stringify(exampleValidValue));
                expectTypeOf(parsedValue).toMatchTypeOf<schemaType>();
                expect(parsedValue).toEqual(exampleValidValue);
                expect(testGrammar(grammar, exampleValidValue)).to.eql(true);
                expect(testGrammar(grammar, exampleValidValue, "pretty")).to.eql(true);
                expect(testGrammar(grammar, exampleValidValue, "dumps")).to.eql(true);

                const parsedValue2 = grammar.parse(JSON.stringify(exampleValidValue2));
                expectTypeOf(parsedValue2).toMatchTypeOf<schemaType>();
                expect(parsedValue2).toEqual(exampleValidValue2);
                expect(testGrammar(grammar, exampleValidValue2)).to.eql(true);
                expect(testGrammar(grammar, exampleValidValue2, "pretty")).to.eql(true);
                expect(testGrammar(grammar, exampleValidValue2, "dumps")).to.eql(true);

                const parsedValue3 = grammar.parse(JSON.stringify(exampleValidValue3));
                expectTypeOf(parsedValue3).toMatchTypeOf<schemaType>();
                expect(parsedValue3).toEqual(exampleValidValue3);
                expect(testGrammar(grammar, exampleValidValue3)).to.eql(true);
                expect(testGrammar(grammar, exampleValidValue3, "pretty")).to.eql(true);
                expect(testGrammar(grammar, exampleValidValue3, "dumps")).to.eql(true);

                const parsedValue4 = grammar.parse(JSON.stringify(exampleValidValue4));
                expectTypeOf(parsedValue4).toMatchTypeOf<schemaType>();
                expect(parsedValue4).toEqual(exampleValidValue4);
                expect(testGrammar(grammar, exampleValidValue4)).to.eql(true);
                expect(testGrammar(grammar, exampleValidValue4, "pretty")).to.eql(true);
                expect(testGrammar(grammar, exampleValidValue4, "dumps")).to.eql(true);

                try {
                    grammar.parse(JSON.stringify(exampleInvalidValue));
                    expect.unreachable("Parsing should have failed");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot('[Error: Expected a valid date-time string but got "2024-12-01T12:00:00.000"]');
                    expect(testGrammar(grammar, exampleInvalidValue)).to.eql(false);
                }

                try {
                    grammar.parse(JSON.stringify(exampleInvalidValue2));
                    expect.unreachable("Parsing should have failed");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot('[Error: Expected a valid date-time string but got "2024-12-32T02:00:00.010Z"]');
                    expect(testGrammar(grammar, exampleInvalidValue2)).to.eql(false);
                }

                try {
                    grammar.parse(JSON.stringify(exampleInvalidValue3));
                    expect.unreachable("Parsing should have failed");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot('[Error: Expected a valid date-time string but got "2000-01-01T24:00:00Z"]');
                    expect(testGrammar(grammar, exampleInvalidValue3)).to.eql(false);
                }

                try {
                    grammar.parse(JSON.stringify(exampleInvalidValue4));
                    expect.unreachable("Parsing should have failed");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot('[Error: Expected a valid date-time string but got "2024-00-20T22:00:00+01:00"]');
                    expect(testGrammar(grammar, exampleInvalidValue4)).to.eql(false);
                }
            });
        });
    });
});

function testGrammar(grammar: LlamaJsonSchemaGrammar<any>, object: any, formattingType: false | "dumps" | "pretty" = false) {
    if (formattingType === "pretty")
        return grammar._testText(JSON.stringify(object, undefined, 4) + "\n".repeat(4));
    else if (formattingType === "dumps")
        return grammar._testText(jsonDumps(object) + "\n".repeat(4));

    return grammar._testText(JSON.stringify(object) + "\n".repeat(4));
}
