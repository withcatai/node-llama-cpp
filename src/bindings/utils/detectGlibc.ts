import process from "process";
import fs from "fs-extra";
import {BinaryPlatform} from "./getPlatform.js";
import {asyncEvery} from "./asyncEvery.js";
import {asyncSome} from "./asyncSome.js";
import {hasFileInPath} from "./hasFileInPath.js";

export async function detectGlibc({
    platform
}: {
    platform: BinaryPlatform
}) {
    if (platform === "linux") {
        const librarySearchPaths = [
            process.env.LD_LIBRARY_PATH,
            "/lib",
            "/lib64",
            "/usr/lib",
            "/usr/lib64",
            "/usr/lib/x86_64-linux-gnu",
            "/usr/lib/aarch64-linux-gnu",
            "/usr/lib/armv7l-linux-gnu"
        ];

        const glibcFileNames = [
            "libc.so",
            "libc.so.5",
            "libc.so.6",
            "libc.so.7" // for when the next version comes out
        ];

        const dynamicLoaderFileNames = [
            "ld-linux.so",
            "ld-linux.so.1",
            "ld-linux.so.2",
            "ld-linux.so.3", // for when the next version comes out
            "ld-linux-x86-64.so",
            "ld-linux-x86-64.so.1",
            "ld-linux-x86-64.so.2",
            "ld-linux-x86-64.so.3", // for when the next version comes out
            "ld-linux-aarch64.so",
            "ld-linux-aarch64.so.1",
            "ld-linux-aarch64.so.2",
            "ld-linux-aarch64.so.3", // for when the next version comes out
            "ld-linux-armv7l.so",
            "ld-linux-armv7l.so.1",
            "ld-linux-armv7l.so.2",
            "ld-linux-armv7l.so.3" // for when the next version comes out
        ];

        const foundGlibC = await asyncEvery([
            asyncSome(glibcFileNames.map((fileName) => hasFileInPath(fileName, librarySearchPaths))),
            asyncSome(dynamicLoaderFileNames.map((fileName) => hasFileInPath(fileName, librarySearchPaths)))
        ]);
        if (foundGlibC)
            return true;

        const loadedLibraries = await getLoadedSharedLibraries();
        return glibcFileNames.some((fileName) => loadedLibraries.has(fileName)) &&
            dynamicLoaderFileNames.some((fileName) => loadedLibraries.has(fileName));
    }

    return false;
}

async function getLoadedSharedLibraries(trimPath = true) {
    const libraries = new Set<string>();

    try {
        const content = await fs.readFile("/proc/self/maps", "utf8");
        for (const line of content.split("\n")) {
            const match = line.match(/\s(\/.*\.so(\.\d+)*)$/);
            const lib = match?.[1];
            if (lib != null && lib !== "") {
                if (trimPath)
                    libraries.add(lib.split("/").pop()!);
                else
                    libraries.add(lib);
            }
        }
    } catch (err) {
        // do nothing
    }

    return libraries;
}
