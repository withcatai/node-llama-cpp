---
outline: deep
description: "'source download' command reference"
---
# `source download` command

<script setup lang="ts">
import {data as docs} from "../cli.data.js";
const commandDoc = docs.source.download;
</script>

<p v-html="commandDoc.description"></p>

::: tip NOTE

`node-llama-cpp` ships with a git bundle of the release of `llama.cpp` it was built with,
so when you run the `source download` command without specifying a specific release or repo,
it will use the bundled git bundle instead of downloading the release from GitHub.

This is useful for building from source on machines that aren't connected to the internet.

:::

::: info
If the build fails on macOS with the error `"/usr/bin/cc" is not able to compile a simple test program`, try running `xcode-select --install` to install the Xcode command line tools.
:::

::: details Programmatically calling the `source download` command in your code
To programmatically call this command in your code, call the `DownloadLlamaCppCommand` function:
```typescript
import {DownloadLlamaCppCommand} from "node-llama-cpp/commands";
await DownloadLlamaCppCommand({});
```
> **Note:** The `node-llama-cpp/commands` import is subject to change and is unsupported inside Electron

:::

## Usage
<div v-html="commandDoc.usageHtml"></div>
<div v-html="commandDoc.options"></div>

> To set custom cmake options that are supported by `llama.cpp`'s cmake build,
> set an environment variable of the option prefixed with `NODE_LLAMA_CPP_CMAKE_OPTION_`.
