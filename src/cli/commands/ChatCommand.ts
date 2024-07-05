import * as readline from "readline";
import process from "process";
import path from "path";
import {CommandModule} from "yargs";
import chalk from "chalk";
import fs from "fs-extra";
import {chatCommandHistoryFilePath, defaultChatSystemPrompt, documentationPageUrls} from "../../config.js";
import {getIsInDocumentationMode} from "../../state.js";
import {ReplHistory} from "../../utils/ReplHistory.js";
import {defineChatSessionFunction} from "../../evaluator/LlamaChatSession/utils/defineChatSessionFunction.js";
import {getLlama} from "../../bindings/getLlama.js";
import {LlamaGrammar} from "../../evaluator/LlamaGrammar.js";
import {LlamaChatSession} from "../../evaluator/LlamaChatSession/LlamaChatSession.js";
import {LlamaJsonSchemaGrammar} from "../../evaluator/LlamaJsonSchemaGrammar.js";
import {
    BuildGpu, LlamaLogLevel, LlamaLogLevelGreaterThan, nodeLlamaCppGpuOptions, parseNodeLlamaCppGpuOption
} from "../../bindings/types.js";
import withOra from "../../utils/withOra.js";
import {TokenMeter} from "../../evaluator/TokenMeter.js";
import {printInfoLine} from "../utils/printInfoLine.js";
import {
    resolveChatWrapper, SpecializedChatWrapperTypeName, specializedChatWrapperTypeNames
} from "../../chatWrappers/utils/resolveChatWrapper.js";
import {GeneralChatWrapper} from "../../chatWrappers/GeneralChatWrapper.js";
import {printCommonInfoLines} from "../utils/printCommonInfoLines.js";
import {resolveCommandGgufPath} from "../utils/resolveCommandGgufPath.js";
import {withProgressLog} from "../../utils/withProgressLog.js";
import {resolveHeaderFlag} from "../utils/resolveHeaderFlag.js";
import {withCliCommandDescriptionDocsUrl} from "../utils/withCliCommandDescriptionDocsUrl.js";

type ChatCommand = {
    modelPath?: string,
    header?: string[],
    gpu?: BuildGpu | "auto",
    systemInfo: boolean,
    systemPrompt: string,
    systemPromptFile?: string,
    prompt?: string,
    promptFile?: string,
    wrapper: SpecializedChatWrapperTypeName | "auto",
    noJinja?: boolean,
    contextSize?: number,
    batchSize?: number,
    flashAttention?: boolean,
    noTrimWhitespace: boolean,
    grammar: "text" | Parameters<typeof LlamaGrammar.getFor>[1],
    jsonSchemaGrammarFile?: string,
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
    noHistory: boolean,
    environmentFunctions: boolean,
    debug: boolean,
    meter: boolean,
    printTimings: boolean
};

export const ChatCommand: CommandModule<object, ChatCommand> = {
    command: "chat [modelPath]",
    describe: withCliCommandDescriptionDocsUrl(
        "Chat with a Llama model",
        documentationPageUrls.CLI.Chat
    ),
    builder(yargs) {
        const isInDocumentationMode = getIsInDocumentationMode();

        return yargs
            .option("modelPath", {
                alias: ["m", "model", "path", "url"],
                type: "string",
                description: "Llama model file to use for the chat. Can be a path to a local file or a URL of a model file to download"
            })
            .option("header", {
                alias: ["H"],
                type: "string",
                array: true,
                description: "Headers to use when downloading a model from a URL, in the format `key: value`. You can pass this option multiple times to add multiple headers."
            })
            .option("gpu", {
                type: "string",

                // yargs types don't support passing `false` as a choice, although it is supported by yargs
                choices: nodeLlamaCppGpuOptions as any as Exclude<typeof nodeLlamaCppGpuOptions[number], false>[],
                coerce: (value) => {
                    if (value == null || value == "")
                        return undefined;

                    return parseNodeLlamaCppGpuOption(value);
                },
                defaultDescription: "Uses the latest local build, and fallbacks to \"auto\"",
                description: "Compute layer implementation type to use for llama.cpp. If omitted, uses the latest local build, and fallbacks to \"auto\""
            })
            .option("systemInfo", {
                alias: "i",
                type: "boolean",
                default: false,
                description: "Print llama.cpp system info"
            })
            .option("systemPrompt", {
                alias: "s",
                type: "string",
                default: defaultChatSystemPrompt,
                defaultDescription: " ",
                description:
                    "System prompt to use against the model" +
                    (isInDocumentationMode ? "" : (". [default value: " + defaultChatSystemPrompt.split("\n").join(" ") + "]"))
            })
            .option("systemPromptFile", {
                type: "string",
                description: "Path to a file to load text from and use as as the model system prompt"
            })
            .option("prompt", {
                type: "string",
                description: "First prompt to automatically send to the model when starting the chat"
            })
            .option("promptFile", {
                type: "string",
                description: "Path to a file to load text from and use as a first prompt to automatically send to the model when starting the chat"
            })
            .option("wrapper", {
                alias: "w",
                type: "string",
                default: "auto" as ChatCommand["wrapper"],
                choices: ["auto", ...specializedChatWrapperTypeNames] as const,
                description: "Chat wrapper to use. Use `auto` to automatically select a wrapper based on the model's BOS token"
            })
            .option("noJinja", {
                type: "boolean",
                default: false,
                description: "Don't use a Jinja wrapper, even if it's the best option for the model"
            })
            .option("contextSize", {
                alias: "c",
                type: "number",
                description: "Context size to use for the model context",
                default: -1,
                defaultDescription: "Automatically determined based on the available VRAM"
            })
            .option("batchSize", {
                alias: "b",
                type: "number",
                description: "Batch size to use for the model context. The default value is the context size"
            })
            .option("flashAttention", {
                alias: "fa",
                type: "boolean",
                default: false,
                description: "Enable flash attention"
            })
            .option("noTrimWhitespace", {
                type: "boolean",
                alias: ["noTrim"],
                default: false,
                description: "Don't trim whitespaces from the model response"
            })
            .option("grammar", {
                alias: "g",
                type: "string",
                default: "text" as ChatCommand["grammar"],
                choices: ["text", "json", "list", "arithmetic", "japanese", "chess"] satisfies ChatCommand["grammar"][],
                description: "Restrict the model response to a specific grammar, like JSON for example"
            })
            .option("jsonSchemaGrammarFile", {
                alias: ["jsgf"],
                type: "string",
                description: "File path to a JSON schema file, to restrict the model response to only generate output that conforms to the JSON schema"
            })
            .option("threads", {
                type: "number",
                default: 6,
                description: "Number of threads to use for the evaluation of tokens"
            })
            .option("temperature", {
                alias: "t",
                type: "number",
                default: 0,
                description: "Temperature is a hyperparameter that controls the randomness of the generated text. It affects the probability distribution of the model's output tokens. A higher temperature (e.g., 1.5) makes the output more random and creative, while a lower temperature (e.g., 0.5) makes the output more focused, deterministic, and conservative. The suggested temperature is 0.8, which provides a balance between randomness and determinism. At the extreme, a temperature of 0 will always pick the most likely next token, leading to identical outputs in each run. Set to `0` to disable."
            })
            .option("minP", {
                alias: "mp",
                type: "number",
                default: 0,
                description: "From the next token candidates, discard the percentage of tokens with the lowest probability. For example, if set to `0.05`, 5% of the lowest probability tokens will be discarded. This is useful for generating more high-quality results when using a high temperature. Set to a value between `0` and `1` to enable. Only relevant when `temperature` is set to a value greater than `0`."
            })
            .option("topK", {
                alias: "k",
                type: "number",
                default: 40,
                description: "Limits the model to consider only the K most likely next tokens for sampling at each step of sequence generation. An integer number between `1` and the size of the vocabulary. Set to `0` to disable (which uses the full vocabulary). Only relevant when `temperature` is set to a value greater than 0."
            })
            .option("topP", {
                alias: "p",
                type: "number",
                default: 0.95,
                description: "Dynamically selects the smallest set of tokens whose cumulative probability exceeds the threshold P, and samples the next token only from this set. A float number between `0` and `1`. Set to `1` to disable. Only relevant when `temperature` is set to a value greater than `0`."
            })
            .option("gpuLayers", {
                alias: "gl",
                type: "number",
                description: "number of layers to store in VRAM",
                default: -1,
                defaultDescription: "Automatically determined based on the available VRAM"
            })
            .option("repeatPenalty", {
                alias: "rp",
                type: "number",
                default: 1.1,
                description: "Prevent the model from repeating the same token too much. Set to `1` to disable."
            })
            .option("lastTokensRepeatPenalty", {
                alias: "rpn",
                type: "number",
                default: 64,
                description: "Number of recent tokens generated by the model to apply penalties to repetition of"
            })
            .option("penalizeRepeatingNewLine", {
                alias: "rpnl",
                type: "boolean",
                default: true,
                description: "Penalize new line tokens. set `--no-penalizeRepeatingNewLine` or `--no-rpnl` to disable"
            })
            .option("repeatFrequencyPenalty", {
                alias: "rfp",
                type: "number",
                description: "For n time a token is in the `punishTokens` array, lower its probability by `n * repeatFrequencyPenalty`. Set to a value between `0` and `1` to enable."
            })
            .option("repeatPresencePenalty", {
                alias: "rpp",
                type: "number",
                description: "Lower the probability of all the tokens in the `punishTokens` array by `repeatPresencePenalty`. Set to a value between `0` and `1` to enable."
            })
            .option("maxTokens", {
                alias: "mt",
                type: "number",
                default: 0,
                description: "Maximum number of tokens to generate in responses. Set to `0` to disable. Set to `-1` to set to the context size"
            })
            .option("noHistory", {
                alias: "nh",
                type: "boolean",
                default: false,
                description: "Don't load or save chat history"
            })
            .option("environmentFunctions", {
                alias: "ef",
                type: "boolean",
                default: false,
                description: "Provide access to environment functions like `getDate` and `getTime`"
            })
            .option("debug", {
                alias: "d",
                type: "boolean",
                default: false,
                description: "Print llama.cpp info and debug logs"
            })
            .option("meter", {
                type: "boolean",
                default: false,
                description: "Print how many tokens were used as input and output for each response"
            })
            .option("printTimings", {
                alias: "pt",
                type: "boolean",
                default: false,
                description: "Print llama.cpp timings after each response"
            });
    },
    async handler({
        modelPath, header, gpu, systemInfo, systemPrompt, systemPromptFile, prompt,
        promptFile, wrapper, noJinja, contextSize, batchSize, flashAttention,
        noTrimWhitespace, grammar, jsonSchemaGrammarFile, threads, temperature, minP, topK,
        topP, gpuLayers, repeatPenalty, lastTokensRepeatPenalty, penalizeRepeatingNewLine,
        repeatFrequencyPenalty, repeatPresencePenalty, maxTokens, noHistory,
        environmentFunctions, debug, meter, printTimings
    }) {
        try {
            await RunChat({
                modelPath, header, gpu, systemInfo, systemPrompt, systemPromptFile, prompt, promptFile, wrapper, noJinja, contextSize,
                batchSize, flashAttention, noTrimWhitespace, grammar, jsonSchemaGrammarFile, threads, temperature, minP, topK, topP,
                gpuLayers, lastTokensRepeatPenalty, repeatPenalty, penalizeRepeatingNewLine, repeatFrequencyPenalty, repeatPresencePenalty,
                maxTokens, noHistory, environmentFunctions, debug, meter, printTimings
            });
        } catch (err) {
            await new Promise((accept) => setTimeout(accept, 0)); // wait for logs to finish printing
            console.error(err);
            process.exit(1);
        }
    }
};


async function RunChat({
    modelPath: modelArg, header: headerArg, gpu, systemInfo, systemPrompt, systemPromptFile, prompt, promptFile, wrapper, noJinja,
    contextSize, batchSize, flashAttention, noTrimWhitespace, grammar: grammarArg, jsonSchemaGrammarFile: jsonSchemaGrammarFilePath,
    threads, temperature, minP, topK, topP, gpuLayers, lastTokensRepeatPenalty, repeatPenalty, penalizeRepeatingNewLine,
    repeatFrequencyPenalty, repeatPresencePenalty, maxTokens, noHistory, environmentFunctions, debug, meter, printTimings
}: ChatCommand) {
    if (contextSize === -1) contextSize = undefined;
    if (gpuLayers === -1) gpuLayers = undefined;

    const headers = resolveHeaderFlag(headerArg);
    const trimWhitespace = !noTrimWhitespace;

    if (debug)
        console.info(`${chalk.yellow("Log level:")} debug`);

    const llamaLogLevel = debug
        ? LlamaLogLevel.debug
        : LlamaLogLevel.warn;
    const llama = gpu == null
        ? await getLlama("lastBuild", {
            logLevel: llamaLogLevel
        })
        : await getLlama({
            gpu,
            logLevel: llamaLogLevel
        });
    const logBatchSize = batchSize != null;

    const resolvedModelPath = await resolveCommandGgufPath(modelArg, llama, headers, {
        flashAttention
    });

    if (systemInfo)
        console.log(llama.systemInfo);

    if (systemPromptFile != null && systemPromptFile !== "") {
        if (systemPrompt != null && systemPrompt !== "" && systemPrompt !== defaultChatSystemPrompt)
            console.warn(chalk.yellow("Both `systemPrompt` and `systemPromptFile` were specified. `systemPromptFile` will be used."));

        systemPrompt = await fs.readFile(path.resolve(process.cwd(), systemPromptFile), "utf8");
    }

    if (promptFile != null && promptFile !== "") {
        if (prompt != null && prompt !== "")
            console.warn(chalk.yellow("Both `prompt` and `promptFile` were specified. `promptFile` will be used."));

        prompt = await fs.readFile(path.resolve(process.cwd(), promptFile), "utf8");
    }

    if (batchSize != null && contextSize != null && batchSize > contextSize) {
        console.warn(chalk.yellow("Batch size is greater than the context size. Batch size will be set to the context size."));
        batchSize = contextSize;
    }

    let initialPrompt = prompt ?? null;
    const model = await withProgressLog({
        loadingText: chalk.blue.bold("Loading model"),
        successText: chalk.blue("Model loaded"),
        failText: chalk.blue("Failed to load model"),
        liveUpdates: !debug,
        noProgress: debug,
        liveCtrlCSendsAbortSignal: true
    }, async (progressUpdater) => {
        try {
            return await llama.loadModel({
                modelPath: resolvedModelPath,
                gpuLayers: gpuLayers != null
                    ? gpuLayers
                    : contextSize != null
                        ? {fitContext: {contextSize}}
                        : undefined,
                defaultContextFlashAttention: flashAttention,
                ignoreMemorySafetyChecks: gpuLayers != null,
                onLoadProgress(loadProgress: number) {
                    progressUpdater.setProgress(loadProgress);
                },
                loadSignal: progressUpdater.abortSignal
            });
        } catch (err) {
            if (err === progressUpdater.abortSignal?.reason)
                process.exit(0);

            throw err;
        } finally {
            if (llama.logLevel === LlamaLogLevel.debug) {
                await new Promise((accept) => setTimeout(accept, 0)); // wait for logs to finish printing
                console.info();
            }
        }
    });
    const context = await withOra({
        loading: chalk.blue("Creating context"),
        success: chalk.blue("Context created"),
        fail: chalk.blue("Failed to create context"),
        useStatusLogs: debug
    }, async () => {
        try {
            return await model.createContext({
                contextSize: contextSize != null ? contextSize : undefined,
                batchSize: batchSize != null ? batchSize : undefined,
                threads,
                ignoreMemorySafetyChecks: gpuLayers != null || contextSize != null
            });
        } finally {
            if (llama.logLevel === LlamaLogLevel.debug) {
                await new Promise((accept) => setTimeout(accept, 0)); // wait for logs to finish printing
                console.info();
            }
        }
    });
    const grammar = jsonSchemaGrammarFilePath != null
        ? new LlamaJsonSchemaGrammar(
            llama,
            await fs.readJson(
                path.resolve(process.cwd(), jsonSchemaGrammarFilePath)
            )
        )
        : grammarArg !== "text"
            ? await LlamaGrammar.getFor(llama, grammarArg)
            : undefined;
    const chatWrapper = resolveChatWrapper({
        type: wrapper,
        bosString: model.tokens.bosString,
        filename: model.filename,
        fileInfo: model.fileInfo,
        tokenizer: model.tokenizer,
        noJinja
    }) ?? new GeneralChatWrapper();
    const contextSequence = context.getSequence();
    const session = new LlamaChatSession({
        contextSequence,
        systemPrompt,
        chatWrapper: chatWrapper
    });
    let lastTokenMeterState = contextSequence.tokenMeter.getState();

    await new Promise((accept) => setTimeout(accept, 0)); // wait for logs to finish printing

    if (grammarArg != "text" && jsonSchemaGrammarFilePath != null)
        console.warn(chalk.yellow("Both `grammar` and `jsonSchemaGrammarFile` were specified. `jsonSchemaGrammarFile` will be used."));

    if (environmentFunctions && grammar != null) {
        console.warn(chalk.yellow("Environment functions are disabled since a grammar is already specified"));
        environmentFunctions = false;
    }

    const padTitle = "Context".length + 1;
    await printCommonInfoLines({
        context,
        minTitleLength: padTitle,
        printBos: true,
        printEos: true,
        logBatchSize,
        tokenMeterEnabled: meter
    });
    printInfoLine({
        title: "Chat",
        padTitle: padTitle,
        info: [{
            title: "Wrapper",
            value: chatWrapper.wrapperName
        }, {
            title: "Repeat penalty",
            value: `${repeatPenalty} (apply to last ${lastTokensRepeatPenalty} tokens)`
        }, {
            show: repeatFrequencyPenalty != null,
            title: "Repeat frequency penalty",
            value: String(repeatFrequencyPenalty)
        }, {
            show: repeatPresencePenalty != null,
            title: "Repeat presence penalty",
            value: String(repeatPresencePenalty)
        }, {
            show: !penalizeRepeatingNewLine,
            title: "Penalize repeating new line",
            value: "disabled"
        }, {
            show: jsonSchemaGrammarFilePath != null,
            title: "JSON schema grammar file",
            value: () => path.relative(process.cwd(), path.resolve(process.cwd(), jsonSchemaGrammarFilePath ?? ""))
        }, {
            show: jsonSchemaGrammarFilePath == null && grammarArg !== "text",
            title: "Grammar",
            value: grammarArg
        }, {
            show: environmentFunctions,
            title: "Environment functions",
            value: "enabled"
        }]
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

    void session.preloadPrompt("")
        .catch(() => void 0); // don't throw an error if preloading fails because a real prompt is sent early

    // eslint-disable-next-line no-constant-condition
    while (true) {
        let hadNoWhitespaceTextInThisIteration = false;
        let nextPrintLeftovers = "";
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
            grammar: grammar as undefined, // this is a workaround to allow passing both `functions` and `grammar`
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
                let text = nextPrintLeftovers + model.detokenize(chunk);
                nextPrintLeftovers = "";

                if (trimWhitespace) {
                    if (!hadNoWhitespaceTextInThisIteration) {
                        text = text.trimStart();

                        if (text.length > 0)
                            hadNoWhitespaceTextInThisIteration = true;
                    }

                    const textWithTrimmedEnd = text.trimEnd();

                    if (textWithTrimmedEnd.length < text.length) {
                        nextPrintLeftovers = text.slice(textWithTrimmedEnd.length);
                        text = textWithTrimmedEnd;
                    }
                }

                process.stdout.write(text);
            },
            functions: (grammar == null && environmentFunctions)
                ? defaultEnvironmentFunctions
                : undefined,
            trimWhitespaceSuffix: trimWhitespace
        });
        process.stdout.write(endColor);
        console.log();

        if (printTimings) {
            if (LlamaLogLevelGreaterThan(llama.logLevel, LlamaLogLevel.info))
                llama.logLevel = LlamaLogLevel.info;

            await context.printTimings();
            await new Promise((accept) => setTimeout(accept, 0)); // wait for logs to finish printing

            llama.logLevel = llamaLogLevel;
        }

        if (meter) {
            const newTokenMeterState = contextSequence.tokenMeter.getState();
            const tokenMeterDiff = TokenMeter.diff(newTokenMeterState, lastTokenMeterState);
            lastTokenMeterState = newTokenMeterState;

            console.info(`${chalk.dim("Input tokens:")} ${String(tokenMeterDiff.usedInputTokens).padEnd(5, " ")}  ${chalk.dim("Output tokens:")} ${tokenMeterDiff.usedOutputTokens}`);
        }
    }
}

const defaultEnvironmentFunctions = {
    getDate: defineChatSessionFunction({
        description: "Retrieve the current date",
        handler() {
            return new Date().toLocaleDateString();
        }
    }),
    getTime: defineChatSessionFunction({
        description: "Retrieve the current time",
        handler() {
            return new Date().toLocaleTimeString();
        }
    })
};
