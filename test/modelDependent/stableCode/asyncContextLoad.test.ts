import {describe, expect, test} from "vitest";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("stableCode", () => {
    describe("async context load", () => {
        test("load asynchronously", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("stable-code-3b-Q5_K_M.gguf");
            const llama = await getTestLlama();
            const model = await llama.loadModel({
                modelPath
            });

            let loopIterationsBeforeLoad = 0;
            let loadDone = false;
            let loadFailed = false;
            const contextPromise = model.createContext({
                contextSize: 4096
            });
            contextPromise
                .then(() => {
                    loadDone = true;
                })
                .catch(() => {
                    loadFailed = true;
                });

            while (!loadDone && !loadFailed) {
                loopIterationsBeforeLoad++;
                await new Promise((resolve) => setTimeout(resolve, 0));
            }

            expect(loopIterationsBeforeLoad).toBeGreaterThanOrEqual(2);

            const context = await contextPromise;
            let loopIterationsBeforeUnload = 0;
            let disposeDone = false;
            let disposeFailed = false;
            const disposePromise = context.dispose();
            disposePromise
                .then(() => {
                    disposeDone = true;
                })
                .catch(() => {
                    disposeFailed = true;
                });

            while (!disposeDone && !disposeFailed) {
                loopIterationsBeforeUnload++;
                await new Promise((resolve) => setTimeout(resolve, 0));
            }

            expect(loopIterationsBeforeUnload).toBeGreaterThanOrEqual(2);
            await expect(disposePromise).resolves.toBeUndefined();
        });
    });
});
