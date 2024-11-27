import {fork} from "node:child_process";
import {fileURLToPath} from "url";
import {createRequire} from "module";
import path from "path";
import {getConsoleLogPrefix} from "../../utils/getConsoleLogPrefix.js";
import {runningInElectron} from "../../utils/runtime.js";
import {BuildGpu} from "../types.js";
import type {BindingModule} from "../AddonTypes.js";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const detectedFileName = path.basename(__filename);
const expectedFileName = "testBindingBinary";

export async function testBindingBinary(bindingBinaryPath: string, gpu: BuildGpu, testTimeout: number = 1000 * 60 * 5): Promise<boolean> {
    if (!detectedFileName.startsWith(expectedFileName)) {
        console.warn(
            getConsoleLogPrefix() +
            `"${expectedFileName}.js" file is not independent, so testing a binding binary with the current system` +
            "prior to importing it cannot be done.\n" +
            getConsoleLogPrefix() +
            "Assuming the test passed with the risk that the process may crash due to an incompatible binary.\n" +
            getConsoleLogPrefix() +
            'To resolve this issue, make sure that "node-llama-cpp" is not bundled together with other code and is imported as an external module with its original file structure.'
        );

        return true;
    }

    async function getForkFunction() {
        if (runningInElectron) {
            try {
                const {utilityProcess} = await import("electron");

                return {
                    type: "electron",
                    fork: utilityProcess.fork.bind(utilityProcess)
                } as const;
            } catch (err) {
                // do nothing
            }
        }

        return {
            type: "node",
            fork
        } as const;
    }

    const forkFunction = await getForkFunction();

    function createTestProcess({
        onMessage,
        onExit
    }: {
        onMessage(message: ChildToParentMessage): void,
        onExit(code: number): void
    }): {
        sendMessage(message: ParentToChildMessage): void,
        killProcess(): void
    } {
        if (forkFunction.type === "electron") {
            let exited = false;
            const subProcess = forkFunction.fork(__filename, [], {
                env: {
                    ...process.env,
                    TEST_BINDING_CP: "true"
                }
            });

            function cleanupElectronFork() {
                if (subProcess.pid != null || !exited) {
                    subProcess.kill();
                    exited = true;
                }

                process.off("exit", cleanupElectronFork);
            }

            process.on("exit", cleanupElectronFork);

            subProcess.on("message", onMessage);
            subProcess.on("exit", (code) => {
                exited = true;
                cleanupElectronFork();
                onExit(code);
            });

            return {
                sendMessage: (message: ParentToChildMessage) => subProcess.postMessage(message),
                killProcess: cleanupElectronFork
            };
        }

        const subProcess = forkFunction.fork(__filename, [], {
            detached: false,
            silent: true,
            env: {
                ...process.env,
                TEST_BINDING_CP: "true"
            }
        });

        function cleanupNodeFork() {
            if (subProcess.exitCode == null)
                subProcess.kill("SIGKILL");

            process.off("exit", cleanupNodeFork);
        }

        process.on("exit", cleanupNodeFork);

        subProcess.on("message", onMessage);
        subProcess.on("exit", (code) => {
            cleanupNodeFork();
            onExit(code ?? -1);
        });

        if (subProcess.killed || subProcess.exitCode != null) {
            cleanupNodeFork();
            onExit(subProcess.exitCode ?? -1);
        }

        return {
            sendMessage: (message: ParentToChildMessage) => subProcess.send(message),
            killProcess: cleanupNodeFork
        };
    }

    let testPassed = false;
    let forkSucceeded = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    let subProcess: ReturnType<typeof createTestProcess> | undefined = undefined;
    let testFinished = false;

    function cleanup() {
        testFinished = true;

        if (timeoutHandle != null)
            clearTimeout(timeoutHandle);

        subProcess?.killProcess();
    }

    return Promise.race([
        new Promise<boolean>((_, reject) => {
            timeoutHandle = setTimeout(() => {
                reject(new Error("Binding binary load test timed out"));
                cleanup();
            }, testTimeout);
        }),
        new Promise<boolean>((resolve, reject) => {
            function done() {
                if (!forkSucceeded)
                    reject(new Error(`Binding binary test failed to run a test process via file "${__filename}"`));
                else
                    resolve(testPassed);

                cleanup();
            }

            subProcess = createTestProcess({
                onMessage(message: ChildToParentMessage) {
                    if (message.type === "ready") {
                        forkSucceeded = true;
                        subProcess!.sendMessage({
                            type: "start",
                            bindingBinaryPath,
                            gpu
                        });
                    } else if (message.type === "done") {
                        testPassed = true;
                        subProcess!.sendMessage({type: "exit"});
                    }
                },
                onExit(code: number) {
                    if (code !== 0)
                        testPassed = false;

                    done();
                }
            });

            if (testFinished)
                subProcess.killProcess();
        })
    ]);
}

if (process.env.TEST_BINDING_CP === "true" && (process.parentPort != null || process.send != null)) {
    const sendMessage = process.parentPort != null
        ? (message: ChildToParentMessage) => process.parentPort.postMessage(message)
        : (message: ChildToParentMessage) => process.send!(message);
    const onMessage = async (message: ParentToChildMessage) => {
        if (message.type === "start") {
            try {
                const binding: BindingModule = require(message.bindingBinaryPath);

                binding.loadBackends();
                const loadedGpu = binding.getGpuType();
                if (loadedGpu == null || (loadedGpu === false && message.gpu !== false))
                    binding.loadBackends(true);

                await binding.init();
                binding.getGpuVramInfo();
                binding.getGpuDeviceInfo();

                const gpuType = binding.getGpuType();
                void (gpuType as BuildGpu satisfies typeof gpuType);
                if (gpuType !== message.gpu)
                    throw new Error(`Binary GPU type mismatch. Expected: ${message.gpu}, got: ${gpuType}`);

                sendMessage({type: "done"});
            } catch (err) {
                console.error(err);
                process.exit(1);
            }
        } else if (message.type === "exit") {
            process.exit(0);
        }
    };

    if (process.parentPort != null)
        process.parentPort.on("message", (message) => onMessage(message.data));
    else
        process.on("message", onMessage);

    sendMessage({type: "ready"});
}

type ParentToChildMessage = {
    type: "start",
    bindingBinaryPath: string,
    gpu: BuildGpu
} | {
    type: "exit"
};
type ChildToParentMessage = {
    type: "ready" | "done"
};
