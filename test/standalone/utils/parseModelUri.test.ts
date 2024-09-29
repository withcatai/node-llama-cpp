import {fileURLToPath} from "url";
import {describe, expect, test} from "vitest";
import {parseModelUri} from "../../../src/utils/parseModelUri.js";

const __filename = fileURLToPath(import.meta.url);

describe("utils", () => {
    describe("parseModelUri", () => {
        test("File path is not resolved", async () => {
            const parsedModelUri = parseModelUri(__filename);

            expect(parsedModelUri).to.eql(null);
        });

        test("URL is not resolved by default", async () => {
            const parsedModelUri = parseModelUri(
                "https://huggingface.co/mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf"
            );

            expect(parsedModelUri).to.eql(null);
        });

        test("Hugging Face URL is resolved", async () => {
            const parsedModelUri = parseModelUri(
                "https://huggingface.co/mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf",
                true
            );

            expect(parsedModelUri).toMatchInlineSnapshot(`
              {
                "filePrefix": "hf_mradermacher_",
                "filename": "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf",
                "fullFilename": "hf_mradermacher_Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf",
                "resolvedUrl": "https://huggingface.co/mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf?download=true",
                "uri": "hf:mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF/Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf",
              }
            `);
        });

        test("Hugging Face URL is resolved 2", async () => {
            const parsedModelUri = parseModelUri(
                "https://huggingface.co/mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf?download=true",
                true
            );

            expect(parsedModelUri).toMatchInlineSnapshot(`
              {
                "filePrefix": "hf_mradermacher_",
                "filename": "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf",
                "fullFilename": "hf_mradermacher_Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf",
                "resolvedUrl": "https://huggingface.co/mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf?download=true",
                "uri": "hf:mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF/Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf",
              }
            `);
        });

        test("Hugging Face URL is resolved 3", async () => {
            const parsedModelUri = parseModelUri(
                "https://huggingface.co/bartowski/Meta-Llama-3.1-70B-Instruct-GGUF/blob/main/Meta-Llama-3.1-70B-Instruct-Q5_K_L/Meta-Llama-3.1-70B-Instruct-Q5_K_L-00001-of-00002.gguf",
                true
            );

            expect(parsedModelUri).toMatchInlineSnapshot(`
              {
                "filePrefix": "hf_bartowski_",
                "filename": "Meta-Llama-3.1-70B-Instruct-Q5_K_L-00001-of-00002.gguf",
                "fullFilename": "hf_bartowski_Meta-Llama-3.1-70B-Instruct-Q5_K_L-00001-of-00002.gguf",
                "resolvedUrl": "https://huggingface.co/bartowski/Meta-Llama-3.1-70B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-70B-Instruct-Q5_K_L/Meta-Llama-3.1-70B-Instruct-Q5_K_L-00001-of-00002.gguf?download=true",
                "uri": "hf:bartowski/Meta-Llama-3.1-70B-Instruct-GGUF/Meta-Llama-3.1-70B-Instruct-Q5_K_L/Meta-Llama-3.1-70B-Instruct-Q5_K_L-00001-of-00002.gguf",
              }
            `);
        });

        test("Hugging Face URL is resolved 4", async () => {
            const parsedModelUri = parseModelUri(
                "https://huggingface.co/bartowski/Meta-Llama-3.1-70B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-70B-Instruct-Q5_K_L/Meta-Llama-3.1-70B-Instruct-Q5_K_L-00001-of-00002.gguf?download=true",
                true
            );

            expect(parsedModelUri).toMatchInlineSnapshot(`
              {
                "filePrefix": "hf_bartowski_",
                "filename": "Meta-Llama-3.1-70B-Instruct-Q5_K_L-00001-of-00002.gguf",
                "fullFilename": "hf_bartowski_Meta-Llama-3.1-70B-Instruct-Q5_K_L-00001-of-00002.gguf",
                "resolvedUrl": "https://huggingface.co/bartowski/Meta-Llama-3.1-70B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-70B-Instruct-Q5_K_L/Meta-Llama-3.1-70B-Instruct-Q5_K_L-00001-of-00002.gguf?download=true",
                "uri": "hf:bartowski/Meta-Llama-3.1-70B-Instruct-GGUF/Meta-Llama-3.1-70B-Instruct-Q5_K_L/Meta-Llama-3.1-70B-Instruct-Q5_K_L-00001-of-00002.gguf",
              }
            `);
        });

        test("Hugging Face URL is resolved 5", async () => {
            const parsedModelUri = parseModelUri(
                "https://huggingface.co/mradermacher/Meta-Llama-3.1-70B-Instruct-GGUF/blob/main/Meta-Llama-3.1-70B-Instruct.Q8_0.gguf.part1of2",
                true
            );

            expect(parsedModelUri).toMatchInlineSnapshot(`
              {
                "filePrefix": "hf_mradermacher_",
                "filename": "Meta-Llama-3.1-70B-Instruct.Q8_0.gguf",
                "fullFilename": "hf_mradermacher_Meta-Llama-3.1-70B-Instruct.Q8_0.gguf",
                "resolvedUrl": "https://huggingface.co/mradermacher/Meta-Llama-3.1-70B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-70B-Instruct.Q8_0.gguf.part1of2?download=true",
                "uri": "hf:mradermacher/Meta-Llama-3.1-70B-Instruct-GGUF/Meta-Llama-3.1-70B-Instruct.Q8_0.gguf.part1of2",
              }
            `);
        });

        test("Hugging Face URI is resolved", async () => {
            const parsedModelUri = parseModelUri("hf:mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF/Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf");

            expect(parsedModelUri).toMatchInlineSnapshot(`
              {
                "filePrefix": "hf_mradermacher_",
                "filename": "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf",
                "fullFilename": "hf_mradermacher_Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf",
                "resolvedUrl": "https://huggingface.co/mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf?download=true",
                "uri": "hf:mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF/Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf",
              }
            `);
        });

        test("Hugging Face URI is resolved 2", async () => {
            const parsedModelUri = parseModelUri("hf:bartowski/Meta-Llama-3.1-70B-Instruct-GGUF/Meta-Llama-3.1-70B-Instruct-Q5_K_L/Meta-Llama-3.1-70B-Instruct-Q5_K_L-00001-of-00002.gguf");

            expect(parsedModelUri).toMatchInlineSnapshot(`
              {
                "filePrefix": "hf_bartowski_",
                "filename": "Meta-Llama-3.1-70B-Instruct-Q5_K_L-00001-of-00002.gguf",
                "fullFilename": "hf_bartowski_Meta-Llama-3.1-70B-Instruct-Q5_K_L-00001-of-00002.gguf",
                "resolvedUrl": "https://huggingface.co/bartowski/Meta-Llama-3.1-70B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-70B-Instruct-Q5_K_L/Meta-Llama-3.1-70B-Instruct-Q5_K_L-00001-of-00002.gguf?download=true",
                "uri": "hf:bartowski/Meta-Llama-3.1-70B-Instruct-GGUF/Meta-Llama-3.1-70B-Instruct-Q5_K_L/Meta-Llama-3.1-70B-Instruct-Q5_K_L-00001-of-00002.gguf",
              }
            `);
        });

        test("Hugging Face URI is resolved 3", async () => {
            const parsedModelUri = parseModelUri("hf:mradermacher/Meta-Llama-3.1-70B-Instruct-GGUF/Meta-Llama-3.1-70B-Instruct.Q8_0.gguf.part1of2");

            expect(parsedModelUri).toMatchInlineSnapshot(`
              {
                "filePrefix": "hf_mradermacher_",
                "filename": "Meta-Llama-3.1-70B-Instruct.Q8_0.gguf",
                "fullFilename": "hf_mradermacher_Meta-Llama-3.1-70B-Instruct.Q8_0.gguf",
                "resolvedUrl": "https://huggingface.co/mradermacher/Meta-Llama-3.1-70B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-70B-Instruct.Q8_0.gguf.part1of2?download=true",
                "uri": "hf:mradermacher/Meta-Llama-3.1-70B-Instruct-GGUF/Meta-Llama-3.1-70B-Instruct.Q8_0.gguf.part1of2",
              }
            `);
        });
    });
});
