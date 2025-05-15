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
                    578 => 0.4307292,
                    1115 => 0.1304377,
                    1102 => 0.0516853,
                    763 => 0.042889,
                    1283 => 0.029397,
                    2100 => 0.0293787,
                    15636 => 0.0262684,
                    2030 => 0.021849,
                    320 => 0.016903,
                    1628 => 0.0118695,
                  },
                  "token": 578,
                },
                {
                  "probabilities": Map {
                    16053 => 0.4222992,
                    4062 => 0.3036339,
                    39935 => 0.0603973,
                    2944 => 0.0373043,
                    5679 => 0.0238118,
                    11914 => 0.0162981,
                    2144 => 0.0146835,
                    1121 => 0.0069849,
                    17571 => 0.0057944,
                    3446 => 0.0049346,
                  },
                  "token": 16053,
                },
                {
                  "probabilities": Map {
                    5679 => 0.9981185,
                    12875 => 0.0001592,
                    18964 => 0.0001154,
                    39935 => 0.000115,
                    13 => 0.0001049,
                    627 => 0.0000928,
                    656 => 0.0000625,
                    893 => 0.0000563,
                    198 => 0.0000522,
                    374 => 0.0000519,
                  },
                  "token": 5679,
                },
                {
                  "probabilities": Map {
                    374 => 0.8126541,
                    1587 => 0.0481526,
                    596 => 0.0247368,
                    1120 => 0.0223041,
                    3250 => 0.0215465,
                    706 => 0.0161833,
                    15849 => 0.0086943,
                    1053 => 0.0059125,
                    55064 => 0.0037811,
                    11 => 0.0036657,
                  },
                  "token": 374,
                },
                {
                  "probabilities": Map {
                    2288 => 0.2757553,
                    1120 => 0.1666547,
                    539 => 0.1577473,
                    779 => 0.133445,
                    264 => 0.0558533,
                    1101 => 0.0292142,
                    16053 => 0.0176781,
                    5042 => 0.015864,
                    1193 => 0.014582,
                    2744 => 0.0140904,
                  },
                  "token": 2288,
                },
                {
                  "probabilities": Map {
                    16053 => 0.9065909,
                    13326 => 0.0636439,
                    19781 => 0.007158,
                    17551 => 0.0020244,
                    10968 => 0.0012683,
                    11920 => 0.0011008,
                    6435 => 0.0010087,
                    34386 => 0.0007758,
                    1208 => 0.0006099,
                    25366 => 0.0005672,
                  },
                  "token": 16053,
                },
                {
                  "probabilities": Map {
                    311 => 0.988279,
                    1524 => 0.0061858,
                    11 => 0.0025774,
                    323 => 0.0005243,
                    13 => 0.0003535,
                    627 => 0.0003211,
                    1606 => 0.0002642,
                    2288 => 0.0002583,
                    369 => 0.0001247,
                    320 => 0.0001022,
                  },
                  "token": 311,
                },
                {
                  "probabilities": Map {
                    2512 => 0.7492248,
                    1524 => 0.0989405,
                    656 => 0.032411,
                    636 => 0.0240648,
                    7940 => 0.0144123,
                    33586 => 0.0108691,
                    387 => 0.0086826,
                    1781 => 0.0058571,
                    1629 => 0.005489,
                    3351 => 0.0051125,
                  },
                  "token": 2512,
                },
                {
                  "probabilities": Map {
                    922 => 0.9521815,
                    1606 => 0.015013,
                    11 => 0.014011,
                    430 => 0.0029686,
                    627 => 0.002315,
                    13 => 0.0018864,
                    1524 => 0.0018013,
                    369 => 0.0017693,
                    323 => 0.0009247,
                    382 => 0.0008479,
                  },
                  "token": 922,
                },
                {
                  "probabilities": Map {
                    279 => 0.6508148,
                    4205 => 0.3128796,
                    1148 => 0.0113661,
                    1690 => 0.004425,
                    904 => 0.0030377,
                    1202 => 0.0026803,
                    264 => 0.0011171,
                    1790 => 0.001086,
                    813 => 0.0010579,
                    1524 => 0.0007699,
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
                  "confidence": 0.4307292,
                  "token": 578,
                },
                {
                  "confidence": 0.4222992,
                  "token": 16053,
                },
                {
                  "confidence": 0.9981185,
                  "token": 5679,
                },
                {
                  "confidence": 0.8126541,
                  "token": 374,
                },
                {
                  "confidence": 0.2757553,
                  "token": 2288,
                },
                {
                  "confidence": 0.9065909,
                  "token": 16053,
                },
                {
                  "confidence": 0.988279,
                  "token": 311,
                },
                {
                  "confidence": 0.7492248,
                  "token": 2512,
                },
                {
                  "confidence": 0.9521815,
                  "token": 922,
                },
                {
                  "confidence": 0.6508148,
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
                  "confidence": 0.4307292,
                  "probabilities": Map {
                    578 => 0.4307292,
                    1115 => 0.1304377,
                    1102 => 0.0516853,
                    763 => 0.042889,
                    1283 => 0.029397,
                    2100 => 0.0293787,
                    15636 => 0.0262684,
                    2030 => 0.021849,
                    320 => 0.016903,
                    1628 => 0.0118695,
                  },
                  "token": 578,
                },
                {
                  "confidence": 0.4222992,
                  "probabilities": Map {
                    16053 => 0.4222992,
                    4062 => 0.3036339,
                    39935 => 0.0603973,
                    2944 => 0.0373043,
                    5679 => 0.0238118,
                    11914 => 0.0162981,
                    2144 => 0.0146835,
                    1121 => 0.0069849,
                    17571 => 0.0057944,
                    3446 => 0.0049346,
                  },
                  "token": 16053,
                },
                {
                  "confidence": 0.9981185,
                  "probabilities": Map {
                    5679 => 0.9981185,
                    12875 => 0.0001592,
                    18964 => 0.0001154,
                    39935 => 0.000115,
                    13 => 0.0001049,
                    627 => 0.0000928,
                    656 => 0.0000625,
                    893 => 0.0000563,
                    198 => 0.0000522,
                    374 => 0.0000519,
                  },
                  "token": 5679,
                },
                {
                  "confidence": 0.8126541,
                  "probabilities": Map {
                    374 => 0.8126541,
                    1587 => 0.0481526,
                    596 => 0.0247368,
                    1120 => 0.0223041,
                    3250 => 0.0215465,
                    706 => 0.0161833,
                    15849 => 0.0086943,
                    1053 => 0.0059125,
                    55064 => 0.0037811,
                    11 => 0.0036657,
                  },
                  "token": 374,
                },
                {
                  "confidence": 0.2757553,
                  "probabilities": Map {
                    2288 => 0.2757553,
                    1120 => 0.1666547,
                    539 => 0.1577473,
                    779 => 0.133445,
                    264 => 0.0558533,
                    1101 => 0.0292142,
                    16053 => 0.0176781,
                    5042 => 0.015864,
                    1193 => 0.014582,
                    2744 => 0.0140904,
                  },
                  "token": 2288,
                },
                {
                  "confidence": 0.9065909,
                  "probabilities": Map {
                    16053 => 0.9065909,
                    13326 => 0.0636439,
                    19781 => 0.007158,
                    17551 => 0.0020244,
                    10968 => 0.0012683,
                    11920 => 0.0011008,
                    6435 => 0.0010087,
                    34386 => 0.0007758,
                    1208 => 0.0006099,
                    25366 => 0.0005672,
                  },
                  "token": 16053,
                },
                {
                  "confidence": 0.988279,
                  "probabilities": Map {
                    311 => 0.988279,
                    1524 => 0.0061858,
                    11 => 0.0025774,
                    323 => 0.0005243,
                    13 => 0.0003535,
                    627 => 0.0003211,
                    1606 => 0.0002642,
                    2288 => 0.0002583,
                    369 => 0.0001247,
                    320 => 0.0001022,
                  },
                  "token": 311,
                },
                {
                  "confidence": 0.7492248,
                  "probabilities": Map {
                    2512 => 0.7492248,
                    1524 => 0.0989405,
                    656 => 0.032411,
                    636 => 0.0240648,
                    7940 => 0.0144123,
                    33586 => 0.0108691,
                    387 => 0.0086826,
                    1781 => 0.0058571,
                    1629 => 0.005489,
                    3351 => 0.0051125,
                  },
                  "token": 2512,
                },
                {
                  "confidence": 0.9521815,
                  "probabilities": Map {
                    922 => 0.9521815,
                    1606 => 0.015013,
                    11 => 0.014011,
                    430 => 0.0029686,
                    627 => 0.002315,
                    13 => 0.0018864,
                    1524 => 0.0018013,
                    369 => 0.0017693,
                    323 => 0.0009247,
                    382 => 0.0008479,
                  },
                  "token": 922,
                },
                {
                  "confidence": 0.6508148,
                  "probabilities": Map {
                    279 => 0.6508148,
                    4205 => 0.3128796,
                    1148 => 0.0113661,
                    1690 => 0.004425,
                    904 => 0.0030377,
                    1202 => 0.0026803,
                    264 => 0.0011171,
                    1790 => 0.001086,
                    813 => 0.0010579,
                    1524 => 0.0007699,
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
