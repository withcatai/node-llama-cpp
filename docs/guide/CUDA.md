---
outline: [2, 3]
description: CUDA support in node-llama-cpp
---
# CUDA Support
> CUDA is a parallel computing platform and API created by NVIDIA for NVIDIA GPUs

`node-llama-cpp` ships with pre-built binaries with CUDA support for Windows and Linux,
and these are automatically used when CUDA is detected on your machine.

To use `node-llama-cpp`'s CUDA support with your NVIDIA GPU,
make sure you have [CUDA Toolkit](https://developer.nvidia.com/cuda-downloads) 12.4 or higher installed on your machine.

If the pre-built binaries don't work with your CUDA installation,
`node-llama-cpp` will automatically download a release of `llama.cpp` and build it from source with CUDA support.
Building from source with CUDA support is slow and can take up to an hour.

The pre-built binaries are compiled with CUDA Toolkit 12.4,
so any version of CUDA Toolkit that is 12.4 or higher should work with the pre-built binaries.
If you have an older version of CUDA Toolkit installed on your machine,
consider updating it to avoid having to wait the long build time.

## Testing CUDA Support
To check whether the CUDA support works on your machine, run this command:
```shell
npx --no node-llama-cpp inspect gpu
```

You should see an output like this:
```ansi
[33mCUDA:[39m [32mavailable[39m

[33mCUDA device:[39m NVIDIA RTX A6000[39m
[33mCUDA used VRAM:[39m 0.54% [90m(266.88MB/47.65GB)[39m
[33mCUDA free VRAM:[39m 99.45% [90m(47.39GB/47.65GB)[39m

[33mCPU model:[39m Intel(R) Xeon(R) Gold 5315Y CPU @ 3.20GHz[39m
[33mUsed RAM:[39m 2.51% [90m(1.11GB/44.08GB)[39m
[33mFree RAM:[39m 97.48% [90m(42.97GB/44.08GB)[39m
```

If you see `CUDA used VRAM` in the output, it means that CUDA support is working on your machine.

## Prerequisites
* [CUDA Toolkit](https://developer.nvidia.com/cuda-downloads) 12.4 or higher
* [NVIDIA Drivers](https://www.nvidia.com/en-us/drivers/)
* [`cmake-js` dependencies](https://github.com/cmake-js/cmake-js#:~:text=projectRoot/build%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%5Bstring%5D-,Requirements%3A,-CMake)
* [CMake](https://cmake.org/download/) 3.26 or higher (optional, recommended if you have build issues)

## Manually Building `node-llama-cpp` With CUDA Support {#building}
Run this command inside of your project:
```shell
npx --no node-llama-cpp source download --gpu cuda
```

> If `cmake` is not installed on your machine, `node-llama-cpp` will automatically download `cmake` to an internal directory and try to use it to build `llama.cpp` from source.

> If you see the message `CUDA not found` during the build process,
> it means that CUDA Toolkit is not installed on your machine or that it is not detected by the build process.

### Custom `llama.cpp` CMake Options
<script setup lang="ts">
import {data} from "./cmakeOptions.data.js";
const cmakeOptionsFileUrl = data.cmakeOptionsFileUrl;
const cudaCmakeOptionsTable = data.cudaCmakeOptionsTable;
</script>

`llama.cpp` has some options you can use to customize your CUDA build.

:::details `llama.cpp` CUDA CMake build options

<div v-html="cudaCmakeOptionsTable"></div>

> Source: <a :href="cmakeOptionsFileUrl">`CMakeLists`</a> (filtered for only CUDA-related options)
> 
> You can see all the available `llama.cpp` CMake build options [here](../guide/building-from-source.md#customize-build)

:::

To build `node-llama-cpp` with any of these options, set an environment variable of an option prefixed with `NODE_LLAMA_CPP_CMAKE_OPTION_`.

### Fix the `Failed to detect a default CUDA architecture` Build Error
To fix this issue you have to set the `CUDACXX` environment variable to the path of the `nvcc` compiler,
and the `CUDA_PATH` environment variable to the path of the CUDA home directory that contains the `nvcc` compiler.

For example, if you have installed CUDA Toolkit 12.4, you have to run a command like this:
::: code-group
```shell [Linux]
export CUDACXX=/usr/local/cuda-12.4/bin/nvcc
export CUDA_PATH=/usr/local/cuda-12.4
```

```cmd [Windows (cmd)]
set CUDACXX=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\bin\nvcc.exe
set CUDA_PATH=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4
```

```cmd [Windows (PowerShell)]
$env:CUDACXX="C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\bin\nvcc.exe"
$env:CUDA_PATH="C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4"
```
:::

Then run the build command again to check whether setting the `CUDACXX` and `CUDA_PATH` environment variables fixed the issue.

### Fix the `The CUDA compiler identification is unknown` Build Error
The solution to this error is the same as [the solution to the `Failed to detect a default CUDA architecture` error](#fix-the-failed-to-detect-a-default-cuda-architecture-build-error).

### Fix the `A single input file is required for a non-link phase when an outputfile is specified` Build Error
To fix this issue you have to set the `CMAKE_GENERATOR_TOOLSET` cmake option to the CUDA home directory, usually already set as the `CUDA_PATH` environment variable.

To do this, set the `NODE_LLAMA_CPP_CMAKE_OPTION_CMAKE_GENERATOR_TOOLSET` environment variable to the path of your CUDA home directory:

::: code-group
```shell [Linux]
export NODE_LLAMA_CPP_CMAKE_OPTION_CMAKE_GENERATOR_TOOLSET=$CUDA_PATH
```

```cmd [Windows (cmd)]
set NODE_LLAMA_CPP_CMAKE_OPTION_CMAKE_GENERATOR_TOOLSET=%CUDA_PATH%
```

```cmd [Windows (PowerShell)]
$env:NODE_LLAMA_CPP_CMAKE_OPTION_CMAKE_GENERATOR_TOOLSET=$env:CUDA_PATH
```
:::

Then run the build command again to check whether setting the `CMAKE_GENERATOR_TOOLSET` cmake option fixed the issue.

### Fix the `forward compatibility was attempted on non supported HW` Error {#fix-cuda-forward-compatibility}
This error usually happens when the CUDA version you have installed on your machine is older than the CUDA version used in the prebuilt binaries supplied by `node-llama-cpp`.

To resolve this issue, you can either [update your CUDA installation](https://developer.nvidia.com/cuda-downloads) to the latest version (recommended) or [build `node-llama-cpp` on your machine](#building) against the CUDA version you have installed.

### Fix the `Binary GPU type mismatch. Expected: cuda, got: false` Error {#fix-cuda-gpu-type-mismatch}
This error usually happens when you have multiple conflicting CUDA versions installed on your machine.

To fix it, uninstall older CUDA versions and restart your machine (important).

:::: details Check which CUDA libraries are picked up by `node-llama-cpp`'s prebuilt binaries on your machine

Run this command inside of your project:

::: code-group
```shell [Linux]
ldd ./node_modules/@node-llama-cpp/linux-x64-cuda/bins/linux-x64-cuda/libggml-cuda.so
```

```cmd [Windows (cmd)]
"C:\Program Files\Git\usr\bin\ldd.exe" node_modules\@node-llama-cpp\win-x64-cuda\bins\win-x64-cuda\ggml-cuda.dll
```

```cmd [Windows (PowerShell)]
& "C:\Program Files\Git\usr\bin\ldd.exe" node_modules\@node-llama-cpp\win-x64-cuda\bins\win-x64-cuda\ggml-cuda.dll
```
:::

::::

### Fix the `ggml_cuda_init: failed to initialize CUDA: (null)` Error {#fix-failed-to-initialize-cuda-null}
This error usually happens when the NVIDIA drivers installed on your machine are incompatible with the version of CUDA you have installed.

To fix it, update your NVIDIA drivers to the latest version from the [NVIDIA Driver Downloads](https://www.nvidia.com/en-us/drivers/) page.


## Using `node-llama-cpp` With CUDA
It's recommended to use [`getLlama`](../api/functions/getLlama) without specifying a GPU type,
so it'll detect the available GPU types and use the best one automatically.

To do this, just use [`getLlama`](../api/functions/getLlama) without any parameters:
```typescript
import {getLlama} from "node-llama-cpp";
// ---cut---
const llama = await getLlama();
console.log("GPU type:", llama.gpu);
```

To force it to use CUDA, you can use the [`gpu`](../api/type-aliases/LlamaOptions#gpu) option:
```typescript
import {getLlama} from "node-llama-cpp";
// ---cut---
const llama = await getLlama({
    gpu: "cuda"
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
    gpu: "cuda"
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
watch -d nvidia-smi
```
