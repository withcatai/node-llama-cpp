import {describe, expect, test} from "vitest";
import {LlamaChatSession, resolveChatWrapper} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";
import {LlamaText} from "../../../src/utils/LlamaText.js";

describe("llama 3.2", () => {
    describe("prompt completion", () => {
        test("prompt completion isn't kept in the next evaluation", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Llama-3.2-3B-Instruct.Q4_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 4096
            });
            const context2 = await model.createContext({
                contextSize: 4096
            });
            const chatSession = new LlamaChatSession({
                contextSequence: context.getSequence(),
                chatWrapper: resolveChatWrapper(model, {
                    customWrapperSettings: {
                        "llama3.2-lightweight": {
                            todayDate: new Date("2025-01-01T00:00:00Z")
                        }
                    }
                })
            });
            const chatSession2 = new LlamaChatSession({
                contextSequence: context2.getSequence(),
                chatWrapper: resolveChatWrapper(model, {
                    customWrapperSettings: {
                        "llama3.2-lightweight": {
                            todayDate: new Date("2025-01-01T00:00:00Z")
                        }
                    }
                })
            });

            const promptCompletion = await chatSession.completePrompt("Hi there!", {
                maxTokens: 11
            });
            expect(promptCompletion).toMatchInlineSnapshot(`" I'm looking for a new phone case. I need"`);
            expect(LlamaText.fromTokens(model.tokenizer, chatSession.sequence.contextTokens)).toMatchInlineSnapshot(`
              LlamaText([
                new SpecialToken("BOS"),
                new SpecialTokensText("<|start_header_id|>"),
                "system",
                new SpecialTokensText("<|end_header_id|>"),
                "

              Cutting Knowledge Date: December 2023",
                new SpecialToken("NL"),
                "Today Date: 1 Jan 2025

              You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
              If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>"),
                "user",
                new SpecialTokensText("<|end_header_id|>"),
                "

              Hi there! I'm looking for a new phone case. I",
              ])
            `);

            const res = await chatSession.prompt("Hi there!", {
                maxTokens: 50
            });
            expect(res).toMatchInlineSnapshot("\"Hello! It's nice to meet you. Is there something I can help you with, or would you like to chat for a bit?\"");
            expect(LlamaText.fromTokens(model.tokenizer, chatSession.sequence.contextTokens)).toMatchInlineSnapshot(`
              LlamaText([
                new SpecialToken("BOS"),
                new SpecialTokensText("<|start_header_id|>"),
                "system",
                new SpecialTokensText("<|end_header_id|>"),
                "

              Cutting Knowledge Date: December 2023",
                new SpecialToken("NL"),
                "Today Date: 1 Jan 2025

              You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.
              If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. If you don't know the answer to a question, don't share false information.",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>"),
                "user",
                new SpecialTokensText("<|end_header_id|>"),
                "

              Hi there!",
                new SpecialToken("EOT"),
                new SpecialTokensText("<|start_header_id|>"),
                "assistant",
                new SpecialTokensText("<|end_header_id|>"),
                "

              Hello! It's nice to meet you. Is there something I can help you with, or would you like to chat for a bit?",
              ])
            `);

            const res2 = await chatSession2.prompt("Hi there!", {
                maxTokens: 50
            });
            expect(res2).to.eql(res);
        });
    });
});
