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
                    578 => 0.4305533,
                    1115 => 0.130425,
                    1102 => 0.0517001,
                    763 => 0.0429165,
                    2100 => 0.0294256,
                    1283 => 0.0293639,
                    15636 => 0.0263192,
                    2030 => 0.021846,
                    320 => 0.0169397,
                    1628 => 0.0118622,
                  },
                  "token": 578,
                },
                {
                  "probabilities": Map {
                    16053 => 0.422323,
                    4062 => 0.3038028,
                    39935 => 0.0603259,
                    2944 => 0.03719,
                    5679 => 0.0237822,
                    11914 => 0.0163508,
                    2144 => 0.0146799,
                    1121 => 0.0069792,
                    17571 => 0.0058104,
                    3446 => 0.0049345,
                  },
                  "token": 16053,
                },
                {
                  "probabilities": Map {
                    5679 => 0.9981169,
                    12875 => 0.0001591,
                    18964 => 0.0001158,
                    39935 => 0.0001149,
                    13 => 0.000105,
                    627 => 0.0000928,
                    656 => 0.0000626,
                    893 => 0.0000564,
                    198 => 0.0000523,
                    374 => 0.000052,
                  },
                  "token": 5679,
                },
                {
                  "probabilities": Map {
                    374 => 0.8124886,
                    1587 => 0.0481525,
                    596 => 0.0247686,
                    1120 => 0.0223102,
                    3250 => 0.0215655,
                    706 => 0.0162146,
                    15849 => 0.0086973,
                    1053 => 0.0059326,
                    55064 => 0.0037868,
                    11 => 0.0036692,
                  },
                  "token": 374,
                },
                {
                  "probabilities": Map {
                    2288 => 0.275358,
                    1120 => 0.1665356,
                    539 => 0.1578801,
                    779 => 0.1335334,
                    264 => 0.0559268,
                    1101 => 0.029222,
                    16053 => 0.0176927,
                    5042 => 0.0158736,
                    1193 => 0.0145978,
                    2744 => 0.0141005,
                  },
                  "token": 2288,
                },
                {
                  "probabilities": Map {
                    16053 => 0.9064938,
                    13326 => 0.0637119,
                    19781 => 0.0071733,
                    17551 => 0.0020312,
                    10968 => 0.0012693,
                    11920 => 0.0011015,
                    6435 => 0.0010066,
                    34386 => 0.0007763,
                    1208 => 0.00061,
                    25366 => 0.0005686,
                  },
                  "token": 16053,
                },
                {
                  "probabilities": Map {
                    311 => 0.9882674,
                    1524 => 0.0062006,
                    11 => 0.0025759,
                    323 => 0.0005238,
                    13 => 0.000353,
                    627 => 0.0003209,
                    1606 => 0.0002636,
                    2288 => 0.0002586,
                    369 => 0.0001249,
                    320 => 0.0001022,
                  },
                  "token": 311,
                },
                {
                  "probabilities": Map {
                    2512 => 0.748888,
                    1524 => 0.0990105,
                    656 => 0.0324961,
                    636 => 0.0241074,
                    7940 => 0.0144517,
                    33586 => 0.0108896,
                    387 => 0.0086869,
                    1781 => 0.0058626,
                    1629 => 0.0054984,
                    3351 => 0.0051182,
                  },
                  "token": 2512,
                },
                {
                  "probabilities": Map {
                    922 => 0.9520677,
                    1606 => 0.015086,
                    11 => 0.0140343,
                    430 => 0.0029692,
                    627 => 0.0023166,
                    13 => 0.0018868,
                    1524 => 0.0018072,
                    369 => 0.0017682,
                    323 => 0.0009252,
                    382 => 0.0008473,
                  },
                  "token": 922,
                },
                {
                  "probabilities": Map {
                    279 => 0.65013,
                    4205 => 0.3135457,
                    1148 => 0.0113787,
                    1690 => 0.0044345,
                    904 => 0.0030412,
                    1202 => 0.0026712,
                    264 => 0.0011194,
                    1790 => 0.0010892,
                    813 => 0.0010549,
                    1524 => 0.0007689,
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
                  "confidence": 0.4305533,
                  "token": 578,
                },
                {
                  "confidence": 0.422323,
                  "token": 16053,
                },
                {
                  "confidence": 0.9981169,
                  "token": 5679,
                },
                {
                  "confidence": 0.8124886,
                  "token": 374,
                },
                {
                  "confidence": 0.275358,
                  "token": 2288,
                },
                {
                  "confidence": 0.9064938,
                  "token": 16053,
                },
                {
                  "confidence": 0.9882674,
                  "token": 311,
                },
                {
                  "confidence": 0.748888,
                  "token": 2512,
                },
                {
                  "confidence": 0.9520677,
                  "token": 922,
                },
                {
                  "confidence": 0.65013,
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
                  "confidence": 0.4305533,
                  "probabilities": Map {
                    578 => 0.4305533,
                    1115 => 0.130425,
                    1102 => 0.0517001,
                    763 => 0.0429165,
                    2100 => 0.0294256,
                    1283 => 0.0293639,
                    15636 => 0.0263192,
                    2030 => 0.021846,
                    320 => 0.0169397,
                    1628 => 0.0118622,
                  },
                  "token": 578,
                },
                {
                  "confidence": 0.422323,
                  "probabilities": Map {
                    16053 => 0.422323,
                    4062 => 0.3038028,
                    39935 => 0.0603259,
                    2944 => 0.03719,
                    5679 => 0.0237822,
                    11914 => 0.0163508,
                    2144 => 0.0146799,
                    1121 => 0.0069792,
                    17571 => 0.0058104,
                    3446 => 0.0049345,
                  },
                  "token": 16053,
                },
                {
                  "confidence": 0.9981169,
                  "probabilities": Map {
                    5679 => 0.9981169,
                    12875 => 0.0001591,
                    18964 => 0.0001158,
                    39935 => 0.0001149,
                    13 => 0.000105,
                    627 => 0.0000928,
                    656 => 0.0000626,
                    893 => 0.0000564,
                    198 => 0.0000523,
                    374 => 0.000052,
                  },
                  "token": 5679,
                },
                {
                  "confidence": 0.8124886,
                  "probabilities": Map {
                    374 => 0.8124886,
                    1587 => 0.0481525,
                    596 => 0.0247686,
                    1120 => 0.0223102,
                    3250 => 0.0215655,
                    706 => 0.0162146,
                    15849 => 0.0086973,
                    1053 => 0.0059326,
                    55064 => 0.0037868,
                    11 => 0.0036692,
                  },
                  "token": 374,
                },
                {
                  "confidence": 0.275358,
                  "probabilities": Map {
                    2288 => 0.275358,
                    1120 => 0.1665356,
                    539 => 0.1578801,
                    779 => 0.1335334,
                    264 => 0.0559268,
                    1101 => 0.029222,
                    16053 => 0.0176927,
                    5042 => 0.0158736,
                    1193 => 0.0145978,
                    2744 => 0.0141005,
                  },
                  "token": 2288,
                },
                {
                  "confidence": 0.9064938,
                  "probabilities": Map {
                    16053 => 0.9064938,
                    13326 => 0.0637119,
                    19781 => 0.0071733,
                    17551 => 0.0020312,
                    10968 => 0.0012693,
                    11920 => 0.0011015,
                    6435 => 0.0010066,
                    34386 => 0.0007763,
                    1208 => 0.00061,
                    25366 => 0.0005686,
                  },
                  "token": 16053,
                },
                {
                  "confidence": 0.9882674,
                  "probabilities": Map {
                    311 => 0.9882674,
                    1524 => 0.0062006,
                    11 => 0.0025759,
                    323 => 0.0005238,
                    13 => 0.000353,
                    627 => 0.0003209,
                    1606 => 0.0002636,
                    2288 => 0.0002586,
                    369 => 0.0001249,
                    320 => 0.0001022,
                  },
                  "token": 311,
                },
                {
                  "confidence": 0.748888,
                  "probabilities": Map {
                    2512 => 0.748888,
                    1524 => 0.0990105,
                    656 => 0.0324961,
                    636 => 0.0241074,
                    7940 => 0.0144517,
                    33586 => 0.0108896,
                    387 => 0.0086869,
                    1781 => 0.0058626,
                    1629 => 0.0054984,
                    3351 => 0.0051182,
                  },
                  "token": 2512,
                },
                {
                  "confidence": 0.9520677,
                  "probabilities": Map {
                    922 => 0.9520677,
                    1606 => 0.015086,
                    11 => 0.0140343,
                    430 => 0.0029692,
                    627 => 0.0023166,
                    13 => 0.0018868,
                    1524 => 0.0018072,
                    369 => 0.0017682,
                    323 => 0.0009252,
                    382 => 0.0008473,
                  },
                  "token": 922,
                },
                {
                  "confidence": 0.65013,
                  "probabilities": Map {
                    279 => 0.65013,
                    4205 => 0.3135457,
                    1148 => 0.0113787,
                    1690 => 0.0044345,
                    904 => 0.0030412,
                    1202 => 0.0026712,
                    264 => 0.0011194,
                    1790 => 0.0010892,
                    813 => 0.0010549,
                    1524 => 0.0007689,
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
