import {describe, expect, test} from "vitest";
import {getFilenameForBinarySplitGgufPartUrls, resolveBinarySplitGgufPartUrls} from "../../../src/gguf/utils/resolveBinarySplitGgufPartUrls.js";


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

        test("keeps an earlier .gguf directory when expanding part urls", async () => {
            const res = resolveBinarySplitGgufPartUrls("https://example.com/models/old.gguf/new.gguf.part1of2?hi=true");

            expect(res).to.eql([
                "https://example.com/models/old.gguf/new.gguf.part1of2?hi=true",
                "https://example.com/models/old.gguf/new.gguf.part2of2?hi=true"
            ]);
        });

        test("filename ignores an earlier .gguf directory", async () => {
            const res = getFilenameForBinarySplitGgufPartUrls([
                "https://example.com/models/old.gguf/new.gguf.part1of2"
            ]);

            expect(res).to.eql("new.gguf");
        });
    });
});
