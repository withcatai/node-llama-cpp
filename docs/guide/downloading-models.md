---
outline: deep
description: Downloading models with node-llama-cpp
---
# Downloading Models
`node-llama-cpp` is equipped with solutions to download models to use them in your project.
The most common use case is to [download models using the CLI](#cli).

<div class="tip custom-block" style="padding-top: 8px">

For a tutorial on how to choose models and where to get them from, read the [choosing a model tutorial](./choosing-a-model)

</div>

## Using the CLI {#cli}
`node-llama-cpp` is equipped with a [model downloader](../cli/pull) you can use to download models and [their related files](../api/functions/createModelDownloader.md) easily and at high speed (using [`ipull`](https://www.npmjs.com/package/ipull)).

It's recommended to add a `models:pull` script to your `package.json` to download all the models used by your project to a local `models` folder.

It's also recommended to ensure all the models are automatically downloaded after running `npm install` by setting up a `postinstall` script

Here's an example of how you can set this up in your `package.json`:
::: code-group
```json [<code>package.json</code>]
{
  "scripts": {
      "postinstall": "npm run models:pull",
      "models:pull": "node-llama-cpp pull --dir ./models <model-url>"
  }
}
```
:::

Don't forget to add the `models` folder to your `.gitignore` file to avoid committing the models to your repository:
::: code-group
``` [<code>.gitignore</code>]
/models
```
:::

If the model consists of multiple files, only use the URL of the first one, and the rest will be downloaded automatically.
For more information, see [`createModelDownloader`](../api/functions/createModelDownloader).

Calling `models:pull` multiple times will only download the models that haven't been downloaded yet.
If a model file was updated, calling `models:pull` will download the updated file and override the old one.

You can pass a list of model URLs to download multiple models at once:

::: code-group
```json [<code>package.json</code>]
{
  "scripts": {
      "postinstall": "npm run models:pull",
      "models:pull": "node-llama-cpp pull --dir ./models <model1-url> <model2-url> <model3-url>"
  }
}
```
:::

::: tip
When [scaffolding a new project](./index.md#scaffold-new-project), the new project already includes this pattern.
:::

## Programmatically Downloading Models {#programmatic}
You can also download models programmatically using the [`createModelDownloader`](../api/functions/createModelDownloader.md) method,
and [`combineModelDownloaders`](../api/functions/combineModelDownloaders.md) to combine multiple model downloaders.

This option is recommended for more advanced use cases, such as downloading models based on user input.

If you know the exact model URLs you're going to need every time in your project, it's better to download the models
automatically after running `npm install` as described in the [Using the CLI](#cli) section.

## Model URIs {#model-uris}
You can reference models using a URI instead of their full download URL when using the CLI and relevant methods.

When downloading a model from a URI, the model files will be prefixed with a corresponding adaptation of the URI.

To reference a model from Hugging Face, you can use one of these schemes:
* `hf:<user>/<model>:<quant>` (`:<quant>` is optional, [but recommended](#hf-scheme-specify-quant))
* `hf:<user>/<model>/<file-path>#<branch>` (`#<branch>` is optional)

Here are example usages of the Hugging Face URI scheme:
::: code-group
```[With quant]
hf:mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M
```
```[Specific file]
hf:mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF/Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf
```
:::

When using a URI to reference a model,
it's recommended [to add it to your `package.json` file](#cli) to ensure it's downloaded when running `npm install`,
and also resolve it using the [`resolveModelFile`](../api/functions/resolveModelFile.md) method to get the full path of the resolved model file.

Here's an example usage of the [`resolveModelFile`](../api/functions/resolveModelFile.md) method:
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, resolveModelFile} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelsDirectory = path.join(__dirname, "models");

const modelPath = await resolveModelFile(
    "hf:user/model:quant",
    modelsDirectory
);

const llama = await getLlama();
const model = await llama.loadModel({modelPath});
```

::: tip NOTE
If a corresponding model file is not found in the given directory, the model will automatically be downloaded.

When a file is being downloaded, the download progress is shown in the console by default.
<br/>
Set the [`cli`](../api/type-aliases/ResolveModelFileOptions#cli) option to `false` to disable this behavior.
:::

::: tip TIP {#hf-scheme-specify-quant}
When using the `hf:<user>/<model>:<quant>` scheme, always specify the quantization level in the URI (`:<quant>`).
<br/>
Doing this allows the resolver to resolve to a local model file without checking the model metadata on Hugging Face first,
so it will be resolved offline and faster.
:::

::: tip Shortcuts for quick experimentation {#uri-shortcuts}
You can copy the page URLs of models and files on Hugging Face
and use them with any of the [CLI commands](../cli/index.md).

**Important:** do not use these page URL shortcuts in production code, and do not commit them to your codebase.
The resolving of such page URL shortcuts are inefficient and unreliable for production use.
:::

## Downloading Gated Models From Hugging Face {#hf-token}
Some models on Hugging Face are "gated", meaning they require a manual consent from you before you can download them.

To download such models, after completing the consent form on the model card, you need to create a [Hugging Face token](https://huggingface.co/docs/hub/en/security-tokens) and set it in one of the following locations:
* Set an environment variable called `HF_TOKEN` the token
* Set the `~/.cache/huggingface/token` file content to the token

Now, using the CLI, the [`createModelDownloader`](../api/functions/createModelDownloader.md) method,
or the [`resolveModelFile`](../api/functions/resolveModelFile.md) method will automatically use the token to download gated models.

Alternatively, you can use the token in the [`tokens`](../api/type-aliases/ModelDownloaderOptions.md#tokens) option when using [`createModelDownloader`](../api/functions/createModelDownloader.md) or [`resolveModelFile`](../api/functions/resolveModelFile.md).

## Inspecting Remote Models
You can inspect the metadata of a remote model without downloading it by either using the [`inspect gguf`](../cli/inspect/gguf.md) command with a URL,
or using the [`readGgufFileInfo`](../api/functions/readGgufFileInfo.md) method with a URL:
```typescript
import {readGgufFileInfo} from "node-llama-cpp";

const modelMetadata = await readGgufFileInfo("<model url>");
```
> If the URL is of a model with multiple parts (either separate files or binary-split files),
> pass the URL of the first file and it'll automatically inspect the rest of the files and combine the metadata.

### Detecting the Compatibility of Remote Models
It's handy to check the compatibility of a remote model with your current machine hardware before downloading it,
so you won't waste time downloading a model that won't work on your machine.

You can do so using the [`inspect estimate`](../cli/inspect/estimate.md) command with a URL:
```shell
npx --no node-llama-cpp inspect estimate <model-url>
```

Running this command will attempt to find the best balance of parameters for the model to run on your machine,
and it'll output the estimated compatibility of the model with your machine with [flash attention](./tips-and-tricks.md#flash-attention) either turned off (the default) or on.

> **Note:** don't specify any of these configurations when loading the model.
> 
> [`node-llama-cpp` will balance the parameters automatically](./index.md#gpu-support) also when loading the model,
> context, etc.

You can also estimate the compatibility of a model programmatically using the [`GgufInsights` class](../api/classes/GgufInsights.md):
```typescript
import {getLlama, readGgufFileInfo, GgufInsights} from "node-llama-cpp";

const llama = await getLlama();
const modelMetadata = await readGgufFileInfo("<model url>");

const insights = await GgufInsights.from(modelMetadata, llama);
const resolvedConfig =
    await insights.configurationResolver.resolveAndScoreConfig();
const flashAttentionconfig =
    await insights.configurationResolver.resolveAndScoreConfig({
        flashAttention: true
    });

console.log(`Compatibility: ${resolvedConfig.compatibilityScore * 100}%`);
console.log(
    `With flash attention: ${flashAttentionconfig.compatibilityScore * 100}%`
);
```
