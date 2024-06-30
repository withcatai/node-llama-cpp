import {fork} from "node:child_process";
import {fileURLToPath} from "url";
import {createRequire} from "module";
import path from "path";
import {getConsoleLogPrefix} from "../../utils/getConsoleLogPrefix.js";
import type {BindingModule} from "../AddonTypes.js";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const detectedFileName = path.basename(__filename);
const expectedFileName = "testBindingBinary";

export function testBindingBinary(bindingBinaryPath: string, testTimeout: number = 1000 * 60 * 5): Promise<boolean> {
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

        return Promise.resolve(true);
    }

    const subProcess = fork(__filename, [], {
        detached: false,
        env: {
            ...process.env,
            TEST_BINDING_CP: "true"
        }
    });
    let testPassed = false;
    let forkSucceeded = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    function cleanup() {
        if (subProcess.exitCode == null)
            subProcess.kill("SIGKILL");

        if (timeoutHandle != null)
            clearTimeout(timeoutHandle);

        process.off("exit", cleanup);
    }

    process.on("exit", cleanup);

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

            subProcess.on("message", (message: ChildToParentMessage) => {
                if (message.type === "ready") {
                    forkSucceeded = true;
                    subProcess.send({type: "start", bindingBinaryPath} satisfies ParentToChildMessage);
                } else if (message.type === "done") {
                    testPassed = true;
                    subProcess.send({type: "exit"} satisfies ParentToChildMessage);
                }
            });

            subProcess.on("exit", (code) => {
                if (code !== 0)
                    testPassed = false;

                done();
            });

            if (subProcess.killed || subProcess.exitCode != null) {
                if (subProcess.exitCode !== 0)
                    testPassed = false;

                done();
            }
        })
    ]);
}

if (process.env.TEST_BINDING_CP === "true" && process.send != null) {
    process.on("message", async (message: ParentToChildMessage) => {
        if (message.type === "start") {
            if (process.send == null)
                process.exit(1);

            try {
                const binding: BindingModule = require(message.bindingBinaryPath);
                await binding.init();
                binding.getGpuVramInfo();
                binding.getGpuDeviceInfo();
                process.send({type: "done"} satisfies ChildToParentMessage);
            } catch (err) {
                console.error(err);
                process.exit(1);
            }
        } else if (message.type === "exit") {
            process.exit(0);
        }
    });

    process.send({type: "ready"} satisfies ChildToParentMessage);
}

type ParentToChildMessage = {
    type: "start",
    bindingBinaryPath: string
} | {
    type: "exit"
};
type ChildToParentMessage = {
    type: "ready" | "done"
};
