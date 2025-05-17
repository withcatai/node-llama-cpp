---
outline: deep
description: "'pull' command reference"
---
# `pull` command

<script setup lang="ts">
import {data as docs} from "./cli.data.js";
const commandDoc = docs.pull;
</script>

<p v-html="commandDoc.description"></p>

A wrapper around [`ipull`](https://www.npmjs.com/package/ipull)
to download model files as fast as possible with parallel connections and other optimizations.

Automatically handles split and binary-split models files, so only pass the URI to the first file of a model.

If a file already exists and its size matches the expected size, it will not be downloaded again unless the `--override` flag is used.

The supported URI schemes are:
- **HTTP:** `https://`, `http://`
- **Hugging Face:** `hf:<user>/<model>:<quant>` (`:<quant>` is optional, [but recommended](../guide/downloading-models.md#hf-scheme-specify-quant))
- **Hugging Face:** `hf:<user>/<model>/<file-path>#<branch>` (`#<branch>` is optional)

Learn more about using model URIs in the [Downloading Models guide](../guide/downloading-models.md#model-uris).

> To programmatically download a model file in your code, use [`createModelDownloader()`](../api/functions/createModelDownloader.md)

## Usage
<div v-html="commandDoc.usageHtml"></div>
<div v-html="commandDoc.options"></div>
