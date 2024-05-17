---
outline: deep
---
# `inspect` command

<script setup lang="ts">
import {data as docs} from "./cli.data.js";
const commandDoc = docs.inspect.index;
</script>

{{commandDoc.description}}

## Usage
<div v-html="commandDoc.usageHtml"></div>
<div v-html="commandDoc.options"></div>
