---
outline: [2, 3]
---
# Troubleshooting
## ESM usage
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
    const {getLlama} = await Function('return import("node-llama-cpp")')();
}

myLogic();
```

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
