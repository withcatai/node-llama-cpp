import {fork} from "node:child_process";
import {mkdtemp, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {describe, expect, test} from "vitest";
import {getForkExecArgv} from "../../../src/bindings/utils/getForkExecArgv.js";


describe("getForkExecArgv", () => {
    test("preserves file-compatible arguments without changing the input", () => {
        const args = ["--trace-warnings", "--conditions", "custom", "--max-old-space-size=256"];
        expect(getForkExecArgv(args)).to.eql(args);
        expect(args).to.eql(["--trace-warnings", "--conditions", "custom", "--max-old-space-size=256"]);
    });

    test.each([
        {args: ["--trace-warnings", "--input-type=module", "-e", "throw new Error('parent eval ran')"], expected: ["--trace-warnings"]},
        {args: ["--trace-warnings", "--input-type", "module", "--eval", "throw new Error('parent eval ran')"], expected: ["--trace-warnings"]},
        {args: ["--trace-warnings", "--input-type=commonjs", "--eval=throw new Error('parent eval ran')"], expected: ["--trace-warnings"]},
        {args: ["--trace-warnings", "--input-type", "commonjs", "-p", "'parent print ran'"], expected: ["--trace-warnings"]},
        {args: ["--trace-warnings", "--input-type=commonjs", "-pe", "'parent print ran'"], expected: ["--trace-warnings"]},
        {args: ["--trace-warnings", "--input-type=commonjs", "--print='parent print ran'"], expected: ["--trace-warnings"]},
        {args: ["-p", "--conditions", "custom", "-e", "'parent eval ran'"], expected: ["--conditions", "custom"]},
        {args: ["--print", "--trace-warnings", "--eval", "'parent eval ran'"], expected: ["--trace-warnings"]}
    ])("starts a file child with input arguments $args", async ({args, expected}) => {
        const directory = await mkdtemp(path.join(os.tmpdir(), "node-llama-cpp-fork-"));
        const childPath = path.join(directory, "child.mjs");
        await writeFile(childPath, "process.send({execArgv: process.execArgv}); process.disconnect();\n");

        try {
            const childArgs = getForkExecArgv(args);
            const result = await new Promise<{execArgv: string[]}>((resolve, reject) => {
                const child = fork(childPath, [], {
                    execArgv: childArgs,
                    stdio: ["ignore", "ignore", "pipe", "ipc"]
                });
                let stderr = "";
                let message: {execArgv: string[]} | undefined;
                const timeout = setTimeout(() => {
                    child.kill();
                    reject(new Error("File child did not finish"));
                }, 5000);

                child.stderr?.on("data", (data) => stderr += data);
                child.on("message", (value: {execArgv: string[]}) => message = value);
                child.on("error", reject);
                child.on("exit", (code) => {
                    clearTimeout(timeout);
                    if (code !== 0 || message == null)
                        reject(new Error(`File child failed: ${code}: ${stderr}`));
                    else
                        resolve(message);
                });
            });

            expect(result.execArgv).to.eql(expected);
        } finally {
            await rm(directory, {recursive: true, force: true});
        }
    });
});
