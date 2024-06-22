---
outline: deep
---
# `inspect gguf` command

<script setup lang="ts">
import {data as docs} from "../cli.data.js";
const commandDoc = docs.inspect.gguf;
</script>

<p><div v-html="commandDoc.description"></div></p>

## Usage
<div v-html="commandDoc.usageHtml"></div>
<div v-html="commandDoc.options"></div>