import {describe, expect, test} from "vitest";
import {getLlama, LlamaChatWrapper} from "../../../src/index.js";
import {FunctionCallGrammar} from "../../../src/llamaEvaluator/LlamaChat/utils/FunctionCallGrammar.js";


describe("grammar for functions", () => {
    test("object", async () => {
        const chatWrapper = new LlamaChatWrapper();
        const llama = await getLlama();
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
          "root ::= [ ]? \\"[[call: \\" rule10 \\")]]\\" [\\\\n] [\\\\n] [\\\\n] [\\\\n] [\\\\n]*
          whitespace-new-lines-rule ::= [\\\\n]? [ \\\\t]* [\\\\n]?
          string-rule ::= \\"\\\\\\"\\" ( [^\\"\\\\\\\\] | \\"\\\\\\\\\\" ([\\"\\\\\\\\/bfnrt] | \\"u\\" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]))* \\"\\\\\\"\\"
          rule1 ::= \\"\\\\\\"good\\\\\\"\\"
          rule2 ::= \\"\\\\\\"bad\\\\\\"\\"
          rule3 ::= ( rule1 | rule2 )
          fractional-number-rule ::= (\\"-\\"? ([0-9] | [1-9] [0-9]*)) (\\".\\" [0-9]+)? ([eE] [-+]? [0-9]+)?
          rule0 ::= \\"{\\" whitespace-new-lines-rule \\"\\\\\\"message\\\\\\"\\" \\":\\" [ ]? string-rule \\",\\" whitespace-new-lines-rule \\"\\\\\\"feeling\\\\\\"\\" \\":\\" [ ]? rule3 \\",\\" whitespace-new-lines-rule \\"\\\\\\"words\\\\\\"\\" \\":\\" [ ]? fractional-number-rule whitespace-new-lines-rule \\"}\\"
          rule5 ::= ( string-rule ) ( \\",\\" whitespace-new-lines-rule string-rule )*
          rule6 ::= ( string-rule )?
          rule4 ::= \\"[\\" whitespace-new-lines-rule ( rule5 | rule6 ) whitespace-new-lines-rule \\"]\\"
          rule7 ::= \\"func1(\\"
          rule8 ::= \\"func2(\\" rule0
          rule9 ::= \\"func3(\\" rule4
          rule10 ::= ( rule7 | rule8 | rule9 )"
        `
        );
    });
});
