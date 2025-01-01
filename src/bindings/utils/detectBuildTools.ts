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
        return {
            vsEditionPaths: [],
            programFilesPaths: []
        };

    const programFilesPaths = await getWindowsProgramFilesPaths();
    const potentialVisualStudioPaths = programFilesPaths
        .map((programFilesPath) => `${programFilesPath}/Microsoft Visual Studio`);

    const versionPaths = (await Promise.all(
        potentialVisualStudioPaths.map(async (vsPath) => {
            if (await fs.pathExists(vsPath)) {
                const versions = await fs.readdir(vsPath, {withFileTypes: true});
                return versions
                    .filter((dirent) => dirent.isDirectory())
                    .map((dirent) => dirent.name)
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

    const vsEditionPaths = (await Promise.all(
        versionPaths.map(async (versionPath) => {
            const editions = await fs.readdir(versionPath, {withFileTypes: true});
            return editions
                .filter((dirent) => dirent.isDirectory())
                .map((edition) => path.join(versionPath, edition.name));
        })
    )).flat();

    return {
        vsEditionPaths,
        programFilesPaths
    };
}

export async function detectWindowsBuildTools(targetArch: typeof process.arch = process.arch) {
    try {
        const currentArch = process.arch;
        const {vsEditionPaths, programFilesPaths} = await getWindowsVisualStudioEditionPaths();

        if (vsEditionPaths.length === 0 && programFilesPaths.length === 0)
            return {
                hasCmake: false,
                hasNinja: false,
                hasLlvm: false,
                hasLibExe: false
            };

        const programDataPaths: string[] = [
            process.env["ProgramData"]
        ].filter((programDataPath) => programDataPath != null);

        const msvcPaths = (await Promise.all(
            vsEditionPaths.map(async (editionPath) => {
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

        const potentialCmakePaths = [
            ...programFilesPaths.map((programFilesPath) => path.join(programFilesPath, "CMake", "bin", "cmake.exe")),
            ...vsEditionPaths.map((editionPath) => (
                path.join(editionPath, "Common7", "IDE", "CommonExtensions", "Microsoft", "CMake", "CMake", "bin", "cmake.exe")
            ))
        ];
        const potentialNinjaPaths = [
            ...programDataPaths.map((programDataPath) => path.join(programDataPath, "chocolatey", "bin", "ninja.exe")),
            ...vsEditionPaths.map((editionPath) => (
                path.join(editionPath, "Common7", "IDE", "CommonExtensions", "Microsoft", "CMake", "Ninja", "ninja.exe")
            ))
        ];
        const potentialLlvmPaths = [
            ...programFilesPaths.map((programFilesPath) => path.join(programFilesPath, "LLVM", "bin")),
            ...vsEditionPaths.map((editionPath) => {
                if (currentArch === "x64")
                    return path.join(editionPath, "VC", "Tools", "Llvm", "x64", "bin");
                else if (currentArch === "arm64")
                    return path.join(editionPath, "VC", "Tools", "Llvm", "ARM64", "bin");

                return path.join(editionPath, "VC", "Tools", "Llvm", "bin");
            })
        ];
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
