import {describe, expect, test} from "vitest";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("stableCode", () => {
    describe("metadata overrides", () => {
        test("boolean metadata override", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("stable-code-3b-Q5_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath,
                metadataOverrides: {
                    tokenizer: {
                        ggml: {
                            "add_bos_token": false
                        }
                    }
                }
            });

            expect(model.fileInfo.metadata.tokenizer.ggml.add_bos_token).to.eql(false);
            expect(model.tokens.shouldPrependBosToken).to.eql(false);

            await model.dispose();
        });

        test("boolean metadata override 2", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("stable-code-3b-Q5_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath,
                metadataOverrides: {
                    tokenizer: {
                        ggml: {
                            "add_bos_token": true
                        }
                    }
                }
            });

            expect(model.fileInfo.metadata.tokenizer.ggml.add_bos_token).to.eql(true);
            expect(model.tokens.shouldPrependBosToken).to.eql(true);

            await model.dispose();
        });
    });
});
