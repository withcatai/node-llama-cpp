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

## Downloading Gated Models From Hugging Face {#hf-token}
Some models on Hugging Face are "gated", meaning they require a manual consent from you before you can download them.

To download such models, after completing the consent form on the model card, you need to create a [Hugging Face token](https://huggingface.co/docs/hub/en/security-tokens) and set it in one of the following locations:
* Set an environment variable called `HF_TOKEN` the token
* Set the `~/.cache/huggingface/token` file content to the token

Now, using the CLI or the [`createModelDownloader`](../api/functions/createModelDownloader.md) method will automatically use the token to download gated models.

Alternatively, you can use the token in the [`tokens`](../api/type-aliases/ModelDownloaderOptions.md#tokens) option when using [`createModelDownloader`](../api/functions/createModelDownloader.md).
