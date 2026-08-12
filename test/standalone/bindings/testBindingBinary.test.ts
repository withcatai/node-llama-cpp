import {EventEmitter} from "node:events";
import {afterEach, describe, expect, test, vi} from "vitest";

const {forkMock} = vi.hoisted(() => ({forkMock: vi.fn()}));
vi.mock("node:child_process", () => ({fork: forkMock}));

import {testBindingBinary} from "../../../src/bindings/utils/testBindingBinary.js";

function createFakeChildProcess() {
    const child = new EventEmitter() as EventEmitter & {
        exitCode: number | null,
        killed: boolean,
        stderr: EventEmitter,
        stdout: EventEmitter,
        kill(): void,
        send(message: {type: string}): void
    };

    child.exitCode = null;
    child.killed = false;
    child.stderr = new EventEmitter();
    child.stdout = new EventEmitter();
    child.kill = () => {
        child.killed = true;
        child.exitCode = -1;
    };
    child.send = (message) => {
        if (message.type === "start")
            queueMicrotask(() => child.emit("message", {type: "loaded"}));
        else if (message.type === "test")
            queueMicrotask(() => child.emit("message", {type: "done"}));
        else if (message.type === "exit") {
            child.exitCode = 0;
            queueMicrotask(() => child.emit("exit", 0));
        }
    };

    return child;
}

describe("testBindingBinary", () => {
    afterEach(() => forkMock.mockReset());

    function setupFakeFork(forkOptions: {stdio?: unknown}[]) {
        forkMock.mockImplementation((_file: string, _args: string[], options: {stdio: unknown}) => {
            forkOptions.push(options);
            const child = createFakeChildProcess();
            queueMicrotask(() => child.emit("message", {type: "ready"}));
            return child;
        });
    }

    test("pipes child output by default on Windows", async () => {
        const forkOptions: {stdio?: unknown}[] = [];
        setupFakeFork(forkOptions);

        await expect(testBindingBinary("fake-binding", undefined, false, 1000)).resolves.toBe(true);

        expect(forkOptions).toHaveLength(1);
        expect(forkOptions[0]?.stdio).toEqual(
            process.platform === "win32"
                ? ["ignore", "pipe", "pipe", "ipc"]
                : ["ignore", "ignore", "ignore", "ipc"]
        );
    });

    test("honors an explicit output pipe setting", async () => {
        const forkOptions: {stdio?: unknown}[] = [];
        setupFakeFork(forkOptions);

        await expect(testBindingBinary("fake-binding", undefined, false, 1000, false)).resolves.toBe(true);

        expect(forkOptions[0]?.stdio).toEqual(["ignore", "ignore", "ignore", "ipc"]);
    });
});
