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
                    578 => 0.4305387,
                    1115 => 0.130273,
                    1102 => 0.0517783,
                    763 => 0.0429566,
                    1283 => 0.0294619,
                    2100 => 0.0294103,
                    15636 => 0.0263193,
                    2030 => 0.0218532,
                    320 => 0.0168992,
                    1628 => 0.011877,
                  },
                  "token": 578,
                },
                {
                  "probabilities": Map {
                    16053 => 0.4229744,
                    4062 => 0.303401,
                    39935 => 0.0602281,
                    2944 => 0.0372685,
                    5679 => 0.0237816,
                    11914 => 0.0162851,
                    2144 => 0.0146596,
                    1121 => 0.0069732,
                    17571 => 0.0057899,
                    3446 => 0.0049125,
                  },
                  "token": 16053,
                },
                {
                  "probabilities": Map {
                    5679 => 0.9981223,
                    12875 => 0.0001592,
                    18964 => 0.0001154,
                    39935 => 0.0001146,
                    13 => 0.0001047,
                    627 => 0.0000926,
                    656 => 0.0000625,
                    893 => 0.0000563,
                    198 => 0.0000522,
                    374 => 0.0000518,
                  },
                  "token": 5679,
                },
                {
                  "probabilities": Map {
                    374 => 0.8128683,
                    1587 => 0.0480889,
                    596 => 0.0247298,
                    1120 => 0.0222965,
                    3250 => 0.0215258,
                    706 => 0.0161501,
                    15849 => 0.0086884,
                    1053 => 0.0059099,
                    55064 => 0.0037784,
                    11 => 0.0036557,
                  },
                  "token": 374,
                },
                {
                  "probabilities": Map {
                    2288 => 0.2759203,
                    1120 => 0.166673,
                    539 => 0.1576579,
                    779 => 0.1335195,
                    264 => 0.055744,
                    1101 => 0.0292486,
                    16053 => 0.0176843,
                    5042 => 0.0158506,
                    1193 => 0.0146031,
                    2744 => 0.0140961,
                  },
                  "token": 2288,
                },
                {
                  "probabilities": Map {
                    16053 => 0.9066879,
                    13326 => 0.0635879,
                    19781 => 0.0071462,
                    17551 => 0.0020222,
                    10968 => 0.0012692,
                    11920 => 0.0011004,
                    6435 => 0.0010057,
                    34386 => 0.0007741,
                    1208 => 0.0006092,
                    25366 => 0.0005664,
                  },
                  "token": 16053,
                },
                {
                  "probabilities": Map {
                    311 => 0.9882948,
                    1524 => 0.0061879,
                    11 => 0.002568,
                    323 => 0.000522,
                    13 => 0.0003525,
                    627 => 0.0003204,
                    1606 => 0.0002628,
                    2288 => 0.000258,
                    369 => 0.0001243,
                    320 => 0.0001019,
                  },
                  "token": 311,
                },
                {
                  "probabilities": Map {
                    2512 => 0.749257,
                    1524 => 0.0991107,
                    656 => 0.0322866,
                    636 => 0.0240931,
                    7940 => 0.014378,
                    33586 => 0.0108598,
                    387 => 0.0086719,
                    1781 => 0.0058546,
                    1629 => 0.0054801,
                    3351 => 0.0051043,
                  },
                  "token": 2512,
                },
                {
                  "probabilities": Map {
                    922 => 0.9522551,
                    1606 => 0.0149839,
                    11 => 0.0139898,
                    430 => 0.002966,
                    627 => 0.0023101,
                    13 => 0.0018821,
                    1524 => 0.0018027,
                    369 => 0.0017665,
                    323 => 0.0009226,
                    382 => 0.0008453,
                  },
                  "token": 922,
                },
                {
                  "probabilities": Map {
                    279 => 0.6508359,
                    4205 => 0.3128611,
                    1148 => 0.0113738,
                    1690 => 0.0044254,
                    904 => 0.0030366,
                    1202 => 0.0026803,
                    264 => 0.0011148,
                    1790 => 0.0010861,
                    813 => 0.0010576,
                    1524 => 0.0007703,
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
                  "confidence": 0.4305387,
                  "token": 578,
                },
                {
                  "confidence": 0.4229744,
                  "token": 16053,
                },
                {
                  "confidence": 0.9981223,
                  "token": 5679,
                },
                {
                  "confidence": 0.8128683,
                  "token": 374,
                },
                {
                  "confidence": 0.2759203,
                  "token": 2288,
                },
                {
                  "confidence": 0.9066879,
                  "token": 16053,
                },
                {
                  "confidence": 0.9882948,
                  "token": 311,
                },
                {
                  "confidence": 0.749257,
                  "token": 2512,
                },
                {
                  "confidence": 0.9522551,
                  "token": 922,
                },
                {
                  "confidence": 0.6508359,
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
                  "confidence": 0.4305387,
                  "probabilities": Map {
                    578 => 0.4305387,
                    1115 => 0.130273,
                    1102 => 0.0517783,
                    763 => 0.0429566,
                    1283 => 0.0294619,
                    2100 => 0.0294103,
                    15636 => 0.0263193,
                    2030 => 0.0218532,
                    320 => 0.0168992,
                    1628 => 0.011877,
                  },
                  "token": 578,
                },
                {
                  "confidence": 0.4229744,
                  "probabilities": Map {
                    16053 => 0.4229744,
                    4062 => 0.303401,
                    39935 => 0.0602281,
                    2944 => 0.0372685,
                    5679 => 0.0237816,
                    11914 => 0.0162851,
                    2144 => 0.0146596,
                    1121 => 0.0069732,
                    17571 => 0.0057899,
                    3446 => 0.0049125,
                  },
                  "token": 16053,
                },
                {
                  "confidence": 0.9981223,
                  "probabilities": Map {
                    5679 => 0.9981223,
                    12875 => 0.0001592,
                    18964 => 0.0001154,
                    39935 => 0.0001146,
                    13 => 0.0001047,
                    627 => 0.0000926,
                    656 => 0.0000625,
                    893 => 0.0000563,
                    198 => 0.0000522,
                    374 => 0.0000518,
                  },
                  "token": 5679,
                },
                {
                  "confidence": 0.8128683,
                  "probabilities": Map {
                    374 => 0.8128683,
                    1587 => 0.0480889,
                    596 => 0.0247298,
                    1120 => 0.0222965,
                    3250 => 0.0215258,
                    706 => 0.0161501,
                    15849 => 0.0086884,
                    1053 => 0.0059099,
                    55064 => 0.0037784,
                    11 => 0.0036557,
                  },
                  "token": 374,
                },
                {
                  "confidence": 0.2759203,
                  "probabilities": Map {
                    2288 => 0.2759203,
                    1120 => 0.166673,
                    539 => 0.1576579,
                    779 => 0.1335195,
                    264 => 0.055744,
                    1101 => 0.0292486,
                    16053 => 0.0176843,
                    5042 => 0.0158506,
                    1193 => 0.0146031,
                    2744 => 0.0140961,
                  },
                  "token": 2288,
                },
                {
                  "confidence": 0.9066879,
                  "probabilities": Map {
                    16053 => 0.9066879,
                    13326 => 0.0635879,
                    19781 => 0.0071462,
                    17551 => 0.0020222,
                    10968 => 0.0012692,
                    11920 => 0.0011004,
                    6435 => 0.0010057,
                    34386 => 0.0007741,
                    1208 => 0.0006092,
                    25366 => 0.0005664,
                  },
                  "token": 16053,
                },
                {
                  "confidence": 0.9882948,
                  "probabilities": Map {
                    311 => 0.9882948,
                    1524 => 0.0061879,
                    11 => 0.002568,
                    323 => 0.000522,
                    13 => 0.0003525,
                    627 => 0.0003204,
                    1606 => 0.0002628,
                    2288 => 0.000258,
                    369 => 0.0001243,
                    320 => 0.0001019,
                  },
                  "token": 311,
                },
                {
                  "confidence": 0.749257,
                  "probabilities": Map {
                    2512 => 0.749257,
                    1524 => 0.0991107,
                    656 => 0.0322866,
                    636 => 0.0240931,
                    7940 => 0.014378,
                    33586 => 0.0108598,
                    387 => 0.0086719,
                    1781 => 0.0058546,
                    1629 => 0.0054801,
                    3351 => 0.0051043,
                  },
                  "token": 2512,
                },
                {
                  "confidence": 0.9522551,
                  "probabilities": Map {
                    922 => 0.9522551,
                    1606 => 0.0149839,
                    11 => 0.0139898,
                    430 => 0.002966,
                    627 => 0.0023101,
                    13 => 0.0018821,
                    1524 => 0.0018027,
                    369 => 0.0017665,
                    323 => 0.0009226,
                    382 => 0.0008453,
                  },
                  "token": 922,
                },
                {
                  "confidence": 0.6508359,
                  "probabilities": Map {
                    279 => 0.6508359,
                    4205 => 0.3128611,
                    1148 => 0.0113738,
                    1690 => 0.0044254,
                    904 => 0.0030366,
                    1202 => 0.0026803,
                    264 => 0.0011148,
                    1790 => 0.0010861,
                    813 => 0.0010576,
                    1524 => 0.0007703,
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
