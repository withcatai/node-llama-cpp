import {describe, expect, test} from "vitest";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("stableCode", () => {
    describe("async model load", () => {
        test("load asynchronously", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("stable-code-3b-Q5_K_M.gguf");
            const llama = await getTestLlama();

            let loopIterationsBeforeLoad = 0;
            let loadDone = false;
            let loadFailed = false;
            const modelPromise = llama.loadModel({
                modelPath
            });
            modelPromise
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

            const model = await modelPromise;
            let loopIterationsBeforeUnload = 0;
            let disposeDone = false;
            let disposeFailed = false;
            const disposePromise = model.dispose();
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

        test("load progress emitted", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("stable-code-3b-Q5_K_M.gguf");
            const llama = await getTestLlama();

            let loopIterationsBeforeLoad = 0;
            let loadDone = false;
            let loadFailed = false;
            const logProgresses: number[] = [];
            const modelPromise = llama.loadModel({
                modelPath,
                onLoadProgress(loadPercentage: number) {
                    if (logProgresses.length === 0 || loadPercentage - logProgresses.at(-1)! >= 0.1 || loadPercentage === 1)
                        logProgresses.push(loadPercentage);
                }
            });
            modelPromise
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

            await expect(modelPromise).resolves.not.toBeNull();
            expect(loopIterationsBeforeLoad).toBeGreaterThanOrEqual(2);
            expect(logProgresses.length).toBeGreaterThan(8);
            expect(logProgresses[logProgresses.length - 1]).toBe(1);

            const model = await modelPromise;
            await model.dispose();
        });

        test("abort model load works", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("stable-code-3b-Q5_K_M.gguf");
            const llama = await getTestLlama();

            class CustomError extends Error {}

            let loopIterationsBeforeLoad = 0;
            let loadDone = false;
            let loadFailed = false;
            const logProgresses: number[] = [];
            const logProgressesAfterAbort: number[] = [];
            const loadController = new AbortController();
            let abortTime: number | null = null;
            let fulfillTime: number | null = null;
            const modelPromise = llama.loadModel({
                modelPath,
                loadSignal: loadController.signal,
                onLoadProgress(loadPercentage: number) {
                    if (logProgresses.length === 0 || loadPercentage - logProgresses.at(-1)! >= 0.1 || loadPercentage === 1)
                        logProgresses.push(loadPercentage);

                    if (loadPercentage >= 0.2 && !loadController.signal.aborted) {
                        loadController.abort(new CustomError());
                        abortTime = Date.now();
                    } else if (loadController.signal.aborted)
                        logProgressesAfterAbort.push(loadPercentage);
                }
            });
            modelPromise
                .then(() => {
                    loadDone = true;
                })
                .catch(() => {
                    loadFailed = true;
                })
                .finally(() => {
                    fulfillTime = Date.now();
                });

            while (!loadDone && !loadFailed) {
                loopIterationsBeforeLoad++;
                await new Promise((resolve) => setTimeout(resolve, 0));
            }

            const timeBetweenAbortAndFulfill = (fulfillTime == null || abortTime == null)
                ? 0
                : fulfillTime - abortTime;
            const maxTimeToAllowToNotAbortBeforeFinishLoading = 1000;

            await expect(modelPromise).rejects.toThrow(CustomError);
            expect(loopIterationsBeforeLoad).toBeGreaterThanOrEqual(2);
            expect(logProgresses.length).toBeGreaterThan(0);

            // only test in cases that the machine is not too fast to finish loading before the stop event is propagated
            if (timeBetweenAbortAndFulfill > maxTimeToAllowToNotAbortBeforeFinishLoading) {
                expect(logProgresses.length).toBeLessThan(8);
                expect(logProgresses[logProgresses.length - 1]).to.not.be.eql(1);
                expect(Math.max(...logProgressesAfterAbort)).toBeLessThan(0.8);
            }
        });
    });
});
