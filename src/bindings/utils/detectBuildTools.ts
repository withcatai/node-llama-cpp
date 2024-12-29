import path from "path";
import fs from "fs-extra";
import {getWindowsProgramFilesPaths} from "./detectAvailableComputeLayers.js";
import {asyncSome} from "./asyncSome.js";
import {asyncEvery} from "./asyncEvery.js";
import {getPlatform} from "./getPlatform.js";

/**
 * On platforms other than Windows, this function will return an empty array
 * @returns Visual Studio edition installation paths - the paths are ordered from the most recent version to the oldest
 */
export async function getWindowsVisualStudioEditionPaths() {
    const platform = getPlatform();

    if (platform !== "win")
        return [];

    const programFilesPaths = await getWindowsProgramFilesPaths();
    const potentialVisualStudioPaths = programFilesPaths
        .map((programFilesPath) => `${programFilesPath}/Microsoft Visual Studio`);

    const versionPaths = (await Promise.all(
        potentialVisualStudioPaths.map(async (vsPath) => {
            if (await fs.pathExists(vsPath)) {
                const versions = await fs.readdir(vsPath);
                return versions
                    .sort((a, b) => {
                        const aNumber = parseInt(a);
                        const bNumber = parseInt(b);

                        if (Number.isFinite(aNumber) && Number.isFinite(bNumber))
                            return bNumber - aNumber;
                        else if (Number.isFinite(aNumber))
                            return -1;
                        else if (Number.isFinite(bNumber))
                            return 1;

                        return 0;
                    })
                    .map((version) => path.join(vsPath, version));
            }

            return [];
        })
    )).flat();

    const editionPaths = (await Promise.all(
        versionPaths.map(async (versionPath) => {
            const editions = await fs.readdir(versionPath);
            return editions.map((edition) => path.join(versionPath, edition));
        })
    )).flat();

    return editionPaths;
}

export async function detectWindowsBuildTools(targetArch: typeof process.arch = process.arch) {
    try {
        const currentArch = process.arch;
        const editionPaths = await getWindowsVisualStudioEditionPaths();

        if (editionPaths.length === 0)
            return {
                hasCmake: false,
                hasNinja: false,
                hasLlvm: false,
                hasLibExe: false
            };

        const msvcPaths = (await Promise.all(
            editionPaths.map(async (editionPath) => {
                const msvcVersionsPath = path.join(editionPath, "VC", "Tools", "MSVC");

                if (await fs.pathExists(msvcVersionsPath)) {
                    const msvcVersions = await fs.readdir(msvcVersionsPath);
                    return msvcVersions
                        .sort((a, b) => {
                            const aNumber = parseInt(a);
                            const bNumber = parseInt(b);

                            if (Number.isFinite(aNumber) && Number.isFinite(bNumber))
                                return bNumber - aNumber;
                            else if (Number.isFinite(aNumber))
                                return -1;
                            else if (Number.isFinite(bNumber))
                                return 1;

                            return 0;
                        })
                        .map((msvcVersion) => path.join(msvcVersionsPath, msvcVersion));
                }

                return [];
            })
        )).flat();

        const potentialCmakePaths = editionPaths.map((editionPath) => (
            path.join(editionPath, "Common7", "IDE", "CommonExtensions", "Microsoft", "CMake", "CMake", "bin", "cmake.exe")
        ));
        const potentialNinjaPaths = editionPaths.map((editionPath) => (
            path.join(editionPath, "Common7", "IDE", "CommonExtensions", "Microsoft", "CMake", "Ninja", "ninja.exe")
        ));
        const potentialLlvmPaths = editionPaths.map((editionPath) => {
            if (currentArch === "x64")
                return path.join(editionPath, "VC", "Tools", "Llvm", "x64", "bin");
            else if (currentArch === "arm64")
                return path.join(editionPath, "VC", "Tools", "Llvm", "ARM64", "bin");

            return path.join(editionPath, "VC", "Tools", "Llvm", "bin");
        });
        const potentialLibExePaths = msvcPaths.map((msvcPath) => {
            const hostArchDirName = currentArch === "x64"
                ? "Hostx64"
                : currentArch === "arm64"
                    ? "Hostarm64"
                    : "_";
            const targetArchDirName = targetArch === "x64"
                ? "x64"
                : targetArch === "arm64"
                    ? "arm64"
                    : "_";

            return path.join(msvcPath, "bin", hostArchDirName, targetArchDirName, "lib.exe");
        });

        const [
            hasCmake,
            hasNinja,
            hasLibExe,
            hasLlvm
        ] = await Promise.all([
            asyncSome(potentialCmakePaths.map((cmakePath) => fs.pathExists(cmakePath))),
            asyncSome(potentialNinjaPaths.map((ninjaPath) => fs.pathExists(ninjaPath))),
            asyncSome(potentialLibExePaths.map((libExePath) => fs.pathExists(libExePath))),
            asyncSome(potentialLlvmPaths.map((llvmPath) => isLlvmPathValid(llvmPath)))
        ]);

        return {
            hasCmake,
            hasNinja,
            hasLlvm,
            hasLibExe
        };
    } catch (err) {
        return {
            hasCmake: false,
            hasNinja: false,
            hasLlvm: false,
            hasLibExe: false
        };
    }
}

async function isLlvmPathValid(llvmPath: string): Promise<boolean> {
    if (!(await fs.pathExists(llvmPath)))
        return false;

    return await asyncEvery([
        fs.pathExists(path.join(llvmPath, "clang.exe")),
        fs.pathExists(path.join(llvmPath, "clang++.exe")),
        fs.pathExists(path.join(llvmPath, "llvm-rc.exe"))
    ]);
}
