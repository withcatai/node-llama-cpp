import process from "process";
import {execFile} from "node:child_process";
import path from "path";
import {fileURLToPath} from "url";
import fs from "fs-extra";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function testCmakeBinary(cmakeBinaryPath?: string, {
    cwd = __dirname, env = process.env
}: {
    cwd?: string, env?: typeof process.env
} = {}) {
    if (cmakeBinaryPath == null || !(await fs.pathExists(cmakeBinaryPath)))
        return false;

    return new Promise<boolean>((resolve, reject) => {
        const child = execFile(cmakeBinaryPath, ["--version"], {
            cwd,
            env,
            windowsHide: true
        });

        child.on("exit", (code) => {
            if (code == 0)
                resolve(true);
            else
                reject(false);
        });
        child.on("error", reject);
        child.on("disconnect", () => resolve(false));
        child.on("close", (code) => {
            if (code == 0)
                resolve(true);
            else
                resolve(false);
        });
    });
}
