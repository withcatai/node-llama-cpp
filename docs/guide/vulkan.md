# Using Vulkan
> Vulkan is a low-overhead, cross-platform 3D graphics and computing API

`node-llama-cpp` ships with prebuilt binaries with Vulkan support for Windows and Linux, and these are automatically used when Vulkan support is detected on your machine.

**Windows:** Vulkan drivers are usually provided together with your GPU drivers, so most chances are that you don't have to install anything.

**Linux:** you have to [install the Vulkan SDK](#vulkan-sdk-ubuntu).

## Testing Vulkan support
To check whether the Vulkan support works on your machine, run this command:
```bash
npx --no node-llama-cpp inspect gpu
```

You should see an output like this:
```ansi
[33mVulkan:[39m [32mavailable[39m

[33mVulkan device:[39m Apple M1 Max[39m
[33mVulkan used VRAM:[39m 0% [90m(64KB/21.33GB)[39m
[33mVulkan free VRAM:[39m 99.99% [90m(21.33GB/21.33GB)[39m

[33mCPU model:[39m Apple M1 Max[39m
[33mUsed RAM:[39m 97.37% [90m(31.16GB/32GB)[39m
[33mFree RAM:[39m 2.62% [90m(860.72MB/32GB)[39m
```

If you see `Vulkan used VRAM` in the output, it means that Vulkan support is working on your machine.

## Building `node-llama-cpp` with Vulkan support
### Prerequisites
* [`cmake-js` dependencies](https://github.com/cmake-js/cmake-js#:~:text=projectRoot/build%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%5Bstring%5D-,Requirements%3A,-CMake)
* [CMake](https://cmake.org/download/) 3.26 or higher (optional, recommended if you have build issues)
* <a id="vulkan-sdk" />[Vulkan SDK](https://vulkan.lunarg.com/sdk/home):
  >
  #### Windows: [Vulkan SDK installer](https://sdk.lunarg.com/sdk/download/latest/windows/vulkan-sdk.exe) {#vulkan-sdk-windows}
  >
  #### Ubuntu {#vulkan-sdk-ubuntu}
  ::: code-group
  
  ```bash [Ubuntu 22.04]
  wget -qO- https://packages.lunarg.com/lunarg-signing-key-pub.asc | sudo tee /etc/apt/trusted.gpg.d/lunarg.asc
  sudo wget -qO /etc/apt/sources.list.d/lunarg-vulkan-jammy.list https://packages.lunarg.com/vulkan/lunarg-vulkan-jammy.list
  sudo apt update
  sudo apt install vulkan-sdk
  ```
  
  ```bash [Ubuntu 20.04]
  wget -qO - https://packages.lunarg.com/lunarg-signing-key-pub.asc | sudo apt-key add -
  sudo wget -qO /etc/apt/sources.list.d/lunarg-vulkan-focal.list https://packages.lunarg.com/vulkan/lunarg-vulkan-focal.list
  sudo apt update
  sudo apt install vulkan-sdk
  ```
  
  :::

## Building from source
When you use the [`getLlama`](../api/functions/getLlama) method, if there's no binary that matches the provided options, it'll automatically build `llama.cpp` from source.

Manually building from source using the [`download`](./cli/download) command is recommended for troubleshooting build issues.

To manually build from source, run this command inside of your project:
```bash
npx --no node-llama-cpp download --gpu vulkan
```

> If `cmake` is not installed on your machine, `node-llama-cpp` will automatically download `cmake` to an internal directory and try to use it to build `llama.cpp` from source.

> If you see the message `Vulkan not found` during the build process,
> it means that the Vulkan SDK is not installed on your machine or that it is not detected by the build process.

## Using `node-llama-cpp` with Vulkan
It's recommended to use [`getLlama`](../api/functions/getLlama) without specifying a GPU type, so it'll detect the available GPU types and use the best one automatically.

To do this, just use [`getLlama`](../api/functions/getLlama) without any parameters:
```typescript
import {getLlama} from "node-llama-cpp";

const llama = await getLlama();
```

To force it to use Vulkan, you can use the [`gpu`](../api/type-aliases/LlamaOptions#gpu) option:
```typescript
import {getLlama} from "node-llama-cpp";

const llama = await getLlama({
    gpu: "vulkan"
});
```
To configure how much layers of the model are run on the GPU, configure `gpuLayers` on `LlamaModel` in your code:
```typescript
const model = await llama.loadModel({
    modelPath,
    gpuLayers: 64 // or any other number of layers you want
});
```

You'll see logs like these in the console when the model loads:
```
llm_load_tensors: ggml ctx size =    0.09 MB
llm_load_tensors: mem required  =   41.11 MB (+ 2048.00 MB per state)
llm_load_tensors: offloading 32 repeating layers to GPU
llm_load_tensors: offloading non-repeating layers to GPU
llm_load_tensors: offloading v cache to GPU
llm_load_tensors: offloading k cache to GPU
llm_load_tensors: offloaded 35/35 layers to GPU
llm_load_tensors: VRAM used: 4741 MB
```

On Linux, you can monitor GPU usage with this command:
```bash
watch -d "npx --no node-llama-cpp inspect gpu"
```
