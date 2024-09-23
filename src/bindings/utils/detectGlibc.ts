import process from "process";
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

        return await asyncEvery([
            asyncSome([
                hasFileInPath("libc.so", librarySearchPaths),
                hasFileInPath("libc.so.5", librarySearchPaths),
                hasFileInPath("libc.so.6", librarySearchPaths),
                hasFileInPath("libc.so.7", librarySearchPaths) // for when the next version comes out
            ]),
            asyncSome([
                hasFileInPath("ld-linux.so", librarySearchPaths),
                hasFileInPath("ld-linux.so.1", librarySearchPaths),
                hasFileInPath("ld-linux.so.2", librarySearchPaths),
                hasFileInPath("ld-linux.so.3", librarySearchPaths), // for when the next version comes out
                hasFileInPath("ld-linux-x86-64.so", librarySearchPaths),
                hasFileInPath("ld-linux-x86-64.so.1", librarySearchPaths),
                hasFileInPath("ld-linux-x86-64.so.2", librarySearchPaths),
                hasFileInPath("ld-linux-x86-64.so.3", librarySearchPaths), // for when the next version comes out
                hasFileInPath("ld-linux-aarch64.so", librarySearchPaths),
                hasFileInPath("ld-linux-aarch64.so.1", librarySearchPaths),
                hasFileInPath("ld-linux-aarch64.so.2", librarySearchPaths),
                hasFileInPath("ld-linux-aarch64.so.3", librarySearchPaths), // for when the next version comes out
                hasFileInPath("ld-linux-armv7l.so", librarySearchPaths),
                hasFileInPath("ld-linux-armv7l.so.1", librarySearchPaths),
                hasFileInPath("ld-linux-armv7l.so.2", librarySearchPaths),
                hasFileInPath("ld-linux-armv7l.so.3", librarySearchPaths) // for when the next version comes out
            ])
        ]);
    }

    return false;
}
