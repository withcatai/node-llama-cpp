---
outline: deep
---
# `pull` command

<script setup lang="ts">
import {data as docs} from "./cli.data.js";
const commandDoc = docs.pull;
</script>

<p v-html="commandDoc.description"></p>

A wrapper around [`ipull`](https://www.npmjs.com/package/ipull)
to download model files as fast as possible with parallel connections and other optimizations.

Automatically handles split and binary-split models files, so only pass the URL to the first file of a model.

If a file already exists and its size matches the expected size, it will not be downloaded again unless the `--override` flag is used.

> To programmatically download a model file in your code, use [`createModelDownloader()`](../api/functions/createModelDownloader.md)

## Usage
<div v-html="commandDoc.usageHtml"></div>
<div v-html="commandDoc.options"></div>
