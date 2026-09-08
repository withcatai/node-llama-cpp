import path from "path";
import which from "which";
import chalk from "chalk";
import withStatusLogs from "../../utils/withStatusLogs.js";
import {llamaDirectory} from "../../config.js";
import {withLockfile} from "../../utils/withLockfile.js";
import {spawnCommand} from "../../utils/spawnCommand.js";
import {getPlatform} from "./getPlatform.js";

export async function downloadMetalToolchainIfNeeded(wrapWithStatusLogs: boolean | "stderr" = "stderr") {
    if (getPlatform() !== "mac")
        return false;

    let xcodeBuildPath: string | null = null;
    try {
        xcodeBuildPath = await which("xcodebuild", {nothrow: true});
    } catch (err) {}

    if (xcodeBuildPath == null)
        return false;

    const installed = await hasMetalToolchain(xcodeBuildPath);
    if (installed)
        return true;

    if (wrapWithStatusLogs === false)
        await downloadMetalToolchain({xcodeBuildPath, progressLogs: wrapWithStatusLogs});
    else {
        try {
            await withStatusLogs({
                loading: chalk.blue("Downloading metal toolchain"),
                success: chalk.blue("Downloaded metal toolchain"),
                fail: chalk.blue("Failed to download metal toolchain")
            }, async () => {
                await downloadMetalToolchain({xcodeBuildPath, progressLogs: wrapWithStatusLogs});
            });
            return true;
        } catch (err) {
            return false;
        }
    }

    return false;
}

export async function hasMetalToolchain(xcodeBuildPath?: string | null): Promise<boolean> {
    if (getPlatform() !== "mac")
        return false;

    if (xcodeBuildPath == null) {
        try {
            xcodeBuildPath = await which("xcodebuild", {nothrow: true});
        } catch (err) {}
    }

    if (xcodeBuildPath == null)
        return false;

    const showComponentResult = await spawnCommand(xcodeBuildPath, ["-showComponent", "MetalToolchain"], llamaDirectory, process.env, false);
    return showComponentResult.combinedStd.includes("Status: installed") || !showComponentResult.combinedStd.includes("Status: uninstalled");
}

async function downloadMetalToolchain({xcodeBuildPath,
    progressLogs = "stderr"
}: {
    xcodeBuildPath: string,
    progressLogs?: boolean | "stderr"
}) {
    await withLockfile({
        resourcePath: path.join(llamaDirectory, ".metalToolchain")
    }, async () => {
        await spawnCommand(xcodeBuildPath, ["-downloadComponent", "MetalToolchain"], llamaDirectory, process.env, progressLogs);
    });
}

