import {describe, expect, test} from "vitest";
import {LlamaChatSession, SpecialTokensText, LlamaText} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("functionary", () => {
    describe("sanity", () => {
        test("How much is 6+6", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("functionary-small-v2.5.Q4_0.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath,
                checkTensors: true
            });
            const context = await model.createContext();
            const chatSession = new LlamaChatSession({
                contextSequence: context.getSequence()
            });

            let res = await chatSession.prompt("How much is 6+6");

            if (res.endsWith("."))
                res = res.slice(0, -".".length);

            expect(res).to.eql("6 + 6 = 12");
        });

        test("text is tokenized with special tokens when appropriate", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("functionary-small-v2.5.Q4_0.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });

            const text = "<|start_header_id|>system<|end_header_id|>\n\nHow much is 6+6\n";

            const tokensWithSpecialTokens = model.tokenize(text, true);
            const tokensWithoutSpecialTokens = model.tokenize(text);

            expect(tokensWithSpecialTokens).to.not.eql(tokensWithoutSpecialTokens);

            expect(tokensWithSpecialTokens).to.toMatchInlineSnapshot(`
              [
                128006,
                9125,
                128007,
                271,
                4438,
                1790,
                374,
                220,
                21,
                10,
                21,
                198,
              ]
            `);
            expect(tokensWithoutSpecialTokens).to.toMatchInlineSnapshot(`
              [
                27,
                91,
                2527,
                8932,
                851,
                91,
                29,
                9125,
                27,
                91,
                408,
                8932,
                851,
                91,
                1363,
                4438,
                1790,
                374,
                220,
                21,
                10,
                21,
                198,
              ]
            `);
        });

        test("tokenizing a text and then detokenizing it arrives at the same text", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("functionary-small-v2.5.Q4_0.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });

            {
                const text = "<|start_header_id|>system<|end_header_id|>\n\nHow much is 6+6\n";

                const tokensWithSpecialTokens = model.tokenize(text, true);
                const tokensNoSpecialTokens = model.tokenize(text, false);
                const textWithSpecialTokens = model.detokenize(tokensWithSpecialTokens, true);
                const textNoSpecialTokens = model.detokenize(tokensNoSpecialTokens, false);

                expect(tokensWithSpecialTokens).to.not.eql(tokensNoSpecialTokens);
                expect(textWithSpecialTokens).to.eql(text);
                expect(textNoSpecialTokens).to.eql(text);
            }
            {
                const text = " <|start_header_id|>system<|end_header_id|>\n\nHow much is 6+6\n";

                const tokensWithSpecialTokens = model.tokenize(text, true);
                const tokensNoSpecialTokens = model.tokenize(text, false);
                const textWithSpecialTokens = model.detokenize(tokensWithSpecialTokens, true);
                const textNoSpecialTokens = model.detokenize(tokensNoSpecialTokens, false);

                expect(tokensWithSpecialTokens).to.not.eql(tokensNoSpecialTokens);
                expect(textWithSpecialTokens).to.eql(text);
                expect(textNoSpecialTokens).to.eql(text);
            }
            {
                const text = "  <|start_header_id|>system<|end_header_id|>\n\nHow much is 6+6\n";

                const tokensWithSpecialTokens = model.tokenize(text, true);
                const tokensNoSpecialTokens = model.tokenize(text, false);
                const textWithSpecialTokens = model.detokenize(tokensWithSpecialTokens, true);
                const textNoSpecialTokens = model.detokenize(tokensNoSpecialTokens, false);

                expect(tokensWithSpecialTokens).to.not.eql(tokensNoSpecialTokens);
                expect(textWithSpecialTokens).to.eql(text);
                expect(textNoSpecialTokens).to.eql(text);
            }
            {
                const text = "\n<|start_header_id|>system<|end_header_id|>\n\nHow much is 6+6\n";

                const tokensWithSpecialTokens = model.tokenize(text, true);
                const tokensNoSpecialTokens = model.tokenize(text, false);
                const textWithSpecialTokens = model.detokenize(tokensWithSpecialTokens, true);
                const textNoSpecialTokens = model.detokenize(tokensNoSpecialTokens, false);

                expect(tokensWithSpecialTokens).to.not.eql(tokensNoSpecialTokens);
                expect(textWithSpecialTokens).to.eql(text);
                expect(textNoSpecialTokens).to.eql(text);
            }
            {
                const text = "\n\n<|start_header_id|>system<|end_header_id|>\n\nHow much is 6+6\n";

                const tokensWithSpecialTokens = model.tokenize(text, true);
                const tokensNoSpecialTokens = model.tokenize(text, false);
                const textWithSpecialTokens = model.detokenize(tokensWithSpecialTokens, true);
                const textNoSpecialTokens = model.detokenize(tokensNoSpecialTokens, false);

                expect(tokensWithSpecialTokens).to.not.eql(tokensNoSpecialTokens);
                expect(textWithSpecialTokens).to.eql(text);
                expect(textNoSpecialTokens).to.eql(text);
            }
            {
                const text = " \n<|start_header_id|>system<|end_header_id|>\n\nHow much is 6+6\n";

                const tokensWithSpecialTokens = model.tokenize(text, true);
                const tokensNoSpecialTokens = model.tokenize(text, false);
                const textWithSpecialTokens = model.detokenize(tokensWithSpecialTokens, true);
                const textNoSpecialTokens = model.detokenize(tokensNoSpecialTokens, false);

                expect(tokensWithSpecialTokens).to.not.eql(tokensNoSpecialTokens);
                expect(textWithSpecialTokens).to.eql(text);
                expect(textNoSpecialTokens).to.eql(text);
            }
            {
                const text = "\n <|start_header_id|>system<|end_header_id|>\n\nHow much is 6+6\n";

                const tokensWithSpecialTokens = model.tokenize(text, true);
                const tokensNoSpecialTokens = model.tokenize(text, false);
                const textWithSpecialTokens = model.detokenize(tokensWithSpecialTokens, true);
                const textNoSpecialTokens = model.detokenize(tokensNoSpecialTokens, false);

                expect(tokensWithSpecialTokens).to.not.eql(tokensNoSpecialTokens);
                expect(textWithSpecialTokens).to.eql(text);
                expect(textNoSpecialTokens).to.eql(text);
            }

            {
                const text = "Hi there";

                const tokensWithTrim = model.tokenize(text, false, "trimLeadingSpace");
                const tokensWithoutTrim = model.tokenize(text, false);

                expect(model.detokenize(tokensWithTrim)).to.eql(text);
                expect(model.detokenize(tokensWithoutTrim)).to.eql(text);
            }
            {
                const text = " Hi there";

                const tokensWithTrim = model.tokenize(text, false, "trimLeadingSpace");
                const tokensWithoutTrim = model.tokenize(text, false);

                expect(model.detokenize(tokensWithTrim)).to.eql(text);
                expect(model.detokenize(tokensWithoutTrim)).to.eql(text);
            }
        });

        test("tokenizing a LlamaText and then detokenizing it arrives at the same text", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("functionary-small-v2.5.Q4_0.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });

            {
                const text = LlamaText([
                    new SpecialTokensText("<|start_header_id|>system<|end_header_id|>\n\n"),
                    "How much is 6+6\n"
                ]);

                const tokens = text.tokenize(model.tokenizer);

                expect(model.detokenize(tokens, true)).to.eql("<|start_header_id|>system<|end_header_id|>\n\nHow much is 6+6\n");
                expect(model.detokenize(tokens, false)).to.eql("system\n\nHow much is 6+6\n");
            }
            {
                const text = LlamaText([
                    new SpecialTokensText("Hi <|start_header_id|>there\n\n"),
                    "How much is 6+6\n"
                ]);

                const tokens = text.tokenize(model.tokenizer);

                expect(model.detokenize(tokens, true)).to.eql("Hi <|start_header_id|>there\n\nHow much is 6+6\n");
                expect(model.detokenize(tokens, false)).to.eql("Hi there\n\nHow much is 6+6\n");
            }
        });
    });
});
