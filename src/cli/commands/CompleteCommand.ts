import * as readline from "readline";
import process from "process";
import path from "path";
import {CommandModule} from "yargs";
import chalk from "chalk";
import fs from "fs-extra";
import withStatusLogs from "../../utils/withStatusLogs.js";
import {getLlama} from "../../bindings/getLlama.js";
import {LlamaModel} from "../../evaluator/LlamaModel.js";
import {LlamaContext} from "../../evaluator/LlamaContext/LlamaContext.js";
import {LlamaLogLevel} from "../../bindings/types.js";
import {LlamaCompletion} from "../../evaluator/LlamaCompletion.js";

type CompleteCommand = {
    model: string,
    systemInfo: boolean,
    text?: string,
    textFile?: string,
    contextSize: number,
    batchSize?: number,
    threads: number,
    temperature: number,
    minP: number,
    topK: number,
    topP: number,
    gpuLayers?: number,
    repeatPenalty: number,
    lastTokensRepeatPenalty: number,
    penalizeRepeatingNewLine: boolean,
    repeatFrequencyPenalty?: number,
    repeatPresencePenalty?: number,
    maxTokens: number,
    noInfoLog: boolean,
    printTimings: boolean
};

export const CompleteCommand: CommandModule<object, CompleteCommand> = {
    command: "complete",
    describe: "Generate a completion for a given text",
    builder(yargs) {
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
            .option("text", {
                type: "string",
                description: "First text to automatically start generating completion for",
                group: "Optional:"
            })
            .option("textFile", {
                type: "string",
                description: "Path to a file to load text from and use as the first text to automatically start generating completion for",
                group: "Optional:"
            })
            .option("contextSize", {
                alias: "c",
                type: "number",
                default: 1024 * 4,
                description: "Context size to use for the model context",
                group: "Optional:"
            })
            .option("batchSize", {
                alias: "b",
                type: "number",
                description: "Batch size to use for the model context. The default value is the context size",
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
            .option("minP", {
                alias: "mp",
                type: "number",
                default: 0,
                description: "From the next token candidates, discard the percentage of tokens with the lowest probability. For example, if set to `0.05`, 5% of the lowest probability tokens will be discarded. This is useful for generating more high-quality results when using a high temperature. Set to a value between `0` and `1` to enable. Only relevant when `temperature` is set to a value greater than `0`.",
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
            .option("noInfoLog", {
                alias: "nl",
                type: "boolean",
                default: false,
                description: "Disable llama.cpp info logs",
                group: "Optional:"
            })
            .option("printTimings", {
                alias: "pt",
                type: "boolean",
                default: false,
                description: "Print llama.cpp timings after each response",
                group: "Optional:"
            });
    },
    async handler({
        model, systemInfo, text, textFile, contextSize, batchSize,
        threads, temperature, minP, topK,
        topP, gpuLayers, repeatPenalty, lastTokensRepeatPenalty, penalizeRepeatingNewLine,
        repeatFrequencyPenalty, repeatPresencePenalty, maxTokens,
        noInfoLog, printTimings
    }) {
        try {
            await RunCompletion({
                model, systemInfo, text, textFile, contextSize, batchSize,
                threads, temperature, minP, topK, topP, gpuLayers, lastTokensRepeatPenalty,
                repeatPenalty, penalizeRepeatingNewLine, repeatFrequencyPenalty, repeatPresencePenalty, maxTokens,
                noInfoLog, printTimings
            });
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
    }
};


async function RunCompletion({
    model: modelArg, systemInfo, text, textFile, contextSize, batchSize,
    threads, temperature, minP, topK, topP, gpuLayers,
    lastTokensRepeatPenalty, repeatPenalty, penalizeRepeatingNewLine, repeatFrequencyPenalty, repeatPresencePenalty,
    maxTokens, noInfoLog, printTimings
}: CompleteCommand) {
    if (noInfoLog)
        console.info(`${chalk.yellow("Log level:")} warn`);

    const llama = await getLlama("lastBuild", {
        logLevel: noInfoLog
            ? LlamaLogLevel.warn
            : LlamaLogLevel.debug
    });
    const logBatchSize = batchSize != null;

    if (systemInfo)
        console.log(llama.systemInfo);

    if (textFile != null && textFile !== "") {
        if (text != null && text !== "")
            console.warn(chalk.yellow("Both `text` and `textFile` were specified. `textFile` will be used."));

        text = await fs.readFile(path.resolve(process.cwd(), textFile), "utf8");
    }

    if (batchSize == null)
        batchSize = contextSize;
    else if (batchSize > contextSize) {
        console.warn(chalk.yellow("Batch size is greater than the context size. Batch size will be set to the context size."));
        batchSize = contextSize;
    }

    let initialText = text ?? null;
    const model = await withStatusLogs({
        loading: chalk.blue("Loading model"),
        success: chalk.blue("Model loaded"),
        fail: chalk.blue("Failed to load model")
    }, async () => new LlamaModel({
        llama,
        modelPath: path.resolve(process.cwd(), modelArg),
        gpuLayers: gpuLayers != null ? gpuLayers : undefined
    }));
    const context = await withStatusLogs({
        loading: chalk.blue("Creating context"),
        success: chalk.blue("Context created"),
        fail: chalk.blue("Failed to create context")
    }, async () => new LlamaContext({
        model,
        contextSize,
        batchSize,
        threads
    }));

    const completion = new LlamaCompletion({
        contextSequence: context.getSequence()
    });

    await new Promise((accept) => setTimeout(accept, 0)); // wait for logs to finish printing

    console.info(`${chalk.yellow("Context size:")} ${context.contextSize}`);

    if (logBatchSize)
        console.info(`${chalk.yellow("Batch size:")} ${context.batchSize}`);

    console.info(`${chalk.yellow("Train context size:")} ${model.trainContextSize}`);
    console.info(`${chalk.yellow("Model type:")} ${model.typeDescription}`);
    console.info(`${chalk.yellow("Repeat penalty:")} ${repeatPenalty} (apply to last ${lastTokensRepeatPenalty} tokens)`);

    if (repeatFrequencyPenalty != null)
        console.info(`${chalk.yellow("Repeat frequency penalty:")} ${repeatFrequencyPenalty}`);

    if (repeatPresencePenalty != null)
        console.info(`${chalk.yellow("Repeat presence penalty:")} ${repeatPresencePenalty}`);

    if (!penalizeRepeatingNewLine)
        console.info(`${chalk.yellow("Penalize repeating new line:")} disabled`);

    // this is for ora to not interfere with readline
    await new Promise(resolve => setTimeout(resolve, 1));

    const replHistory: string[] = [];

    async function getPrompt() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            history: replHistory.slice()
        });

        const res: string = await new Promise((accept) => rl.question(chalk.yellow("> "), accept));
        rl.close();

        return res;
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const input = initialText != null
            ? initialText
            : await getPrompt();

        if (initialText != null) {
            console.log(chalk.green("> ") + initialText);
            initialText = null;
        } else
            await replHistory.push(input);

        if (input === ".exit")
            break;

        process.stdout.write(chalk.yellow("Completion: "));

        const [startColor, endColor] = chalk.blue("MIDDLE").split("MIDDLE");

        process.stdout.write(startColor);
        await completion.generateCompletion(input, {
            temperature,
            minP,
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
                ? context.contextSize
                : maxTokens <= 0
                    ? undefined
                    : maxTokens,
            onToken(chunk) {
                process.stdout.write(model.detokenize(chunk));
            }
        });
        process.stdout.write(endColor);
        console.log();

        if (printTimings)
            await context.printTimings();
    }
}
