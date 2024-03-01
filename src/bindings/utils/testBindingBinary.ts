import {fork} from "node:child_process";
import {fileURLToPath} from "url";
import {createRequire} from "module";
import type {BindingModule} from "../AddonTypes.js";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);

export function testBindingBinary(bindingBinaryPath: string, testTimeout: number = 1000 * 60 * 5) {
    const subProcess = fork(__filename, [], {
        detached: false,
        env: {
            ...process.env,
            TEST_BINDING_CP: "true"
        }
    });
    let testPassed = false;
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
        new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => {
                reject(new Error("Binding binary load test timed out"));
                cleanup();
            }, testTimeout);
        }),
        new Promise((resolve) => {
            subProcess.on("message", (message: ChildToParentMessage) => {
                if (message.type === "ready") {
                    subProcess.send({type: "start", bindingBinaryPath} satisfies ParentToChildMessage);
                } else if (message.type === "done") {
                    testPassed = true;
                    subProcess.send({type: "exit"} satisfies ParentToChildMessage);
                }
            });

            subProcess.on("exit", (code) => {
                if (code !== 0)
                    testPassed = false;

                resolve(testPassed);
                cleanup();
            });

            if (subProcess.killed || subProcess.exitCode != null) {
                if (subProcess.exitCode !== 0)
                    testPassed = false;

                resolve(testPassed);
                cleanup();
            }
        })
    ]);
}

if (process.env.TEST_BINDING_CP === "true" && process.send != null) {
    process.on("message", (message: ParentToChildMessage) => {
        if (message.type === "start") {
            if (process.send == null)
                process.exit(1);

            try {
                const binding: BindingModule = require(message.bindingBinaryPath);
                binding.init();
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
