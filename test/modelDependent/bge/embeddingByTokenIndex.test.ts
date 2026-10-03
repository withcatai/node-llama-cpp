import {describe, expect, test} from "vitest";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";


describe("bge", () => {
    describe("embedding", () => {
        test("getEmbeddings returns each requested batch position from one decode", {timeout: 1000 * 60 * 60 * 2}, async () => {
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
            // mark every token as an output, so every position becomes readable
            const resLogitIndexes = ctx.addToBatch(
                0,
                0,
                Uint32Array.from(tokens),
                Uint32Array.from(tokens.map((_, i) => i))
            );
            await ctx.decodeBatch();
            ctx.disposeSequence(0);

            const nEmbd = ctx.getEmbedding(1).length;
            const positions = Uint32Array.from([0, 1, tokens.length - 1]);
            const flat = ctx.getEmbeddings(positions);
            expect(flat.length).toBe(positions.length * nEmbd);

            const row = (i: number) => Array.from(flat.slice(i * nEmbd, (i + 1) * nEmbd));

            // the last batch position is what getEmbedding(1) (last output row) returns
            expect(row(2)).to.eql(Array.from(ctx.getEmbedding(1)));
            // different batch positions return different token states
            expect(row(0)).to.not.eql(row(1));
            expect(row(0)).to.not.eql(row(2));

            // a position beyond the last decoded batch errors out
            expect(() => ctx.getEmbeddings(Uint32Array.from([tokens.length]))).toThrow();
            // empty positions error out
            expect(() => ctx.getEmbeddings(new Uint32Array(0))).toThrow();
            void resLogitIndexes;

            await context.dispose();
            await model.dispose();
        });
    });
});
