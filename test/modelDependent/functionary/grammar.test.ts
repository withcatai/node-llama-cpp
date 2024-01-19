import {describe, expect, test} from "vitest";
import {LlamaChatSession, LlamaContext, LlamaJsonSchemaGrammar, LlamaModel} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";

describe("functionary", () => {
    describe("grammar", () => {
        test("JSON schema", async () => {
            const modelPath = await getModelFile("functionary-small-v2.2.q4_0.gguf");

            const model = new LlamaModel({
                modelPath
            });
            const context = new LlamaContext({
                model,
                contextSize: 4096
            });
            const chatSession = new LlamaChatSession({
                contextSequence: context.getSequence()
            });

            const grammar = new LlamaJsonSchemaGrammar({
                type: "object",
                properties: {
                    "userMessagePositivityScoreFromOneToTen": {
                        enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
                    },
                    "verbsInUserMessage": {
                        type: "array",
                        items: {
                            type: "string"
                        }
                    }
                }
            } as const);

            const res = await chatSession.prompt("How's your day going so far?", {
                grammar
            });
            const parsedRes = grammar.parse(res);

            expect(parsedRes.userMessagePositivityScoreFromOneToTen).to.eq(10);
            expect(parsedRes.verbsInUserMessage).to.eql(["going"]);
        }, {
            timeout: 1000 * 60 * 60
        });
    });
});
