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
                      35308 => 0.5205752,
                      27096 => 0.2434221,
                      11 => 0.0222422,
                      198 => 0.0119651,
                      863 => 0.0083929,
                      374 => 0.0083748,
                      1131 => 0.0068622,
                      25 => 0.0062526,
                      7940 => 0.0053943,
                      1 => 0.0051856,
                    },
                  },
                },
                {
                  "next": {
                    "probabilities": Map {
                      927 => 0.9811716,
                      198 => 0.003379,
                      6288 => 0.0032698,
                      279 => 0.0006585,
                      1633 => 0.0003187,
                      1035 => 0.0003126,
                      13 => 0.0002916,
                      264 => 0.0002902,
                      297 => 0.0002849,
                      720 => 0.0002489,
                    },
                    "token": 927,
                  },
                },
                {
                  "next": {
                    "confidence": 0.9307394,
                    "token": 279,
                  },
                },
                {
                  "next": {
                    "confidence": 0.9596596,
                    "probabilities": Map {
                      16053 => 0.9596596,
                      1208 => 0.0047719,
                      198 => 0.0031805,
                      5679 => 0.0029246,
                      65536 => 0.0019735,
                      6435 => 0.000917,
                      2697 => 0.0006723,
                      720 => 0.0005984,
                      21811 => 0.0005529,
                      45363 => 0.0005513,
                    },
                  },
                },
                {
                  "next": {
                    "confidence": 0.9871598,
                    "probabilities": Map {
                      5679 => 0.9871598,
                      21811 => 0.0014282,
                      198 => 0.0009355,
                      8415 => 0.0007248,
                      12875 => 0.0003796,
                      4194 => 0.0003463,
                      720 => 0.0002809,
                      14588 => 0.0002761,
                      9522 => 0.0002418,
                      627 => 0.0002038,
                    },
                    "token": 5679,
                  },
                },
              ]
            `);
        });
    });
});
