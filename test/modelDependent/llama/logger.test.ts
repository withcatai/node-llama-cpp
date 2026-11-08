import {describe, expect, test} from "vitest";
import {getModelFile} from "../../utils/modelFiles.js";
import {getLlama, LlamaLogLevel} from "../../../src/index.js";

describe("llama", () => {
    describe("logger", () => {
        test("a custom logger keeps receiving llama.cpp log lines after a second getLlama() call", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("bge-small-en-v1.5-q8_0.gguf");
            const lines1: string[] = [];
            const lines2: string[] = [];

            const llama1 = await getLlama({
                logLevel: LlamaLogLevel.debug,
                logger(level, message) {
                    lines1.push(message);
                }
            });
            await llama1.loadModel({modelPath});

            const llama2 = await getLlama({
                logLevel: LlamaLogLevel.debug,
                logger(level, message) {
                    lines2.push(message);
                }
            });
            await new Promise((resolve) => setTimeout(resolve, 100));
            await llama2.loadModel({modelPath});

            // llama.cpp emits native log lines through the logger of the most recently created instance.
            // Only TS-side logs would reach `lines2` if the native log sink was broken.
            expect(lines1.some((line) => line.includes("llama_model_loader"))).toBe(true);
            expect(lines2.some((line) => line.includes("llama_model_loader"))).toBe(true);

            await llama2.dispose();
            await llama1.dispose();
        });
    });
});
