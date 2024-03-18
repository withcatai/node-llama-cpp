import * as readline from "readline";
import process from "process";
import path from "path";
import {CommandModule} from "yargs";
import chalk from "chalk";
import fs from "fs-extra";
import withStatusLogs from "../../utils/withStatusLogs.js";
import {getLlama} from "../../bindings/getLlama.js";
import {LlamaLogLevel} from "../../bindings/types.js";
import {LlamaCompletion} from "../../evaluator/LlamaCompletion.js";

type InfillCommand = {
    model: string,
    systemInfo: boolean,
    prefix?: string,
    prefixFile?: string,
    suffix?: string,
    suffixFile?: string,
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

export const InfillCommand: CommandModule<object, InfillCommand> = {
    command: "infill",
    describe: "Generate an infill completion for a given suffix and prefix texts",
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
            .option("prefix", {
                type: "string",
                description: "First prefix text to automatically load",
                group: "Optional:"
            })
            .option("prefixFile", {
                type: "string",
                description: "Path to a file to load prefix text from automatically",
                group: "Optional:"
            })
            .option("suffix", {
                type: "string",
                description: "First suffix text to automatically load. Requires `prefix` or `prefixFile` to be set",
                group: "Optional:"
            })
            .option("suffixFile", {
                type: "string",
                description: "Path to a file to load suffix text from automatically. Requires `prefix` or `prefixFile` to be set",
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
        model, systemInfo, prefix, prefixFile, suffix, suffixFile, contextSize, batchSize,
        threads, temperature, minP, topK,
        topP, gpuLayers, repeatPenalty, lastTokensRepeatPenalty, penalizeRepeatingNewLine,
        repeatFrequencyPenalty, repeatPresencePenalty, maxTokens,
        noInfoLog, printTimings
    }) {
        try {
            await RunInfill({
                model, systemInfo, prefix, prefixFile, suffix, suffixFile, contextSize, batchSize,
                threads, temperature, minP, topK, topP, gpuLayers, lastTokensRepeatPenalty,
                repeatPenalty, penalizeRepeatingNewLine, repeatFrequencyPenalty, repeatPresencePenalty, maxTokens,
                noInfoLog, printTimings
            });
        } catch (err) {
            await new Promise((accept) => setTimeout(accept, 0)); // wait for logs to finish printing
            console.error(err);
            process.exit(1);
        }
    }
};


async function RunInfill({
    model: modelArg, systemInfo, prefix, prefixFile, suffix, suffixFile, contextSize, batchSize,
    threads, temperature, minP, topK, topP, gpuLayers,
    lastTokensRepeatPenalty, repeatPenalty, penalizeRepeatingNewLine, repeatFrequencyPenalty, repeatPresencePenalty,
    maxTokens, noInfoLog, printTimings
}: InfillCommand) {
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

    if (prefixFile != null && prefixFile !== "") {
        if (prefix != null && prefix !== "")
            console.warn(chalk.yellow("Both `prefix` and `prefixFile` were specified. `prefixFile` will be used."));

        prefix = await fs.readFile(path.resolve(process.cwd(), prefixFile), "utf8");
    }

    if (suffixFile != null && suffixFile !== "") {
        if (suffix != null && suffix !== "")
            console.warn(chalk.yellow("Both `suffix` and `suffixFile` were specified. `suffixFile` will be used."));

        suffix = await fs.readFile(path.resolve(process.cwd(), suffixFile), "utf8");
    }

    if (suffix != null && prefix == null) {
        console.warn(chalk.yellow("Suffix was specified but no prefix was specified. Suffix will be ignored."));
        suffix = undefined;
    }

    if (batchSize == null)
        batchSize = contextSize;
    else if (batchSize > contextSize) {
        console.warn(chalk.yellow("Batch size is greater than the context size. Batch size will be set to the context size."));
        batchSize = contextSize;
    }

    let initialPrefix = prefix ?? null;
    let initialSuffix = suffix ?? null;

    const model = await withStatusLogs({
        loading: chalk.blue("Loading model"),
        success: chalk.blue("Model loaded"),
        fail: chalk.blue("Failed to load model")
    }, async () => {
        try {
            return await llama.loadModel({
                modelPath: path.resolve(process.cwd(), modelArg),
                gpuLayers: gpuLayers != null ? gpuLayers : undefined
            });
        } finally {
            if (llama.logLevel === LlamaLogLevel.debug) {
                await new Promise((accept) => setTimeout(accept, 0)); // wait for logs to finish printing
                console.info();
            }
        }
    });
    const context = await withStatusLogs({
        loading: chalk.blue("Creating context"),
        success: chalk.blue("Context created"),
        fail: chalk.blue("Failed to create context")
    }, async () => {
        try {
            return await model.createContext({
                contextSize,
                batchSize,
                threads
            });
        } finally {
            if (llama.logLevel === LlamaLogLevel.debug) {
                await new Promise((accept) => setTimeout(accept, 0)); // wait for logs to finish printing
                console.info();
            }
        }
    });

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

    if (!completion.infillSupported) {
        console.log(chalk.red("Infill is not supported for this model"));
        process.exit(1);
    }

    const replPrefixHistory: string[] = [];
    const replSuffixHistory: string[] = [];

    async function getInput(name: "Prefix" | "Suffix") {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            history: name === "Prefix"
                ? replPrefixHistory.slice()
                : replSuffixHistory.slice()
        });

        const res: string = await new Promise((accept) => rl.question(chalk.yellow(name + "> "), accept));
        rl.close();

        return res;
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const prefixInput = initialPrefix != null
            ? initialPrefix
            : await getInput("Prefix");

        if (initialPrefix != null) {
            console.log(chalk.green("Prefix> ") + initialPrefix);
            initialPrefix = null;
        } else
            await replPrefixHistory.push(prefixInput);

        if (prefixInput === ".exit")
            break;

        const suffixInput = initialSuffix != null
            ? initialSuffix
            : await getInput("Suffix");

        if (initialSuffix != null) {
            console.log(chalk.green("Suffix> ") + initialSuffix);
            initialSuffix = null;
        } else
            await replSuffixHistory.push(suffixInput);

        if (suffixInput === ".exit")
            break;

        process.stdout.write(chalk.yellow("Infill: "));

        const [startColor, endColor] = chalk.blue("MIDDLE").split("MIDDLE");

        process.stdout.write(startColor);
        await completion.generateInfillCompletion(prefixInput, suffixInput, {
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