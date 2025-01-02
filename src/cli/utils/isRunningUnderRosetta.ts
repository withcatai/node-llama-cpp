import path from "path";
import {fileURLToPath} from "url";
import process from "process";
import {getPlatform} from "../../bindings/utils/getPlatform.js";
import {spawnCommand} from "../../utils/spawnCommand.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function isRunningUnderRosetta() {
    const platform = getPlatform();

    // // only check for rosetta on macOS when x64 is detected
    if (platform !== "mac" || process.arch !== "x64")
        return false;

    try {
        const res = await spawnCommand("sysctl", ["-n", "sysctl.proc_translated"], __dirname, process.env, false);

        return res.combinedStd.trim() === "1";
    } catch (err) {
        return false;
    }
}
