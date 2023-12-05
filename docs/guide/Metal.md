# Metal support
Metal support is enabled by default on macOS.

The pre-built binaries of `node-llama-cpp` for macOS are built with Metal support enabled, and when building from source on macOS,
Metal support is enabled by default.

If you're using a Mac with an Intel chip, you might want to disable Metal support if you're experiencing issues with it.

## Disabling Metal support
### Prerequisites
* [`cmake-js` dependencies](https://github.com/cmake-js/cmake-js#:~:text=projectRoot/build%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%5Bstring%5D-,Requirements%3A,-CMake)
* [CMake](https://cmake.org/download/) 3.26 or higher (optional, recommended if you have build issues)

### Building `node-llama-cpp` with Metal support disabled
Run this command inside of your project:
```bash
npx --no node-llama-cpp download --no-metal
```

> If `cmake` is not installed on your machine, `node-llama-cpp` will automatically download `cmake` to an internal directory and try to use it to build `llama.cpp` from source.

You can optionally disable `metal` by setting `NODE_LLAMA_CPP_METAL` in your script before importing or executing `node-llama-cpp`.
```bash
NODE_LLAMA_CPP_METAL=false node your-script.js
```
```javascript
// Set dynamically during execution via dynamic import.
// Will build at runtime.
process.env.NODE_LLAMA_CPP_METAL = false;
const LlamaModel = (...args) => import("node-llama-cpp").then(({ LlamaModel }) => new LlamaModel(...args));
const model = await LlamaModel({
  modelPath: path.join(__dirname, "downloaded-model.gguf"),
});
```