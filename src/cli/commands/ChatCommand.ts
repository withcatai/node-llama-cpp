import * as readline from "readline";
import process from "process";
import path from "path";
import {CommandModule} from "yargs";
import chalk from "chalk";
import fs from "fs-extra";
import withOra from "../../utils/withOra.js";
import {chatCommandHistoryFilePath, defaultChatSystemPrompt} from "../../config.js";
import {LlamaChatPromptWrapper} from "../../chatWrappers/LlamaChatPromptWrapper.js";
import {GeneralChatPromptWrapper} from "../../chatWrappers/GeneralChatPromptWrapper.js";
import {ChatMLChatPromptWrapper} from "../../chatWrappers/ChatMLChatPromptWrapper.js";
import {getChatWrapperByBos} from "../../chatWrappers/createChatWrapperByBos.js";
import {ChatPromptWrapper} from "../../ChatPromptWrapper.js";
import {FalconChatPromptWrapper} from "../../chatWrappers/FalconChatPromptWrapper.js";
import {getIsInDocumentationMode} from "../../state.js";
import {ReplHistory} from "../../utils/ReplHistory.js";
import type {LlamaGrammar} from "../../llamaEvaluator/LlamaGrammar.js";

const modelWrappers = ["auto", "general", "llamaChat", "chatML", "falconChat"] as const;

type ChatCommand = {
    model: string,
    systemInfo: boolean,
    printTimings: boolean,
    systemPrompt: string,
    prompt?: string,
    wrapper: (typeof modelWrappers)[number],
    contextSize: number,
    grammar: "text" | Parameters<typeof LlamaGrammar.getFor>[0],
    jsonSchemaGrammarFile?: string,
    threads: number,
    temperature: number,
    topK: number,
    topP: number,
    gpuLayers?: number,
    repeatPenalty: number,
    lastTokensRepeatPenalty: number,
    penalizeRepeatingNewLine: boolean,
    repeatFrequencyPenalty?: number,
    repeatPresencePenalty?: number,
    maxTokens: number,
    noHistory: boolean
};

export const ChatCommand: CommandModule<object, ChatCommand> = {
    command: "chat",
    describe: "Chat with a Llama model",
    builder(yargs) {
        const isInDocumentationMode = getIsInDocumentationMode();

        return yargs
            .option("model", {
                alias: "m",
                type: "string",
                demandOption: true,
                description: "Llama model file to use for the chat",
                group: "Required:"
            })
            .option("systemInfo", {
                alias: "i",
                type: "boolean",
                default: false,
                description: "Print llama.cpp system info",
                group: "Optional:"
            })
            .option("printTimings", {
                type: "boolean",
                default: false,
                description: "Print llama.cpp timings",
                group: "Optional:"
            })
            .option("systemPrompt", {
                alias: "s",
                type: "string",
                default: defaultChatSystemPrompt,
                defaultDescription: " ",
                description:
                    "System prompt to use against the model" +
                    (isInDocumentationMode ? "" : (". [default value: " + defaultChatSystemPrompt.split("\n").join(" ") + "]")),
                group: "Optional:"
            })
            .option("prompt", {
                type: "string",
                description: "First prompt to automatically send to the model when starting the chat",
                group: "Optional:"
            })
            .option("wrapper", {
                alias: "w",
                type: "string",
                default: "general" as ChatCommand["wrapper"],
                choices: modelWrappers,
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
            .option("jsonSchemaGrammarFile", {
                alias: ["jsgf"],
                type: "string",
                description: "File path to a JSON schema file, to restrict the model response to only generate output that conforms to the JSON schema",
                group: "Optional:"
            })
            .option("threads", {
                type: "number",
                default: 6,
                description: "Number of threads to use for the evaluation of tokens",
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
            .option("gpuLayers", {
                alias: "gl",
                type: "number",
                description: "number of layers to store in VRAM",
                group: "Optional:"
            })
            .option("repeatPenalty", {
                alias: "rp",
                type: "number",
                default: 1.1,
                description: "Prevent the model from repeating the same token too much. Set to `1` to disable.",
                group: "Optional:"
            })
            .option("lastTokensRepeatPenalty", {
                alias: "rpn",
                type: "number",
                default: 64,
                description: "Number of recent tokens generated by the model to apply penalties to repetition of",
                group: "Optional:"
            })
            .option("penalizeRepeatingNewLine", {
                alias: "rpnl",
                type: "boolean",
                default: true,
                description: "Penalize new line tokens. set \"--no-penalizeRepeatingNewLine\" or \"--no-rpnl\" to disable",
                group: "Optional:"
            })
            .option("repeatFrequencyPenalty", {
                alias: "rfp",
                type: "number",
                description: "For n time a token is in the `punishTokens` array, lower its probability by `n * repeatFrequencyPenalty`. Set to a value between `0` and `1` to enable.",
                group: "Optional:"
            })
            .option("repeatPresencePenalty", {
                alias: "rpp",
                type: "number",
                description: "Lower the probability of all the tokens in the `punishTokens` array by `repeatPresencePenalty`. Set to a value between `0` and `1` to enable.",
                group: "Optional:"
            })
            .option("maxTokens", {
                alias: "mt",
                type: "number",
                default: 0,
                description: "Maximum number of tokens to generate in responses. Set to `0` to disable. Set to `-1` to set to the context size",
                group: "Optional:"
            })
            .option("noHistory", {
                alias: "nh",
                type: "boolean",
                default: false,
                description: "Don't load or save chat history",
                group: "Optional:"
            });
    },
    async handler({
        model, systemInfo, systemPrompt, prompt, wrapper, contextSize,
        grammar, jsonSchemaGrammarFile, threads, temperature, topK, topP,
        gpuLayers, repeatPenalty, lastTokensRepeatPenalty, penalizeRepeatingNewLine,
        repeatFrequencyPenalty, repeatPresencePenalty, maxTokens, noHistory, printTimings
    }) {
        try {
            await RunChat({
                model, systemInfo, systemPrompt, prompt, wrapper, contextSize, grammar, jsonSchemaGrammarFile, threads, temperature, topK,
                topP, gpuLayers, lastTokensRepeatPenalty, repeatPenalty, penalizeRepeatingNewLine, repeatFrequencyPenalty,
                repeatPresencePenalty, maxTokens, noHistory, printTimings
            });
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
    }
};


async function RunChat({
    model: modelArg, systemInfo, systemPrompt, prompt, wrapper, contextSize, grammar: grammarArg,
    jsonSchemaGrammarFile: jsonSchemaGrammarFilePath, threads, temperature, topK, topP, gpuLayers, lastTokensRepeatPenalty, repeatPenalty,
    penalizeRepeatingNewLine, repeatFrequencyPenalty, repeatPresencePenalty, maxTokens, noHistory, printTimings
}: ChatCommand) {
    const {LlamaChatSession} = await import("../../llamaEvaluator/LlamaChatSession.js");
    const {LlamaModel} = await import("../../llamaEvaluator/LlamaModel.js");
    const {LlamaContext} = await import("../../llamaEvaluator/LlamaContext.js");
    const {LlamaGrammar} = await import("../../llamaEvaluator/LlamaGrammar.js");
    const {LlamaJsonSchemaGrammar} = await import("../../llamaEvaluator/LlamaJsonSchemaGrammar.js");

    let initialPrompt = prompt ?? null;
    const model = new LlamaModel({
        modelPath: path.resolve(process.cwd(), modelArg),
        gpuLayers: gpuLayers != null ? gpuLayers : undefined
    });
    const context = new LlamaContext({
        model,
        contextSize,
        threads
    });
    const grammar = jsonSchemaGrammarFilePath != null
        ? new LlamaJsonSchemaGrammar(
            await fs.readJson(
                path.resolve(process.cwd(), jsonSchemaGrammarFilePath)
            )
        )
        : grammarArg !== "text"
            ? await LlamaGrammar.getFor(grammarArg)
            : undefined;
    const bos = context.getBosString(); // bos = beginning of sequence
    const eos = context.getEosString(); // eos = end of sequence
    const promptWrapper = getChatWrapper(wrapper, bos);
    const session = new LlamaChatSession({
        context,
        printLLamaSystemInfo: systemInfo,
        systemPrompt,
        promptWrapper
    });

    if (grammarArg != "text" && jsonSchemaGrammarFilePath != null)
        console.warn(chalk.yellow("Both `grammar` and `jsonSchemaGrammarFile` were specified. `jsonSchemaGrammarFile` will be used."));

    console.info(`${chalk.yellow("BOS:")} ${bos}`);
    console.info(`${chalk.yellow("EOS:")} ${eos}`);
    console.info(`${chalk.yellow("Chat wrapper:")} ${promptWrapper.wrapperName}`);
    console.info(`${chalk.yellow("Repeat penalty:")} ${repeatPenalty} (apply to last ${lastTokensRepeatPenalty} tokens)`);

    if (repeatFrequencyPenalty != null)
        console.info(`${chalk.yellow("Repeat frequency penalty:")} ${repeatFrequencyPenalty}`);

    if (repeatPresencePenalty != null)
        console.info(`${chalk.yellow("Repeat presence penalty:")} ${repeatPresencePenalty}`);

    if (!penalizeRepeatingNewLine)
        console.info(`${chalk.yellow("Penalize repeating new line:")} disabled`);

    if (jsonSchemaGrammarFilePath != null)
        console.info(`${chalk.yellow("JSON schema grammar file:")} ${
            path.relative(process.cwd(), path.resolve(process.cwd(), jsonSchemaGrammarFilePath))
        }`);
    else if (grammarArg !== "text")
        console.info(`${chalk.yellow("Grammar:")} ${grammarArg}`);

    await withOra({
        loading: chalk.blue("Loading model"),
        success: chalk.blue("Model loaded"),
        fail: chalk.blue("Failed to load model")
    }, async () => {
        await session.init();
    });

    // this is for ora to not interfere with readline
    await new Promise(resolve => setTimeout(resolve, 1));

    const replHistory = await ReplHistory.load(chatCommandHistoryFilePath, !noHistory);

    async function getPrompt() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            history: replHistory.history.slice()
        });

        const res: string = await new Promise((accept) => rl.question(chalk.yellow("> "), accept));
        rl.close();

        return res;
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const input = initialPrompt != null
            ? initialPrompt
            : await getPrompt();

        if (initialPrompt != null) {
            console.log(chalk.green("> ") + initialPrompt);
            initialPrompt = null;
        } else
            await replHistory.add(input);

        if (input === ".exit")
            break;

        process.stdout.write(chalk.yellow("AI: "));

        const [startColor, endColor] = chalk.blue("MIDDLE").split("MIDDLE");

        process.stdout.write(startColor);
        await session.prompt(input, {
            grammar,
            temperature,
            topK,
            topP,
            repeatPenalty: {
                penalty: repeatPenalty,
                frequencyPenalty: repeatFrequencyPenalty != null ? repeatFrequencyPenalty : undefined,
                presencePenalty: repeatPresencePenalty != null ? repeatPresencePenalty : undefined,
                penalizeNewLine: penalizeRepeatingNewLine,
                lastTokens: lastTokensRepeatPenalty
            },
            maxTokens: maxTokens === -1
                ? context.getContextSize()
                : maxTokens <= 0
                    ? undefined
                    : maxTokens,
            onToken(chunk) {
                process.stdout.write(session.context.decode(chunk));
            }
        });
        process.stdout.write(endColor);
        console.log();

        if (printTimings)
            context.printTimings();
    }
}

function getChatWrapper(wrapper: ChatCommand["wrapper"], bos: string | null): ChatPromptWrapper {
    switch (wrapper) {
        case "general":
            return new GeneralChatPromptWrapper();
        case "llamaChat":
            return new LlamaChatPromptWrapper();
        case "chatML":
            return new ChatMLChatPromptWrapper();
        case "falconChat":
            return new FalconChatPromptWrapper();
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
