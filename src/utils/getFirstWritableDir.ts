import path from "path";
import fs from "fs-extra";
import {runningInElectron} from "./runtime.js";
import {LruCache} from "./LruCache.js";

export async function getFirstWritableDir(dirPaths: string[]): Promise<string | null> {
    for (const dirPath of dirPaths) {
        if (isPathInsideAsar(dirPath))
            continue;

        if (await isPathWritable(dirPath))
            return dirPath;
    }

    return null;
}

const writableCheckCache = new LruCache<string, boolean>(20);
export async function isPathWritableWithCache(dirPath: string) {
    const isWritable = writableCheckCache.get(dirPath) ?? await isPathWritable(dirPath);
    writableCheckCache.set(dirPath, isWritable);
    return isWritable;
}

export async function isPathWritable(dirPath: string) {
    let checkPath = path.resolve(dirPath);

    while (true) {
        try {
            const stat = await fs.lstat(checkPath);
            if (!stat.isDirectory())
                return false;

            break;
        } catch (error: any) {
            if (error?.code !== "ENOENT")
                return false;

            const nextCheckPath = path.dirname(checkPath);
            if (nextCheckPath === checkPath)
                return false;

            checkPath = nextCheckPath;
        }
    }

    try {
        await fs.access(path.dirname(checkPath), fs.constants.W_OK | fs.constants.X_OK);
    } catch {
        return false;
    }

    return true;
}

/**
 * Check whether a path is inside an asar when running in Electron,
 * which means that the path is not writable and inaccessible outside the Electron app.
 */
export function isPathInsideAsar(dirPath: string, excludeUnpacked: boolean = false) {
    if (!runningInElectron)
        return false;

    const normalizedPath = dirPath.toLowerCase();
    if (normalizedPath.endsWith(".asar") ||
        (!excludeUnpacked && normalizedPath.endsWith(".asar.unpacked"))
    )
        return true;

    return normalizedPath.includes(".asar" + path.sep) ||
        (!excludeUnpacked && normalizedPath.includes(".asar.unpacked" + path.sep));
}
