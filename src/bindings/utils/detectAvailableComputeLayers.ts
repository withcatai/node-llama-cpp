import process from "process";
import path from "path";
import fs from "fs-extra";
import semver from "semver";
import {getConsoleLogPrefix} from "../../utils/getConsoleLogPrefix.js";
import {BinaryPlatform, getPlatform} from "./getPlatform.js";
import {hasFileInPath} from "./hasFileInPath.js";
import {asyncSome} from "./asyncSome.js";
import {asyncEvery} from "./asyncEvery.js";


export async function detectAvailableComputeLayers({
    platform = getPlatform()
}: {
    platform?: BinaryPlatform
} = {}) {
    const [
        cuda,
        vulkan,
        metal
    ] = await Promise.all([
        detectCudaSupport({platform}),
        detectVulkanSupport({platform}),
        detectMetalSupport({platform})
    ]);

    return {
        cuda,
        vulkan,
        metal
    };
}

async function detectCudaSupport({
    platform
}: {
    platform: BinaryPlatform
}) {
    if (platform === "win") {
        const librarySearchPaths = [
            process.env.CUDA_PATH
        ];
        const windir = getWindir();

        const [
            hasNvidiaDriver,
            hasCudaRuntime
        ] = await Promise.all([
            asyncSome([
                hasFileInPath("nvml.dll"),
                fs.pathExists(path.join(windir, "System32", "nvml.dll"))
            ]),
            asyncEvery([
                asyncSome([
                    hasFileInPath("cudart64_110.dll", librarySearchPaths),
                    hasFileInPath("cudart64_11.dll", librarySearchPaths),
                    hasFileInPath("cudart64_12.dll", librarySearchPaths),
                    hasFileInPath("cudart64_13.dll", librarySearchPaths) // for when the next version comes out
                ]),
                asyncSome([
                    hasFileInPath("cublas64_11.dll", librarySearchPaths),
                    hasFileInPath("cublas64_12.dll", librarySearchPaths),
                    hasFileInPath("cublas64_13.dll", librarySearchPaths) // for when the next version comes out
                ]),
                asyncSome([
                    hasFileInPath("cublasLt64_11.dll", librarySearchPaths),
                    hasFileInPath("cublasLt64_12.dll", librarySearchPaths),
                    hasFileInPath("cublasLt64_13.dll", librarySearchPaths) // for when the next version comes out
                ])
            ])
        ]);

        return {
            hasNvidiaDriver,
            hasCudaRuntime
        };
    } else if (platform === "linux") {
        const cudaLibraryPaths = await getLinuxCudaLibraryPaths();
        const librarySearchPaths = [
            process.env.LD_LIBRARY_PATH,
            process.env.CUDA_PATH,
            "/usr/lib",
            "/usr/lib64",
            "/usr/lib/x86_64-linux-gnu",
            ...cudaLibraryPaths
        ];

        const [
            hasNvidiaDriver,
            hasCudaRuntime
        ] = await Promise.all([
            asyncSome([
                hasFileInPath("libnvidia-ml.so", librarySearchPaths),
                hasFileInPath("libnvidia-ml.so.1", librarySearchPaths)
            ]),
            asyncEvery([
                asyncSome([
                    hasFileInPath("libcuda.so", librarySearchPaths),
                    hasFileInPath("libcuda.so.1", librarySearchPaths)
                ]),
                asyncSome([
                    hasFileInPath("libcudart.so", librarySearchPaths),
                    hasFileInPath("libcudart.so.11", librarySearchPaths),
                    hasFileInPath("libcudart.so.12", librarySearchPaths),
                    hasFileInPath("libcudart.so.13", librarySearchPaths) // for when the next version comes out
                ]),
                asyncSome([
                    hasFileInPath("libcublas.so", librarySearchPaths),
                    hasFileInPath("libcublas.so.11", librarySearchPaths),
                    hasFileInPath("libcublas.so.12", librarySearchPaths),
                    hasFileInPath("libcublas.so.13", librarySearchPaths) // for when the next version comes out
                ]),
                asyncSome([
                    hasFileInPath("libcublasLt.so", librarySearchPaths),
                    hasFileInPath("libcublasLt.so.11", librarySearchPaths),
                    hasFileInPath("libcublasLt.so.12", librarySearchPaths),
                    hasFileInPath("libcublasLt.so.13", librarySearchPaths) // for when the next version comes out
                ])
            ])
        ]);

        return {
            hasNvidiaDriver,
            hasCudaRuntime
        };
    }

    return {
        hasNvidiaDriver: false,
        hasCudaRuntime: false
    };
}

async function detectVulkanSupport({
    platform
}: {
    platform: BinaryPlatform
}) {
    if (platform === "win") {
        const windir = getWindir();

        return await asyncSome([
            hasFileInPath("vulkan-1.dll"),
            fs.pathExists(path.join(windir, "System32", "vulkan-1.dll")),
            fs.pathExists(path.join(windir, "SysWOW64", "vulkan-1.dll"))
        ]);
    } else if (platform === "linux") {
        const librarySearchPaths = [
            process.env.LD_LIBRARY_PATH,
            "/usr/lib",
            "/usr/lib64",
            "/usr/lib/x86_64-linux-gnu",
            (process.env.PREFIX != null && process.env.PREFIX?.toLowerCase()?.includes?.("termux"))
                ? `${process.env.PREFIX}/usr/lib`
                : undefined
        ];

        return await asyncSome([
            hasFileInPath("libvulkan.so", librarySearchPaths),
            hasFileInPath("libvulkan.so.1", librarySearchPaths)
        ]);
    } else if (platform === "mac") {
        return await asyncSome([
            hasFileInPath("libvulkan.dylib"),
            hasFileInPath("libvulkan.dylib.1")
        ]);
    }

    return false;
}

async function detectMetalSupport({
    platform
}: {
    platform: BinaryPlatform
}) {
    return platform === "mac";
}

export async function getLinuxCudaLibraryPaths() {
    if (!(await fs.pathExists("/usr/local/")))
        return [];

    const res: string[] = [];
    try {
        const usrLocal = "/usr/local";
        const cudaFolderPrefix = "cuda-";
        const cudaFolders = (await fs.readdir(usrLocal))
            .filter((folderName) => folderName.toLowerCase().startsWith(cudaFolderPrefix))
            .sort((a, b) => {
                const aVersion = a.slice(cudaFolderPrefix.length);
                const bVersion = b.slice(cudaFolderPrefix.length);

                try {
                    const aVersionValid = semver.valid(semver.coerce(aVersion));
                    const bVersionValid = semver.valid(semver.coerce(bVersion));

                    if (aVersionValid && bVersionValid)
                        return semver.compare(aVersionValid, bVersionValid);
                    else if (aVersionValid)
                        return -1;
                    else if (bVersionValid)
                        return 1;
                    else
                        return 0;
                } catch (err) {
                    return 0;
                }
            })
            .reverse();

        for (const usrLocalFolderName in cudaFolders) {
            const cudaTargetsFolder = `${usrLocal}/${usrLocalFolderName}/targets`;
            for (const cudaTargetFolderName in await fs.readdir(cudaTargetsFolder)) {
                res.push(
                    `${cudaTargetsFolder}/${cudaTargetFolderName}/lib`,
                    `${cudaTargetsFolder}/${cudaTargetFolderName}/lib/stubs`
                );
            }

        }
    } catch (err) {
        console.error(getConsoleLogPrefix() + 'Failed to search "/usr/local/" for CUDA library paths', err);
    }

    return res;
}

function getWindir() {
    return process.env.windir || process.env.WINDIR || process.env.SystemRoot || process.env.systemroot || process.env.SYSTEMROOT ||
        "C:\\Windows";
}
