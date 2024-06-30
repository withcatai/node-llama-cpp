import {describe, expect, test} from "vitest";
import {getFilenameForBinarySplitGgufPartUrls} from "../../../src/gguf/utils/resolveBinarySplitGgufPartUrls.js";


describe("utils", () => {
    describe("modelDownloader", () => {
        test("getFilenameForBinarySplitGgufPartUrls", async () => {
            const res = getFilenameForBinarySplitGgufPartUrls([
                "https://example.com/model.Q6_K.gguf.part1of2",
                "https://example.com/model.Q6_K.gguf.part2of2"
            ]);
            expect(res).to.eql("model.Q6_K.gguf");
        });

        test("getFilenameForBinarySplitGgufPartUrls with search params", async () => {
            const res = getFilenameForBinarySplitGgufPartUrls([
                "https://example.com/model.Q6_K.gguf.part1of2?hi=true",
                "https://example.com/model.Q6_K.gguf.part2of2?hello=hi"
            ]);
            expect(res).to.eql("model.Q6_K.gguf");
        });
    });
});
