import {describe, expect, test, vi} from "vitest";
import {spawnCommand} from "../../../src/utils/spawnCommand.js";


describe("utils", () => {
    describe("spawnCommand", () => {
        test("keeps the parent's stdout clean and doesn't hijack its stdin", async () => {
            const marker = "node_llama_cpp_spawn_stdout_marker";

            const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
            const stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
            const stdinPipe = vi.spyOn(process.stdin, "pipe");

            try {
                const res = await spawnCommand(
                    process.execPath,
                    ["-e", `process.stdout.write(${JSON.stringify(marker)})`],
                    process.cwd(),
                    process.env,
                    true
                );

                // the child's stdout is still captured in the resolved result
                expect(res.stdout).to.include(marker);

                // ...but it must not be echoed onto the parent's stdout (reserved for data channels like JSON-RPC)
                const parentStdout = stdoutWrite.mock.calls.map((call) => String(call[0])).join("");
                expect(parentStdout).to.not.include(marker);

                // progress is echoed to stderr instead
                const parentStderr = stderrWrite.mock.calls.map((call) => String(call[0])).join("");
                expect(parentStderr).to.include(marker);

                // and the parent's stdin must never be piped into the child
                expect(stdinPipe).to.not.toHaveBeenCalled();
            } finally {
                stdoutWrite.mockRestore();
                stderrWrite.mockRestore();
                stdinPipe.mockRestore();
            }
        });
    });
});
