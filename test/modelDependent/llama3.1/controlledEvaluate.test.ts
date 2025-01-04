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
                    item.next.probabilities = new Map([...item.next.probabilities.entries()].slice(0, 10));

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
                      35308 => 0.5214946269989014,
                      27096 => 0.24320587515830994,
                      11 => 0.022182414308190346,
                      198 => 0.011944590136408806,
                      374 => 0.008361410349607468,
                      863 => 0.008360812440514565,
                      1131 => 0.006834662053734064,
                      25 => 0.006243313197046518,
                      7940 => 0.00540389958769083,
                      1 => 0.005168775096535683,
                    },
                  },
                },
                {
                  "next": {
                    "probabilities": Map {
                      927 => 0.9811904430389404,
                      198 => 0.0033848676830530167,
                      6288 => 0.0032705331686884165,
                      279 => 0.0006552835111506283,
                      1633 => 0.00031841936288401484,
                      1035 => 0.0003114044084213674,
                      13 => 0.0002916732046287507,
                      264 => 0.00028948261751793325,
                      297 => 0.0002833220351021737,
                      720 => 0.00024898265837691724,
                    },
                    "token": 927,
                  },
                },
                {
                  "next": {
                    "confidence": 0.9306728839874268,
                    "token": 279,
                  },
                },
                {
                  "next": {
                    "confidence": 0.9597684741020203,
                    "probabilities": Map {
                      16053 => 0.9597684741020203,
                      1208 => 0.004750591237097979,
                      198 => 0.0031827085185796022,
                      5679 => 0.0029162338469177485,
                      65536 => 0.00197240780107677,
                      6435 => 0.0009124248754233122,
                      2697 => 0.0006706250132992864,
                      720 => 0.0005979162524454296,
                      21811 => 0.0005516768433153629,
                      45363 => 0.0005495203076861799,
                    },
                  },
                },
                {
                  "next": {
                    "confidence": 0.9871460199356079,
                    "probabilities": Map {
                      5679 => 0.9871460199356079,
                      21811 => 0.001438674982637167,
                      198 => 0.0009368227329105139,
                      8415 => 0.0007225279696285725,
                      12875 => 0.00038032486918382347,
                      4194 => 0.00034695648355409503,
                      720 => 0.00028149448917247355,
                      14588 => 0.00027612835401669145,
                      9522 => 0.00024171460245270282,
                      627 => 0.0002042166597675532,
                    },
                    "token": 5679,
                  },
                },
              ]
            `);
        });
    });
});
