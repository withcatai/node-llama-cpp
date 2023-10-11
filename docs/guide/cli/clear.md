---
outline: deep
---
# `clear` command

<script setup lang="ts">
import {data as docs} from "./cli.data.js";
const commandDoc = docs.clear;
</script>

{{commandDoc.description}}

## Usage
```shell-vue
{{commandDoc.usage}}
```
<div v-html="commandDoc.options"></div>
