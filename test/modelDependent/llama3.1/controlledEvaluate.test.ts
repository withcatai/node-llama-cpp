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
                            .map(([token, probability]) => [token, simplifyFloat(probability)])
                    );

                if (item.next?.confidence != null)
                    item.next.confidence = simplifyFloat(item.next.confidence);

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
                      35308 => 0.521,
                      27096 => 0.243,
                      11 => 0.0222,
                      198 => 0.012,
                      374 => 0.0084,
                      863 => 0.00839,
                      1131 => 0.00683,
                      25 => 0.00624,
                      7940 => 0.0054,
                      13 => 0.00519,
                    },
                  },
                },
                {
                  "next": {
                    "probabilities": Map {
                      927 => 0.981,
                      198 => 0.00339,
                      6288 => 0.00328,
                      279 => 0.000654,
                      1633 => 0.000319,
                      1035 => 0.000313,
                      13 => 0.000292,
                      264 => 0.00029,
                      297 => 0.000284,
                      720 => 0.00025,
                    },
                    "token": 927,
                  },
                },
                {
                  "next": {
                    "confidence": 0.931,
                    "token": 279,
                  },
                },
                {
                  "next": {
                    "confidence": 0.96,
                    "probabilities": Map {
                      16053 => 0.96,
                      1208 => 0.00473,
                      198 => 0.00317,
                      5679 => 0.0029,
                      65536 => 0.00197,
                      6435 => 0.000909,
                      2697 => 0.00067,
                      720 => 0.000597,
                      21811 => 0.000548,
                      45363 => 0.000548,
                    },
                  },
                },
                {
                  "next": {
                    "confidence": 0.987,
                    "probabilities": Map {
                      5679 => 0.987,
                      21811 => 0.00142,
                      198 => 0.000936,
                      8415 => 0.000724,
                      12875 => 0.00038,
                      4194 => 0.000345,
                      720 => 0.000281,
                      14588 => 0.000275,
                      9522 => 0.000242,
                      627 => 0.000204,
                    },
                    "token": 5679,
                  },
                },
              ]
            `);
        });
    });
});

function simplifyFloat(value: number) {
    if (value === 0)
        return 0;

    const step = 10 ** (Math.floor(Math.log10(Math.abs(value))) - 2);
    return Number.parseFloat((Math.round(value / step) * step).toPrecision(12));
}
