import {describe, expect, test} from "vitest";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";


describe("bge", () => {
    describe("embedding", () => {
        test("getEmbedding reads the requested token, not always the last one", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("bge-small-en-v1.5-q8_0.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 512,
                _embeddings: true
            });
            const ctx = context._ctx;

            const tokenize = (text: string) => model.tokenize(text);

            // Regressed in v3.22.0 (#645): `getEmbedding(n)` hard-coded `-1`, so it
            // returned the LAST token's embedding regardless of `n`, and every
            // hidden-state readout of an earlier token silently got the last one.
            const firstText = "apple banana cherry";
            const firstTokens = tokenize(firstText);
            ctx.initBatch(firstTokens.length);
            ctx.addToBatch(0, 0, Uint32Array.from(firstTokens), Uint32Array.from(firstTokens.map((_, i) => i)));
            await ctx.decodeBatch();
            ctx.disposeSequence(0);

            const n = firstTokens.length;
            const secondLast = ctx.getEmbedding(2);
            const last = ctx.getEmbedding(1);
            expect(secondLast.length).toBeGreaterThan(0);
            expect(last.length).toBe(secondLast.length);
            // "cherry" is not "banana": the two readouts must differ
            expect(Array.from(secondLast)).to.not.eql(Array.from(last));

            // reading the same position twice is stable
            const secondLast2 = ctx.getEmbedding(2);
            expect(Array.from(secondLast2)).to.eql(Array.from(secondLast));

            // out of range read (beyond the batch) must throw, not silently return the last token
            expect(() => ctx.getEmbedding(n + 1)).toThrow();

            await context.dispose();
            await model.dispose();
        });

        test("getEmbeddings returns each requested output position from one decode", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("bge-small-en-v1.5-q8_0.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 512,
                _embeddings: true
            });
            const ctx = context._ctx;

            const tokens = model.tokenize("one two three four");
            ctx.initBatch(tokens.length);
            // mark every token as a logit output, so every position becomes readable
            const logitIndexes = Uint32Array.from(tokens.map((_, i) => i));
            ctx.addToBatch(0, 0, Uint32Array.from(tokens), logitIndexes);
            await ctx.decodeBatch();
            ctx.disposeSequence(0);

            const nEmbd = ctx.getEmbedding(1).length;
            const positions = Uint32Array.from([0, 1, tokens.length - 1]);
            const flat = ctx.getEmbeddings(positions);
            expect(flat.length).toBe(positions.length * nEmbd);

            const row = (i: number) => Array.from(flat.slice(i * nEmbd, (i + 1) * nEmbd));

            // each row equals a direct single readout of the same token (counted from the end)
            const lastDirect = Array.from(ctx.getEmbedding(1));
            expect(row(2)).to.eql(lastDirect);
            // different tokens differ
            expect(row(0)).to.not.eql(row(1));

            // out-of-range position throws
            expect(() => ctx.getEmbeddings(Uint32Array.from([tokens.length]))).toThrow();
            // empty positions throw
            expect(() => ctx.getEmbeddings(new Uint32Array(0))).toThrow();

            await context.dispose();
            await model.dispose();
        });
    });
});
