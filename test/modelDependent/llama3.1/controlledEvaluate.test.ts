import {describe, expect, test} from "vitest";
import {Token, ControlledEvaluateInputItem} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("llama 3.1", () => {
    describe("controlled evaluate", () => {
        test("get probabilities for 3 tokens", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf");
            const llama = await getTestLlama();

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
                      35308 => 0.5214946,
                      27096 => 0.2432059,
                      11 => 0.0221824,
                      198 => 0.0119446,
                      374 => 0.0083614,
                      863 => 0.0083608,
                      1131 => 0.0068347,
                      25 => 0.0062433,
                      7940 => 0.0054039,
                      1 => 0.0051688,
                    },
                  },
                },
                {
                  "next": {
                    "probabilities": Map {
                      927 => 0.9811904,
                      198 => 0.0033849,
                      6288 => 0.0032705,
                      279 => 0.0006553,
                      1633 => 0.0003184,
                      1035 => 0.0003114,
                      13 => 0.0002917,
                      264 => 0.0002895,
                      297 => 0.0002833,
                      720 => 0.000249,
                    },
                    "token": 927,
                  },
                },
                {
                  "next": {
                    "confidence": 0.9306729,
                    "token": 279,
                  },
                },
                {
                  "next": {
                    "confidence": 0.9597685,
                    "probabilities": Map {
                      16053 => 0.9597685,
                      1208 => 0.0047506,
                      198 => 0.0031827,
                      5679 => 0.0029162,
                      65536 => 0.0019724,
                      6435 => 0.0009124,
                      2697 => 0.0006706,
                      720 => 0.0005979,
                      21811 => 0.0005517,
                      45363 => 0.0005495,
                    },
                  },
                },
                {
                  "next": {
                    "confidence": 0.987146,
                    "probabilities": Map {
                      5679 => 0.987146,
                      21811 => 0.0014387,
                      198 => 0.0009368,
                      8415 => 0.0007225,
                      12875 => 0.0003803,
                      4194 => 0.000347,
                      720 => 0.0002815,
                      14588 => 0.0002761,
                      9522 => 0.0002417,
                      627 => 0.0002042,
                    },
                    "token": 5679,
                  },
                },
              ]
            `);
        });
    });
});
