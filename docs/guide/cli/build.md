# `build` command

<script setup lang="ts">
import {data as docs} from "./cli.data.js";
const commandDoc = docs.build;
</script>

{{commandDoc.description}}

## Usage
```shell-vue
{{commandDoc.usage}}
```
<div v-html="commandDoc.options"></div>


> To set custom cmake options that are supported by `llama.cpp`'s cmake build,
> set an environment variable of the option prefixed with `NODE_LLAMA_CPP_CMAKE_OPTION_`.
