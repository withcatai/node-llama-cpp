<div align="center">
    <a href="https://node-llama-cpp.withcat.ai" target="_blank"><img alt="node-llama-cpp Logo" src="https://raw.githubusercontent.com/withcatai/node-llama-cpp/master/assets/logo.v3.roundEdges.avif" width="360px" /></a>
    <h1>node-llama-cpp</h1>
    <p>Run AI models locally on your machine</p>
    <sub>Pre-built bindings are provided with a fallback to building from source with cmake</sub>
    <p></p>
</div>

<div align="center" class="main-badges">

[![Build](https://github.com/withcatai/node-llama-cpp/actions/workflows/build.yml/badge.svg)](https://github.com/withcatai/node-llama-cpp/actions/workflows/build.yml)
[![License](https://badgen.net/badge/color/MIT/green?label=license)](https://www.npmjs.com/package/node-llama-cpp)
[![Types](https://badgen.net/badge/color/TypeScript/blue?label=types)](https://www.npmjs.com/package/node-llama-cpp)
[![Version](https://badgen.net/npm/v/node-llama-cpp)](https://www.npmjs.com/package/node-llama-cpp)

</div>

✨ [`gpt-oss` is here!](https://node-llama-cpp.withcat.ai/blog/v3.12-gpt-oss) ✨

## Features
* Run LLMs locally on your machine
* [Metal, CUDA and Vulkan support](https://node-llama-cpp.withcat.ai/guide/#gpu-support)
* [Pre-built binaries are provided](https://node-llama-cpp.withcat.ai/guide/building-from-source), with a fallback to building from source _**without**_ `node-gyp` or Python
* [Adapts to your hardware automatically](https://node-llama-cpp.withcat.ai/guide/#gpu-support), no need to configure anything
* A Complete suite of everything you need to use LLMs in your projects
* [Use the CLI to chat with a model without writing any code](#try-it-without-installing)
* Up-to-date with the latest `llama.cpp`. Download and compile the latest release with a [single CLI command](https://node-llama-cpp.withcat.ai/guide/building-from-source#downloading-a-release)
* Enforce a model to generate output in a parseable format, [like JSON](https://node-llama-cpp.withcat.ai/guide/chat-session#json-response), or even force it to [follow a specific JSON schema](https://node-llama-cpp.withcat.ai/guide/chat-session#response-json-schema)
* [Provide a model with functions it can call on demand](https://node-llama-cpp.withcat.ai/guide/chat-session#function-calling) to retrieve information or perform actions
* [Embedding and reranking support](https://node-llama-cpp.withcat.ai/guide/embedding)
* [Safe against special token injection attacks](https://node-llama-cpp.withcat.ai/guide/llama-text#input-safety-in-node-llama-cpp)
* Great developer experience with full TypeScript support, and [complete documentation](https://node-llama-cpp.withcat.ai/guide/)
* Much more

## [Documentation](https://node-llama-cpp.withcat.ai)
* [Getting started guide](https://node-llama-cpp.withcat.ai/guide/)
* [API reference](https://node-llama-cpp.withcat.ai/api/functions/getLlama)
* [CLI help](https://node-llama-cpp.withcat.ai/cli/)
* [Blog](https://node-llama-cpp.withcat.ai/blog/)
* [Changelog](https://github.com/withcatai/node-llama-cpp/releases)
* [Roadmap](https://github.com/orgs/withcatai/projects/1)

## Try It Without Installing
Chat with a model in your terminal using [a single command](https://node-llama-cpp.withcat.ai/cli/chat):
```bash
npx -y node-llama-cpp chat
```

## Installation
```bash
npm install node-llama-cpp
```

[This package comes with pre-built binaries](https://node-llama-cpp.withcat.ai/guide/building-from-source) for macOS, Linux and Windows.

If binaries are not available for your platform, it'll fallback to download a release of `llama.cpp` and build it from source with `cmake`.
To disable this behavior, set the environment variable `NODE_LLAMA_CPP_SKIP_DOWNLOAD` to `true`.

## Usage
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});


const q1 = "Hi there, how are you?";
console.log("User: " + q1);

const a1 = await session.prompt(q1);
console.log("AI: " + a1);


const q2 = "Summarize what you said";
console.log("User: " + q2);

const a2 = await session.prompt(q2);
console.log("AI: " + a2);
```

> For more examples, see the [getting started guide](https://node-llama-cpp.withcat.ai/guide/)

## Contributing
To contribute to `node-llama-cpp` read the [contribution guide](https://node-llama-cpp.withcat.ai/guide/contributing).

## Acknowledgements
* llama.cpp: [ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp)


<br />

<div align="center" width="360">
    <img alt="Star please" src="https://raw.githubusercontent.com/withcatai/node-llama-cpp/master/assets/star.please.roundEdges.png" width="360" margin="auto" />
    <br/>
    <p align="right">
        <i>If you like this repo, star it ✨</i>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
    </p>
</div>
