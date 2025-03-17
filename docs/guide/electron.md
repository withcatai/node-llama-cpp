---
description: Using node-llama-cpp in Electron applications
---
# Using in Electron
`node-llama-cpp` is fully supported in [Electron](https://www.electronjs.org), and also includes custom Electron-specific adaptations.

You can only use `node-llama-cpp` on the main process in Electron applications.
Trying to use `node-llama-cpp` on a renderer process will crash the application.

You can scaffold an example Electron app that uses `node-llama-cpp` with complete configuration for packaging and distribution by running the following command:
```shell
npm create node-llama-cpp@latest -- --template electron-typescript-react
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

## Cross Compilation
Cross packaging from one platform to another is not supported, since binaries for other platforms are not downloaded to your machine when you run `npm install`.

Packaging an `arm64` app on an `x64` machine is supported, but packaging an `x64` app on an `arm64` machine is not.

::: details GitHub Actions template for cross-compilation

<span v-pre>

```yml
name: Build
on: [push]

jobs:
  build-electron:
    name: Build Electron app - ${{ matrix.config.name }}
    runs-on: ${{ matrix.config.os }}
    strategy:
      fail-fast: false
      matrix:
        config:
          - name: "Windows"
            os: windows-2022
          - name: "Ubuntu"
            os: ubuntu-22.04
          - name: "macOS"
            os: macos-13

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies on Ubuntu
        if: matrix.config.name == 'Ubuntu'
        run: |
          sudo apt-get update
          sudo apt-get install libarchive-tools rpm
          sudo snap install snapcraft --classic

      - name: Install modules
        run: npm ci

      - name: Build electron app
        id: build
        shell: bash
        timeout-minutes: 480
        run: npm run build

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          include-hidden-files: true
          name: "electron-app-${{ matrix.config.name }}"
          path: "./release"
```

</span>

:::

## Bundling
When bundling your code for Electron using [Electron Vite](https://electron-vite.org) or Webpack,
ensure that `node-llama-cpp` is not bundled, and is instead treated as an external module.

Marking `node-llama-cpp` as an external module will prevent its code from being bundled with your application code,
and instead, it'll be loaded from the `node_modules` directory at runtime (which should be packed into a `.asar` archive).

The file structure of `node-llama-cpp` is crucial for it to function correctly,
so bundling it will break its functionality.
Moreover, since `node-llama-cpp` includes prebuilt binaries (and also local builds from source),
those files must be retained in their original structure for it to work.

Electron has [its own bundling solution called ASAR](https://www.electronjs.org/docs/latest/tutorial/asar-archives) that is designed to work with node modules.
ASAR retains the original file structure of node modules by packing all the files into a single `.asar` archive file that Electron will read from at runtime like it would from the file system.
This method ensures node modules work as intended in Electron applications, even though they are bundled into a single file.

Using ASAR is the recommended way to bundle `node-llama-cpp` in your Electron app.

If you're using the scaffolded Electron app, this is already taken care of.

::: tip NOTE
We recommend using [Electron Vite](https://electron-vite.org) over Webpack for your Electron app due to to Vite's speed and Webpack's lack of proper ESM support in the output bundle, which complicates the bundling process.
:::
