---
outline: deep
description: "'source build' command reference"
---
# `source build` command

<script setup lang="ts">
import {data as docs} from "../cli.data.js";
const commandDoc = docs.source.build;
</script>

<p v-html="commandDoc.description"></p>

::: info
If the build fails on macOS with the error `"/usr/bin/cc" is not able to compile a simple test program`, try running `xcode-select --install` to install the Xcode command line tools.
:::

::: details Programmatically calling the `source build` command in your code
To programmatically call this command in your code, call the `BuildLlamaCppCommand` function:
```typescript
import {BuildLlamaCppCommand} from "node-llama-cpp/commands";
await BuildLlamaCppCommand({});
```
> **Note:** The `node-llama-cpp/commands` import is subject to change and is unsupported inside Electron

:::

## Usage
<div v-html="commandDoc.usageHtml"></div>
<div v-html="commandDoc.options"></div>


> To set custom cmake options that are supported by `llama.cpp`'s cmake build,
> set an environment variable of the option prefixed with `NODE_LLAMA_CPP_CMAKE_OPTION_`.
