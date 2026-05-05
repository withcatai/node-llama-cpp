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
                    578 => 0.43,
                    1115 => 0.13,
                    1102 => 0.0516,
                    763 => 0.0429,
                    2100 => 0.0294,
                    1283 => 0.0294,
                    15636 => 0.0263,
                    2030 => 0.0219,
                    320 => 0.0169,
                    1628 => 0.0119,
                  },
                  "token": 578,
                },
                {
                  "probabilities": Map {
                    16053 => 0.422,
                    4062 => 0.304,
                    39935 => 0.0603,
                    2944 => 0.0376,
                    5679 => 0.0237,
                    11914 => 0.0161,
                    2144 => 0.0147,
                    1121 => 0.00699,
                    17571 => 0.00574,
                    3446 => 0.00492,
                  },
                  "token": 16053,
                },
                {
                  "probabilities": Map {
                    5679 => 0.998,
                    12875 => 0.000159,
                    18964 => 0.000115,
                    39935 => 0.000115,
                    13 => 0.000105,
                    627 => 0.0000928,
                    656 => 0.0000625,
                    893 => 0.0000563,
                    198 => 0.0000522,
                    374 => 0.0000521,
                  },
                  "token": 5679,
                },
                {
                  "probabilities": Map {
                    374 => 0.812,
                    1587 => 0.0482,
                    596 => 0.0247,
                    1120 => 0.0224,
                    3250 => 0.0216,
                    706 => 0.0162,
                    15849 => 0.00871,
                    1053 => 0.00591,
                    55064 => 0.00378,
                    11 => 0.00368,
                  },
                  "token": 374,
                },
                {
                  "probabilities": Map {
                    2288 => 0.276,
                    1120 => 0.167,
                    539 => 0.158,
                    779 => 0.133,
                    264 => 0.0558,
                    1101 => 0.0293,
                    16053 => 0.0178,
                    5042 => 0.0159,
                    1193 => 0.0146,
                    2744 => 0.0141,
                  },
                  "token": 2288,
                },
                {
                  "probabilities": Map {
                    16053 => 0.907,
                    13326 => 0.0635,
                    19781 => 0.00713,
                    17551 => 0.00202,
                    10968 => 0.00126,
                    11920 => 0.0011,
                    6435 => 0.001,
                    34386 => 0.000775,
                    1208 => 0.000609,
                    25366 => 0.000566,
                  },
                  "token": 16053,
                },
                {
                  "probabilities": Map {
                    311 => 0.988,
                    1524 => 0.00617,
                    11 => 0.00258,
                    323 => 0.000525,
                    13 => 0.000354,
                    627 => 0.000322,
                    1606 => 0.000265,
                    2288 => 0.000258,
                    369 => 0.000125,
                    320 => 0.000102,
                  },
                  "token": 311,
                },
                {
                  "probabilities": Map {
                    2512 => 0.75,
                    1524 => 0.0987,
                    656 => 0.0324,
                    636 => 0.0241,
                    7940 => 0.0144,
                    33586 => 0.0109,
                    387 => 0.00867,
                    1781 => 0.00585,
                    1629 => 0.00549,
                    3351 => 0.00512,
                  },
                  "token": 2512,
                },
                {
                  "probabilities": Map {
                    922 => 0.952,
                    1606 => 0.015,
                    11 => 0.014,
                    430 => 0.00297,
                    627 => 0.00232,
                    13 => 0.00189,
                    1524 => 0.0018,
                    369 => 0.00177,
                    323 => 0.000927,
                    382 => 0.000848,
                  },
                  "token": 922,
                },
                {
                  "probabilities": Map {
                    279 => 0.652,
                    4205 => 0.312,
                    1148 => 0.0114,
                    1690 => 0.00443,
                    904 => 0.00304,
                    1202 => 0.00267,
                    264 => 0.00111,
                    1790 => 0.00108,
                    813 => 0.00105,
                    1524 => 0.000764,
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
                  "confidence": 0.43,
                  "token": 578,
                },
                {
                  "confidence": 0.422,
                  "token": 16053,
                },
                {
                  "confidence": 0.998,
                  "token": 5679,
                },
                {
                  "confidence": 0.812,
                  "token": 374,
                },
                {
                  "confidence": 0.276,
                  "token": 2288,
                },
                {
                  "confidence": 0.907,
                  "token": 16053,
                },
                {
                  "confidence": 0.988,
                  "token": 311,
                },
                {
                  "confidence": 0.75,
                  "token": 2512,
                },
                {
                  "confidence": 0.952,
                  "token": 922,
                },
                {
                  "confidence": 0.652,
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
                  "confidence": 0.43,
                  "probabilities": Map {
                    578 => 0.43,
                    1115 => 0.13,
                    1102 => 0.0516,
                    763 => 0.0429,
                    2100 => 0.0294,
                    1283 => 0.0294,
                    15636 => 0.0263,
                    2030 => 0.0219,
                    320 => 0.0169,
                    1628 => 0.0119,
                  },
                  "token": 578,
                },
                {
                  "confidence": 0.422,
                  "probabilities": Map {
                    16053 => 0.422,
                    4062 => 0.304,
                    39935 => 0.0603,
                    2944 => 0.0376,
                    5679 => 0.0237,
                    11914 => 0.0161,
                    2144 => 0.0147,
                    1121 => 0.00699,
                    17571 => 0.00574,
                    3446 => 0.00492,
                  },
                  "token": 16053,
                },
                {
                  "confidence": 0.998,
                  "probabilities": Map {
                    5679 => 0.998,
                    12875 => 0.000159,
                    18964 => 0.000115,
                    39935 => 0.000115,
                    13 => 0.000105,
                    627 => 0.0000928,
                    656 => 0.0000625,
                    893 => 0.0000563,
                    198 => 0.0000522,
                    374 => 0.0000521,
                  },
                  "token": 5679,
                },
                {
                  "confidence": 0.812,
                  "probabilities": Map {
                    374 => 0.812,
                    1587 => 0.0482,
                    596 => 0.0247,
                    1120 => 0.0224,
                    3250 => 0.0216,
                    706 => 0.0162,
                    15849 => 0.00871,
                    1053 => 0.00591,
                    55064 => 0.00378,
                    11 => 0.00368,
                  },
                  "token": 374,
                },
                {
                  "confidence": 0.276,
                  "probabilities": Map {
                    2288 => 0.276,
                    1120 => 0.167,
                    539 => 0.158,
                    779 => 0.133,
                    264 => 0.0558,
                    1101 => 0.0293,
                    16053 => 0.0178,
                    5042 => 0.0159,
                    1193 => 0.0146,
                    2744 => 0.0141,
                  },
                  "token": 2288,
                },
                {
                  "confidence": 0.907,
                  "probabilities": Map {
                    16053 => 0.907,
                    13326 => 0.0635,
                    19781 => 0.00713,
                    17551 => 0.00202,
                    10968 => 0.00126,
                    11920 => 0.0011,
                    6435 => 0.001,
                    34386 => 0.000775,
                    1208 => 0.000609,
                    25366 => 0.000566,
                  },
                  "token": 16053,
                },
                {
                  "confidence": 0.988,
                  "probabilities": Map {
                    311 => 0.988,
                    1524 => 0.00617,
                    11 => 0.00258,
                    323 => 0.000525,
                    13 => 0.000354,
                    627 => 0.000322,
                    1606 => 0.000265,
                    2288 => 0.000258,
                    369 => 0.000125,
                    320 => 0.000102,
                  },
                  "token": 311,
                },
                {
                  "confidence": 0.75,
                  "probabilities": Map {
                    2512 => 0.75,
                    1524 => 0.0987,
                    656 => 0.0324,
                    636 => 0.0241,
                    7940 => 0.0144,
                    33586 => 0.0109,
                    387 => 0.00867,
                    1781 => 0.00585,
                    1629 => 0.00549,
                    3351 => 0.00512,
                  },
                  "token": 2512,
                },
                {
                  "confidence": 0.952,
                  "probabilities": Map {
                    922 => 0.952,
                    1606 => 0.015,
                    11 => 0.014,
                    430 => 0.00297,
                    627 => 0.00232,
                    13 => 0.00189,
                    1524 => 0.0018,
                    369 => 0.00177,
                    323 => 0.000927,
                    382 => 0.000848,
                  },
                  "token": 922,
                },
                {
                  "confidence": 0.652,
                  "probabilities": Map {
                    279 => 0.652,
                    4205 => 0.312,
                    1148 => 0.0114,
                    1690 => 0.00443,
                    904 => 0.00304,
                    1202 => 0.00267,
                    264 => 0.00111,
                    1790 => 0.00108,
                    813 => 0.00105,
                    1524 => 0.000764,
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
                    .map(([token, probability]) => [token, simplifyFloat(probability)])
            );

        if (item.confidence != null)
            item.confidence = simplifyFloat(item.confidence);
    }
}

function simplifyFloat(value: number) {
    if (value === 0)
        return 0;

    const step = 10 ** (Math.floor(Math.log10(Math.abs(value))) - 2);
    return Number.parseFloat((Math.round(value / step) * step).toPrecision(12));
}
