import os from "os";
import {getPlatform} from "./getPlatform.js";
import {getLinuxDistroInfo} from "./getLinuxDistroInfo.js";

export async function getPlatformInfo(): Promise<{name: string, version: string}> {
    const currentPlatform = getPlatform();

    if (currentPlatform === "mac")
        return {
            name: "macOS",
            version: os.release()
        };
    else if (currentPlatform === "linux") {
        const linuxDistroInfo = await getLinuxDistroInfo();

        return {
            name: linuxDistroInfo.name,
            version: linuxDistroInfo.version
        };
    } else if (currentPlatform === "win")
        return {
            name: "Windows",
            version: os.release()
        };

    return {
        name: "Unknown",
        version: os.release()
    };
}

export type BinaryPlatformInfo = Awaited<ReturnType<typeof getPlatformInfo>>;
