import {describe, expect, test} from "vitest";
import {Token} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";
import {SequenceEvaluateOutput} from "../../../src/evaluator/LlamaContext/types.js";

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

        test("with probabilities", {timeout: 1000 * 60 * 60 * 2}, async () => {
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
                    578 => 0.43072959780693054,
                    1115 => 0.13043756783008575,
                    1102 => 0.05168525502085686,
                    763 => 0.04288897663354874,
                    1283 => 0.029397012665867805,
                    2100 => 0.029378682374954224,
                    15636 => 0.026268385350704193,
                    2030 => 0.02184896357357502,
                    320 => 0.01690298318862915,
                    1628 => 0.011869494803249836,
                  },
                  "token": 578,
                },
                {
                  "probabilities": Map {
                    16053 => 0.42230042815208435,
                    4062 => 0.30363598465919495,
                    39935 => 0.060395680367946625,
                    2944 => 0.0373028889298439,
                    5679 => 0.023811226710677147,
                    11914 => 0.016298197209835052,
                    2144 => 0.014683431014418602,
                    1121 => 0.006984429899603128,
                    17571 => 0.005794311873614788,
                    3446 => 0.004934381693601608,
                  },
                  "token": 16053,
                },
                {
                  "probabilities": Map {
                    5679 => 0.9981182813644409,
                    12875 => 0.00015924211766105145,
                    18964 => 0.00011538491526152939,
                    39935 => 0.00011497695231810212,
                    13 => 0.00010490677959751338,
                    627 => 0.00009277161007048562,
                    656 => 0.00006256866618059576,
                    893 => 0.00005633986438624561,
                    198 => 0.00005223735934123397,
                    374 => 0.00005191291347728111,
                  },
                  "token": 5679,
                },
                {
                  "probabilities": Map {
                    374 => 0.8126624226570129,
                    1587 => 0.04815267026424408,
                    596 => 0.024733318015933037,
                    1120 => 0.022302960976958275,
                    3250 => 0.02154506742954254,
                    706 => 0.01618366874754429,
                    15849 => 0.00869414210319519,
                    1053 => 0.005911793559789658,
                    55064 => 0.0037806404288858175,
                    11 => 0.0036655946169048548,
                  },
                  "token": 374,
                },
                {
                  "probabilities": Map {
                    2288 => 0.2757589817047119,
                    1120 => 0.16664838790893555,
                    539 => 0.15775153040885925,
                    779 => 0.1334378868341446,
                    264 => 0.05585397779941559,
                    1101 => 0.029216185212135315,
                    16053 => 0.017680438235402107,
                    5042 => 0.015862826257944107,
                    1193 => 0.014583030715584755,
                    2744 => 0.014090186916291714,
                  },
                  "token": 2288,
                },
                {
                  "probabilities": Map {
                    16053 => 0.9066131114959717,
                    13326 => 0.06362388283014297,
                    19781 => 0.00715874508023262,
                    17551 => 0.0020243648905307055,
                    10968 => 0.0012676455080509186,
                    11920 => 0.0011003530817106366,
                    6435 => 0.0010086935944855213,
                    34386 => 0.0007757442072033882,
                    1208 => 0.0006099422462284565,
                    25366 => 0.0005670536775141954,
                  },
                  "token": 16053,
                },
                {
                  "probabilities": Map {
                    311 => 0.9882798194885254,
                    1524 => 0.006186165846884251,
                    11 => 0.0025764326564967632,
                    323 => 0.0005241178441792727,
                    13 => 0.0003534558054525405,
                    627 => 0.0003210459544789046,
                    1606 => 0.00026416024775244296,
                    2288 => 0.00025828619254752994,
                    369 => 0.00012467413034755737,
                    320 => 0.00010217254020972177,
                  },
                  "token": 311,
                },
                {
                  "probabilities": Map {
                    2512 => 0.7492305040359497,
                    1524 => 0.09894875437021255,
                    656 => 0.032405685633420944,
                    636 => 0.024060513824224472,
                    7940 => 0.014415031298995018,
                    33586 => 0.010868093930184841,
                    387 => 0.008681590668857098,
                    1781 => 0.005856928415596485,
                    1629 => 0.005487737245857716,
                    3351 => 0.005111564416438341,
                  },
                  "token": 2512,
                },
                {
                  "probabilities": Map {
                    922 => 0.9521902799606323,
                    1606 => 0.01500858273357153,
                    11 => 0.014008254744112492,
                    430 => 0.002968641696497798,
                    627 => 0.002314596902579069,
                    13 => 0.0018861450953409076,
                    1524 => 0.0018014858942478895,
                    369 => 0.001769029418937862,
                    323 => 0.0009245016262866557,
                    382 => 0.0008477734518237412,
                  },
                  "token": 922,
                },
                {
                  "probabilities": Map {
                    279 => 0.6508099436759949,
                    4205 => 0.31288382411003113,
                    1148 => 0.011366183869540691,
                    1690 => 0.004424854647368193,
                    904 => 0.0030378159135580063,
                    1202 => 0.0026804644148796797,
                    264 => 0.0011171377263963223,
                    1790 => 0.0010860266629606485,
                    813 => 0.0010579257505014539,
                    1524 => 0.0007699796697124839,
                  },
                  "token": 279,
                },
              ]
            `);
        });

        test("with confidence", {timeout: 1000 * 60 * 60 * 2}, async () => {
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
            const res: SequenceEvaluateOutput<{readonly confidence: true}>[] = [];
            for await (const output of sequence.evaluateWithMetadata(inputTokens, {confidence: true})) {
                res.push(output);

                if (res.length >= maxTokens)
                    break;
            }

            expect(res).toMatchInlineSnapshot(`
              [
                {
                  "confidence": 0.43072959780693054,
                  "token": 578,
                },
                {
                  "confidence": 0.42230042815208435,
                  "token": 16053,
                },
                {
                  "confidence": 0.9981182813644409,
                  "token": 5679,
                },
                {
                  "confidence": 0.8126624226570129,
                  "token": 374,
                },
                {
                  "confidence": 0.2757589817047119,
                  "token": 2288,
                },
                {
                  "confidence": 0.9066131114959717,
                  "token": 16053,
                },
                {
                  "confidence": 0.9882798194885254,
                  "token": 311,
                },
                {
                  "confidence": 0.7492305040359497,
                  "token": 2512,
                },
                {
                  "confidence": 0.9521902799606323,
                  "token": 922,
                },
                {
                  "confidence": 0.6508099436759949,
                  "token": 279,
                },
              ]
            `);
        });

        test("with probabilities and confidence", {timeout: 1000 * 60 * 60 * 2}, async () => {
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
                  "confidence": 0.43072959780693054,
                  "probabilities": Map {
                    578 => 0.43072959780693054,
                    1115 => 0.13043756783008575,
                    1102 => 0.05168525502085686,
                    763 => 0.04288897663354874,
                    1283 => 0.029397012665867805,
                    2100 => 0.029378682374954224,
                    15636 => 0.026268385350704193,
                    2030 => 0.02184896357357502,
                    320 => 0.01690298318862915,
                    1628 => 0.011869494803249836,
                  },
                  "token": 578,
                },
                {
                  "confidence": 0.42230042815208435,
                  "probabilities": Map {
                    16053 => 0.42230042815208435,
                    4062 => 0.30363598465919495,
                    39935 => 0.060395680367946625,
                    2944 => 0.0373028889298439,
                    5679 => 0.023811226710677147,
                    11914 => 0.016298197209835052,
                    2144 => 0.014683431014418602,
                    1121 => 0.006984429899603128,
                    17571 => 0.005794311873614788,
                    3446 => 0.004934381693601608,
                  },
                  "token": 16053,
                },
                {
                  "confidence": 0.9981182813644409,
                  "probabilities": Map {
                    5679 => 0.9981182813644409,
                    12875 => 0.00015924211766105145,
                    18964 => 0.00011538491526152939,
                    39935 => 0.00011497695231810212,
                    13 => 0.00010490677959751338,
                    627 => 0.00009277161007048562,
                    656 => 0.00006256866618059576,
                    893 => 0.00005633986438624561,
                    198 => 0.00005223735934123397,
                    374 => 0.00005191291347728111,
                  },
                  "token": 5679,
                },
                {
                  "confidence": 0.8126624226570129,
                  "probabilities": Map {
                    374 => 0.8126624226570129,
                    1587 => 0.04815267026424408,
                    596 => 0.024733318015933037,
                    1120 => 0.022302960976958275,
                    3250 => 0.02154506742954254,
                    706 => 0.01618366874754429,
                    15849 => 0.00869414210319519,
                    1053 => 0.005911793559789658,
                    55064 => 0.0037806404288858175,
                    11 => 0.0036655946169048548,
                  },
                  "token": 374,
                },
                {
                  "confidence": 0.2757589817047119,
                  "probabilities": Map {
                    2288 => 0.2757589817047119,
                    1120 => 0.16664838790893555,
                    539 => 0.15775153040885925,
                    779 => 0.1334378868341446,
                    264 => 0.05585397779941559,
                    1101 => 0.029216185212135315,
                    16053 => 0.017680438235402107,
                    5042 => 0.015862826257944107,
                    1193 => 0.014583030715584755,
                    2744 => 0.014090186916291714,
                  },
                  "token": 2288,
                },
                {
                  "confidence": 0.9066131114959717,
                  "probabilities": Map {
                    16053 => 0.9066131114959717,
                    13326 => 0.06362388283014297,
                    19781 => 0.00715874508023262,
                    17551 => 0.0020243648905307055,
                    10968 => 0.0012676455080509186,
                    11920 => 0.0011003530817106366,
                    6435 => 0.0010086935944855213,
                    34386 => 0.0007757442072033882,
                    1208 => 0.0006099422462284565,
                    25366 => 0.0005670536775141954,
                  },
                  "token": 16053,
                },
                {
                  "confidence": 0.9882798194885254,
                  "probabilities": Map {
                    311 => 0.9882798194885254,
                    1524 => 0.006186165846884251,
                    11 => 0.0025764326564967632,
                    323 => 0.0005241178441792727,
                    13 => 0.0003534558054525405,
                    627 => 0.0003210459544789046,
                    1606 => 0.00026416024775244296,
                    2288 => 0.00025828619254752994,
                    369 => 0.00012467413034755737,
                    320 => 0.00010217254020972177,
                  },
                  "token": 311,
                },
                {
                  "confidence": 0.7492305040359497,
                  "probabilities": Map {
                    2512 => 0.7492305040359497,
                    1524 => 0.09894875437021255,
                    656 => 0.032405685633420944,
                    636 => 0.024060513824224472,
                    7940 => 0.014415031298995018,
                    33586 => 0.010868093930184841,
                    387 => 0.008681590668857098,
                    1781 => 0.005856928415596485,
                    1629 => 0.005487737245857716,
                    3351 => 0.005111564416438341,
                  },
                  "token": 2512,
                },
                {
                  "confidence": 0.9521902799606323,
                  "probabilities": Map {
                    922 => 0.9521902799606323,
                    1606 => 0.01500858273357153,
                    11 => 0.014008254744112492,
                    430 => 0.002968641696497798,
                    627 => 0.002314596902579069,
                    13 => 0.0018861450953409076,
                    1524 => 0.0018014858942478895,
                    369 => 0.001769029418937862,
                    323 => 0.0009245016262866557,
                    382 => 0.0008477734518237412,
                  },
                  "token": 922,
                },
                {
                  "confidence": 0.6508099436759949,
                  "probabilities": Map {
                    279 => 0.6508099436759949,
                    4205 => 0.31288382411003113,
                    1148 => 0.011366183869540691,
                    1690 => 0.004424854647368193,
                    904 => 0.0030378159135580063,
                    1202 => 0.0026804644148796797,
                    264 => 0.0011171377263963223,
                    1790 => 0.0010860266629606485,
                    813 => 0.0010579257505014539,
                    1524 => 0.0007699796697124839,
                  },
                  "token": 279,
                },
              ]
            `);
        });

        test("confidence alone matches probability alone", {timeout: 1000 * 60 * 60 * 2}, async () => {
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

function simplifyRes<T extends SequenceEvaluateOutput<{readonly probabilities: true}>>(res: T[]) {
    for (const item of res) {
        if (item.probabilities != null)
            item.probabilities = new Map([...item.probabilities.entries()].slice(0, 10));
    }
}
