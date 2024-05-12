import {describe, expect, test} from "vitest";
import {Llama2ChatWrapper} from "../../../src/index.js";
import {FunctionCallGrammar} from "../../../src/evaluator/LlamaChat/utils/FunctionCallGrammar.js";
import {getTestLlama} from "../../utils/getTestLlama.js";


describe("grammar for functions", () => {
    test("object", async () => {
        const chatWrapper = new Llama2ChatWrapper();
        const llama = await getTestLlama();
        const grammar = new FunctionCallGrammar(llama, {
            func1: {

            },
            func2: {
                params: {
                    type: "object",
                    properties: {
                        message: {
                            type: "string"
                        },
                        feeling: {
                            enum: ["good", "bad"]
                        },
                        words: {
                            type: "number"
                        }
                    }
                }
            },
            func3: {
                description: "Some description here",
                params: {
                    type: "array",
                    items: {
                        type: "string"
                    }
                }
            }
        } as const, chatWrapper, true);

        expect(grammar.grammar).toMatchInlineSnapshot(
            `
          "root ::= [ ]? "[[call: " rule10 ")]]" [\\n] [\\n] [\\n] [\\n] [\\n]*
          whitespace-b-1-4-rule ::= ([\\n] ("    " | "\\t") | [ ]?)
          string-rule ::= "\\"" ([^"\\\\\\x7F\\x00-\\x1F] | "\\\\" (["\\\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]))* "\\""
          rule1 ::= "\\"good\\""
          rule2 ::= "\\"bad\\""
          rule3 ::= ( rule1 | rule2 )
          fractional-number-rule ::= ("-"? ([0-9] | [1-9] [0-9]*)) ("." [0-9]+)? ([eE] [-+]? [0-9]+)?
          whitespace-b-0-4-rule ::= ([\\n] | [ ]?)
          rule0 ::= "{" whitespace-b-1-4-rule "\\"message\\"" ":" [ ]? string-rule "," whitespace-b-1-4-rule "\\"feeling\\"" ":" [ ]? rule3 "," whitespace-b-1-4-rule "\\"words\\"" ":" [ ]? fractional-number-rule whitespace-b-0-4-rule "}"
          rule5 ::= ( string-rule ) ( "," whitespace-b-1-4-rule string-rule )*
          rule6 ::= ( string-rule )?
          rule4 ::= "[" whitespace-b-1-4-rule ( rule5 | rule6 ) whitespace-b-0-4-rule "]"
          rule7 ::= "func1("
          rule8 ::= "func2(" rule0
          rule9 ::= "func3(" rule4
          rule10 ::= ( rule7 | rule8 | rule9 )"
        `
        );
    });
});
