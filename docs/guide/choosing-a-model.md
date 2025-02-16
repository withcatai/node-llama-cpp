---
outline: deep
description: Learn how to choose the right model for your use case
---
# Choosing a Model
## About GGUF Model Files
`llama.cpp` works with GGUF (Georgi Gerganov's Unified Format) model files.

GGUF model files are usually converted from other formats, such as Transformers, PyTorch, etc.

The advantages of GGUF files include:
* Ease of use
* No need for custom code for each different model
* Optimization for `llama.cpp`
* Containing all the necessary information for using the file within the file itself

A GGUF model file includes metadata about the model that's used for loading and running it.
You can inspect this metadata using the [`inspect gguf`](../cli/inspect/gguf.md) command or the [`readGgufFileInfo` function](../api/functions/readGgufFileInfo.md).

::: tip
You can pass a URL to the [`inspect gguf`](../cli/inspect/gguf.md) command or the [`readGgufFileInfo` function](../api/functions/readGgufFileInfo.md) to read the metadata of a model without downloading it.
:::

## Finding a Model Source
The recommended way to obtain a pre-converted GGUF model file is from the [HuggingFace model hub](https://huggingface.co/models?library=gguf) from a reputable source.

### Community Conversions
Reputable community members convert many popular models to GGUF and publish them on HuggingFace.
When searching for a GGUF model, you can visit their HuggingFace profiles to find the model you're looking for.

Here's a list of recommended community members who convert models to GGUF:
* [Michael Radermacher](https://huggingface.co/mradermacher) (`mradermacher`) - very high quality conversions, with a quality graph on the model pages
* [Bartowski](https://huggingface.co/bartowski) (`bartowski`) - quick to convert new models

> If you're a community member who converts many models to GGUF and would like to be added to this list, please open a PR to add yourself.

### Model Providers
Some models are converted into GGUF by the model providers themselves.

For example, [Google released a GGUF conversion of Gemma 2](https://huggingface.co/google/gemma-2-2b-it-GGUF) themselves.

The advantages of obtaining models directly from the model provider include:
* It's a reputable source (assuming you know what you're looking for).
* The model provider can ensure that the model performs as expected at the time of publishing.

The disadvantages of obtaining models directly from the model provider include:
* Sometimes the conversion is not up-to-date enough with the latest updates of `llama.cpp`,
  which can result in degraded performance compared to an up-to-date model conversion.
* Some model providers lock their models behind a consent form, making them "gated models".
  This renders the models inaccessible without using an API token to download them, complicating their use in CI/CD and other automated workflows.

## Choosing a Model
When choosing a model, consider the following:

### What are your hardware capabilities? (CPU, GPU, VRAM, etc.)
If the machine you plan to run this model on doesn't have a GPU,
you'd probably want to use a small model that can run on a CPU with decent performance.

If you have a GPU, the amount of VRAM you have will determine the size of the model you can run.
Ideally, you'd want to fit the entire model in the VRAM to use only the GPU and achieve maximum performance.
If the model requires more memory than the available VRAM, parts of it will be offloaded to the RAM and be evaluated using the CPU,
significantly reducing the efficiency and speed of inference.

::: tip
Use the [`inspect gpu`](../cli/inspect/gpu.md) command to check your hardware capabilities:
```shell
npx --no node-llama-cpp inspect gpu
```
:::

Here's a rough estimation of the VRAM required for different model sizes:
| Model Size | VRAM  |
| ---------- | ----- |
| 1B         | 1GB   |
| 3B         | 3.5GB |
| 8B         | 6GB   |
| 70B        | 55GB  |
| 405B       | 300GB |

::: tip
To get a more accurate estimation of how well a model will run on your hardware before downloading it, you can use the [`inspect estimate`](../cli/inspect/estimate.md) command:
```shell
npx --no node-llama-cpp inspect estimate <model-file-url>
```
:::

### What do you need this model for? (chat, code completion, analyzing data, classification, embedding, etc.) {#model-purpose}
There are plenty of models with different areas of expertise and capabilities.

When you choose a model that is more specialized in the task you need it for, it will usually perform better than a general model.
Furthermore, a smaller model that is specialized in the task you need it for can also perform better than a larger model that is more general.

To optimize for the response quality, as well as performance, you should prefer a model that is specialized in the task you need it for.

Here are a few concepts to be aware of when choosing a model:
* **Instruction-type models** - models that are trained to receive instructions and perform tasks based on them.
  These models usually support chat templates, meaning that you can use a [`LlamaChatSession`](../api/classes/LlamaChatSession.md) to interact with them.
  
  You can identify these models by looking for `Instruct` or `it` in the model name.

  A non-instruct model can still be useful for generating completions, but it may not work well for chat, as it is unaware of a chat syntax.

* **Fine-tuned models** - models that are trained on specific datasets to perform better on particular tasks.
  These models are based on a more general-purpose model and are trained on top of it.
  Fine-tuning is usually less extensive and is much cheaper than the training of the original model.
  
  You can identify these models by looking for the foundational model they're based on (e.g., Llama 3) in the model name, along with the fine-tune name.
  For example, a popular fine-tune called "dolphin" is used to make a model uncensored.
  A model named [`dolphin-2.9.3-llama-3-8b-i1-GGUF`](https://huggingface.co/mradermacher/dolphin-2.9.3-llama-3-8b-i1-GGUF) is a "dolphin" fine-tuned model based on the Llama 3 8B model.
  
  To distinguish between the fine-tune and the foundational model in the model name,
  you can either recognize the foundational model name and then assume that the rest is a fine-tune name,
  or you can open the model's page and read the model description.

* **Embedding models** - models that are trained to convert text into [embeddings](./embedding.md) that capture the semantic meaning of the text.

  Generating embeddings for similarity search using such models is preferable
  because they are highly optimized for this task.
  Embedding models are often significantly smaller (sometimes as small as 100MB), faster,
  and consume less memory than general-purpose models, making them more efficient and practical.

  While general-purpose models can also be used for generating embeddings,
  they may not be as optimized or as efficient as embedding models for this task.
  
  Many embedding models include terms like `embed` in their name.

* **Reranking models** - models that are trained to rerank (sort) a list of documents
  based on their relevance to a given query.
  These models are usually smaller and faster than general-purpose models,
  making them more efficient and practical for reranking tasks.
  
  Reranking models are often significantly smaller (sometimes as small as 500MB), faster,
  and consume less memory than general-purpose models, making them more efficient and practical.

  While general-purpose models can also be used for reranking,
  doing this requires prompting the model, which is more cumbersome and inefficient than
  using a specialized model with a [ranking context](./embedding.md#reranking) for this task.
  
  Many reranking models include terms like `rerank` or `reranker` in their name.

### How much data do you plan to feed the model at once with?
If you plan to feed the model with a lot of data at once, you'll need a model that supports a large context size.
The larger the context size is, the more data the model can process at once.

You can only create a context with a size that is smaller or equal to the context size the model was trained on (although there are techniques around that, like [RoPE](https://github.com/ggml-org/llama.cpp/discussions/1965)).
The larger the context size is, the more memory the model will require to run.
If you plan to feed the model with a lot of data at once, you may want to choose a smaller model that uses less memory, so you can create a larger context.

::: tip
To find the training context size of a model,
as well as the largest context size that can be created with that model on your machine,
you can use the [`inspect estimate`](../cli/inspect/estimate.md) command:
```shell
npx --no node-llama-cpp inspect estimate <model-file-url>
```
:::

## Choosing a File to Get
After choosing a model, you should choose what quality level of the model you want to get.

For example, on [this model](https://huggingface.co/mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF), clicking on the `Files and versions` tab reveals many model files.
Each of these files represent a different quality level of the model, and you can choose the one that best fits your needs.
The more compressed the model is, the less memory it will require to run, and the faster it will run, but the quality of the responses may be lower.

The only way to determine whether the model's quality is sufficient for your needs is to try it out with a task you plan to use it for and see how well it performs.

Usually, a `Q4_K_M` quality offers the best balance between compression and quality (with `Q5_K_M` as a close second), so it's recommended to start with this quality.

A `Q8_0` quality is typically the highest quality that still uses compression, but it's also slower to run and uses more memory.

A `f16` (or any other `f<byte size>`) file is an uncompressed model, and it's the highest quality, but it's also the slowest to run and uses the most memory.
It's generally not recommended to use this quality for inference, but it's useful for training.

::: tip
The easiest way to test a model's quality is by using the [`chat`](../cli/chat.md) command.

You can download a model and immediately prompt it with a single command by passing a model URL together with a `--prompt` flag:
```shell
npx --no node-llama-cpp chat --prompt 'Hi there' <model-url>
```
:::

## Downloading a Model
For improved download speeds, you can use the [`pull`](../cli/pull.md) command to download a model:
```shell
npx --no node-llama-cpp pull --dir ./models <model-file-url>
```

> If the model file URL is of a chunk of a binary-split model (for example, [this model](https://huggingface.co/mradermacher/Meta-Llama-3.1-405B-GGUF/blob/main/Meta-Llama-3.1-405B.Q4_K_S.gguf.part1of5)),
> it will automatically download all the chunks and combine them into a single file.
> 
> If the model file URL is of a single part of a multi-part model (for example, [this model](https://huggingface.co/bartowski/Meta-Llama-3-70B-Instruct-GGUF/blob/main/Meta-Llama-3-70B-Instruct-Q5_K_L.gguf/Meta-Llama-3-70B-Instruct-Q5_K_L-00001-of-00002.gguf)),
> it will also download all the other parts as well into the same directory.

::: tip
Consider using [model URIs](./downloading-models.md#model-uris) to download and load models.
:::
