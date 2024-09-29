import {describe, expect, test} from "vitest";
import {createSplitPartFilename} from "../../../src/gguf/utils/resolveSplitGgufParts.js";


describe("utils", () => {
    describe("createSplitPartFilename", () => {
        test("simple initial part filename", async () => {
            const partFilename = createSplitPartFilename("Meta-Llama-3.1-70B-Instruct-Q5_K_L.gguf", 3, 10);

            expect(partFilename).to.eql("Meta-Llama-3.1-70B-Instruct-Q5_K_L-00003-of-00010.gguf");
        });

        test("initial part filename with existing parts information", async () => {
            const partFilename = createSplitPartFilename("Meta-Llama-3.1-70B-Instruct-Q5_K_L-00001-of-00002.gguf", 3, 10);

            expect(partFilename).to.eql("Meta-Llama-3.1-70B-Instruct-Q5_K_L-00003-of-00010.gguf");
        });

        test("initial part filename with existing parts information 2", async () => {
            const partFilename = createSplitPartFilename("Meta-Llama-3.1-70B-Instruct-Q5_K_L-00002-of-00002.gguf", 3, 10);

            expect(partFilename).to.eql("Meta-Llama-3.1-70B-Instruct-Q5_K_L-00003-of-00010.gguf");
        });
    });
});
