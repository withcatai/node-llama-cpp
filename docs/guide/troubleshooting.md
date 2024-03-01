# Troubleshooting
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
