# Building from source
`node-llama-cpp` ships with pre-built binaries for macOS, Linux and Windows.

In case binaries are not available for your platform or fail to load,
it'll fallback to download a release of `llama.cpp` and build it from source with `cmake`.

## Downloading a release
To download a release of `llama.cpp` and build it from source you can use the [CLI `download` command](./cli/download.md).

```shell
npx --no node-llama-cpp download
```

::: tip NOTE

`node-llama-cpp` ships with a git bundle of the release of `llama.cpp` it was built with,
so when you run the [`download`](./cli/download.md) command without specifying a specific release or repo,
it will use the bundled git bundle instead of downloading the release from GitHub.

This is useful for building from source on machines that aren't connected to the internet.

:::

::: info

If `cmake` is not installed on your machine, `node-llama-cpp` will automatically download `cmake` to an internal directory and try to use it to build `llama.cpp` from source.

If the build fails, make sure you have the required dependencies of `cmake` installed on your machine. More info is available [here](https://github.com/cmake-js/cmake-js#:~:text=projectRoot/build%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%5Bstring%5D-,Requirements%3A,-CMake) (you don't have to install `cmake` or `cmake-js`, just the dependencies).

If the build fails on macOS with the error `"/usr/bin/cc" is not able to compile a simple test program`, try running `xcode-select --install` to install the Xcode command line tools.

:::

## `download` and `build` commands
The difference between the [`download`](./cli/download.md) and [`build`](./cli/build.md) commands
is that the `download` command downloads a release of `llama.cpp` and builds it,
while the `build` command builds the `llama.cpp` release that's already downloaded.

You can only use the `build` command after you've already downloaded a release of `llama.cpp` with the `download` command.

To only download a release of `llama.cpp` without building it, use the `download` command with the `--skipBuild` option:
```shell
npx --no node-llama-cpp download --skipBuild
```

## Customizing the build
> **Meta:** To configure Metal support see the [Metal support guide](./Metal.md).
> 
> **CUDA:** To configure CUDA support see the [CUDA support guide](./CUDA.md).

`llama.cpp` has cmake build options that can be configured to customize the build.
You can find documentation for these options [here](https://github.com/ggerganov/llama.cpp#blas-build).

To build `node-llama-cpp` with any of these options, set an environment variable of an option prefixed with `NODE_LLAMA_CPP_CMAKE_OPTION_` before running the [`download`](./cli/download.md) or [`build`](./cli/build.md) commands.

## Downloading a newer release
Every new release of `node-llama-cpp` ships with the latest release of `llama.cpp` that was available at the time of the release,
so relying on the latest version of `node-llama-cpp` should be enough for most use cases.

However, you may want to download a newer release of `llama.cpp` ([`llama.cpp` releases](https://github.com/ggerganov/llama.cpp/releases))
and build it from source to get the latest features and bug fixes before a new version of `node-llama-cpp` is released.

A new release may contain breaking changes, so it won't necessarily work properly or even compile at all, so do this with caution.

You can do this by specifying the `--release` option with the release tag you want to download:
```shell
npx --no node-llama-cpp download --release "b1350"
```

> You can find the release tag on the [`llama.cpp` releases page](https://github.com/ggerganov/llama.cpp/releases):

You can also opt to download the latest release available:
```shell
npx --no node-llama-cpp download --release latest
```
