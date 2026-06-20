import os from "os";
import fs from "fs";
import {getPlatform} from "./getPlatform.js";
import {getLinuxDistroInfo} from "./getLinuxDistroInfo.js";

export async function getPlatformInfo(): Promise<{name: string, version: string, wsl2: boolean}> {
    const currentPlatform = getPlatform();
    let isWsl2 = false;

    if (currentPlatform === "linux") {
        try {
            const release = fs.readFileSync("/proc/sys/kernel/osrelease", "utf8").toLowerCase();
            isWsl2 = release.includes("microsoft") || release.includes("wsl");
        } catch {
            // ignore
        }
    }

    if (currentPlatform === "mac")
        return {
            name: "macOS",
            version: os.release(),
            wsl2: false
        };
    else if (currentPlatform === "linux") {
        const linuxDistroInfo = await getLinuxDistroInfo();

        return {
            name: linuxDistroInfo.name,
            version: linuxDistroInfo.version,
            wsl2: isWsl2
        };
    } else if (currentPlatform === "win")
        return {
            name: "Windows",
            version: os.release(),
            wsl2: false
        };

    return {
        name: "Unknown",
        version: os.release(),
        wsl2: false
    };
}

export type BinaryPlatformInfo = Awaited<ReturnType<typeof getPlatformInfo>>;
