---
outline: deep
description: Developing node-llama-cpp
---
# Developing `node-llama-cpp`
This document describes how to set up your development environment to contribute to `node-llama-cpp`.

## Prerequisites
- [Git](https://git-scm.com/). [GitHub's Guide to Installing Git](https://help.github.com/articles/set-up-git) is a good source of information.
- [Node.js](https://nodejs.org/en/) (v20 or higher)
- [cmake dependencies](https://github.com/cmake-js/cmake-js#installation:~:text=projectRoot/build%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%5Bstring%5D-,Requirements%3A,-CMake) - make sure the required dependencies of `cmake` are installed on your machine. More info is available [here](https://github.com/cmake-js/cmake-js#installation:~:text=projectRoot/build%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%5Bstring%5D-,Requirements%3A,-CMake) (you don't necessarily have to install `cmake`, just the dependencies)

## Setup
1. [Fork `node-llama-cpp` repo](https://github.com/withcatai/node-llama-cpp/fork)
2. Clone your forked repo to your local machine
3. Install dependencies:
   ```shell
   npm install
   ```
4. Build the CLI, use the CLI to clone the latest release of `llama.cpp` and build it from source, and download all the models needed by the tests:
   ```shell
   npm run dev:setup
   ```
   ::: info What to do if the build fails
   If the build fails on C++ errors, this may be due to breaking interface changes on the `llama.cpp` side.
   
   You're encouraged to make changes to the usage of `llama.cpp` functions in the `llama/addon` directory to resolve these errors and then open a pull request for these changes separately from your main changes PR.
   
   We continually maintain the `llama/addon` directory to keep it up to date with the latest changes of `llama.cpp`, so any help with this is greatly appreciated.
   :::

## Development
Whenever you add a new functionality to `node-llama-cpp`, consider improving the CLI to reflect this change.

After you're done making changes to the code, please add some tests if possible, and update the documentation.

To test whether your local setup works, download a model and try using it with the `chat` command.

### Get a Model File
We recommend you to get a GGUF model from either [Michael Radermacher on Hugging Face](https://huggingface.co/mradermacher) or [search HuggingFace directly](https://huggingface.co/models?library=gguf) for a GGUF model.

We recommend you to start by getting a small model that doesn't have a lot of parameters just to ensure everything works, so try downloading a `7B`/`8B` parameters model first (search for models with both `7B`/`8B` and `GGUF` in their name).

For improved download speeds, you can use the [`pull`](../cli/pull.md) command to download a model:
```shell
npm run build; node ./dist/cli/cli.js pull --dir ./test/.models <model-file-url>
```

### Validate Your Setup by Chatting With a Model
To validate that your setup works, run the following command to chat with the model you downloaded:
```shell
npm run dev:build; node ./dist/cli/cli.js chat <path-to-a-model-file-on-your-computer>
```

Try telling the model `Hi there` and see how it reacts. Any response from the model means that your setup works.
If the response looks weird or doesn't make sense, try using a different model.

If the model doesn't stop generating output, try using a different [chat wrapper](./chat-wrapper). For example:
```shell
npm run dev:build; node ./dist/cli/cli.js chat --wrapper general <path-to-a-model-file-on-your-computer>
```

::: tip Important
Make sure you always run `npm run dev:build` before running the CLI to make sure that your code changes are reflected in the CLI.
:::

### Debugging
To run a chat session with a debugger, configure your IDE to run the following command with a debugger:
```shell
npx vite-node ./src/cli/cli.ts chat <path-to-a-model-file-on-your-computer>
```

#### Finding Process Crash Stack Trace for Native Code (macOS) {#native-crash-stack-trace-macos}
To get the stack trace of a crash stemming in `llama.cpp` or the bindings, run `node` with `lldb`:
```shell
lldb node -- ./node_modules/.bin/vite-node ./src/cli/cli.ts chat <path-to-a-model-file-on-your-computer>
```

After it finishes loading, type `run` (or `process launch` if `run` fails) and press Enter for the execution of `node` to start.
When the process crashes, you'll get a stack trace in the terminal.

#### Finding Process Crash Stack Trace for Native Code (Linux) {#native-crash-stack-trace-linux}
To get the stack trace of a crash stemming in `llama.cpp` or the bindings, run `node` with `gdb`:
```shell
gdb --args node ./node_modules/.bin/vite-node ./src/cli/cli.ts chat <path-to-a-model-file-on-your-computer>
```

After it finishes loading, type `run` and press Enter for the execution of `node` to start.
When the process crashes, type `bt full` and press Enter to see the stack trace.

### Updating the Documentation
All the documentation is written in Markdown files in the `docs` directory.
To see the changes you made to the documentation, run the following command:
```shell
npm run docs:dev
```

Before sending a PR, ensure that the documentation can compile correctly by running this command:
```shell
npm run docs:build
```

## Opening a Pull Request
Before starting to work on a new feature,
search for a related issue on the [issues page](https://github.com/withcatai/node-llama-cpp/issues).
If there's already an issue for the feature you want to work on,
comment on that issue to let us know that you're working on it, to avoid duplicate work.

To open a pull request, read the [pull request guidelines](./contributing.md).
