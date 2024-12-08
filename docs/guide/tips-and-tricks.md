---
description: Tips and tricks for using node-llama-cpp
---
# Tips and Tricks
## Flash Attention {#flash-attention}
::: warning Experimental Feature
The support for flash attention is currently experimental and may not always work as expected
:::

Flash attention is an optimization in the attention mechanism that makes inference faster, more efficient and uses less memory.

Using it can allow you to use lager models, have a larger context size, and have faster inference.

You can try enabling and to see how it works with the model you're using together with the compute layer you're using (CUDA, Metal, Vulkan, etc.).
Given that you tested it with a specific model file across all the compute layers you intend to run this model on, you can assume it'll continue to work well with that model file.

Upon flash attention exiting the experimental status, it will be enabled by default.

To enable flash attention on the model level, you can enable the [`defaultContextFlashAttention`](../api/type-aliases/LlamaModelOptions#defaultcontextflashattention) option when using [`loadModel`](../api/classes/Llama#loadmodel):
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(
    fileURLToPath(import.meta.url)
);

const llama = await getLlama();
// ---cut---
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "my-model.gguf"),
    defaultContextFlashAttention: true
});
const context = await model.createContext();
```

You can also enable flash attention for an individual context when creating it,
but doing that is less optimized as the model may get loaded with less GPU layers
since it expected the context to use much more VRAM than it actually does due to flash attention:
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(
    fileURLToPath(import.meta.url)
);

const llama = await getLlama();
// ---cut---
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "my-model.gguf")
});
const context = await model.createContext({
    flashAttention: true
});
```

::: tip
All the CLI commands related to using model files have a flag to enable flash attention,
or provide additional information regarding flash attention when used.
:::

## OpenMP {#openmp}
> OpenMP is an API for parallel programming in shared-memory systems

OpenMP can help improve inference performance on Linux and Windows, but requires additional installation and setup.

The performance improvement can be [up to 8% faster](https://github.com/ggerganov/llama.cpp/pull/7606) inference times (on specific conditions).
Setting the `OMP_PROC_BIND` environment variable to `TRUE` on systems that support many threads (assume 36 as the minimum) can improve performance [by up to 23%](https://github.com/ggerganov/llama.cpp/pull/7606).

The pre-built binaries are compiled without OpenMP since OpenMP isn't always available on all systems, and has to be installed separately.

**macOS:** OpenMP isn't beneficial on macOS as it doesn't improve the performance. Do not attempt to install it on macOS.

**Windows:** The installation of [Microsoft Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170#latest-microsoft-visual-c-redistributable-version) comes with OpenMP built-in.

**Linux:** You have to manually install OpenMP:
```shell
sudo apt update
sudo apt install libgomp1
```

After installing OpenMP, [build from source](./building-from-source.md) and the OpenMP library will be automatically be used upon detection:
```shell
npx --no node-llama-cpp source download
```

Now, just use `node-llama-cpp` as you normally would.

## Intel AMX {#intel-amx}
> Intel AMX (Advanced Matrix Extensions) is a dedicated hardware block found on Intel Xeon processors
> that helps optimize and accelerate matrix multiplication operations.
> 
> It's available on the 4th Gen and newer Intel Xeon processors.

Intel AMX can improve CPU inference performance [by 2x and up to even 14x](https://github.com/ggerganov/llama.cpp/pull/7707) faster inference times on supported CPUs (on specific conditions).

If you're using a 4th Gen or newer Intel Xeon processor,
you might want to [build `llama.cpp` from source](./building-from-source.md) to utilize these hardware-specific optimizations available on your hardware.

To do this, run this command inside your project on the machine you run your project on:
```shell
npx --no node-llama-cpp source download
```

Alternatively, you can force `node-llama-cpp` to not use its prebuilt binaries
and instead build from source when calling [`getLlama`](../api/functions/getLlama.md) for the first time on a Xeon CPU:

```typescript
import os from "os";
import {getLlama} from "node-llama-cpp";

const llama = await getLlama({
    usePrebuiltBinaries: !os.cpus().some((cpu) => (
        cpu.model.toLowerCase().includes("Xeon".toLowerCase())
    ))
});
```
::: info NOTE
Building from source can take some time (when using CUDA even up to an hour in extreme cases),
so ensure you dedicate some time for this as part of the deployment process.
:::
