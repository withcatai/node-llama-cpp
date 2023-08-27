import * as readline from "readline/promises";
import process from "process";
import {CommandModule} from "yargs";
import chalk from "chalk";
import withOra from "../../utils/withOra.js";
import {defaultChatSystemPrompt} from "../../config.js";
import {LlamaChatPromptWrapper} from "../../chatWrappers/LlamaChatPromptWrapper.js";
import {GeneralChatPromptWrapper} from "../../chatWrappers/GeneralChatPromptWrapper.js";
import {ChatMLPromptWrapper} from "../../chatWrappers/ChatMLPromptWrapper.js";
import {getChatWrapperByBos} from "../../chatWrappers/createChatWrapperByBos.js";
import {ChatPromptWrapper} from "../../ChatPromptWrapper.js";
import type {LlamaGrammar} from "../../llamaEvaluator/LlamaGrammar.js";

type ChatCommand = {
    model: string,
    systemInfo: boolean,
    systemPrompt: string,
    wrapper: "auto" | "general" | "llamaChat" | "chatML",
    contextSize: number,
    grammar: "text" | Parameters<typeof LlamaGrammar.getFor>[0],
    temperature: number,
    topK: number,
    topP: number,
    maxTokens: number
};

export const ChatCommand: CommandModule<object, ChatCommand> = {
    command: "chat",
    describe: "Chat with a LLama model",
    builder(yargs) {
        return yargs
            .option("model", {
                alias: "m",
                type: "string",
                demandOption: true,
                description: "LLama model file to use for the chat",
                group: "Required:"
            })
            .option("systemInfo", {
                alias: "i",
                type: "boolean",
                default: false,
                description: "Print llama.cpp system info",
                group: "Optional:"
            })
            .option("systemPrompt", {
                alias: "s",
                type: "string",
                default: defaultChatSystemPrompt,
                defaultDescription: "",
                description:
                    "System prompt to use against the model. " +
                    "[default value: " + defaultChatSystemPrompt.split("\n").join(" ") + "]",
                group: "Optional:"
            })
            .option("wrapper", {
                alias: "w",
                type: "string",
                default: "auto" as ChatCommand["wrapper"],
                choices: ["auto", "general", "llamaChat", "chatML"] satisfies ChatCommand["wrapper"][],
                description: "Chat wrapper to use. Use `auto` to automatically select a wrapper based on the model's BOS token",
                group: "Optional:"
            })
            .option("contextSize", {
                alias: "c",
                type: "number",
                default: 1024 * 4,
                description: "Context size to use for the model",
                group: "Optional:"
            })
            .option("grammar", {
                alias: "g",
                type: "string",
                default: "text" as ChatCommand["grammar"],
                choices: ["text", "json", "list", "arithmetic", "japanese", "chess"] satisfies ChatCommand["grammar"][],
                description: "Restrict the model response to a specific grammar, like JSON for example",
                group: "Optional:"
            })
            .option("temperature", {
                alias: "t",
                type: "number",
                default: 0,
                description: "Temperature is a hyperparameter that controls the randomness of the generated text. It affects the probability distribution of the model's output tokens. A higher temperature (e.g., 1.5) makes the output more random and creative, while a lower temperature (e.g., 0.5) makes the output more focused, deterministic, and conservative. The suggested temperature is 0.8, which provides a balance between randomness and determinism. At the extreme, a temperature of 0 will always pick the most likely next token, leading to identical outputs in each run. Set to `0` to disable.",
                group: "Optional:"
            })
            .option("topK", {
                alias: "k",
                type: "number",
                default: 40,
                description: "Limits the model to consider only the K most likely next tokens for sampling at each step of sequence generation. An integer number between `1` and the size of the vocabulary. Set to `0` to disable (which uses the full vocabulary). Only relevant when `temperature` is set to a value greater than 0.",
                group: "Optional:"
            })
            .option("topP", {
                alias: "p",
                type: "number",
                default: 0.95,
                description: "Dynamically selects the smallest set of tokens whose cumulative probability exceeds the threshold P, and samples the next token only from this set. A float number between `0` and `1`. Set to `1` to disable. Only relevant when `temperature` is set to a value greater than `0`.",
                group: "Optional:"
            })
            .option("maxTokens", {
                alias: "mt",
                type: "number",
                default: 0,
                description: "Maximum number of tokens to generate in responses. Set to `0` to disable. Set to `-1` to set to the context size",
                group: "Optional:"
            });
    },
    async handler({
        model, systemInfo, systemPrompt, wrapper, contextSize, grammar,
        temperature, topK, topP, maxTokens
    }) {
        try {
            await RunChat({model, systemInfo, systemPrompt, wrapper, contextSize, grammar, temperature, topK, topP, maxTokens});
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
    }
};


async function RunChat({
    model: modelArg, systemInfo, systemPrompt, wrapper, contextSize, grammar: grammarArg, temperature, topK, topP, maxTokens
}: ChatCommand) {
    const {LlamaChatSession} = await import("../../llamaEvaluator/LlamaChatSession.js");
    const {LlamaModel} = await import("../../llamaEvaluator/LlamaModel.js");
    const {LlamaContext} = await import("../../llamaEvaluator/LlamaContext.js");
    const {LlamaGrammar} = await import("../../llamaEvaluator/LlamaGrammar.js");

    const model = new LlamaModel({
        modelPath: modelArg,
        contextSize,
        temperature,
        topK,
        topP
    });
    const context = new LlamaContext({
        model,
        grammar: grammarArg !== "text"
            ? await LlamaGrammar.getFor(grammarArg)
            : undefined
    });
    const bos = context.getBos(); // bos = beginning of sequence
    const eos = context.getEos(); // eos = end of sequence
    const promptWrapper = getChatWrapper(wrapper, bos);
    const session = new LlamaChatSession({
        context,
        printLLamaSystemInfo: systemInfo,
        systemPrompt,
        promptWrapper
    });

    console.info(`${chalk.yellow("BOS:")} ${bos}`);
    console.info(`${chalk.yellow("EOS:")} ${eos}`);
    console.info(`${chalk.yellow("Chat wrapper:")} ${promptWrapper.wrapperName}`);

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
        await session.prompt(input, {
            maxTokens: maxTokens === -1
                ? context.getContextSize()
                : maxTokens <= 0
                    ? undefined
                    : maxTokens,
            onToken(chunk) {
                process.stdout.write(session.context.decode(Uint32Array.from(chunk)));
            }
        });
        process.stdout.write(endColor);
        console.log();
    }
}

function getChatWrapper(wrapper: ChatCommand["wrapper"], bos: string): ChatPromptWrapper {
    switch (wrapper) {
        case "general":
            return new GeneralChatPromptWrapper();
        case "llamaChat":
            return new LlamaChatPromptWrapper();
        case "chatML":
            return new ChatMLPromptWrapper();
        default:
    }

    if (wrapper === "auto") {
        const chatWrapper = getChatWrapperByBos(bos);

        if (chatWrapper != null)
            return new chatWrapper();

        return new GeneralChatPromptWrapper();
    }

    void (wrapper satisfies never);

    throw new Error("Unknown wrapper: " + wrapper);
}
