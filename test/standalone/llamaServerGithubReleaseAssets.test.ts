import {describe, expect, test} from "vitest";
import {
    getLlamaServerGithubReleaseAssetDownloadUrl,
    getLlamaServerGithubReleaseAssetFileName,
    getLlamaServerGithubReleaseAssetFileNameForBuildMetadata,
    getLlamaServerGithubReleaseAssetForBuildOptions,
    getLlamaServerGithubReleaseAssets,
    getLlamaServerGithubReleaseTag
} from "../../src/bindings/utils/llamaServerGithubReleaseAssets.js";

describe("llamaServerGithubReleaseAssets", () => {
    test("declares the managed runtime flavor matrix", () => {
        expect(getLlamaServerGithubReleaseAssets())
            .toEqual([
                {
                    platform: "mac",
                    arch: "arm64",
                    gpu: "metal",
                    runtimePlatform: "darwin",
                    runtimeArch: "arm64"
                },
                {
                    platform: "mac",
                    arch: "x64",
                    gpu: "metal",
                    runtimePlatform: "darwin",
                    runtimeArch: "x64"
                },
                {
                    platform: "linux",
                    arch: "x64",
                    gpu: false,
                    runtimePlatform: "linux",
                    runtimeArch: "x64"
                },
                {
                    platform: "linux",
                    arch: "x64",
                    gpu: "cuda",
                    runtimePlatform: "linux",
                    runtimeArch: "x64",
                    runtimeFlavor: "cuda"
                },
                {
                    platform: "linux",
                    arch: "x64",
                    gpu: "vulkan",
                    runtimePlatform: "linux",
                    runtimeArch: "x64",
                    runtimeFlavor: "vulkan"
                },
                {
                    platform: "linux",
                    arch: "arm64",
                    gpu: false,
                    runtimePlatform: "linux",
                    runtimeArch: "arm64"
                },
                {
                    platform: "linux",
                    arch: "arm64",
                    gpu: "cuda",
                    runtimePlatform: "linux",
                    runtimeArch: "arm64",
                    runtimeFlavor: "cuda"
                },
                {
                    platform: "linux",
                    arch: "arm",
                    gpu: false,
                    runtimePlatform: "linux",
                    runtimeArch: "armv7l"
                },
                {
                    platform: "win",
                    arch: "x64",
                    gpu: false,
                    runtimePlatform: "win32",
                    runtimeArch: "x64"
                },
                {
                    platform: "win",
                    arch: "x64",
                    gpu: "cuda",
                    runtimePlatform: "win32",
                    runtimeArch: "x64",
                    runtimeFlavor: "cuda"
                },
                {
                    platform: "win",
                    arch: "x64",
                    gpu: "vulkan",
                    runtimePlatform: "win32",
                    runtimeArch: "x64",
                    runtimeFlavor: "vulkan"
                },
                {
                    platform: "win",
                    arch: "arm64",
                    gpu: false,
                    runtimePlatform: "win32",
                    runtimeArch: "arm64"
                }
            ]);
    });

    test("resolves the macOS arm64 metal runtime asset", () => {
        expect(getLlamaServerGithubReleaseAssetForBuildOptions({
            platform: "mac",
            arch: "arm64",
            gpu: "metal"
        }))
            .toEqual({
                platform: "mac",
                arch: "arm64",
                gpu: "metal",
                runtimePlatform: "darwin",
                runtimeArch: "arm64"
            });
    });

    test.each([
        [{platform: "win", arch: "arm64", gpu: "cuda"}]
    ] as const)("does not resolve non-primary managed server flavor %#", (buildOptions) => {
        expect(getLlamaServerGithubReleaseAssetForBuildOptions(buildOptions))
            .toBeNull();
    });

    test("resolves the Linux arm64 CUDA runtime asset for DGX Spark", () => {
        expect(getLlamaServerGithubReleaseAssetForBuildOptions({
            platform: "linux",
            arch: "arm64",
            gpu: "cuda"
        }))
            .toEqual({
                platform: "linux",
                arch: "arm64",
                gpu: "cuda",
                runtimePlatform: "linux",
                runtimeArch: "arm64",
                runtimeFlavor: "cuda"
            });
    });

    test("resolves the Linux arm64 CPU fallback runtime asset", () => {
        expect(getLlamaServerGithubReleaseAssetForBuildOptions({
            platform: "linux",
            arch: "arm64",
            gpu: false
        }))
            .toEqual({
                platform: "linux",
                arch: "arm64",
                gpu: false,
                runtimePlatform: "linux",
                runtimeArch: "arm64"
            });
    });

    test("maps 32-bit ARM runtime lookups to the armv7l asset filename", () => {
        expect(getLlamaServerGithubReleaseAssetForBuildOptions({
            platform: "linux",
            arch: "arm",
            gpu: false
        }))
            .toEqual({
                platform: "linux",
                arch: "arm",
                gpu: false,
                runtimePlatform: "linux",
                runtimeArch: "armv7l"
            });
    });

    test("builds the canonical runtime asset file name", () => {
        expect(getLlamaServerGithubReleaseAssetFileName("b8762", {
            platform: "mac",
            arch: "arm64",
            gpu: "metal"
        }))
            .toBe("llama-server-darwin-arm64-b8762.zip");
    });

    test("builds canonical runtime asset file names for every managed flavor", () => {
        const fileNames = getLlamaServerGithubReleaseAssets()
            .map((asset) => getLlamaServerGithubReleaseAssetFileName("b8762", {
                platform: asset.platform,
                arch: asset.arch,
                gpu: asset.gpu
            }));

        expect(fileNames)
            .toEqual([
                "llama-server-darwin-arm64-b8762.zip",
                "llama-server-darwin-x64-b8762.zip",
                "llama-server-linux-x64-b8762.zip",
                "llama-server-linux-x64-cuda-b8762.zip",
                "llama-server-linux-x64-vulkan-b8762.zip",
                "llama-server-linux-arm64-b8762.zip",
                "llama-server-linux-arm64-cuda-b8762.zip",
                "llama-server-linux-armv7l-b8762.zip",
                "llama-server-win32-x64-b8762.zip",
                "llama-server-win32-x64-cuda-b8762.zip",
                "llama-server-win32-x64-vulkan-b8762.zip",
                "llama-server-win32-arm64-b8762.zip"
            ]);
    });

    test("builds the canonical runtime asset file name from build metadata", () => {
        expect(getLlamaServerGithubReleaseAssetFileNameForBuildMetadata({
            platform: "win",
            arch: "x64",
            gpu: false,
            llamaCpp: {
                repo: "ggml-org/llama.cpp",
                release: "b8762"
            }
        }))
            .toBe("llama-server-win32-x64-b8762.zip");
    });

    test("builds the armv7l runtime asset file name from build metadata", () => {
        expect(getLlamaServerGithubReleaseAssetFileNameForBuildMetadata({
            platform: "linux",
            arch: "armv7l",
            gpu: false,
            llamaCpp: {
                repo: "ggml-org/llama.cpp",
                release: "b8762"
            }
        }))
            .toBe("llama-server-linux-armv7l-b8762.zip");
    });

    test("builds the GitHub release asset download URL", () => {
        expect(getLlamaServerGithubReleaseTag("0.2.1"))
            .toBe("realtimex-v0.2.1");
        expect(getLlamaServerGithubReleaseAssetDownloadUrl("0.2.1", "llama-server-darwin-arm64-b8762.zip"))
            .toBe(
                "https://github.com/therealtimex/node-llama-cpp/releases/download/" +
                "realtimex-v0.2.1/llama-server-darwin-arm64-b8762.zip"
            );
    });
});
