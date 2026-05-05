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
                      35308 => 0.522,
                      27096 => 0.243,
                      11 => 0.0221,
                      198 => 0.012,
                      374 => 0.00837,
                      863 => 0.00836,
                      1131 => 0.00682,
                      25 => 0.00624,
                      7940 => 0.00539,
                      13 => 0.00517,
                    },
                  },
                },
                {
                  "next": {
                    "probabilities": Map {
                      927 => 0.981,
                      198 => 0.00338,
                      6288 => 0.00328,
                      279 => 0.000653,
                      1633 => 0.00032,
                      1035 => 0.000312,
                      13 => 0.000291,
                      264 => 0.000289,
                      297 => 0.000283,
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
                      198 => 0.00318,
                      5679 => 0.0029,
                      65536 => 0.00197,
                      6435 => 0.000912,
                      2697 => 0.000666,
                      720 => 0.000598,
                      21811 => 0.000549,
                      45363 => 0.000549,
                    },
                  },
                },
                {
                  "next": {
                    "confidence": 0.987,
                    "probabilities": Map {
                      5679 => 0.987,
                      21811 => 0.00143,
                      198 => 0.000937,
                      8415 => 0.000724,
                      12875 => 0.00038,
                      4194 => 0.000344,
                      720 => 0.000282,
                      14588 => 0.000276,
                      9522 => 0.000241,
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
