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
                parameters: "13B",
                otherInfo: []
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
                parameters: "13B",
                otherInfo: []
            });
    });

    test("codellama-7b.Q5_K_M.gguf", () => {
        expect(parseModelFileName("codellama-7b.Q5_K_M.gguf"))
            .toEqual({
                name: "codellama",
                subType: "",
                quantization: "Q5_K_M",
                fileType: "gguf",
                parameters: "7B",
                otherInfo: []
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
                parameters: "34B",
                otherInfo: []
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
                parameters: "13B",
                otherInfo: []
            });
    });

    test("functionary-small-v2.2.q4_0.gguf", () => {
        expect(parseModelFileName("functionary-small-v2.2.q4_0.gguf"))
            .toEqual({
                name: "functionary",
                subType: "small-v2.2",
                quantization: "Q4_0",
                fileType: "gguf",
                otherInfo: []
            });
    });

    test("functionary-small-v2.5.Q4_0.gguf", () => {
        expect(parseModelFileName("functionary-small-v2.5.Q4_0.gguf"))
            .toEqual({
                name: "functionary",
                subType: "small-v2.5",
                quantization: "Q4_0",
                fileType: "gguf",
                otherInfo: []
            });
    });

    test("claude2-alpaca-13b.Q5_K_M.gguf", () => {
        expect(parseModelFileName("claude2-alpaca-13b.Q5_K_M.gguf"))
            .toEqual({
                name: "claude2",
                subType: "alpaca",
                quantization: "Q5_K_M",
                fileType: "gguf",
                parameters: "13B",
                otherInfo: []
            });
    });

    test("dolphin-2.1-mistral-7b.Q4_K_M.gguf", () => {
        expect(parseModelFileName("dolphin-2.1-mistral-7b.Q4_K_M.gguf"))
            .toEqual({
                name: "dolphin",
                subType: "2.1-mistral",
                quantization: "Q4_K_M",
                fileType: "gguf",
                parameters: "7B",
                otherInfo: []
            });
    });

    test("gemma-7b-it-Q5_K_M.gguf", () => {
        expect(parseModelFileName("gemma-7b-it-Q5_K_M.gguf"))
            .toEqual({
                name: "gemma",
                subType: "",
                quantization: "Q5_K_M",
                fileType: "gguf",
                parameters: "7B",
                otherInfo: ["it"]
            });
    });

    test("llama-2-7b-chat.Q4_0.gguf", () => {
        expect(parseModelFileName("llama-2-7b-chat.Q4_0.gguf"))
            .toEqual({
                name: "llama",
                subType: "2",
                quantization: "Q4_0",
                fileType: "gguf",
                parameters: "7B",
                otherInfo: ["chat"]
            });
    });

    test("rpguild-chatml-13b.Q4_K_M.gguf", () => {
        expect(parseModelFileName("rpguild-chatml-13b.Q4_K_M.gguf"))
            .toEqual({
                name: "rpguild",
                subType: "chatml",
                quantization: "Q4_K_M",
                fileType: "gguf",
                parameters: "13B",
                otherInfo: []
            });
    });

    test("neuralbeagle14-7b.Q4_K_M.gguf", () => {
        expect(parseModelFileName("neuralbeagle14-7b.Q4_K_M.gguf"))
            .toEqual({
                name: "neuralbeagle14",
                subType: "",
                quantization: "Q4_K_M",
                fileType: "gguf",
                parameters: "7B",
                otherInfo: []
            });
    });

    test("QVQ-72B-Preview-Q6_K-00001-of-00002.gguf", () => {
        expect(parseModelFileName("QVQ-72B-Preview-Q6_K-00001-of-00002.gguf"))
            .toEqual({
                name: "QVQ",
                subType: "",
                quantization: "Q6_K",
                fileType: "gguf",
                parameters: "72B",
                parts: {
                    part: "00001",
                    parts: "00002"
                },
                otherInfo: ["Preview"]
            });
    });

    test("Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf", () => {
        expect(parseModelFileName("Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf"))
            .toEqual({
                name: "Meta",
                subType: "Llama-3.1",
                quantization: "Q4_K_M",
                fileType: "gguf",
                parameters: "8B",
                otherInfo: ["Instruct"]
            });
    });

    test("Rombo-LLM-V2.5-Qwen-14b.i1-Q3_K_M.gguf", () => {
        expect(parseModelFileName("Rombo-LLM-V2.5-Qwen-14b.i1-Q3_K_M.gguf"))
            .toEqual({
                name: "Rombo",
                subType: "LLM-V2.5-Qwen",
                quantization: "Q3_K_M",
                fileType: "gguf",
                parameters: "14B",
                otherInfo: ["i1"]
            });
    });

    test("DeepSeek-R1-Distill-Qwen-14B-f32-00001-of-00002.gguf", () => {
        expect(parseModelFileName("DeepSeek-R1-Distill-Qwen-14B-f32-00001-of-00002.gguf"))
            .toEqual({
                name: "DeepSeek",
                subType: "R1-Distill-Qwen",
                quantization: "F32",
                fileType: "gguf",
                parameters: "14B",
                parts: {
                    part: "00001",
                    parts: "00002"
                },
                otherInfo: []
            });
    });

    test("DeepSeek-R1-Distill-Qwen-14B.f32-00001-of-00002.gguf", () => {
        expect(parseModelFileName("DeepSeek-R1-Distill-Qwen-14B.f32-00001-of-00002.gguf"))
            .toEqual({
                name: "DeepSeek",
                subType: "R1-Distill-Qwen",
                quantization: "F32",
                fileType: "gguf",
                parameters: "14B",
                parts: {
                    part: "00001",
                    parts: "00002"
                },
                otherInfo: ["f32"]
            });
    });

    test("hf_mradermacher_Llama-3.2-3B-Instruct.Q4_K_S.gguf", () => {
        expect(parseModelFileName("hf_mradermacher_Llama-3.2-3B-Instruct.Q4_K_S.gguf"))
            .toEqual({
                name: "hf_mradermacher_Llama",
                subType: "3.2",
                quantization: "Q4_K_S",
                fileType: "gguf",
                parameters: "3B",
                otherInfo: ["Instruct"]
            });
    });

    test("hf_mradermacher_Llama-3.2-3B-Instruct.Q4_K_S-00001-of-00002.gguf", () => {
        expect(parseModelFileName("hf_mradermacher_Llama-3.2-3B-Instruct.Q4_K_S-00001-of-00002.gguf"))
            .toEqual({
                name: "hf_mradermacher_Llama",
                subType: "3.2",
                quantization: "Q4_K_S",
                fileType: "gguf",
                parameters: "3B",
                parts: {
                    part: "00001",
                    parts: "00002"
                },
                otherInfo: ["Instruct.Q4_K_S"]
            });
    });
});
