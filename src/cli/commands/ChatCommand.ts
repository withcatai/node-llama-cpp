import * as readline from "readline/promises";
import process from "process";
import {CommandModule} from "yargs";
import chalk from "chalk";
import withOra from "../../utils/withOra.js";
import {defaultChatSystemPrompt} from "../../config.js";
import {LlamaChatPromptWrapper} from "../../chatWrappers/LlamaChatPromptWrapper.js";
import {GeneralChatPromptWrapper} from "../../chatWrappers/GeneralChatPromptWrapper.js";

type ChatCommand = {
    model: string,
    systemInfo: boolean,
    systemPrompt: string,
    wrapper: string
};

export const ChatCommand: CommandModule<object, ChatCommand> = {
    command: "chat",
    describe: "Chat with a LLama model",
    builder(yargs) {
        return yargs
            .option("model", {
                type: "string",
                demandOption: true,
                description: "LLama model file to use for the chat",
                group: "Required:"
            })
            .option("systemInfo", {
                type: "boolean",
                default: false,
                description: "Print llama.cpp system info",
                group: "Optional:"
            })
            .option("systemPrompt", {
                type: "string",
                default: defaultChatSystemPrompt,
                defaultDescription: "",
                description:
                    "System prompt to use against the model. " +
                    "[default value: " + defaultChatSystemPrompt.split("\n").join(" ") + "]",
                group: "Optional:"
            })
            .option("wrapper", {
                type: "string",
                default: "general",
                choices: ["general", "llama"],
                description: "Chat wrapper to use",
                group: "Optional:"
            });
    },
    async handler({model, systemInfo, systemPrompt, wrapper}) {
        try {
            await RunChat({model, systemInfo, systemPrompt, wrapper});
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
    }
};


async function RunChat({model: modelArg, systemInfo, systemPrompt, wrapper}: ChatCommand) {
    const {LlamaChatSession} = await import("../../LlamaChatSession.js");
    const {LlamaModel} = await import("../../LlamaModel.js");

    const model = new LlamaModel({
        modelPath: modelArg
    });
    const session = new LlamaChatSession({
        model,
        printLLamaSystemInfo: systemInfo,
        systemPrompt,
        promptWrapper: createChatWrapper(wrapper)
    });

    await withOra({
        loading: chalk.blue("Loading model"),
        success: chalk.blue("Model loaded"),
        fail: chalk.blue("Failed to load model")
    }, async () => {
        await session.init();
    });

    // this is for ora to not interfere with readline
    await new Promise(resolve => setTimeout(resolve, 1));

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const input = await rl.question(chalk.yellow("> "));

        if (input === ".exit")
            break;

        process.stdout.write(chalk.yellow("AI: "));

        const [startColor, endColor] = chalk.blue("MIDDLE").split("MIDDLE");

        process.stdout.write(startColor);
        await session.prompt(input, (chunk) => {
            process.stdout.write(model.decode(Uint32Array.from(chunk)));
        });
        process.stdout.write(endColor);
        console.log();
    }
}

function createChatWrapper(wrapper: string) {
    switch (wrapper) {
        case "general":
            return new GeneralChatPromptWrapper();
        case "llama":
            return new LlamaChatPromptWrapper();
    }
    throw new Error("Unknown wrapper: " + wrapper);
}
