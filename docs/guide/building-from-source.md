---
description: Building llama.cpp from source for node-llama-cpp
---
# Building From Source
`node-llama-cpp` ships with pre-built binaries for macOS, Linux and Windows.

In case binaries are not available for your platform or fail to load,
it'll fallback to download a release of `llama.cpp` and build it from source with `cmake`.

## Downloading a Release
To download a release of `llama.cpp` and build it from source you can use the CLI [`source download`](../cli/source/download.md) command.

```shell
npx --no node-llama-cpp source download
```

::: tip NOTE

`node-llama-cpp` ships with a git bundle of the release of `llama.cpp` it was built with,
so when you run the [`source download`](../cli/source/download.md) command without specifying a specific release or repo,
it will use the bundled git bundle instead of downloading the release from GitHub.

This is useful for building from source on machines that aren't connected to the internet.

:::

::: info
If `cmake` is not installed on your machine, `node-llama-cpp` will automatically download `cmake` to an internal directory and try to use it to build `llama.cpp` from source.

If the build fails, make sure you have the required dependencies of `cmake` installed on your machine. More info is available [here](https://github.com/cmake-js/cmake-js#:~:text=projectRoot/build%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%5Bstring%5D-,Requirements%3A,-CMake) (you don't have to install `cmake` or `cmake-js`, just the dependencies).
:::

::: details Dependencies for macOS
If the build fails on macOS with the error `"/usr/bin/cc" is not able to compile a simple test program`,
try running this command to install the Xcode command line tools:
```shell
xcode-select --install
```
:::

::: details Dependencies for Windows x64
If the build fails on your machine, ensure you have all the necessary build tools installed.

You can install all the dependencies via [WinGet](https://learn.microsoft.com/en-us/windows/package-manager/winget/) using this command:
```shell
winget install --id Microsoft.VisualStudio.2022.BuildTools --force --override "--add Microsoft.VisualStudio.Component.VC.CMake.Project Microsoft.VisualStudio.Component.VC.CoreBuildTools Microsoft.VisualStudio.Component.VC.Tools.x86.x64 Microsoft.VisualStudio.Component.VC.ATL Microsoft.VisualStudio.Component.VC.ATLMFC Microsoft.VisualStudio.Component.VC.Llvm.ClangToolset Microsoft.VisualStudio.Component.VC.Llvm.Clang Microsoft.VisualStudio.Component.VC.Redist.14.Latest Microsoft.Component.VC.Runtime.UCRTSDK Microsoft.VisualStudio.Component.Windows10SDK Microsoft.VisualStudio.Component.Windows10SDK.20348"
```
> WinGet is built-in on Windows 11 and modern Windows 10 versions

---

You can also install all the dependencies manually using the [Visual C++ Build Tools installer](https://visualstudio.microsoft.com/visual-cpp-build-tools/):
* **`Workloads` tab:** select `Desktop development with C++`
* **`Individual components` tab**: select the following:
  * C++ ATL for latest v143 build tools (x86 & x64)
  * C++ MFC for latest v143 build tools (x86 & x64)
  * C++ CMake tools for Windows
  * C++ Clang Compiler for Windows
  * MSBuild support for LLVM (clang-cl) toolset
  * Windows Universal CRT SDK
:::

::: details Dependencies for Windows on Arm
On Windows on Arm you need to install additional build tools to build `llama.cpp` from source.

You can install all the dependencies via [WinGet](https://learn.microsoft.com/en-us/windows/package-manager/winget/) using this command:
```shell
winget install --id Microsoft.VisualStudio.2022.BuildTools --force --override "--add Microsoft.VisualStudio.Component.VC.CMake.Project Microsoft.VisualStudio.Component.VC.CoreBuildTools Microsoft.VisualStudio.Component.VC.Tools.x86.x64 Microsoft.VisualStudio.Component.VC.Tools.ARM64 Microsoft.VisualStudio.Component.VC.ATL Microsoft.VisualStudio.Component.VC.ATL.ARM64 Microsoft.VisualStudio.Component.VC.ATLMFC Microsoft.VisualStudio.Component.VC.MFC.ARM64 Microsoft.VisualStudio.Component.VC.Llvm.ClangToolset Microsoft.VisualStudio.Component.VC.Llvm.Clang Microsoft.VisualStudio.Component.VC.Redist.14.Latest Microsoft.Component.VC.Runtime.UCRTSDK Microsoft.VisualStudio.Component.Windows10SDK Microsoft.VisualStudio.Component.Windows10SDK.20348"
```
> WinGet is built-in on Windows 11 and modern Windows 10 versions

---

You can also install all the dependencies manually using the [Visual C++ Build Tools installer](https://visualstudio.microsoft.com/visual-cpp-build-tools/):
* **`Workloads` tab:** select `Desktop development with C++`
* **`Individual components` tab**: select the following:
  * MSVC v143 - VS 2022 C++ ARM64 build tools (latest)
  * C++ ATL for latest v143 build tools (ARM64/ARM64EC)
  * C++ MFC for latest v143 build tools (ARM64/ARM64EC)
  * C++ CMake tools for Windows
  * C++ Clang Compiler for Windows
  * MSBuild support for LLVM (clang-cl) toolset
  * Windows Universal CRT SDK
:::

## `source download` and `source build` Commands
The difference between the [`source download`](../cli/source/download.md) and [`source build`](../cli/source/build.md) commands
is that the `source download` command downloads a release of `llama.cpp` and builds it,
while the `source build` command builds the `llama.cpp` release that's already downloaded.

You can only use the `source build` command after you've already downloaded a release of `llama.cpp` with the `source download` command.

To only download a release of `llama.cpp` without building it, use the `source download` command with the `--skipBuild` option:
```shell
npx --no node-llama-cpp source download --skipBuild
```

## Building Inside Your App
The best way to use a customized build is by customizing the options passed to the [`getLlama`](../api/functions/getLlama.md).

If there's no existing binary that matches the provided options (either a local build or a pre-built binary),
it'll automatically download a release of `llama.cpp` (if it's not already downloaded) and build it from source.

You can pass custom cmake options you want the binary be compiled with by using the [`cmakeOptions`](../api/type-aliases/LlamaOptions.md#cmakeoptions) option:
```typescript
import {getLlama} from "node-llama-cpp";
// ---cut---
const llama = await getLlama({
    cmakeOptions: {
        OPTION_NAME: "OPTION_VALUE"
    },
    
    // force a build if the pre-built binary doesn't
    // match all the provided options, such as the cmakeOptions
    existingPrebuiltBinaryMustMatchBuildOptions: true
});
```

You can also force it to build a new binary by setting the [`build`](../api/type-aliases/LlamaOptions.md#build) option to `"forceRebuild"`:
```typescript
import {getLlama} from "node-llama-cpp";
// ---cut---
const llama = await getLlama({
    build: "forceRebuild"
});
```

::: info Electron support for building from source
When running in Electron, the [`build`](../api/type-aliases/LlamaOptions.md#build) option defaults to `"never"` as 
we cannot assume that the user has the necessary build tools installed on their machine, and the user won't be able to
see the build process to troubleshoot any issues that may arise.

You can manually set it to be `"auto"` to allow building from source in Electron.

When running from inside an Asar archive in Electron, building from source is not possible, so it'll never build from source.
To allow building from source in Electron apps, make sure you ship `node-llama-cpp` as an unpacked module.

If you want to use a build with custom cmake options in your Electron app,
make sure you build `node-llama-cpp` with your desired cmake options _before_ building your Electron app,
and make sure you pass the same cmake options to the [`getLlama`](../api/functions/getLlama.md) function in your Electron app so it'll use the binary you built.
:::

## Customizing the Build {#customize-build}
> **Meta:** To configure Metal support see the [Metal support guide](./Metal.md).
> 
> **CUDA:** To configure CUDA support see the [CUDA support guide](./CUDA.md).
> 
> **Vulkan:** To configure Vulkan support see the [Vulkan support guide](./Vulkan.md).

<script setup lang="ts">
import {data} from "./cmakeOptions.data.js";
const cmakeOptionsTable = data.cmakeOptionsTable;
const cmakeOptionsFileUrl = data.cmakeOptionsFileUrl;
</script>

`llama.cpp` has CMake build options that can be configured to customize the build.

:::details `llama.cpp` CMake build options

<div v-html="cmakeOptionsTable"></div>

> Source: <a :href="cmakeOptionsFileUrl">`CMakeLists`</a>

:::

To build `node-llama-cpp` with any of these options, set an environment variable of an option prefixed with `NODE_LLAMA_CPP_CMAKE_OPTION_` before running the [`source download`](../cli/source/download.md) or [`source build`](../cli/source/build.md) commands.

To use that customized build in your code, you can either use `getLlama("lastBuild")` to get the last build that was built,
or pass the code snippet that is printed after the build finishes.

## Downloading a Newer Release {#download-new-release}
Every new release of `node-llama-cpp` ships with the latest release of `llama.cpp` that was available at the time of the release,
so relying on the latest version of `node-llama-cpp` should be enough for most use cases.

However, you may want to download a newer release of `llama.cpp` ([`llama.cpp` releases](https://github.com/ggml-org/llama.cpp/releases))
and build it from source to get the latest features and bug fixes before a new version of `node-llama-cpp` is released.

A new release may contain breaking changes, so it won't necessarily work properly or even compile at all, so do this with caution.

You can do this by specifying the `--release` option with the release tag you want to download:
```shell
npx --no node-llama-cpp source download --release "b1350"
```

> You can find the release tag on the [`llama.cpp` releases page](https://github.com/ggml-org/llama.cpp/releases):

You can also opt to download the latest release available:
```shell
npx --no node-llama-cpp source download --release latest
```
