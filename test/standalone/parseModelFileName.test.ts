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

    test("functionary-small-v2.2.q4_0.gguf", () => {
        expect(parseModelFileName("functionary-small-v2.2.q4_0.gguf"))
            .toEqual({
                name: "functionary",
                subType: "small-v2.2",
                quantization: "q4_0",
                fileType: "gguf"
            });
    });

    test("claude2-alpaca-13b.Q5_K_M.gguf", () => {
        expect(parseModelFileName("claude2-alpaca-13b.Q5_K_M.gguf"))
            .toEqual({
                name: "claude2",
                subType: "alpaca",
                quantization: "Q5_K_M",
                fileType: "gguf",
                parameters: "13B"
            });
    });

    test("dolphin-2.1-mistral-7b.Q4_K_M.gguf", () => {
        expect(parseModelFileName("dolphin-2.1-mistral-7b.Q4_K_M.gguf"))
            .toEqual({
                name: "dolphin",
                subType: "2.1-mistral",
                quantization: "Q4_K_M",
                fileType: "gguf",
                parameters: "7B"
            });
    });

    test("gemma-7b-it-Q5_K_M.gguf", () => {
        expect(parseModelFileName("gemma-7b-it-Q5_K_M.gguf"))
            .toEqual({
                name: "gemma",
                subType: "",
                quantization: "Q5_K_M",
                fileType: "gguf",
                parameters: "7B"
            });
    });
});
