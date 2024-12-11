import path from "path";
import fs from "fs-extra";
import {runningInElectron} from "../../utils/runtime.js";

export async function resolveActualBindingBinaryPath(binaryPath: string) {
    const absolutePath = path.resolve(binaryPath);
    if (!runningInElectron)
        return absolutePath;

    const fixedAsarPath = absolutePath.replace(".asar" + path.sep, ".asar.unpacked" + path.sep);
    try {
        if (await fs.pathExists(fixedAsarPath))
            return fixedAsarPath;

        return absolutePath;
    } catch (err) {
        return absolutePath;
    }
}
