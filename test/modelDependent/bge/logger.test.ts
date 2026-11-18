import {describe, expect, test} from "vitest";
import {getModelFile} from "../../utils/modelFiles.js";
import {getLlama, LlamaLogLevel} from "../../../src/index.js";

describe("bge", () => {
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
            await using model1 = await llama1.loadModel({modelPath});
            const lines1CountAfterFirstModel = lines1.length;

            const llama2 = await getLlama({
                logLevel: LlamaLogLevel.debug,
                logger(level, message) {
                    lines2.push(message);
                }
            });
            await using model2 = await llama2.loadModel({modelPath});

            expect(lines1.length).toBe(lines1CountAfterFirstModel);
            expect(lines2.length).toBeGreaterThan(0);

            await llama2.dispose();
            await llama1.dispose();
        });
    });
});
