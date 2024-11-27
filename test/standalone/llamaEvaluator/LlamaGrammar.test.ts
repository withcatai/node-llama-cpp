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
          "root ::= "{" whitespace-b-1-4-rule "\\"message\\"" ":" [ ]? rule0 "," whitespace-b-1-4-rule "\\"numberOfWordsInMessage\\"" ":" [ ]? integer-number-rule "," whitespace-b-1-4-rule "\\"feelingGoodPercentage\\"" ":" [ ]? fractional-number-rule "," whitespace-b-1-4-rule "\\"feelingGood\\"" ":" [ ]? boolean-rule "," whitespace-b-1-4-rule "\\"feelingOverall\\"" ":" [ ]? rule1 "," whitespace-b-1-4-rule "\\"verbsInMessage\\"" ":" [ ]? rule2 whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
          whitespace-b-1-4-rule ::= ([\\n] ("    " | "\\t") | [ ]?)
          string-rule ::= "\\"" ([^"\\\\\\x7F\\x00-\\x1F] | "\\\\" (["\\\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]))* "\\""
          null-rule ::= "null"
          rule0 ::= ( string-rule | null-rule )
          integer-number-rule ::= ("-"? ([0-9] | [1-9] [0-9]*))
          fractional-number-rule ::= ("-"? ([0-9] | [1-9] [0-9]*)) ("." [0-9]+)? ([eE] [-+]? [0-9]+)?
          boolean-rule ::= ( "true" | "false" )
          val0 ::= "\\"good\\""
          val1 ::= "\\"bad\\""
          rule1 ::= ( val0 | val1 )
          comma-whitespace-b-2-4-rule ::= "," ([\\n] (" "{8} | "\\t\\t") | [ ]?)
          whitespace-b-2-4-rule ::= ([\\n] (" "{8} | "\\t\\t") | [ ]?)
          rule2 ::= "[" whitespace-b-2-4-rule ( string-rule ( comma-whitespace-b-2-4-rule string-rule )* )? whitespace-b-1-4-rule "]"
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
          "root ::= "[" whitespace-b-1-4-rule ( rule1 ( comma-whitespace-b-1-4-rule rule1 )* )? whitespace-b-0-4-rule "]" "\\n\\n\\n\\n" [\\n]*
          whitespace-b-1-4-rule ::= ([\\n] ("    " | "\\t") | [ ]?)
          string-rule ::= "\\"" ([^"\\\\\\x7F\\x00-\\x1F] | "\\\\" (["\\\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]))* "\\""
          whitespace-b-0-4-rule ::= ([\\n] | [ ]?)
          rule0 ::= "{" whitespace-b-1-4-rule "\\"message\\"" ":" [ ]? string-rule whitespace-b-0-4-rule "}"
          rule1 ::= ( rule0 | string-rule )
          comma-whitespace-b-1-4-rule ::= "," ([\\n] ("    " | "\\t") | [ ]?)"
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
          "root ::= "{" whitespace-b-1-4-rule "\\"onlyPositiveText\\"" ":" [ ]? "true" "," whitespace-b-1-4-rule "\\"onlyNegativeText\\"" ":" [ ]? "false" "," whitespace-b-1-4-rule "\\"onlyVibe\\"" ":" [ ]? val0 "," whitespace-b-1-4-rule "\\"onlyNumber\\"" ":" [ ]? "10" "," whitespace-b-1-4-rule "\\"worstThing\\"" ":" [ ]? null-rule "," whitespace-b-1-4-rule "\\"withNewLine\\"" ":" [ ]? val1 "," whitespace-b-1-4-rule "\\"withQuotes\\"" ":" [ ]? val2 whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
          whitespace-b-1-4-rule ::= ([\\n] ("    " | "\\t") | [ ]?)
          val0 ::= "\\"good\\""
          null-rule ::= "null"
          val1 ::= "\\"Hooray!\\nYes!\\t/\\\\\\""
          val2 ::= "\\"The message is \\\\\\"Hi!\\\\\\".\\""
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
          "root ::= "{" whitespace-b-1-4-rule "\\"onlyPositiveText\\"" ":" [ ]? "true" "," whitespace-b-1-4-rule "\\"onlyNegativeText\\"" ":" [ ]? "false" "," whitespace-b-1-4-rule "\\"onlyVibe\\"" ":" [ ]? val0 "," whitespace-b-1-4-rule "\\"onlyNumber\\"" ":" [ ]? "10" "," whitespace-b-1-4-rule "\\"worstThing\\"" ":" [ ]? null-rule "," whitespace-b-1-4-rule "\\"withNewLine\\"" ":" [ ]? val1 "," whitespace-b-1-4-rule "\\"withQuotes\\"" ":" [ ]? val2 whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
          whitespace-b-1-4-rule ::= ([\\n] ("    " | "\\t") | [ ]?)
          val0 ::= "\\"good\\""
          null-rule ::= "null"
          val1 ::= "\\"Hooray!\\nYes!\\t/\\\\\\""
          val2 ::= "\\"The message is \\\\\\"Hi!\\\\\\".\\""
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
          "root ::= "{" whitespace-b-1-4-rule "\\"onlyPositiveText\\"" ":" [ ]? "true" "," whitespace-b-1-4-rule "\\"onlyNegativeText\\"" ":" [ ]? "false" "," whitespace-b-1-4-rule "\\"onlyVibe\\"" ":" [ ]? val0 "," whitespace-b-1-4-rule "\\"onlyNumber\\"" ":" [ ]? "10" "," whitespace-b-1-4-rule "\\"worstThing\\"" ":" [ ]? null-rule "," whitespace-b-1-4-rule "\\"withNewLine\\"" ":" [ ]? val1 "," whitespace-b-1-4-rule "\\"withQuotes\\"" ":" [ ]? val2 whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
          whitespace-b-1-4-rule ::= ([\\n] ("    " | "\\t") | [ ]?)
          val0 ::= "\\"good\\""
          null-rule ::= "null"
          val1 ::= "\\"Hooray!\\nYes!\\t/\\\\\\""
          val2 ::= "\\"The message is \\\\\\"Hi!\\\\\\".\\""
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
              "root ::= "{" whitespace-b-1-4-rule "\\"simple\\"" ":" [ ]? rule2 "," whitespace-b-1-4-rule "\\"withMinItems\\"" ":" [ ]? rule3 whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
              whitespace-b-1-4-rule ::= ([\\n] ("    " | "\\t") | [ ]?)
              string-rule ::= "\\"" ([^"\\\\\\x7F\\x00-\\x1F] | "\\\\" (["\\\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]))* "\\""
              fractional-number-rule ::= ("-"? ([0-9] | [1-9] [0-9]*)) ("." [0-9]+)? ([eE] [-+]? [0-9]+)?
              boolean-rule ::= ( "true" | "false" )
              null-rule ::= "null"
              comma-whitespace-no-new-lines-rule ::= "," [ ]?
              whitespace-no-new-lines-rule ::= [ ]?
              rule0 ::= "[" whitespace-no-new-lines-rule ( any-json-s-0-4-rule ( comma-whitespace-no-new-lines-rule any-json-s-0-4-rule )* )? whitespace-no-new-lines-rule "]"
              any-json-s-0-4-rule ::= ( string-rule | fractional-number-rule | boolean-rule | null-rule | rule0 )
              comma-whitespace-b-1-4-rule ::= "," ([\\n] ("    " | "\\t") | [ ]?)
              whitespace-b-0-4-rule ::= ([\\n] | [ ]?)
              rule1 ::= "[" whitespace-b-1-4-rule ( any-json-s-0-4-rule ( comma-whitespace-b-1-4-rule any-json-s-0-4-rule )* )? whitespace-b-0-4-rule "]"
              any-json-0-4-rule ::= ( string-rule | fractional-number-rule | boolean-rule | null-rule | rule1 )
              comma-whitespace-b-2-4-rule ::= "," ([\\n] (" "{8} | "\\t\\t") | [ ]?)
              whitespace-b-2-4-rule ::= ([\\n] (" "{8} | "\\t\\t") | [ ]?)
              rule2 ::= "[" whitespace-b-2-4-rule ( any-json-0-4-rule ( comma-whitespace-b-2-4-rule any-json-0-4-rule )* )? whitespace-b-1-4-rule "]"
              rule3 ::= "[" whitespace-b-2-4-rule any-json-0-4-rule ( comma-whitespace-b-2-4-rule any-json-0-4-rule ){1,} whitespace-b-1-4-rule "]""
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
                expect(err).toMatchInlineSnapshot('[Error: Expected an array but got "string"]');
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue2));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected at least 2 items but got 1]");
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue3));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected at least 2 items but got 0]");
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
              "root ::= "{" whitespace-b-1-4-rule "\\"simple\\"" ":" [ ]? rule0 "," whitespace-b-1-4-rule "\\"withMinItems\\"" ":" [ ]? rule1 "," whitespace-b-1-4-rule "\\"withMaxItems\\"" ":" [ ]? rule2 "," whitespace-b-1-4-rule "\\"withMinAndMaxItems\\"" ":" [ ]? rule3 "," whitespace-b-1-4-rule "\\"withEqualMinAndMaxItems\\"" ":" [ ]? rule4 whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
              whitespace-b-1-4-rule ::= ([\\n] ("    " | "\\t") | [ ]?)
              string-rule ::= "\\"" ([^"\\\\\\x7F\\x00-\\x1F] | "\\\\" (["\\\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]))* "\\""
              comma-whitespace-b-2-4-rule ::= "," ([\\n] (" "{8} | "\\t\\t") | [ ]?)
              whitespace-b-2-4-rule ::= ([\\n] (" "{8} | "\\t\\t") | [ ]?)
              rule0 ::= "[" whitespace-b-2-4-rule ( string-rule ( comma-whitespace-b-2-4-rule string-rule )* )? whitespace-b-1-4-rule "]"
              rule1 ::= "[" whitespace-b-2-4-rule string-rule ( comma-whitespace-b-2-4-rule string-rule ){1,} whitespace-b-1-4-rule "]"
              rule2 ::= "[" whitespace-b-2-4-rule ( string-rule ( comma-whitespace-b-2-4-rule string-rule ){0,2} )? whitespace-b-1-4-rule "]"
              rule3 ::= "[" whitespace-b-2-4-rule string-rule ( comma-whitespace-b-2-4-rule string-rule ){1,2} whitespace-b-1-4-rule "]"
              rule4 ::= "[" whitespace-b-2-4-rule string-rule ( comma-whitespace-b-2-4-rule string-rule ){2} whitespace-b-1-4-rule "]"
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
                expect(err).toMatchInlineSnapshot("[Error: Expected at least 2 items but got 1]");
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue3));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected exactly 3 items but got 2]");
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
              "root ::= "{" whitespace-b-1-4-rule "\\"simple\\"" ":" [ ]? rule4 "," whitespace-b-1-4-rule "\\"withAdditionalItems\\"" ":" [ ]? rule6 "," whitespace-b-1-4-rule "\\"withAdditionalItemsAndMin\\"" ":" [ ]? rule8 "," whitespace-b-1-4-rule "\\"withAdditionalItemsAndMax\\"" ":" [ ]? rule9 "," whitespace-b-1-4-rule "\\"withMaxSizeOfPrefixItems\\"" ":" [ ]? rule10 "," whitespace-b-1-4-rule "\\"withAdditionalItemsAndMaxSizeOfPrefixItems\\"" ":" [ ]? rule10 "," whitespace-b-1-4-rule "\\"withAdditionalItemsAndMinAndMax\\"" ":" [ ]? rule11 "," whitespace-b-1-4-rule "\\"withAdditionalItemsAndMinAndMaxEquals\\"" ":" [ ]? rule12 whitespace-b-0-4-rule "}" "\\n\\n\\n\\n" [\\n]*
              whitespace-b-1-4-rule ::= ([\\n] ("    " | "\\t") | [ ]?)
              string-rule ::= "\\"" ([^"\\\\\\x7F\\x00-\\x1F] | "\\\\" (["\\\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]))* "\\""
              comma-whitespace-b-2-4-rule ::= "," ([\\n] (" "{8} | "\\t\\t") | [ ]?)
              boolean-rule ::= ( "true" | "false" )
              fractional-number-rule ::= ("-"? ([0-9] | [1-9] [0-9]*)) ("." [0-9]+)? ([eE] [-+]? [0-9]+)?
              null-rule ::= "null"
              whitespace-b-2-4-rule ::= ([\\n] (" "{8} | "\\t\\t") | [ ]?)
              rule0 ::= "{" whitespace-b-2-4-rule "\\"message\\"" ":" [ ]? string-rule whitespace-b-1-4-rule "}"
              rule1 ::= "[" whitespace-b-2-4-rule ( string-rule ( comma-whitespace-b-2-4-rule string-rule )* )? whitespace-b-1-4-rule "]"
              comma-whitespace-no-new-lines-rule ::= "," [ ]?
              whitespace-no-new-lines-rule ::= [ ]?
              rule2 ::= "[" whitespace-no-new-lines-rule ( any-json-s-0-4-rule ( comma-whitespace-no-new-lines-rule any-json-s-0-4-rule )* )? whitespace-no-new-lines-rule "]"
              any-json-s-0-4-rule ::= ( string-rule | fractional-number-rule | boolean-rule | null-rule | rule2 )
              comma-whitespace-b-1-4-rule ::= "," ([\\n] ("    " | "\\t") | [ ]?)
              whitespace-b-0-4-rule ::= ([\\n] | [ ]?)
              rule3 ::= "[" whitespace-b-1-4-rule ( any-json-s-0-4-rule ( comma-whitespace-b-1-4-rule any-json-s-0-4-rule )* )? whitespace-b-0-4-rule "]"
              any-json-0-4-rule ::= ( string-rule | fractional-number-rule | boolean-rule | null-rule | rule3 )
              rule4 ::= "[" whitespace-b-2-4-rule string-rule comma-whitespace-b-2-4-rule boolean-rule comma-whitespace-b-2-4-rule fractional-number-rule comma-whitespace-b-2-4-rule null-rule comma-whitespace-b-2-4-rule rule0 comma-whitespace-b-2-4-rule rule1 comma-whitespace-b-2-4-rule ( any-json-0-4-rule ( comma-whitespace-b-2-4-rule any-json-0-4-rule )* )? whitespace-b-1-4-rule "]"
              val0 ::= "\\"1\\""
              rule5 ::= ( val0 | "-6" )
              rule6 ::= "[" whitespace-b-2-4-rule string-rule comma-whitespace-b-2-4-rule boolean-rule comma-whitespace-b-2-4-rule fractional-number-rule comma-whitespace-b-2-4-rule null-rule comma-whitespace-b-2-4-rule rule0 comma-whitespace-b-2-4-rule rule1 comma-whitespace-b-2-4-rule ( rule5 ( comma-whitespace-b-2-4-rule rule5 )* )? whitespace-b-1-4-rule "]"
              val1 ::= "-600"
              rule7 ::= ( val0 | val1 )
              rule8 ::= "[" whitespace-b-2-4-rule string-rule comma-whitespace-b-2-4-rule boolean-rule comma-whitespace-b-2-4-rule fractional-number-rule comma-whitespace-b-2-4-rule null-rule comma-whitespace-b-2-4-rule rule0 comma-whitespace-b-2-4-rule rule1 comma-whitespace-b-2-4-rule rule7 ( comma-whitespace-b-2-4-rule rule7 ){1,} whitespace-b-1-4-rule "]"
              rule9 ::= "[" whitespace-b-2-4-rule string-rule comma-whitespace-b-2-4-rule boolean-rule comma-whitespace-b-2-4-rule fractional-number-rule comma-whitespace-b-2-4-rule null-rule comma-whitespace-b-2-4-rule rule0 comma-whitespace-b-2-4-rule rule1 comma-whitespace-b-2-4-rule ( rule5 ( comma-whitespace-b-2-4-rule rule5 )? )? whitespace-b-1-4-rule "]"
              rule10 ::= "[" whitespace-b-2-4-rule string-rule comma-whitespace-b-2-4-rule boolean-rule comma-whitespace-b-2-4-rule fractional-number-rule comma-whitespace-b-2-4-rule null-rule comma-whitespace-b-2-4-rule rule0 comma-whitespace-b-2-4-rule rule1 whitespace-b-1-4-rule "]"
              rule11 ::= "[" whitespace-b-2-4-rule string-rule comma-whitespace-b-2-4-rule boolean-rule comma-whitespace-b-2-4-rule fractional-number-rule comma-whitespace-b-2-4-rule null-rule comma-whitespace-b-2-4-rule rule0 comma-whitespace-b-2-4-rule rule1 comma-whitespace-b-2-4-rule rule5 ( comma-whitespace-b-2-4-rule rule5 ){1,3} whitespace-b-1-4-rule "]"
              rule12 ::= "[" whitespace-b-2-4-rule string-rule comma-whitespace-b-2-4-rule boolean-rule comma-whitespace-b-2-4-rule fractional-number-rule comma-whitespace-b-2-4-rule null-rule comma-whitespace-b-2-4-rule rule0 comma-whitespace-b-2-4-rule rule1 comma-whitespace-b-2-4-rule rule5 ( comma-whitespace-b-2-4-rule rule5 ){3} whitespace-b-1-4-rule "]""
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
                expect(err).toMatchInlineSnapshot('[Error: Expected one of ["1", -6] but got "extra"]');
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue2));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot('[Error: Expected one of ["1", -600] but got "extra"]');
            }

            try {
                grammar.parse(JSON.stringify(exampleInvalidValue3));
                expect.unreachable("Parsing should have failed");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: Expected at most 8 items but got 10]");
            }
        });
    });
});
