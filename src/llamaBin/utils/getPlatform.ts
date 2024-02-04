import process from "process";

export function getPlatform() {
    switch (process.platform) {
        case "win32":
        case "cygwin":
            return "win";

        case "linux":
        case "android":
            return "linux";

        case "darwin":
            return "mac";
    }

    return process.platform;
}

export type BinaryPlatform = ReturnType<typeof getPlatform>;
