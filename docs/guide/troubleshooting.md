---
outline: [2, 3]
description: Troubleshooting common issues with node-llama-cpp
---
# Troubleshooting
## ESM Usage
`node-llama-cpp` is an [ES module](https://nodejs.org/api/esm.html#modules-ecmascript-modules), so can only use `import` to load it and cannot use [`require`](https://nodejs.org/docs/latest-v18.x/api/esm.html#require:~:text=Using%20require%20to%20load%20an%20ES%20module%20is%20not%20supported%20because%20ES%20modules%20have%20asynchronous%20execution.%20Instead%2C%20use%20import()%20to%20load%20an%20ES%20module%20from%20a%20CommonJS%20module.).

Since the Node.js ecosystem is transitioning to ESM, it's recommended to use it in your project.

To do so, make sure your `package.json` file has `"type": "module"` in it.

### Using in CommonJS
If you cannot use ESM in your project, you can still use the `import` function from a CommonJS module to load `node-llama-cpp`:
```typescript
async function myLogic() {
    const {getLlama} = await import("node-llama-cpp");
}

myLogic();
```

If your `tsconfig.json` is configured to transpile `import` statements into `require` function calls automatically,
you can use this workaround to `import` `node-llama-cpp`:
```typescript
async function myLogic() {
    const nlc: typeof import("node-llama-cpp") = await Function('return import("node-llama-cpp")')();
    const {getLlama} = nlc;
    
    const llama = await getLlama();
}

myLogic();
```


## Investigating Unexpected `llama.cpp` Behavior
If you notice some unexpected behavior or crashes in your application, you should enable debug logs to see more information about what's happening.

To do so, enable the [`debug`](../api/type-aliases/LlamaOptions.md#debug) option when calling [`getLlama`](../api/functions/getLlama.md):
```typescript
import {getLlama} from "node-llama-cpp";
// ---cut---
const llama = await getLlama({
    debug: true
});
```

Alternatively, you can set the environment variable `NODE_LLAMA_CPP_DEBUG` to `true`.


## Running in Termux
In Termux, the prebuilt binaries cannot be used due to the custom linker used by it.

To allow `node-llama-cpp` to build the binaries, install the required packages first:
```bash
pkg update
pkg install nodejs git cmake clang libxml2
```

For Vulkan support, also install the following packages:
```bash
pkg install vulkan-tools vulkan-loader-android vulkan-headers vulkan-extension-layer
```
> Note that your device GPU may not support the required capabilities that `llama.cpp` requires, so it may not work.
> 
> If that happens, disable Vulkan in your code or uninstall the Vulkan packages.


## Crashes With an `illegal hardware instruction` Error or a `SIGILL` Signal {#illegal-hardware-instruction}
A common cause for this issue is when the installed nodejs architecture is different from the host machine CPU architecture.

For example, having an x64 nodejs installed on an arm64 machine (such as Apple Silicon Macs).

To check whether this is the case, run this command to see what architecture is used for the nodejs you have installed:
```shell
node -e "console.log(process.platform, process.arch)"
```

## Getting Invalid Responses Using a Qwen or Qwen2 Model
If you're getting invalid or gibberish responses when using CUDA with a Qwen or Qwen2 model,
try [enabling flash attention](../guide/tips-and-tricks#flash-attention) to fix the issue.

## Getting an [`InsufficientMemoryError`](../api/classes/InsufficientMemoryError.md) Error
Getting an [`InsufficientMemoryError`](../api/classes/InsufficientMemoryError.md) error means you're trying to load a model
or create a context with a specific configuration that requires more memory than the available VRAM in your GPU.

This usually happens when you specify a specific [`gpuLayers`](../api/type-aliases/LlamaModelOptions.md#gpulayers) when loading a model,
or using a specific [`contextSize`](../api/type-aliases/LlamaContextOptions.md#contextsize) when creating a context.

The solution to this issue is to remove these settings to let `node-llama-cpp` find the optimal configuration that works on your machine
to load the model with and create a context with.

Give this code, you should remove the marked lines:
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(
    fileURLToPath(import.meta.url)
);
const modelPath = path.join(__dirname, "my-model.gguf");
// ---cut---
const llama = await getLlama();
const model = await llama.loadModel({
    modelPath,
    gpuLayers: "max" // [!code --]
});
const context = await model.createContext({
    contextSize: 128000 // [!code --]
});
```

### Getting an [`InsufficientMemoryError`](../api/classes/InsufficientMemoryError.md) Error Although Enough VRAM is available
If you're getting an [`InsufficientMemoryError`](../api/classes/InsufficientMemoryError.md) error even though you're certain you have enough VRAM available in your GPU,
it may have to do with the way the memory usage is estimated.

`node-llama-cpp` has a built-in memory estimation mechanism that estimates the memory required for the model to run on the GPU in order to find the optimal configuration to load a model with and create a context with.
This estimation is important also to make sure the model is loaded with parameters that won't crash the process.

However, this estimation may be inaccurate and exaggerated in some cases,
or a recent change in `llama.cpp` may not have been accounted for in the estimation.

To check whether this is the case, you can run the [`inspect measure`](../cli/inspect/measure.md) command to compare the estimated memory usage with the actual memory usage:
```shell
npx --no node-llama-cpp inspect measure [modelPath]
```

To work around this issue, you can force `node-llama-cpp` to ignore the memory safeguards and load the model anyway by setting the `ignoreMemorySafetyChecks` options to `true`:
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(
    fileURLToPath(import.meta.url)
);
const modelPath = path.join(__dirname, "my-model.gguf");
// ---cut---
const llama = await getLlama();
const model = await llama.loadModel({
    modelPath,
    ignoreMemorySafetyChecks: true
});
const context = await model.createContext({
    ignoreMemorySafetyChecks: true
});
```

> **Important:** Use `ignoreMemorySafetyChecks` with caution, as it may cause the process to crash if the memory usage exceeds the available VRAM

If you found that the memory estimation is indeed inaccurate,
please [open a new issue on GitHub](https://github.com/withcatai/node-llama-cpp/issues/new/choose) with a link to the model you're using and the output of the [`inspect measure`](../cli/inspect/measure.md) command.

## Getting an `The specified module could not be found \\?\C:\Users\Administrator\AppData\Roaming\npm\node_modules` Error on a Windows Machine
The common cause for this issue is when using the `Administrator` to run `npm install` and then trying to run the code with a different user.

Ensure you're not using the `Administrator` user for `npm install` nor to run the code.

## Getting an `EPERM: operation not permitted` Error on a Windows Machine When Building an Electron App
`electron-builder` needs to create symlinks to perform the build process, which requires enabling Developer Mode on Windows.

To do that, go to `Settings > Update & Security > For developers` and enable `Developer mode`.

After that, delete the `.cache` folder under your user directory and try building the app again.
