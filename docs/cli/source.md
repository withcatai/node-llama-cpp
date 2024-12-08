---
outline: deep
description: "'source' command reference"
---
# `source` command

<script setup lang="ts">
import {data as docs} from "./cli.data.js";
const commandDoc = docs.source.index;
</script>

<p v-html="commandDoc.description"></p>

## Usage
<div v-html="commandDoc.usageHtml"></div>
<div v-html="commandDoc.options"></div>
