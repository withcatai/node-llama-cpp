---
outline: deep
---
# `pull` command

<script setup lang="ts">
import {data as docs} from "./cli.data.js";
const commandDoc = docs.pull;
</script>

<p><div v-html="commandDoc.description"></div></p>

A wrapper around [`ipull`](https://www.npmjs.com/package/ipull)
to download a model file as fast as possible with parallel connections and other optimizations.

> To programmatically download a model file in your code, use [`createModelDownloader()`](../api/functions/createModelDownloader.md)

## Usage
<div v-html="commandDoc.usageHtml"></div>
<div v-html="commandDoc.options"></div>
