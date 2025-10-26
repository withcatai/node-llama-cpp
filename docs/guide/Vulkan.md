---
outline: [2, 3]
description: Vulkan support in node-llama-cpp
---
# Using Vulkan
> Vulkan is a low-overhead, cross-platform 3D graphics and computing API

`node-llama-cpp` ships with pre-built binaries with Vulkan support for Windows and Linux, and these are automatically used when Vulkan support is detected on your machine.

**Windows:** Vulkan drivers are usually provided together with your GPU drivers, so most chances are that you don't have to install anything.

**Linux:** you have to [install the Vulkan SDK](#vulkan-sdk-ubuntu).

## Testing Vulkan Support
To check whether the Vulkan support works on your machine, run this command:
```shell
npx --no node-llama-cpp inspect gpu
```

You should see an output like this:
```ansi
[33mVulkan:[39m [32mavailable[39m

[33mVulkan device:[39m NVIDIA RTX A6000[39m
[33mVulkan used VRAM:[39m 0% [90m(0B/47.99GB)[39m
[33mVulkan free VRAM:[39m 100% [90m(47.99GB/47.99GB)[39m

[33mCPU model:[39m Intel(R) Xeon(R) Gold 5315Y CPU @ 3.20GHz[39m
[33mUsed RAM:[39m 2.51% [90m(1.11GB/44.08GB)[39m
[33mFree RAM:[39m 97.48% [90m(42.97GB/44.08GB)[39m
```

If you see `Vulkan used VRAM` in the output, it means that Vulkan support is working on your machine.

## Building `node-llama-cpp` With Vulkan Support {#building}
### Prerequisites
* [`cmake-js` dependencies](https://github.com/cmake-js/cmake-js#:~:text=projectRoot/build%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%5Bstring%5D-,Requirements%3A,-CMake)
* [CMake](https://cmake.org/download/) 3.26 or higher (optional, recommended if you have build issues)
* <a id="vulkan-sdk" />[Vulkan SDK](https://vulkan.lunarg.com/sdk/home):
  >
  #### Windows: [Vulkan SDK installer](https://sdk.lunarg.com/sdk/download/latest/windows/vulkan-sdk.exe) {#vulkan-sdk-windows}
  >
  #### Ubuntu {#vulkan-sdk-ubuntu}
  ::: code-group
  
  ```shell [Ubuntu 24.04]
  wget -qO- https://packages.lunarg.com/lunarg-signing-key-pub.asc | sudo tee /etc/apt/trusted.gpg.d/lunarg.asc
  sudo wget -qO /etc/apt/sources.list.d/lunarg-vulkan-noble.list https://packages.lunarg.com/vulkan/lunarg-vulkan-noble.list
  sudo apt update
  sudo apt install vulkan-sdk
  ```
  
  ```shell [Ubuntu 22.04]
  wget -qO- https://packages.lunarg.com/lunarg-signing-key-pub.asc | sudo tee /etc/apt/trusted.gpg.d/lunarg.asc
  sudo wget -qO /etc/apt/sources.list.d/lunarg-vulkan-jammy.list https://packages.lunarg.com/vulkan/lunarg-vulkan-jammy.list
  sudo apt update
  sudo apt install vulkan-sdk
  ```
  
  :::

* :::details Windows only: enable long paths support
  Open cmd as Administrator and run this command:
  ```shell
  reg add "HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\FileSystem" /v "LongPathsEnabled" /t REG_DWORD /d "1" /f  
  ```
  :::
* :::details Windows only: LLVM (optional, recommended if you have build issues)
  There are a few methods to install LLVM:
  * **As part of Microsoft Visual C++ Build Tools (Recommended):** the dependencies for Window listed under [Downloading a Release](./building-from-source.md#downloading-a-release) will also install LLVM.
  * **Independently:** visit the [latest LLVM release page](https://github.com/llvm/llvm-project/releases/latest) and download the installer for your Windows architecture.
  :::

### Building From Source
When you use the [`getLlama`](../api/functions/getLlama) method, if there's no binary that matches the provided options, it'll automatically build `llama.cpp` from source.

Manually building from source using the [`source download`](../cli/source/download.md) command is recommended for troubleshooting build issues.

To manually build from source, run this command inside of your project:
```shell
npx --no node-llama-cpp source download --gpu vulkan
```

> If `cmake` is not installed on your machine, `node-llama-cpp` will automatically download `cmake` to an internal directory and try to use it to build `llama.cpp` from source.

> If you see the message `Vulkan not found` during the build process,
> it means that the Vulkan SDK is not installed on your machine or that it is not detected by the build process.

## Using `node-llama-cpp` With Vulkan
It's recommended to use [`getLlama`](../api/functions/getLlama) without specifying a GPU type,
so it'll detect the available GPU types and use the best one automatically.

To do this, just use [`getLlama`](../api/functions/getLlama) without any parameters:
```typescript
import {getLlama} from "node-llama-cpp";
// ---cut---
const llama = await getLlama();
console.log("GPU type:", llama.gpu);
```

To force it to use Vulkan, you can use the [`gpu`](../api/type-aliases/LlamaOptions#gpu) option:
```typescript
import {getLlama} from "node-llama-cpp";
// ---cut---
const llama = await getLlama({
    gpu: "vulkan"
});
console.log("GPU type:", llama.gpu);
```

By default, `node-llama-cpp` will offload as many layers of the model to the GPU as it can fit in the VRAM.

To force it to offload a specific number of layers, you can use the [`gpuLayers`](../api/type-aliases/LlamaModelOptions.md#gpulayers) option:
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelPath = path.join(__dirname, "my-model.gguf")

const llama = await getLlama({
    gpu: "vulkan"
});

// ---cut---
const model = await llama.loadModel({
    modelPath,
    gpuLayers: 33 // or any other number of layers you want
});
```

::: warning
Attempting to offload more layers to the GPU than the available VRAM can fit will result in an [`InsufficientMemoryError`](../api/classes/InsufficientMemoryError.md) error.
:::

On Linux, you can monitor GPU usage with this command:
```shell
watch -d "npx --no node-llama-cpp inspect gpu"
```

## Vulkan Caveats
[At the moment](https://github.com/ggml-org/llama.cpp/issues/7575),
Vulkan doesn't work well when using multiple contexts at the same time,
so it's recommended to use a single context with Vulkan,
and to manually dispose a context (using [`.dispose()`](../api/classes/LlamaContext.md#dispose)) before creating a new one.

CUDA is always preferred by [`getLlama`](../api/functions/getLlama.md) by default when it's available,
so you may not encounter this issue at all.

If you'd like to make sure Vulkan isn't used in your project, you can do this:
```typescript
import {getLlama} from "node-llama-cpp";
// ---cut---
const llama = await getLlama({
    gpu: {
        type: "auto",
        exclude: ["vulkan"]
    }
});
```
