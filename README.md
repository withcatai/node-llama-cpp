# Node Llama.cpp
Node.js bindings for llama.cpp.

Pre-built bindings are provided with a fallback to building from source with `node-gyp`.

[![Build](https://github.com/withcatai/node-llama-cpp/actions/workflows/build.yml/badge.svg)](https://github.com/withcatai/node-llama-cpp/actions/workflows/build.yml)
[![Version](https://badgen.net/npm/v/node-llama-cpp)](https://www.npmjs.com/package/node-llama-cpp)


## Installation
```bash
npm install --save node-llama-cpp
```

This package comes with pre-built binaries for macOS, Linux and Windows.

If binaries are not available for your platform, it'll fallback to download the latest version of `llama.cpp` and build it from source with `node-gyp`.
To disable this behavior set the environment variable `NODE_LLAMA_CPP_SKIP_DOWNLOAD` to `true`.

## Documentation
### Usage
#### As a chatbot
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {LlamaModel, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const model = new LlamaModel({
    modelPath: path.join(__dirname, "models", "vicuna-13b-v1.5-16k.ggmlv3.q5_1.bin")
})
const session = new LlamaChatSession({model});


const q1 = "Hi there, how are you?";
console.log("User: " + q1);

const a1 = await session.prompt(q1);
console.log("AI: " + a1);


const q2 = "Summerize what you said";
console.log("User: " + q2);

const a2 = await session.prompt(q2);
console.log("AI: " + a2);
```

##### Custom prompt handling against the model
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {LlamaModel, LlamaChatSession, ChatPromptWrapper} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class MyCustomChatPromptWrapper extends ChatPromptWrapper {
    public override wrapPrompt(prompt: string, {systemPrompt, promptIndex}: {systemPrompt: string, promptIndex: number}) {
        if (promptIndex === 0) {
            return "SYSTEM: " + systemPrompt + "\nUSER: " + prompt + "\nASSISTANT:";
        } else {
            return "USER: " + prompt + "\nASSISTANT:";
        }
    }

    public override getStopStrings(): string[] {
        return ["USER:"];
    }
}

const model = new LlamaModel({
    modelPath: path.join(__dirname, "models", "vicuna-13b-v1.5-16k.ggmlv3.q5_1.bin"),
    promptWrapper: new MyCustomChatPromptWrapper() // by default, LlamaChatPromptWrapper is used
})
const session = new LlamaChatSession({model});


const q1 = "Hi there, how are you?";
console.log("User: " + q1);

const a1 = await session.prompt(q1);
console.log("AI: " + a1);


const q2 = "Summerize what you said";
console.log("User: " + q2);

const a2 = await session.prompt(q2);
console.log("AI: " + a2);
```

#### Raw
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {LlamaModel, LlamaChatSession} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const model = new LlamaChatSession({
    modelPath: path.join(__dirname, "models", "vicuna-13b-v1.5-16k.ggmlv3.q5_1.bin")
});

const q1 = "Hi there, how are you?";
console.log("AI: " + q1);

const tokens = model.encode(q1);
const res: number[] = [];
for await (const chunk of model.evaluate(tokens)) {
    res.push(chunk);
    
    // it's important to not concatinate the results as strings,
    // as doing so will break some characters (like some emojis) that are made of multiple tokens.
    // by using an array of tokens, we can decode them correctly together.
    const resString: string = model.decode(Uint32Array.from(res));
    
    const lastPart = resString.split("ASSISTANT:").reverse()[0];
    if (lastPart.includes("USER:"))
        break;
}

const a1 = model.decode(Uint32Array.from(res)).split("USER:")[0];
console.log("AI: " + a1);
```

### CLI
```txt
Usage: node-llama-cpp <command> [options]

Commands:
  node-llama-cpp download           Download a release of llama.cpp and compile it
  node-llama-cpp build              Compile the currently downloaded llama.cpp
  node-llama-cpp clear [type]       Clear files created by llama-cli
  node-llama-cpp chat               Chat with a LLama model

Options:
  -h, --help     Show help                                                                 [boolean]
  -v, --version  Show version number                                                       [boolean]                                                [boolean]
```

#### `download` command
```txt
node-llama-cpp download

Download a release of llama.cpp and compile it

Options:
  -h, --help        Show help                                                              [boolean]
      --repo        The GitHub repository to download a release of llama.cpp from. Can also be set v
                    ia the NODE_LLAMA_CPP_REPO environment variable
                                                           [string] [default: "ggerganov/llama.cpp"]
      --release     The tag of the llama.cpp release to download. Can also be set via the NODE_LLAMA
                    _CPP_REPO_RELEASE environment variable              [string] [default: "latest"]
      --arch        The architecture to compile llama.cpp for                               [string]
      --nodeTarget  The Node.js version to compile llama.cpp for. Example: v18.0.0          [string]
  -v, --version     Show version number                                                    [boolean]
```

#### `build` command
```txt
node-llama-cpp build

Compile the currently downloaded llama.cpp

Options:
  -h, --help        Show help                                                              [boolean]
      --arch        The architecture to compile llama.cpp for                               [string]
      --nodeTarget  The Node.js version to compile llama.cpp for. Example: v18.0.0          [string]
  -v, --version     Show version number                                                    [boolean]
```

#### `clear` command
```txt
node-llama-cpp clear [type]

Clear files created by llama-cli

Options:
  -h, --help     Show help                                                                 [boolean]
      --type     Files to clear        [string] [choices: "source", "build", "all"] [default: "all"]
  -v, --version  Show version number                                                       [boolean]
```

#### `chat` command
```txt
node-llama-cpp chat

Chat with a LLama model

Required:
      --model  LLama model file to use for the chat                              [string] [required]

Optional:
      --systemInfo    Print llama.cpp system info                         [boolean] [default: false]
      --systemPrompt  System prompt to use against the model. [default value: You are a helpful, res
                      pectful and honest assistant. Always answer as helpfully as possible. If a que
                      stion does not make any sense, or is not factually coherent, explain why inste
                      ad of answering something not correct. If you don't know the answer to a quest
                      ion, please don't share false information.]
  [string] [default: "You are a helpful, respectful and honest assistant. Always answer as helpfully
                                                                                        as possible.
                If a question does not make any sense, or is not factually coherent, explain why ins
   tead of answering something not correct. If you don't know the answer to a question, please don't
                                                                          share false information."]

Options:
  -h, --help     Show help                                                                 [boolean]
  -v, --version  Show version number                                                       [boolean]
```
