---
outline: deep
description: "'init' command reference"
---
# `init` command

<script setup lang="ts">
import {data as docs} from "./cli.data.js";
const commandDoc = docs.init;
</script>

<p v-html="commandDoc.description"></p>

::: info
This command is also available via:
```shell
npm create node-llama-cpp@latest [name]
```
:::

## Usage
<div v-html="commandDoc.usageHtml"></div>
<div v-html="commandDoc.options"></div>
