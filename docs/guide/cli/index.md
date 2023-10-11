---
outline: deep
---
# CLI

<script setup lang="ts">
import {data as docs} from "./cli.data.js";
const commandDoc = docs.index;
</script>

{{commandDoc.description}}

## Usage
```shell-vue
{{commandDoc.usage}}
```
<div v-html="commandDoc.options"></div>
