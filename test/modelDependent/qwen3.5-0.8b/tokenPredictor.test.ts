import {describe, expect, test} from "vitest";
import {InputLookupTokenPredictor, LlamaCompletion} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("qwen3.5 0.8b", () => {
    describe("token predictor", () => {
        test("token prediction does not change the generated output", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Qwen3.5-0.8B-Q8_0.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });

            async function generateText(withTokenPredictor: boolean) {
                const context = await model.createContext({
                    contextSize: 2048
                });

                try {
                    const sequence = context.getSequence(
                        withTokenPredictor
                            ? {tokenPredictor: new InputLookupTokenPredictor()}
                            : {}
                    );
                    const completion = new LlamaCompletion({
                        contextSequence: sequence
                    });

                    const text = await completion.generateCompletion("1, 2, 3,", {
                        temperature: 0,
                        maxTokens: 40
                    });

                    return {
                        text,
                        tokenPredictions: sequence.tokenPredictions
                    };
                } finally {
                    await context.dispose();
                }
            }

            const expected = await generateText(false);
            const withTokenPredictor = await generateText(true);

            // ensure that token prediction was actually used, and that predictions were both validated and refuted,
            // so the rollback of refuted predictions was exercised
            expect(withTokenPredictor.tokenPredictions.validated).toBeGreaterThan(0);
            expect(withTokenPredictor.tokenPredictions.refuted).toBeGreaterThan(0);

            expect(withTokenPredictor.text).to.eql(expected.text);
        });
    });
});
