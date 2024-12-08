---
outline: deep
description: "'infill' command reference"
---
# `infill` command

<script setup lang="ts">
import {data as docs} from "./cli.data.js";
const commandDoc = docs.infill;
</script>

<p v-html="commandDoc.description"></p>

## Usage
<div v-html="commandDoc.usageHtml"></div>
<div v-html="commandDoc.options"></div>
