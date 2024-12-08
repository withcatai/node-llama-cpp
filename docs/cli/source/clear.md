---
outline: deep
description: "'source clear' command reference"
---
# `source clear` command

<script setup lang="ts">
import {data as docs} from "../cli.data.js";
const commandDoc = docs.source.clear;
</script>

<p v-html="commandDoc.description"></p>

::: details Programmatically calling the `source clear` command in your code
To programmatically call this command in your code, call the `ClearLlamaCppBuildCommand` function:
```typescript
import {ClearLlamaCppBuildCommand} from "node-llama-cpp/commands";
await ClearLlamaCppBuildCommand({type: "all"});
```
> **Note:** The `node-llama-cpp/commands` import is subject to change and is unsupported inside Electron

:::

## Usage
<div v-html="commandDoc.usageHtml"></div>
<div v-html="commandDoc.options"></div>
