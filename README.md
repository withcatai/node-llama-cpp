<div align="center">
    <img alt="node-llama-cpp Logo" src="https://media.githubusercontent.com/media/withcatai/node-llama-cpp/master/assets/logo.roundEdges.png" width="360px" />
    <h1>node-llama-cpp</h1>
    <p>Run AI models locally on your machine</p>
    <sub>Pre-built bindings are provided with a fallback to building from source with cmake</sub>
    <p></p>
</div>

<div align="center" class="main-badges">

[![Build](https://github.com/withcatai/node-llama-cpp/actions/workflows/build.yml/badge.svg)](https://github.com/withcatai/node-llama-cpp/actions/workflows/build.yml)
[![License](https://badgen.net/badge/color/MIT/green?label=license)](https://www.npmjs.com/package/node-llama-cpp)
[![License](https://badgen.net/badge/color/TypeScript/blue?label=types)](https://www.npmjs.com/package/node-llama-cpp)
[![Version](https://badgen.net/npm/v/node-llama-cpp)](https://www.npmjs.com/package/node-llama-cpp)

</div>

## Features
* Run a text generation model locally on your machine
* Metal and CUDA support
* Pre-built binaries are provided, with a fallback to building from source without `node-gyp` or Python
* Chat with a model using a chat wrapper
* Use the CLI to chat with a model without writing any code
* Up-to-date with the latest version of `llama.cpp`. Download and compile the latest release with a single CLI command.
* Force a model to generate output in a parseable format, like JSON, or even force it to follow a specific JSON schema

## [Documentation](https://withcatai.github.io/node-llama-cpp/)
* [Getting started guide](https://withcatai.github.io/node-llama-cpp/guide/)
* [API reference](https://withcatai.github.io/node-llama-cpp/api/classes/LlamaModel)
* [CLI help](https://withcatai.github.io/node-llama-cpp/guide/cli/)
* [Changelog](https://github.com/withcatai/node-llama-cpp/releases)
* [Roadmap](https://github.com/orgs/withcatai/projects/1)

## Installation
```bash
npm install --save node-llama-cpp
```

This package comes with pre-built binaries for macOS, Linux and Windows.

If binaries are not available for your platform, it'll fallback to download the latest version of `llama.cpp` and build it from source with `cmake`.
To disable this behavior set the environment variable `NODE_LLAMA_CPP_SKIP_DOWNLOAD` to `true`.

## Usage
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {LlamaModel, LlamaContext, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const model = new LlamaModel({
    modelPath: path.join(__dirname, "models", "codellama-13b.Q3_K_M.gguf")
});
const context = new LlamaContext({model});
const session = new LlamaChatSession({context});


const q1 = "Hi there, how are you?";
console.log("User: " + q1);

const a1 = await session.prompt(q1);
console.log("AI: " + a1);


const q2 = "Summerize what you said";
console.log("User: " + q2);

const a2 = await session.prompt(q2);
console.log("AI: " + a2);
```

> For more examples, see the [getting started guide](https://withcatai.github.io/node-llama-cpp/guide/)

## Contributing
To contribute to `node-llama-cpp` read the [contribution guide](https://withcatai.github.io/node-llama-cpp/guide/contributing).

## Acknowledgements
* llama.cpp: [ggerganov/llama.cpp](https://github.com/ggerganov/llama.cpp)


<br />

<div align="center" width="360">
    <img alt="Star please" src="https://media.githubusercontent.com/media/withcatai/node-llama-cpp/master/assets/star.please.roundEdges.png" width="360" margin="auto" />
    <br/>
    <p align="right">
        <i>If you like this repo, star it ✨</i>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
    </p>
</div>
