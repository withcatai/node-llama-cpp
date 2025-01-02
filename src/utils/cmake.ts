import path from "path";
import fs from "fs-extra";
import which from "which";
import chalk from "chalk";
import {chmodr} from "chmodrp";
import {
    defaultXpacksCacheDirectory, defaultXpacksStoreDirectory, llamaDirectory, localXpacksCacheDirectory, localXpacksStoreDirectory,
    xpackDirectory, xpmVersion
} from "../config.js";
import {logDistroInstallInstruction} from "../bindings/utils/logDistroInstallInstruction.js";
import {getPlatform} from "../bindings/utils/getPlatform.js";
import {getWindowsVisualStudioEditionPaths} from "../bindings/utils/detectBuildTools.js";
import {spawnCommand} from "./spawnCommand.js";
import withStatusLogs from "./withStatusLogs.js";
import {withLockfile} from "./withLockfile.js";


export async function hasBuiltinCmake() {
    try {
        const resolvedPath = await which("cmake");
        return resolvedPath !== "";
    } catch (err) {
        return false;
    }
}

export async function getCmakePath() {
    try {
        const resolvedPath = await which("cmake", {
            nothrow: true
        });

        if (resolvedPath !== "" && resolvedPath != null)
            return resolvedPath;
    } catch (err) {}

    try {
        const existingCmake = await findExistingCmake();
        if (existingCmake != null)
            return existingCmake;
    } catch (err) {}

    try {
        let resolvedPath = await which("cmake", {
            path: path.join(llamaDirectory, "xpack", "xpacks", ".bin")
        });

        if (resolvedPath.toLowerCase().endsWith(".cmd"))
            resolvedPath = (await getBinFromWindowCmd(resolvedPath, "cmake.exe")) ?? "";
        else if (resolvedPath.toLowerCase().endsWith(".ps1")) {
            const cmdFilePath = resolvedPath.slice(0, -".ps1".length) + ".cmd";

            if (await fs.pathExists(cmdFilePath))
                resolvedPath = (await getBinFromWindowCmd(cmdFilePath, "cmake.exe")) ?? "";
        }

        if (resolvedPath !== "")
            return resolvedPath;
    } catch (err) {}

    throw new Error("cmake not found");
}

export async function downloadCmakeIfNeeded(wrapWithStatusLogs: boolean = false) {
    try {
        await getCmakePath();
        return;
    } catch (err) {}

    if (!wrapWithStatusLogs)
        await downloadCmake({progressLogs: wrapWithStatusLogs});
    else {
        try {
            await withStatusLogs({
                loading: chalk.blue("Downloading cmake"),
                success: chalk.blue("Downloaded cmake"),
                fail: chalk.blue("Failed to download cmake")
            }, async () => {
                await downloadCmake({progressLogs: wrapWithStatusLogs});
            });
        } catch (err) {
            await logDistroInstallInstruction('To install "cmake", ', {
                linuxPackages: {apt: ["cmake"], apk: ["cmake"]},
                macOsPackages: {brew: ["cmake"]}
            });
            throw err;
        }
    }
}

export async function clearLocalCmake() {
    await fs.remove(localXpacksStoreDirectory);
    await fs.remove(localXpacksCacheDirectory);
    await fs.remove(path.join(xpackDirectory, "xpacks"));
}

/**
 * There's an issue where after a compilation, the cmake binaries have permissions that don't allow them to be deleted.
 * This function fixes that.
 * It should be run after each compilation.
 */
export async function fixXpackPermissions() {
    try {
        await chmodr(localXpacksStoreDirectory, 0o777);
        await chmodr(localXpacksCacheDirectory, 0o777);
        await chmodr(path.join(xpackDirectory, "xpacks"), 0o777);
    } catch (err) {}
}

async function findExistingCmake() {
    const platform = getPlatform();

    if (platform === "win") {
        const {vsEditionPaths} = await getWindowsVisualStudioEditionPaths();

        const potentialCmakePaths = vsEditionPaths.map((editionPath) => (
            path.join(editionPath, "Common7", "IDE", "CommonExtensions", "Microsoft", "CMake", "CMake", "bin", "cmake.exe")
        ));

        const cmakePaths = (await Promise.all(
            potentialCmakePaths.map(async (cmakePath) => {
                if (await fs.pathExists(cmakePath))
                    return cmakePath;

                return null;
            })
        ))
            .filter((cmakePath) => cmakePath != null);

        return cmakePaths[0];
    }

    return undefined;
}

async function downloadCmake({progressLogs = true}: {progressLogs?: boolean} = {}) {
    await withLockfile({
        resourcePath: path.join(xpackDirectory, "cmakeInstall")
    }, async () => {
        const xpmEnv: NodeJS.ProcessEnv = {
            ...process.env,
            XPACKS_STORE_FOLDER: defaultXpacksStoreDirectory,
            XPACKS_CACHE_FOLDER: defaultXpacksCacheDirectory
        };

        await spawnCommand("npm", ["exec", "--yes", "--", `xpm@${xpmVersion}`, "install", "@xpack-dev-tools/cmake@latest", "--no-save"], xpackDirectory, xpmEnv, progressLogs);

        await fs.remove(localXpacksCacheDirectory);
        await fixXpackPermissions();
    });
}

async function getBinFromWindowCmd(cmdFilePath: string, binName: string) {
    const fileContent: string = await fs.readFile(cmdFilePath, "utf8");
    const lowercaseFileContent = fileContent.toLowerCase();

    if (!lowercaseFileContent.includes(binName))
        return null;

    const lastIndexOfBinName = lowercaseFileContent.lastIndexOf(binName);
    const characterAfterBinName = fileContent[lastIndexOfBinName + binName.length];

    if (characterAfterBinName !== '"' && characterAfterBinName !== "'")
        return null;

    const startStringCharacter = fileContent.lastIndexOf(characterAfterBinName, lastIndexOfBinName);

    const binPath = fileContent.slice(startStringCharacter + 1, lastIndexOfBinName + binName.length);

    if (!await fs.pathExists(binPath))
        return null;

    return binPath;
}
