---
outline: deep
---
# `init` command

<script setup lang="ts">
import {data as docs} from "./cli.data.js";
const commandDoc = docs.init;
</script>

{{commandDoc.description}}

::: info
This command is also available via:
```shell
npm create node-llama-cpp@latest [name]
```
:::

## Usage
<div v-html="commandDoc.usageHtml"></div>
<div v-html="commandDoc.options"></div>
