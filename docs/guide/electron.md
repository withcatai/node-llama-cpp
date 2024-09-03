# Using in Electron
`node-llama-cpp` is fully supported in [Electron](https://www.electronjs.org), and also includes custom Electron-specific adaptations.

You can only use `node-llama-cpp` on the main process in Electron applications.
Trying to use `node-llama-cpp` on a renderer process will crash the application.

You can scaffold an example Electron app that uses `node-llama-cpp` with complete configuration for packaging and distribution by running the following command:
```shell
npm create node-llama-cpp@latest --template electron-typescript-react
```

::: tip
Even if you intend to integrate `node-llama-cpp` into your existing Electron app,
it's still recommended that you scaffold a new Electron project and investigate the `electron-builder.ts` file
to see how to configure your existing Electron app to work well with `node-llama-cpp`.
:::

## Electron Support
In Electron, when there's no binary available for the current platform,
`node-llama-cpp` won't build from source by default,
since we cannot assume that the user has the necessary build tools installed.

You can customize this behavior by using the [`build`](../api/type-aliases/LlamaOptions.md#build) option when calling [`getLlama`](../api/functions/getLlama.md).

When running from an asar archive, building from source is always disabled, since the asar archive is read-only.

It's important to make sure that the native binaries are not packed into the asar archive.
If you're using the scaffolded Electron app, this is already taken care of.

## Customizing Prebuilt Binaries
If you'd like to use `llama.cpp` with custom CMake build options,
you need to build all the binaries you want to ship to users before packaging your Electron app.
You also need to call [`getLlama`](../api/functions/getLlama.md) with the CMake build options you used to build the binaries,
so that `node-llama-cpp` can find them.

Cross packaging from one platform to another is not supported, since binaries for other platforms are not downloaded to you machine when your run `npm install`.

Packaging an `arm64` app on an `x64` machine is supported, but packaging an `x64` app on an `arm64` machine is not.
