import path from "path";
import os from "os";
import fs from "fs-extra";
import {cliHomedirTempDirectory, localTempDirectory} from "../config.js";
import {isPathWritableWithCache} from "./getFirstWritableDir.js";

const currentDate = new Date();
const currentRunId = [
    process.pid + ".",
    String(currentDate.getFullYear()).padStart(4, "0"),
    String(currentDate.getMonth() + 1).padStart(2, "0"),
    String(currentDate.getDate()).padStart(2, "0"),
    String(currentDate.getHours()).padStart(2, "0"),
    String(currentDate.getMinutes()).padStart(2, "0"),
    String(currentDate.getSeconds()).padStart(2, "0"),
    String(currentDate.getMilliseconds()).padStart(3, "0"),
    ".",
    Math.random()
        .toString(36)
        .slice(2)
].join("");

let lastResolvedTempDir: string | undefined = undefined;
export async function getTempDir(helperTempDirs?: string[]) {
    for (const tempDir of helperTempDirs ?? []) {
        if (await isPathWritableWithCache(tempDir))
            return new FsPathHandle(path.join(tempDir, "nlc." + currentRunId));
    }

    if (lastResolvedTempDir != null)
        return new FsPathHandle(lastResolvedTempDir);

    if (await isPathWritableWithCache(localTempDirectory))
        lastResolvedTempDir = path.join(localTempDirectory, currentRunId);
    else if (await isPathWritableWithCache(os.tmpdir()))
        lastResolvedTempDir = path.join(os.tmpdir(), "nlc." + currentRunId);
    else if (await isPathWritableWithCache(cliHomedirTempDirectory))
        lastResolvedTempDir = path.join(cliHomedirTempDirectory, currentRunId);

    if (lastResolvedTempDir != null)
        return new FsPathHandle(lastResolvedTempDir);

    return undefined;
}

const pathUsages = new Map<string, number>();
function addPathUsage(tempDirPath: string) {
    const usage = pathUsages.get(tempDirPath) ?? 0;
    pathUsages.set(tempDirPath, usage + 1);

    if (usage === 0)
        ensureExitEventRegistration();
}

function removePathUsage(tempDirPath: string, removeAsync: boolean = false): Promise<void> | void {
    const usage = pathUsages.get(tempDirPath);
    if (usage == null)
        return;

    if (usage <= 1) {
        pathUsages.delete(tempDirPath);

        if (removeAsync)
            return fs.remove(tempDirPath)
                .then(doNothing)
                .catch(doNothing);

        try {
            fs.removeSync(tempDirPath);
        } catch (err) {
            // do nothing
        }

        ensureExitEventRegistration();
    } else
        pathUsages.set(tempDirPath, usage - 1);
}

function removePathUsageSync(tempDirPath: string): void {
    removePathUsage(tempDirPath);
}

let onExitRegistered = false;
function ensureExitEventRegistration() {
    if (pathUsages.size === 0 && onExitRegistered) {
        process.off("beforeExit", onExit);
        onExitRegistered = false;
    } else if (pathUsages.size > 0 && !onExitRegistered) {
        process.on("beforeExit", onExit);
        onExitRegistered = true;
    }
}

function onExit() {
    for (const tempDirPath of pathUsages.keys()) {
        try {
            fs.removeSync(tempDirPath);
        } catch (err) {
            // do nothing
        }
    }
}

export class FsPathHandle {
    public readonly path: string;

    private _finalizationRegistry: FinalizationRegistry<string>;
    private _disposed: boolean = false;

    public constructor(dirPath: string) {
        this.path = dirPath;
        this._finalizationRegistry = new FinalizationRegistry(removePathUsageSync);

        addPathUsage(this.path);
        this._finalizationRegistry.register(this, this.path);
    }

    public async dispose() {
        if (this._disposed)
            return;

        this._disposed = true;
        this._finalizationRegistry.unregister(this);
        await removePathUsage(this.path, true);
    }

    public [Symbol.asyncDispose]() {
        return this.dispose();
    }

    public [Symbol.dispose]() {
        if (this._disposed)
            return;

        this._disposed = true;
        this._finalizationRegistry.unregister(this);
        removePathUsage(this.path, false);
    }
}

function doNothing() {

}
