import {describe, expect, test} from "vitest";
import {HarmonyChatWrapper, LlamaChatSession} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("qwen3 0.6b", () => {
    describe("grammar", () => {
        test("HarmonyChatWrapper grammar token dropping bug regression", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Qwen3-0.6B-Q8_0.gguf");
            const llama = await getTestLlama();
            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 2048
            });
            const chatWrapper = new HarmonyChatWrapper();
            const chatSession = new LlamaChatSession({
                contextSequence: context.getSequence(),
                chatWrapper
            });

            const grammar = await llama.createGrammarForJsonSchema({
                type: "object",
                properties: {
                    prop: {type: "string"}
                },
                required: ["prop"]
            });

            const promptTest = 'output this JSON string exactly and nothing else: {"prop":"test"}';
            
            const res = await chatSession.prompt(promptTest, {
                grammar,
                temperature: 0,
                seed: 1
            });
            const parsedRes = grammar.parse(res);
            
            expect(res.trim().startsWith("{")).toBe(true);
            expect(parsedRes).toHaveProperty("prop");
        });
    });
});
