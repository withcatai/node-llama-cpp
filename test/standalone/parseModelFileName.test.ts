import {describe, expect, test} from "vitest";
import {parseModelFileName} from "../../src/utils/parseModelFileName.js";

describe("parseModelFileName", () => {
    test("orca-2-13b.Q4_K_M.gguf", () => {
        expect(parseModelFileName("orca-2-13b.Q4_K_M.gguf"))
            .toEqual({
                name: "orca",
                subType: "2",
                quantization: "Q4_K_M",
                fileType: "gguf",
                version: undefined,
                parameters: "13B"
            });
    });

    test("orca-2-13b-v2.Q4_K_M.gguf", () => {
        expect(parseModelFileName("orca-2-13b-v2.Q4_K_M.gguf"))
            .toEqual({
                name: "orca",
                subType: "2",
                quantization: "Q4_K_M",
                fileType: "gguf",
                version: "v2",
                parameters: "13B"
            });
    });

    test("phind-codellama-34b-v2.Q4_K_M.gguf", () => {
        expect(parseModelFileName("phind-codellama-34b-v2.Q4_K_M.gguf"))
            .toEqual({
                name: "phind",
                subType: "codellama",
                quantization: "Q4_K_M",
                fileType: "gguf",
                version: "v2",
                parameters: "34B"
            });
    });

    test("yarn-llama-2-13b-64k.Q5_K_S.gguf", () => {
        expect(parseModelFileName("yarn-llama-2-13b-64k.Q5_K_S.gguf"))
            .toEqual({
                contextSize: "64K",
                name: "yarn",
                subType: "llama-2",
                quantization: "Q5_K_S",
                fileType: "gguf",
                parameters: "13B"
            });
    });
});
