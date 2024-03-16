---
outline: deep
---
# Developing `node-llama-cpp`
This document describes how to set up your development environment to contribute to `node-llama-cpp`.

## Prerequisites
- [Git](https://git-scm.com/). [GitHub's Guide to Installing Git](https://help.github.com/articles/set-up-git) is a good source of information.
- [Node.js](https://nodejs.org/en/) (v18 or higher)
- [cmake dependencies](https://github.com/cmake-js/cmake-js#installation:~:text=projectRoot/build%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%5Bstring%5D-,Requirements%3A,-CMake) - make sure the required dependencies of `cmake` are installed on your machine. More info is available [here](https://github.com/cmake-js/cmake-js#installation:~:text=projectRoot/build%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%5Bstring%5D-,Requirements%3A,-CMake) (you don't necessarily have to install `cmake`, just the dependencies)

## Setup
1. [Fork `node-llama-cpp` repo](https://github.com/withcatai/node-llama-cpp/fork)
2. Clone your forked repo to your local machine
3. Install dependencies:
    ```bash
    npm install
    ```
4. Build the CLI, use the CLI to clone the latest release of `llama.cpp`, and build it from source:
    ```bash
    npm run dev:setup
    ```
   > If the build fails on c++ errors, this may be due to breaking interface changes on the `llama.cpp` side, which happens pretty often recently.
   > 
   > You're encouraged to make changes to the usage of `llama.cpp` functions in the `llama/addon.cpp` file to resolve these errors and then open a pull request for these changes separately from your main changes PR.
   >
   > We continually maintain the `llama/addon.cpp` file to keep it up to date with the latest changes of `llama.cpp`, so any help with this is greatly appreciated.

## Development
Whenever you add a new functionality to `node-llama-cpp`, consider improving the CLI to reflect this change.

To test whether you local setup works, download a model and try using it with the `chat` command.

### Get a model file
We recommend you to get a GGUF model from the [TheBloke on Hugging Face](https://huggingface.co/TheBloke?search_models=GGUF).

We recommend you to start by getting a small model that doesn't have a lot of parameters just to ensure that your setup works, so try downloading a `7B` parameters model first (search for models with both `7B` and `GGUF` in their name).

For improved download speeds, you can use [`ipull`](https://www.npmjs.com/package/ipull) to download the model:
```bash
npx ipull <model-file-ul>
```

### Validate your setup by chatting with a model
To validate that your setup works, run the following command to chat with the model you downloaded:
```bash
npm run dev:build; node ./dist/cli/cli.js chat --model <path-to-a-model-file-on-your-computer>
```

Try telling the model `Hi there` and see how it reacts. Any response from the model means that your setup works.
If the response looks weird or doesn't make sense, try using a different model.

If the model doesn't stop generating output, try using a different chat wrapper. For example:
```bash
npm run dev:build; node ./dist/cli/cli.js chat --wrapper llamaChat --model <path-to-a-model-file-on-your-computer>
```

> **Important:** Make sure you always run `npm run dev:build` before running the CLI to make sure that your code changes are reflected in the CLI.

### Debugging
To run a chat session with a debugger, configure your IDE to run the following command with a debugger:
```bash
npx vite-node ./src/cli/cli.ts chat --model <path-to-a-model-file-on-your-computer>
```

## Opening a pull request
Before starting to work on a new feature,
search for a related issue on the [issues page](https://github.com/withcatai/node-llama-cpp/issues).
If there's already an issue for the feature you want to work on,
comment on that issue to let us know that you're working on it, to avoid duplicate work.

To open a pull request, read the [pull request guidelines](./contributing.md).
