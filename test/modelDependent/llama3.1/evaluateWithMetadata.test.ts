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
                    578 => 0.4307296,
                    1115 => 0.1304376,
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
                    16053 => 0.4223004,
                    4062 => 0.303636,
                    39935 => 0.0603957,
                    2944 => 0.0373029,
                    5679 => 0.0238112,
                    11914 => 0.0162982,
                    2144 => 0.0146834,
                    1121 => 0.0069844,
                    17571 => 0.0057943,
                    3446 => 0.0049344,
                  },
                  "token": 16053,
                },
                {
                  "probabilities": Map {
                    5679 => 0.9981183,
                    12875 => 0.0001592,
                    18964 => 0.0001154,
                    39935 => 0.000115,
                    13 => 0.0001049,
                    627 => 0.0000928,
                    656 => 0.0000626,
                    893 => 0.0000563,
                    198 => 0.0000522,
                    374 => 0.0000519,
                  },
                  "token": 5679,
                },
                {
                  "probabilities": Map {
                    374 => 0.8126624,
                    1587 => 0.0481527,
                    596 => 0.0247333,
                    1120 => 0.022303,
                    3250 => 0.0215451,
                    706 => 0.0161837,
                    15849 => 0.0086941,
                    1053 => 0.0059118,
                    55064 => 0.0037806,
                    11 => 0.0036656,
                  },
                  "token": 374,
                },
                {
                  "probabilities": Map {
                    2288 => 0.275759,
                    1120 => 0.1666484,
                    539 => 0.1577515,
                    779 => 0.1334379,
                    264 => 0.055854,
                    1101 => 0.0292162,
                    16053 => 0.0176804,
                    5042 => 0.0158628,
                    1193 => 0.014583,
                    2744 => 0.0140902,
                  },
                  "token": 2288,
                },
                {
                  "probabilities": Map {
                    16053 => 0.9066131,
                    13326 => 0.0636239,
                    19781 => 0.0071587,
                    17551 => 0.0020244,
                    10968 => 0.0012676,
                    11920 => 0.0011004,
                    6435 => 0.0010087,
                    34386 => 0.0007757,
                    1208 => 0.0006099,
                    25366 => 0.0005671,
                  },
                  "token": 16053,
                },
                {
                  "probabilities": Map {
                    311 => 0.9882798,
                    1524 => 0.0061862,
                    11 => 0.0025764,
                    323 => 0.0005241,
                    13 => 0.0003535,
                    627 => 0.000321,
                    1606 => 0.0002642,
                    2288 => 0.0002583,
                    369 => 0.0001247,
                    320 => 0.0001022,
                  },
                  "token": 311,
                },
                {
                  "probabilities": Map {
                    2512 => 0.7492305,
                    1524 => 0.0989488,
                    656 => 0.0324057,
                    636 => 0.0240605,
                    7940 => 0.014415,
                    33586 => 0.0108681,
                    387 => 0.0086816,
                    1781 => 0.0058569,
                    1629 => 0.0054877,
                    3351 => 0.0051116,
                  },
                  "token": 2512,
                },
                {
                  "probabilities": Map {
                    922 => 0.9521903,
                    1606 => 0.0150086,
                    11 => 0.0140083,
                    430 => 0.0029686,
                    627 => 0.0023146,
                    13 => 0.0018861,
                    1524 => 0.0018015,
                    369 => 0.001769,
                    323 => 0.0009245,
                    382 => 0.0008478,
                  },
                  "token": 922,
                },
                {
                  "probabilities": Map {
                    279 => 0.6508099,
                    4205 => 0.3128838,
                    1148 => 0.0113662,
                    1690 => 0.0044249,
                    904 => 0.0030378,
                    1202 => 0.0026805,
                    264 => 0.0011171,
                    1790 => 0.001086,
                    813 => 0.0010579,
                    1524 => 0.00077,
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
                  "confidence": 0.4307296,
                  "token": 578,
                },
                {
                  "confidence": 0.4223004,
                  "token": 16053,
                },
                {
                  "confidence": 0.9981183,
                  "token": 5679,
                },
                {
                  "confidence": 0.8126624,
                  "token": 374,
                },
                {
                  "confidence": 0.275759,
                  "token": 2288,
                },
                {
                  "confidence": 0.9066131,
                  "token": 16053,
                },
                {
                  "confidence": 0.9882798,
                  "token": 311,
                },
                {
                  "confidence": 0.7492305,
                  "token": 2512,
                },
                {
                  "confidence": 0.9521903,
                  "token": 922,
                },
                {
                  "confidence": 0.6508099,
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
                  "confidence": 0.4307296,
                  "probabilities": Map {
                    578 => 0.4307296,
                    1115 => 0.1304376,
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
                  "confidence": 0.4223004,
                  "probabilities": Map {
                    16053 => 0.4223004,
                    4062 => 0.303636,
                    39935 => 0.0603957,
                    2944 => 0.0373029,
                    5679 => 0.0238112,
                    11914 => 0.0162982,
                    2144 => 0.0146834,
                    1121 => 0.0069844,
                    17571 => 0.0057943,
                    3446 => 0.0049344,
                  },
                  "token": 16053,
                },
                {
                  "confidence": 0.9981183,
                  "probabilities": Map {
                    5679 => 0.9981183,
                    12875 => 0.0001592,
                    18964 => 0.0001154,
                    39935 => 0.000115,
                    13 => 0.0001049,
                    627 => 0.0000928,
                    656 => 0.0000626,
                    893 => 0.0000563,
                    198 => 0.0000522,
                    374 => 0.0000519,
                  },
                  "token": 5679,
                },
                {
                  "confidence": 0.8126624,
                  "probabilities": Map {
                    374 => 0.8126624,
                    1587 => 0.0481527,
                    596 => 0.0247333,
                    1120 => 0.022303,
                    3250 => 0.0215451,
                    706 => 0.0161837,
                    15849 => 0.0086941,
                    1053 => 0.0059118,
                    55064 => 0.0037806,
                    11 => 0.0036656,
                  },
                  "token": 374,
                },
                {
                  "confidence": 0.275759,
                  "probabilities": Map {
                    2288 => 0.275759,
                    1120 => 0.1666484,
                    539 => 0.1577515,
                    779 => 0.1334379,
                    264 => 0.055854,
                    1101 => 0.0292162,
                    16053 => 0.0176804,
                    5042 => 0.0158628,
                    1193 => 0.014583,
                    2744 => 0.0140902,
                  },
                  "token": 2288,
                },
                {
                  "confidence": 0.9066131,
                  "probabilities": Map {
                    16053 => 0.9066131,
                    13326 => 0.0636239,
                    19781 => 0.0071587,
                    17551 => 0.0020244,
                    10968 => 0.0012676,
                    11920 => 0.0011004,
                    6435 => 0.0010087,
                    34386 => 0.0007757,
                    1208 => 0.0006099,
                    25366 => 0.0005671,
                  },
                  "token": 16053,
                },
                {
                  "confidence": 0.9882798,
                  "probabilities": Map {
                    311 => 0.9882798,
                    1524 => 0.0061862,
                    11 => 0.0025764,
                    323 => 0.0005241,
                    13 => 0.0003535,
                    627 => 0.000321,
                    1606 => 0.0002642,
                    2288 => 0.0002583,
                    369 => 0.0001247,
                    320 => 0.0001022,
                  },
                  "token": 311,
                },
                {
                  "confidence": 0.7492305,
                  "probabilities": Map {
                    2512 => 0.7492305,
                    1524 => 0.0989488,
                    656 => 0.0324057,
                    636 => 0.0240605,
                    7940 => 0.014415,
                    33586 => 0.0108681,
                    387 => 0.0086816,
                    1781 => 0.0058569,
                    1629 => 0.0054877,
                    3351 => 0.0051116,
                  },
                  "token": 2512,
                },
                {
                  "confidence": 0.9521903,
                  "probabilities": Map {
                    922 => 0.9521903,
                    1606 => 0.0150086,
                    11 => 0.0140083,
                    430 => 0.0029686,
                    627 => 0.0023146,
                    13 => 0.0018861,
                    1524 => 0.0018015,
                    369 => 0.001769,
                    323 => 0.0009245,
                    382 => 0.0008478,
                  },
                  "token": 922,
                },
                {
                  "confidence": 0.6508099,
                  "probabilities": Map {
                    279 => 0.6508099,
                    4205 => 0.3128838,
                    1148 => 0.0113662,
                    1690 => 0.0044249,
                    904 => 0.0030378,
                    1202 => 0.0026805,
                    264 => 0.0011171,
                    1790 => 0.001086,
                    813 => 0.0010579,
                    1524 => 0.00077,
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
