import {describe, expect, test} from "vitest";
import {LlamaChatSession, LlamaJsonSchemaGrammar} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("llama 3", () => {
    describe("grammar", () => {
        describe("JSON schema", () => {
            test("find verb in message", {timeout: 1000 * 60 * 60 * 2}, async () => {
                const modelPath = await getModelFile("Meta-Llama-3-8B-Instruct.Q4_K_M.gguf");
                const llama = await getTestLlama();

                const model = await llama.loadModel({
                    modelPath
                });
                const context = await model.createContext({
                    contextSize: 4096
                });
                const chatSession = new LlamaChatSession({
                    contextSequence: context.getSequence()
                });

                const grammar = await llama.createGrammarForJsonSchema({
                    type: "object",
                    properties: {
                        "userMessagePositivityScoreFromOneToTen": {
                            enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
                        },
                        "positiveWordsInUserMessage": {
                            type: "array",
                            items: {
                                type: "string"
                            }
                        }
                    }
                });

                const res = await chatSession.prompt("It's great!", {
                    grammar
                });
                const parsedRes = grammar.parse(res);

                expect(parsedRes.userMessagePositivityScoreFromOneToTen).to.eq(10);
                expect(parsedRes.positiveWordsInUserMessage).to.eql(["great"]);
            });

            test("get an array of numbers", {timeout: 1000 * 60 * 60 * 2}, async () => {
                const modelPath = await getModelFile("Meta-Llama-3-8B-Instruct.Q4_K_M.gguf");
                const llama = await getTestLlama();

                const model = await llama.loadModel({
                    modelPath
                });
                const context = await model.createContext({
                    contextSize: 4096
                });
                const chatSession = new LlamaChatSession({
                    contextSequence: context.getSequence()
                });

                const grammar = new LlamaJsonSchemaGrammar(llama, {
                    type: "array",
                    items: {
                        type: "number"
                    }
                } as const);

                const res = await chatSession.prompt("Give me an array of numbers from 1 to 10", {
                    grammar
                });
                const parsedRes = grammar.parse(res);

                expect(parsedRes).to.eql([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
            });
        });
    });
});
