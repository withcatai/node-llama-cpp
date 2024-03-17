---
outline: deep
---
# `complete` command

<script setup lang="ts">
import {data as docs} from "./cli.data.js";
const commandDoc = docs.complete;
</script>

{{commandDoc.description}}

## Usage
```shell-vue
{{commandDoc.usage}}
```
<div v-html="commandDoc.options"></div>
