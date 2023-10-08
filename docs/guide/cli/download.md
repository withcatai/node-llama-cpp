# `download` command

<script setup lang="ts">
import {data as docs} from "./cli.data.js";
const commandDoc = docs.download;
</script>

{{commandDoc.description}}

::: tip NOTE

`node-llama-cpp` ships with a git bundle of the release of `llama.cpp` it was built with,
so when you run the `download` command without specifying a specific release or repo,
it will use the bundled git bundle instead of downloading the release from GitHub.

This is useful for building from source on machines that aren't connected to the internet.

:::

## Usage
```shell-vue
{{commandDoc.usage}}
```
<div v-html="commandDoc.options"></div>

> To set custom cmake options that are supported by `llama.cpp`'s cmake build,
> set an environment variable of the option prefixed with `NODE_LLAMA_CPP_CMAKE_OPTION_`.
