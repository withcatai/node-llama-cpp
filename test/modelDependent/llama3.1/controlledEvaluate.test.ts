import {describe, expect, test} from "vitest";
import {Token, ControlledEvaluateInputItem} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("llama 3.1", () => {
    describe("controlled evaluate", () => {
        test("get probabilities for 3 tokens", {timeout: 1000 * 60 * 60 * 2}, async (testContext) => {
            const modelPath = await getModelFile("Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf");
            const llama = await getTestLlama();

            // the precise values are different for each GPU type, so we skip the test for GPUs other than metal
            if (llama.gpu !== "metal")
                testContext.skip();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 512
            });
            const sequence = context.getSequence();

            const text = "The quick brown fox jumps over the lazy dog, but! the lazy dog is too lazy to care. " +
                "The reason for this is that the lazy dog is too lazy to care about the quick brown fox.";

            const inputTokens: ControlledEvaluateInputItem[] = model.tokenize(text);
            expect(inputTokens.length).to.be.greaterThan(8);

            inputTokens[2] = [inputTokens[2] as Token, {
                generateNext: {
                    token: true
                }
            }];
            inputTokens[3] = [inputTokens[3] as Token, {
                generateNext: {
                    probabilities: true
                }
            }];
            inputTokens[4] = [inputTokens[4] as Token, {
                generateNext: {
                    token: true,
                    probabilities: true
                }
            }];

            inputTokens[5] = [inputTokens[5] as Token, {
                generateNext: {
                    token: true,
                    confidence: true
                }
            }];
            inputTokens[6] = [inputTokens[6] as Token, {
                generateNext: {
                    probabilities: true,
                    confidence: true
                }
            }];
            inputTokens[7] = [inputTokens[7] as Token, {
                generateNext: {
                    token: true,
                    probabilities: true,
                    confidence: true
                }
            }];

            const res = await sequence.controlledEvaluate(inputTokens);

            const simplifiedRes = res.map((item) => {
                if (item == null || item.next == null)
                    return item;

                // only keep the top 10 probabilities to not clutter the snapshot
                if (item.next?.probabilities != null)
                    item.next.probabilities = new Map(
                        [...item.next.probabilities.entries()]
                            .slice(0, 10)
                            .map(([token, probability]) => [token, parseFloat(probability.toFixed(7))])
                    );

                if (item.next?.confidence != null)
                    item.next.confidence = parseFloat(item.next.confidence.toFixed(7));

                return item;
            });

            expect(simplifiedRes).toMatchInlineSnapshot(`
              [
                ,
                ,
                {
                  "next": {
                    "token": 39935,
                  },
                },
                {
                  "next": {
                    "probabilities": Map {
                      35308 => 0.5214539,
                      27096 => 0.2432189,
                      11 => 0.0221867,
                      198 => 0.0119489,
                      374 => 0.0083635,
                      863 => 0.0083618,
                      1131 => 0.0068354,
                      25 => 0.0062467,
                      7940 => 0.0054025,
                      320 => 0.0051706,
                    },
                  },
                },
                {
                  "next": {
                    "probabilities": Map {
                      927 => 0.9811952,
                      198 => 0.0033833,
                      6288 => 0.00327,
                      279 => 0.0006553,
                      1633 => 0.0003185,
                      1035 => 0.0003111,
                      13 => 0.0002916,
                      264 => 0.0002894,
                      297 => 0.0002833,
                      720 => 0.0002489,
                    },
                    "token": 927,
                  },
                },
                {
                  "next": {
                    "confidence": 0.930688,
                    "token": 279,
                  },
                },
                {
                  "next": {
                    "confidence": 0.9597747,
                    "probabilities": Map {
                      16053 => 0.9597747,
                      1208 => 0.0047502,
                      198 => 0.0031807,
                      5679 => 0.0029171,
                      65536 => 0.0019718,
                      6435 => 0.0009126,
                      2697 => 0.0006707,
                      720 => 0.0005979,
                      21811 => 0.0005516,
                      45363 => 0.0005494,
                    },
                  },
                },
                {
                  "next": {
                    "confidence": 0.9871562,
                    "probabilities": Map {
                      5679 => 0.9871562,
                      21811 => 0.0014367,
                      198 => 0.0009356,
                      8415 => 0.0007227,
                      12875 => 0.0003802,
                      4194 => 0.0003468,
                      720 => 0.0002813,
                      14588 => 0.000276,
                      9522 => 0.0002415,
                      627 => 0.0002041,
                    },
                    "token": 5679,
                  },
                },
              ]
            `);
        });
    });
});
