import {describe, expect, test} from "vitest";
import {Token, SequenceEvaluateOutput} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("llama 3.1", () => {
    describe("evaluate with metadata", () => {
        const text = "The quick brown fox jumps over the lazy dog, but! the lazy dog is too lazy to care. " +
            "The reason for this is that the lazy dog is too lazy to care about the quick brown fox.";

        test("no options", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 512
            });
            const sequence = context.getSequence();

            const inputTokens = model.tokenize(text);
            const maxTokens = 10;
            const res: SequenceEvaluateOutput<{}>[] = [];
            for await (const output of sequence.evaluateWithMetadata(inputTokens, {})) {
                res.push(output);

                if (res.length >= maxTokens)
                    break;
            }

            simplifyRes(res);
            expect(res).toMatchInlineSnapshot(`
              [
                {
                  "token": 578,
                },
                {
                  "token": 16053,
                },
                {
                  "token": 5679,
                },
                {
                  "token": 374,
                },
                {
                  "token": 2288,
                },
                {
                  "token": 16053,
                },
                {
                  "token": 311,
                },
                {
                  "token": 2512,
                },
                {
                  "token": 922,
                },
                {
                  "token": 279,
                },
              ]
            `);
        });

        test("with probabilities", {timeout: 1000 * 60 * 60 * 2}, async (testContext) => {
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

            const inputTokens = model.tokenize(text);
            const maxTokens = 10;
            const res: SequenceEvaluateOutput<{readonly probabilities: true}>[] = [];
            for await (const output of sequence.evaluateWithMetadata(inputTokens, {probabilities: true})) {
                res.push(output);

                if (res.length >= maxTokens)
                    break;
            }

            simplifyRes(res);
            expect(res).toMatchInlineSnapshot(`
              [
                {
                  "probabilities": Map {
                    578 => 0.4307095,
                    1115 => 0.1304636,
                    1102 => 0.0516819,
                    763 => 0.0428933,
                    1283 => 0.0293915,
                    2100 => 0.0293782,
                    15636 => 0.0262626,
                    2030 => 0.0218519,
                    320 => 0.0169018,
                    1628 => 0.0118644,
                  },
                  "token": 578,
                },
                {
                  "probabilities": Map {
                    16053 => 0.4223687,
                    4062 => 0.303549,
                    39935 => 0.0603321,
                    2944 => 0.0373496,
                    5679 => 0.0237923,
                    11914 => 0.0163001,
                    2144 => 0.0146822,
                    1121 => 0.0069893,
                    17571 => 0.0057973,
                    3446 => 0.0049349,
                  },
                  "token": 16053,
                },
                {
                  "probabilities": Map {
                    5679 => 0.9981177,
                    12875 => 0.0001593,
                    18964 => 0.0001154,
                    39935 => 0.0001149,
                    13 => 0.000105,
                    627 => 0.0000928,
                    656 => 0.0000626,
                    893 => 0.0000563,
                    198 => 0.0000523,
                    374 => 0.0000519,
                  },
                  "token": 5679,
                },
                {
                  "probabilities": Map {
                    374 => 0.8126541,
                    1587 => 0.0481505,
                    596 => 0.0247274,
                    1120 => 0.022311,
                    3250 => 0.0215521,
                    706 => 0.0161821,
                    15849 => 0.0086956,
                    1053 => 0.0059156,
                    55064 => 0.0037815,
                    11 => 0.0036657,
                  },
                  "token": 374,
                },
                {
                  "probabilities": Map {
                    2288 => 0.2758818,
                    1120 => 0.1666409,
                    539 => 0.1577165,
                    779 => 0.1333762,
                    264 => 0.0558459,
                    1101 => 0.029207,
                    16053 => 0.0176698,
                    5042 => 0.0158617,
                    1193 => 0.0145808,
                    2744 => 0.0140919,
                  },
                  "token": 2288,
                },
                {
                  "probabilities": Map {
                    16053 => 0.9066046,
                    13326 => 0.0636245,
                    19781 => 0.007155,
                    17551 => 0.0020255,
                    10968 => 0.0012684,
                    11920 => 0.001101,
                    6435 => 0.001009,
                    34386 => 0.0007755,
                    1208 => 0.00061,
                    25366 => 0.0005675,
                  },
                  "token": 16053,
                },
                {
                  "probabilities": Map {
                    311 => 0.9882814,
                    1524 => 0.0061828,
                    11 => 0.0025772,
                    323 => 0.0005243,
                    13 => 0.0003535,
                    627 => 0.0003212,
                    1606 => 0.0002642,
                    2288 => 0.0002583,
                    369 => 0.0001247,
                    320 => 0.0001022,
                  },
                  "token": 311,
                },
                {
                  "probabilities": Map {
                    2512 => 0.7492506,
                    1524 => 0.0989418,
                    656 => 0.032397,
                    636 => 0.0240763,
                    7940 => 0.0143969,
                    33586 => 0.01087,
                    387 => 0.0086808,
                    1781 => 0.0058532,
                    1629 => 0.0054883,
                    3351 => 0.0051112,
                  },
                  "token": 2512,
                },
                {
                  "probabilities": Map {
                    922 => 0.9521582,
                    1606 => 0.0150241,
                    11 => 0.0140157,
                    430 => 0.002969,
                    627 => 0.0023168,
                    13 => 0.0018882,
                    1524 => 0.0018011,
                    369 => 0.0017693,
                    323 => 0.0009252,
                    382 => 0.0008483,
                  },
                  "token": 922,
                },
                {
                  "probabilities": Map {
                    279 => 0.6508825,
                    4205 => 0.3128083,
                    1148 => 0.0113708,
                    1690 => 0.0044266,
                    904 => 0.0030378,
                    1202 => 0.0026779,
                    264 => 0.001117,
                    1790 => 0.0010864,
                    813 => 0.0010572,
                    1524 => 0.0007698,
                  },
                  "token": 279,
                },
              ]
            `);
        });

        test("with confidence", {timeout: 1000 * 60 * 60 * 2}, async (testContext) => {
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

            const inputTokens = model.tokenize(text);
            const maxTokens = 10;
            const res: SequenceEvaluateOutput<{readonly confidence: true}>[] = [];
            for await (const output of sequence.evaluateWithMetadata(inputTokens, {confidence: true})) {
                res.push(output);

                if (res.length >= maxTokens)
                    break;
            }

            simplifyRes(res);
            expect(res).toMatchInlineSnapshot(`
              [
                {
                  "confidence": 0.4307095,
                  "token": 578,
                },
                {
                  "confidence": 0.4223687,
                  "token": 16053,
                },
                {
                  "confidence": 0.9981177,
                  "token": 5679,
                },
                {
                  "confidence": 0.8126541,
                  "token": 374,
                },
                {
                  "confidence": 0.2758818,
                  "token": 2288,
                },
                {
                  "confidence": 0.9066046,
                  "token": 16053,
                },
                {
                  "confidence": 0.9882814,
                  "token": 311,
                },
                {
                  "confidence": 0.7492506,
                  "token": 2512,
                },
                {
                  "confidence": 0.9521582,
                  "token": 922,
                },
                {
                  "confidence": 0.6508825,
                  "token": 279,
                },
              ]
            `);
        });

        test("with probabilities and confidence", {timeout: 1000 * 60 * 60 * 2}, async (testContext) => {
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

            const inputTokens = model.tokenize(text);
            const maxTokens = 10;
            const res: SequenceEvaluateOutput<{readonly probabilities: true, readonly confidence: true}>[] = [];
            for await (const output of sequence.evaluateWithMetadata(inputTokens, {probabilities: true, confidence: true})) {
                res.push(output);

                if (res.length >= maxTokens)
                    break;
            }

            simplifyRes(res);
            expect(res).toMatchInlineSnapshot(`
              [
                {
                  "confidence": 0.4307095,
                  "probabilities": Map {
                    578 => 0.4307095,
                    1115 => 0.1304636,
                    1102 => 0.0516819,
                    763 => 0.0428933,
                    1283 => 0.0293915,
                    2100 => 0.0293782,
                    15636 => 0.0262626,
                    2030 => 0.0218519,
                    320 => 0.0169018,
                    1628 => 0.0118644,
                  },
                  "token": 578,
                },
                {
                  "confidence": 0.4223687,
                  "probabilities": Map {
                    16053 => 0.4223687,
                    4062 => 0.303549,
                    39935 => 0.0603321,
                    2944 => 0.0373496,
                    5679 => 0.0237923,
                    11914 => 0.0163001,
                    2144 => 0.0146822,
                    1121 => 0.0069893,
                    17571 => 0.0057973,
                    3446 => 0.0049349,
                  },
                  "token": 16053,
                },
                {
                  "confidence": 0.9981177,
                  "probabilities": Map {
                    5679 => 0.9981177,
                    12875 => 0.0001593,
                    18964 => 0.0001154,
                    39935 => 0.0001149,
                    13 => 0.000105,
                    627 => 0.0000928,
                    656 => 0.0000626,
                    893 => 0.0000563,
                    198 => 0.0000523,
                    374 => 0.0000519,
                  },
                  "token": 5679,
                },
                {
                  "confidence": 0.8126541,
                  "probabilities": Map {
                    374 => 0.8126541,
                    1587 => 0.0481505,
                    596 => 0.0247274,
                    1120 => 0.022311,
                    3250 => 0.0215521,
                    706 => 0.0161821,
                    15849 => 0.0086956,
                    1053 => 0.0059156,
                    55064 => 0.0037815,
                    11 => 0.0036657,
                  },
                  "token": 374,
                },
                {
                  "confidence": 0.2758818,
                  "probabilities": Map {
                    2288 => 0.2758818,
                    1120 => 0.1666409,
                    539 => 0.1577165,
                    779 => 0.1333762,
                    264 => 0.0558459,
                    1101 => 0.029207,
                    16053 => 0.0176698,
                    5042 => 0.0158617,
                    1193 => 0.0145808,
                    2744 => 0.0140919,
                  },
                  "token": 2288,
                },
                {
                  "confidence": 0.9066046,
                  "probabilities": Map {
                    16053 => 0.9066046,
                    13326 => 0.0636245,
                    19781 => 0.007155,
                    17551 => 0.0020255,
                    10968 => 0.0012684,
                    11920 => 0.001101,
                    6435 => 0.001009,
                    34386 => 0.0007755,
                    1208 => 0.00061,
                    25366 => 0.0005675,
                  },
                  "token": 16053,
                },
                {
                  "confidence": 0.9882814,
                  "probabilities": Map {
                    311 => 0.9882814,
                    1524 => 0.0061828,
                    11 => 0.0025772,
                    323 => 0.0005243,
                    13 => 0.0003535,
                    627 => 0.0003212,
                    1606 => 0.0002642,
                    2288 => 0.0002583,
                    369 => 0.0001247,
                    320 => 0.0001022,
                  },
                  "token": 311,
                },
                {
                  "confidence": 0.7492506,
                  "probabilities": Map {
                    2512 => 0.7492506,
                    1524 => 0.0989418,
                    656 => 0.032397,
                    636 => 0.0240763,
                    7940 => 0.0143969,
                    33586 => 0.01087,
                    387 => 0.0086808,
                    1781 => 0.0058532,
                    1629 => 0.0054883,
                    3351 => 0.0051112,
                  },
                  "token": 2512,
                },
                {
                  "confidence": 0.9521582,
                  "probabilities": Map {
                    922 => 0.9521582,
                    1606 => 0.0150241,
                    11 => 0.0140157,
                    430 => 0.002969,
                    627 => 0.0023168,
                    13 => 0.0018882,
                    1524 => 0.0018011,
                    369 => 0.0017693,
                    323 => 0.0009252,
                    382 => 0.0008483,
                  },
                  "token": 922,
                },
                {
                  "confidence": 0.6508825,
                  "probabilities": Map {
                    279 => 0.6508825,
                    4205 => 0.3128083,
                    1148 => 0.0113708,
                    1690 => 0.0044266,
                    904 => 0.0030378,
                    1202 => 0.0026779,
                    264 => 0.001117,
                    1790 => 0.0010864,
                    813 => 0.0010572,
                    1524 => 0.0007698,
                  },
                  "token": 279,
                },
              ]
            `);
        });

        test("confidence alone matches probability alone", {timeout: 1000 * 60 * 60 * 2}, async (testContext) => {
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

            const inputTokens = model.tokenize(text);
            const maxTokens = 10;

            const probabilityRes: [token: Token, probability: number][] = [];
            for await (const output of sequence.evaluateWithMetadata(inputTokens, {probabilities: true})) {
                const tokenProbability = output.probabilities.get(output.token);
                if (tokenProbability == null)
                    throw new Error("Token probability not found");

                probabilityRes.push([output.token, tokenProbability]);

                if (probabilityRes.length >= maxTokens)
                    break;
            }

            await sequence.clearHistory();

            const confidenceRes: [token: Token, probability: number][] = [];
            for await (const output of sequence.evaluateWithMetadata(inputTokens, {confidence: true})) {
                confidenceRes.push([output.token, output.confidence]);

                if (confidenceRes.length >= maxTokens)
                    break;
            }

            expect(probabilityRes).toEqual(confidenceRes);
        });
    });
});

function simplifyRes<T extends Partial<SequenceEvaluateOutput<{readonly probabilities: true, readonly confidence: true}>>>(res: T[]) {
    for (const item of res) {
        if (item.probabilities != null)
            item.probabilities = new Map(
                [...item.probabilities.entries()]
                    .slice(0, 10)
                    .map(([token, probability]) => [token, parseFloat(probability.toFixed(7))])
            );

        if (item.confidence != null)
            item.confidence = parseFloat(item.confidence.toFixed(7));
    }
}
