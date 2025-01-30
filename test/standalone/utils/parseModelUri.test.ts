import {fileURLToPath} from "url";
import {describe, expect, test} from "vitest";
import {parseModelUri, resolveParsedModelUri} from "../../../src/utils/parseModelUri.js";

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
                "type": "resolved",
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
                "type": "resolved",
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
                "type": "resolved",
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
                "type": "resolved",
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
                "type": "resolved",
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
                "type": "resolved",
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
                "type": "resolved",
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
                "type": "resolved",
                "uri": "hf:mradermacher/Meta-Llama-3.1-70B-Instruct-GGUF/Meta-Llama-3.1-70B-Instruct.Q8_0.gguf.part1of2",
              }
            `);
        });

        test("Hugging Face simple URI is resolved", async () => {
            const parsedModelUri = parseModelUri("hf:mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M");

            expect(parsedModelUri).toMatchInlineSnapshot(`
              {
                "baseFilename": "Meta-Llama-3.1-8B-Instruct",
                "filePrefix": "hf_mradermacher_",
                "possibleFullFilenames": [
                  "hf_mradermacher_Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf",
                  "hf_mradermacher_Meta-Llama-3.1-8B-Instruct.Q4_K_M-00001-of-{:
              {number}
              :}.gguf",
                ],
                "resolveDetails": {
                  "model": "Meta-Llama-3.1-8B-Instruct-GGUF",
                  "tag": "Q4_K_M",
                  "type": "hf",
                  "user": "mradermacher",
                },
                "type": "unresolved",
                "uri": "hf:mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M",
              }
            `);

            const resolvedUri = await resolveParsedModelUri(parsedModelUri);
            expect(resolvedUri).toMatchInlineSnapshot(`
              {
                "filePrefix": "hf_mradermacher_",
                "filename": "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf",
                "fullFilename": "hf_mradermacher_Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf",
                "resolvedUrl": "https://huggingface.co/mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf?download=true",
                "type": "resolved",
                "uri": "hf:mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M",
              }
            `);
        });

        test("Hugging Face simple URI is resolved - lowercase quant", async () => {
            const parsedModelUri = parseModelUri("hf:mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF:q4_k_m");

            expect(parsedModelUri).toMatchInlineSnapshot(`
              {
                "baseFilename": "Meta-Llama-3.1-8B-Instruct",
                "filePrefix": "hf_mradermacher_",
                "possibleFullFilenames": [
                  "hf_mradermacher_Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf",
                  "hf_mradermacher_Meta-Llama-3.1-8B-Instruct.Q4_K_M-00001-of-{:
              {number}
              :}.gguf",
                ],
                "resolveDetails": {
                  "model": "Meta-Llama-3.1-8B-Instruct-GGUF",
                  "tag": "Q4_K_M",
                  "type": "hf",
                  "user": "mradermacher",
                },
                "type": "unresolved",
                "uri": "hf:mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M",
              }
            `);

            const resolvedUri = await resolveParsedModelUri(parsedModelUri);
            expect(resolvedUri).toMatchInlineSnapshot(`
              {
                "filePrefix": "hf_mradermacher_",
                "filename": "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf",
                "fullFilename": "hf_mradermacher_Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf",
                "resolvedUrl": "https://huggingface.co/mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf?download=true",
                "type": "resolved",
                "uri": "hf:mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M",
              }
            `);
        });

        test("Hugging Face simple URI is resolved 2", async () => {
            const parsedModelUri = parseModelUri("hf:bartowski/Meta-Llama-3.1-70B-Instruct-GGUF:Q5_K_L");

            expect(parsedModelUri).toMatchInlineSnapshot(`
              {
                "baseFilename": "Meta-Llama-3.1-70B-Instruct",
                "filePrefix": "hf_bartowski_",
                "possibleFullFilenames": [
                  "hf_bartowski_Meta-Llama-3.1-70B-Instruct.Q5_K_L.gguf",
                  "hf_bartowski_Meta-Llama-3.1-70B-Instruct.Q5_K_L-00001-of-{:
              {number}
              :}.gguf",
                ],
                "resolveDetails": {
                  "model": "Meta-Llama-3.1-70B-Instruct-GGUF",
                  "tag": "Q5_K_L",
                  "type": "hf",
                  "user": "bartowski",
                },
                "type": "unresolved",
                "uri": "hf:bartowski/Meta-Llama-3.1-70B-Instruct-GGUF:Q5_K_L",
              }
            `);

            const resolvedUri = await resolveParsedModelUri(parsedModelUri);
            expect(resolvedUri).toMatchInlineSnapshot(`
              {
                "filePrefix": "hf_bartowski_",
                "filename": "Meta-Llama-3.1-70B-Instruct.Q5_K_L-00001-of-00002.gguf",
                "fullFilename": "hf_bartowski_Meta-Llama-3.1-70B-Instruct.Q5_K_L-00001-of-00002.gguf",
                "resolvedUrl": "https://huggingface.co/bartowski/Meta-Llama-3.1-70B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-70B-Instruct-Q5_K_L/Meta-Llama-3.1-70B-Instruct-Q5_K_L-00001-of-00002.gguf?download=true",
                "type": "resolved",
                "uri": "hf:bartowski/Meta-Llama-3.1-70B-Instruct-GGUF:Q5_K_L",
              }
            `);
        });

        test("Hugging Face simple URI is resolved 3", async () => {
            const parsedModelUri = parseModelUri("hf:mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF");

            expect(parsedModelUri).toMatchInlineSnapshot(`
              {
                "baseFilename": "Meta-Llama-3.1-8B-Instruct",
                "filePrefix": "hf_mradermacher_",
                "possibleFullFilenames": [
                  "hf_mradermacher_Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf",
                  "hf_mradermacher_Meta-Llama-3.1-8B-Instruct.Q4_K_M-00001-of-{:
              {number}
              :}.gguf",
                  "hf_mradermacher_Meta-Llama-3.1-8B-Instruct.gguf",
                  "hf_mradermacher_Meta-Llama-3.1-8B-Instruct-00001-of-{:
              {number}
              :}.gguf",
                ],
                "resolveDetails": {
                  "model": "Meta-Llama-3.1-8B-Instruct-GGUF",
                  "tag": "",
                  "type": "hf",
                  "user": "mradermacher",
                },
                "type": "unresolved",
                "uri": "hf:mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF",
              }
            `);

            const resolvedUri = await resolveParsedModelUri(parsedModelUri);
            expect(resolvedUri).toMatchInlineSnapshot(`
              {
                "filePrefix": "hf_mradermacher_",
                "filename": "Meta-Llama-3.1-8B-Instruct.IQ3_M.gguf",
                "fullFilename": "hf_mradermacher_Meta-Llama-3.1-8B-Instruct.IQ3_M.gguf",
                "resolvedUrl": "https://huggingface.co/mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct.IQ3_M.gguf?download=true",
                "type": "resolved",
                "uri": "hf:mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF",
              }
            `);
        });

        test("Hugging Face simple URI is resolved 4", async () => {
            const parsedModelUri = parseModelUri("hf:mradermacher/Meta-Llama-3.1-70B-Instruct-GGUF:Q8_0");

            expect(parsedModelUri).toMatchInlineSnapshot(`
              {
                "baseFilename": "Meta-Llama-3.1-70B-Instruct",
                "filePrefix": "hf_mradermacher_",
                "possibleFullFilenames": [
                  "hf_mradermacher_Meta-Llama-3.1-70B-Instruct.Q8_0.gguf",
                  "hf_mradermacher_Meta-Llama-3.1-70B-Instruct.Q8_0-00001-of-{:
              {number}
              :}.gguf",
                ],
                "resolveDetails": {
                  "model": "Meta-Llama-3.1-70B-Instruct-GGUF",
                  "tag": "Q8_0",
                  "type": "hf",
                  "user": "mradermacher",
                },
                "type": "unresolved",
                "uri": "hf:mradermacher/Meta-Llama-3.1-70B-Instruct-GGUF:Q8_0",
              }
            `);

            try {
                await resolveParsedModelUri(parsedModelUri);
                expect.unreachable("This quantization cannot be resolved due to being binary split");
            } catch (err) {
                expect(err).toMatchInlineSnapshot('[Error: Cannot get quantization "Q8_0" for model "hf:mradermacher/Meta-Llama-3.1-70B-Instruct-GGUF" or it does not exist]');
            }
        });

        test("Hugging Face simple URI is resolved 5", async () => {
            const parsedModelUri = parseModelUri("https://huggingface.co/mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF");

            expect(parsedModelUri).toMatchInlineSnapshot(`
              {
                "baseFilename": "Meta-Llama-3.1-8B-Instruct",
                "filePrefix": "hf_mradermacher_",
                "possibleFullFilenames": [
                  "hf_mradermacher_Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf",
                  "hf_mradermacher_Meta-Llama-3.1-8B-Instruct.Q4_K_M-00001-of-{:
              {number}
              :}.gguf",
                  "hf_mradermacher_Meta-Llama-3.1-8B-Instruct.gguf",
                  "hf_mradermacher_Meta-Llama-3.1-8B-Instruct-00001-of-{:
              {number}
              :}.gguf",
                ],
                "resolveDetails": {
                  "model": "Meta-Llama-3.1-8B-Instruct-GGUF",
                  "tag": "",
                  "type": "hf",
                  "user": "mradermacher",
                },
                "type": "unresolved",
                "uri": "hf:mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF",
              }
            `);

            const resolvedUri = await resolveParsedModelUri(parsedModelUri);
            expect(resolvedUri).toMatchInlineSnapshot(`
              {
                "filePrefix": "hf_mradermacher_",
                "filename": "Meta-Llama-3.1-8B-Instruct.IQ3_M.gguf",
                "fullFilename": "hf_mradermacher_Meta-Llama-3.1-8B-Instruct.IQ3_M.gguf",
                "resolvedUrl": "https://huggingface.co/mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct.IQ3_M.gguf?download=true",
                "type": "resolved",
                "uri": "hf:mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF",
              }
            `);
        });

        test("Hugging Face simple URI is resolved 6", async () => {
            const parsedModelUri = parseModelUri("hf:mradermacher/Meta-Llama-3.1-70B-Instruct-GGUF:invalid");

            expect(parsedModelUri).toMatchInlineSnapshot(`
              {
                "baseFilename": "Meta-Llama-3.1-70B-Instruct",
                "filePrefix": "hf_mradermacher_",
                "possibleFullFilenames": [
                  "hf_mradermacher_Meta-Llama-3.1-70B-Instruct.INVALID.gguf",
                  "hf_mradermacher_Meta-Llama-3.1-70B-Instruct.INVALID-00001-of-{:
              {number}
              :}.gguf",
                ],
                "resolveDetails": {
                  "model": "Meta-Llama-3.1-70B-Instruct-GGUF",
                  "tag": "invalid",
                  "type": "hf",
                  "user": "mradermacher",
                },
                "type": "unresolved",
                "uri": "hf:mradermacher/Meta-Llama-3.1-70B-Instruct-GGUF:invalid",
              }
            `);

            try {
                await resolveParsedModelUri(parsedModelUri);
                expect.unreachable("This quantization cannot be resolved due to not existing");
            } catch (err) {
                expect(err).toMatchInlineSnapshot('[Error: Cannot get quantization "invalid" for model "hf:mradermacher/Meta-Llama-3.1-70B-Instruct-GGUF" or it does not exist]');
            }
        });
    });
});
