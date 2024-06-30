import {describe, expect, test} from "vitest";
import {GbnfJsonSchema, Llama2ChatWrapper} from "../../../src/index.js";
import {getTestLlama} from "../../utils/getTestLlama.js";
import {FunctionCallNameGrammar} from "../../../src/evaluator/LlamaChat/utils/FunctionCallNameGrammar.js";
import {FunctionCallParamsGrammar} from "../../../src/evaluator/LlamaChat/utils/FunctionCallParamsGrammar.js";


describe("grammar for functions", () => {
    const functions = {
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
                        type: "integer"
                    }
                }
            } satisfies GbnfJsonSchema
        },
        func3: {
            description: "Some description here",
            params: {
                type: "array",
                items: {
                    type: "string"
                }
            } satisfies GbnfJsonSchema
        }
    } as const;

    test("FunctionCallNameGrammar", async () => {
        const chatWrapper = new Llama2ChatWrapper();
        const llama = await getTestLlama();
        const grammar = new FunctionCallNameGrammar(llama, functions, chatWrapper);

        expect(grammar.grammar).toMatchInlineSnapshot(
            `
          "root ::= [ ]? rule3 [\\n]
          rule0 ::= "func1"
          rule1 ::= "func2"
          rule2 ::= "func3"
          rule3 ::= ( rule0 | rule1 | rule2 )"
        `
        );
    });

    test("FunctionCallParamsGrammar", async () => {
        const chatWrapper = new Llama2ChatWrapper();
        const llama = await getTestLlama();
        const grammar1 = new FunctionCallParamsGrammar(llama, functions, chatWrapper, "func2", functions.func2.params);

        expect(grammar1.grammar).toMatchInlineSnapshot(
            `
          "root ::= "{" whitespace-b-1-4-rule "\\"message\\"" ":" [ ]? string-rule "," whitespace-b-1-4-rule "\\"feeling\\"" ":" [ ]? rule2 "," whitespace-b-1-4-rule "\\"words\\"" ":" [ ]? integer-number-rule whitespace-b-0-4-rule "}" "\\n\\n\\n\\n"
          whitespace-b-1-4-rule ::= ([\\n] ("    " | "\\t") | [ ]?)
          string-rule ::= "\\"" ([^"\\\\\\x7F\\x00-\\x1F] | "\\\\" (["\\\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]))* "\\""
          rule0 ::= "\\"good\\""
          rule1 ::= "\\"bad\\""
          rule2 ::= ( rule0 | rule1 )
          integer-number-rule ::= ("-"? ([0-9] | [1-9] [0-9]*))
          whitespace-b-0-4-rule ::= ([\\n] | [ ]?)"
        `
        );

        const grammar2 = new FunctionCallParamsGrammar(llama, functions, chatWrapper, "func3", functions.func3.params);

        expect(grammar2.grammar).toMatchInlineSnapshot(
            `
          "root ::= "[" whitespace-b-1-4-rule ( rule0 | rule1 ) whitespace-b-0-4-rule "]" "\\n\\n\\n\\n"
          string-rule ::= "\\"" ([^"\\\\\\x7F\\x00-\\x1F] | "\\\\" (["\\\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]))* "\\""
          whitespace-b-1-4-rule ::= ([\\n] ("    " | "\\t") | [ ]?)
          rule0 ::= ( string-rule ) ( "," whitespace-b-1-4-rule string-rule )*
          rule1 ::= ( string-rule )?
          whitespace-b-0-4-rule ::= ([\\n] | [ ]?)"
        `
        );
    });
});
