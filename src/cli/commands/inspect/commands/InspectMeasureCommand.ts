import path from "path";
import process from "process";
import {fileURLToPath} from "url";
import {fork} from "node:child_process";
import {CommandModule} from "yargs";
import chalk from "chalk";
import bytes from "bytes";
import stripAnsi from "strip-ansi";
import {readGgufFileInfo} from "../../../../gguf/readGgufFileInfo.js";
import {resolveCommandGgufPath} from "../../../utils/resolveCommandGgufPath.js";
import {getLlama} from "../../../../bindings/getLlama.js";
import {BuildGpu, LlamaLogLevel, nodeLlamaCppGpuOptions, parseNodeLlamaCppGpuOption} from "../../../../bindings/types.js";
import {LlamaModel} from "../../../../evaluator/LlamaModel/LlamaModel.js";
import {getConsoleLogPrefix} from "../../../../utils/getConsoleLogPrefix.js";
import {ConsoleTable, ConsoleTableColumn} from "../../../utils/ConsoleTable.js";
import {GgufInsights} from "../../../../gguf/insights/GgufInsights.js";
import {resolveHeaderFlag} from "../../../utils/resolveHeaderFlag.js";
import {getPrettyBuildGpuName} from "../../../../bindings/consts.js";
import {getReadablePath} from "../../../utils/getReadablePath.js";
import {withCliCommandDescriptionDocsUrl} from "../../../utils/withCliCommandDescriptionDocsUrl.js";
import {documentationPageUrls} from "../../../../config.js";

type InspectMeasureCommand = {
    modelPath?: string,
    header?: string[],
    gpu?: BuildGpu | "auto",
    minLayers: number,
    maxLayers?: number,
    minContextSize: number,
    maxContextSize?: number,
    flashAttention?: boolean,
    measures: number,
    printHeaderBeforeEachLayer?: boolean,
    evaluateText?: string,
    repeatEvaluateText?: number
};

export const InspectMeasureCommand: CommandModule<object, InspectMeasureCommand> = {
    command: "measure [modelPath]",
    describe: withCliCommandDescriptionDocsUrl(
        "Measure VRAM consumption of a GGUF model file with all possible combinations of gpu layers and context sizes",
        documentationPageUrls.CLI.Inspect.Measure
    ),
    builder(yargs) {
        return yargs
            .option("modelPath", {
                alias: ["m", "model", "path", "url", "uri"],
                type: "string",
                description: "Model file to use for the measurements. Can be a path to a local file or a URI of a model file to download. Leave empty to choose from a list of recommended models"
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
            .option("minLayers", {
                alias: "mnl",
                type: "number",
                default: 1,
                description: "Minimum number of layers to offload to the GPU"
            })
            .option("maxLayers", {
                alias: "mxl",
                type: "number",
                default: -1,
                defaultDescription: "All layers",
                description: "Maximum number of layers to offload to the GPU"
            })
            .option("minContextSize", {
                alias: "mncs",
                type: "number",
                default: 512,
                description: "Minimum context size"
            })
            .option("maxContextSize", {
                alias: "mxcs",
                type: "number",
                default: -1,
                defaultDescription: "Train context size",
                description: "Maximum context size"
            })
            .option("flashAttention", {
                alias: "fa",
                type: "boolean",
                default: false,
                description: "Enable flash attention for the context"
            })
            .option("measures", {
                alias: "n",
                type: "number",
                default: 10,
                description: "Number of context size measures to take for each gpu layers count"
            })
            .option("printHeaderBeforeEachLayer", {
                alias: "ph",
                type: "boolean",
                default: true,
                description: "Print header before each layer's measures"
            })
            .option("evaluateText", {
                alias: ["evaluate", "et"],
                type: "string",
                description: "Text to evaluate with the model"
            })
            .option("repeatEvaluateText", {
                alias: ["repeatEvaluate", "ret"],
                type: "number",
                default: 1,
                description: "Number of times to repeat the evaluation text before sending it for evaluation, in order to make it longer"
            });
    },
    async handler({
        modelPath: ggufPath, header: headerArg, gpu, minLayers, maxLayers, minContextSize, maxContextSize, flashAttention, measures = 10,
        printHeaderBeforeEachLayer = true, evaluateText, repeatEvaluateText
    }: InspectMeasureCommand) {
        if (maxLayers === -1) maxLayers = undefined;
        if (maxContextSize === -1) maxContextSize = undefined;
        if (minLayers < 1) minLayers = 1;

        const headers = resolveHeaderFlag(headerArg);

        // ensure a llama build is available
        const llama = gpu == null
            ? await getLlama("lastBuild", {
                logLevel: LlamaLogLevel.error
            })
            : await getLlama({
                gpu,
                logLevel: LlamaLogLevel.error
            });

        const resolvedGgufPath = await resolveCommandGgufPath(ggufPath, llama, headers);

        console.info(`${chalk.yellow("File:")} ${getReadablePath(resolvedGgufPath)}`);
        console.info(`${chalk.yellow("GPU:")} ${getPrettyBuildGpuName(llama.gpu)}${gpu == null ? chalk.gray(" (last build)") : ""}`);
        console.info();

        const ggufMetadata = await readGgufFileInfo(resolvedGgufPath, {
            sourceType: "filesystem"
        });
        const ggufInsights = await GgufInsights.from(ggufMetadata, llama);
        const totalVram = (await llama.getVramState()).total;

        let lastGpuLayers = maxLayers ?? ggufInsights.totalLayers;
        let previousContextSizeCheck: undefined | number = undefined;

        measureTable.logHeader({drawRowSeparator: !printHeaderBeforeEachLayer});

        while (lastGpuLayers >= (minLayers ?? 0)) {
            let printedAlreadyWithThisProcess = false;
            let hadSuccessInThisProcess = false;
            const getNewProccessValue = () => {
                if (printedAlreadyWithThisProcess)
                    return undefined;

                printedAlreadyWithThisProcess = true;
                return chalk.green("*");
            };

            const done = await measureModel({
                modelPath: resolvedGgufPath,
                gpu: gpu == null
                    ? undefined
                    : llama.gpu,
                maxGpuLayers: lastGpuLayers,
                minGpuLayers: minLayers,
                initialMaxContextSize: previousContextSizeCheck,
                maxContextSize,
                minContextSize,
                flashAttention,
                tests: measures,
                evaluateText: evaluateText == null
                    ? undefined
                    : evaluateText.repeat(repeatEvaluateText ?? 1),
                onInfo({gpuLayers, result}) {
                    if (lastGpuLayers !== gpuLayers) {
                        lastGpuLayers = gpuLayers;
                        previousContextSizeCheck = undefined;
                        measureTable.logLine({});

                        if (printHeaderBeforeEachLayer)
                            measureTable.logHeader({drawRowSeparator: false});
                    }

                    if (result.type === "crash") {
                        if (!hadSuccessInThisProcess) {
                            measureTable.logLine({
                                newProcess: getNewProccessValue(),
                                type: chalk.redBright("Crash"),
                                gpuLayers: String(lastGpuLayers),
                                contextSize: previousContextSizeCheck != null
                                    ? String(previousContextSizeCheck)
                                    : chalk.red(result.result),
                                estimatedModelVram: previousContextSizeCheck == null
                                    ? undefined
                                    : chalk.red(result.result)
                            });
                            lastGpuLayers--;
                        }
                    } else if (result.type === "error") {
                        previousContextSizeCheck = result.contextSize;
                        hadSuccessInThisProcess = true;

                        measureTable.logLine({
                            newProcess: getNewProccessValue(),
                            type: chalk.red("Error"),
                            gpuLayers: String(lastGpuLayers),
                            contextSize: previousContextSizeCheck != null
                                ? String(previousContextSizeCheck)
                                : chalk.red(result.error),
                            estimatedModelVram: previousContextSizeCheck == null
                                ? undefined
                                : chalk.red(result.error)
                        });
                    } else if (result.type === "success") {
                        previousContextSizeCheck = result.contextSize;
                        hadSuccessInThisProcess = true;

                        const modelVramEstimation = ggufInsights.estimateModelResourceRequirements({gpuLayers: lastGpuLayers}).gpuVram;
                        const modelVramEstimationDiffBytes = (modelVramEstimation < result.modelVramUsage ? "-" : "") +
                            bytes(Math.abs(result.modelVramUsage - modelVramEstimation));
                        const modelVramEstimationDiffText = modelVramEstimationDiffBytes.padEnd(9, " ") + " " +
                            padStartAnsi("(" + renderDiffPercentageWithColors(((modelVramEstimation / result.modelVramUsage) - 1) * 100) + ")", 9);

                        const contextVramEstimation = previousContextSizeCheck == null
                            ? undefined
                            : ggufInsights.estimateContextResourceRequirements({
                                contextSize: previousContextSizeCheck,
                                modelGpuLayers: lastGpuLayers,
                                flashAttention
                            }).gpuVram;
                        const contextVramEstimationDiffBytes = (result.contextVramUsage == null || contextVramEstimation == null)
                            ? undefined
                            : (
                                (contextVramEstimation < result.contextVramUsage ? "-" : "") +
                                bytes(Math.abs(result.contextVramUsage - contextVramEstimation))
                            );
                        const contextVramEstimationDiffText = (
                            contextVramEstimation == null || contextVramEstimationDiffBytes == null || result.contextVramUsage == null
                        )
                            ? undefined
                            : (
                                contextVramEstimationDiffBytes.padEnd(9, " ") + " " +
                                padStartAnsi("(" + renderDiffPercentageWithColors(((contextVramEstimation / result.contextVramUsage) - 1) * 100) + ")", 9)
                            );

                        measureTable.logLine({
                            newProcess: getNewProccessValue(),
                            type: previousContextSizeCheck == null
                                ? "Model"
                                : "Context",
                            gpuLayers: String(lastGpuLayers),
                            contextSize: previousContextSizeCheck != null
                                ? String(previousContextSizeCheck)
                                : undefined,

                            estimatedModelVram: bytes(modelVramEstimation),
                            actualModelVram: bytes(result.modelVramUsage),
                            modelEstimationDiff: modelVramEstimationDiffText,

                            estimatedContextVram: contextVramEstimation == null
                                ? undefined
                                : bytes(contextVramEstimation),
                            actualContextVram: result.contextVramUsage == null
                                ? undefined
                                : bytes(result.contextVramUsage),
                            contextEstimationDiff: contextVramEstimationDiffText,
                            totalVramUsage: ((result.totalVramUsage / totalVram) * 100).toFixed(2).padStart(5, "0") + "% " +
                                chalk.gray("(" + bytes(result.totalVramUsage) + "/" + bytes(totalVram) + ")")
                        });
                    }
                }
            });

            if (done)
                break;
        }
    }
};

const measureTable = new ConsoleTable([{
    key: "newProcess",
    title: " ",
    width: 1
}, {
    key: "type",
    title: "Type",
    width: Math.max("Type".length, "Model".length, "Context".length),
    canSpanOverEmptyColumns: true
}, {
    key: "gpuLayers",
    title: "Layers",
    width: "Layers".length,
    canSpanOverEmptyColumns: true
}, {
    key: "contextSize",
    title: "Context size",
    width: "Context size".length,
    canSpanOverEmptyColumns: true
}, {
    key: "estimatedModelVram",
    title: "Estimated model VRAM",
    width: "Estimated model VRAM".length,
    canSpanOverEmptyColumns: true
}, {
    key: "actualModelVram",
    title: "Model VRAM",
    width: "Model VRAM".length
}, {
    key: "modelEstimationDiff",
    title: "Diff",
    width: Math.max("Diff".length, 9 + 1 + 9)
}, {
    key: "estimatedContextVram",
    title: "Estimated context VRAM",
    width: "Estimated context VRAM".length
}, {
    key: "actualContextVram",
    title: "Context VRAM",
    width: "Context VRAM".length
}, {
    key: "contextEstimationDiff",
    title: "Diff",
    width: Math.max("Diff".length, 9 + 1 + 9)
}, {
    key: "totalVramUsage",
    title: "VRAM usage",
    width: Math.max("VRAM usage".length, 8 + 1 + 8 + 1 + 8)
}] as const satisfies readonly ConsoleTableColumn[]);

function renderDiffPercentageWithColors(percentage: number, {
    greenBright = 2,
    green = 6,
    yellow = 10,
    yellowBright = 14
}: {
    greenBright?: number,
    green?: number,
    yellow?: number,
    yellowBright?: number
} = {}): string {
    const percentageText = percentage.toFixed(2).padStart(5, "0") + "%";
    const absPercentage = Math.abs(percentage);

    if (absPercentage < greenBright)
        return chalk.greenBright(percentageText);
    else if (absPercentage < green)
        return chalk.green(percentageText);
    else if (absPercentage < yellow)
        return chalk.yellow(percentageText);
    else if (absPercentage < yellowBright)
        return chalk.yellowBright(percentageText);

    return chalk.red(percentageText);
}

const __filename = fileURLToPath(import.meta.url);
const detectedFileName = path.basename(__filename);
const expectedFileName = "InspectMeasureCommand";

async function measureModel({
    modelPath, gpu, tests, initialMaxContextSize, maxContextSize, minContextSize, maxGpuLayers, minGpuLayers, flashAttention, evaluateText,
    onInfo
}: {
    modelPath: string,
    gpu?: BuildGpu | "auto",
    tests: number,
    initialMaxContextSize?: number,
    maxContextSize?: number,
    minContextSize?: number,
    maxGpuLayers: number,
    minGpuLayers?: number,
    flashAttention?: boolean,
    evaluateText?: string,
    onInfo(data: {
        gpuLayers: number,
        result: {
            type: "error",
            error: string,
            contextSize?: number
        } | {
            type: "crash",
            result: string
        } | {
            type: "success",
            modelVramUsage: number,
            contextSize?: number,
            contextVramUsage?: number,
            contextStateSize?: number,
            totalVramUsage: number
        }
    }): void
}) {
    if (!detectedFileName.startsWith(expectedFileName)) {
        console.warn(
            getConsoleLogPrefix() +
            `"${expectedFileName}.js" file is not independent, so running sub-process tests cannot be done with it\n` +
            getConsoleLogPrefix() +
            'To resolve this issue, make sure that "node-llama-cpp" is not bundled together with other code.'
        );

        throw new Error("Sub-process tests cannot be done with the current file");
    }

    const subProcess = fork(__filename, [], {
        detached: false,
        stdio: [null, null, null, "ipc"],
        env: {
            ...process.env,
            MEASURE_MODEL_CP: "true",
            MEASURE_MODEL_CP_GPU: gpu == null
                ? undefined
                : JSON.stringify(gpu)
        }
    });
    let isPlannedExit = false;
    let forkSucceeded = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const processCreationTimeout = 1000 * 60 * 5;
    const stdTexts: string[] = [];

    let lastGpuLayers = maxGpuLayers;

    function cleanup() {
        if (subProcess.exitCode == null)
            subProcess.kill("SIGKILL");

        if (timeoutHandle != null)
            clearTimeout(timeoutHandle);

        process.off("exit", cleanup);
    }

    process.on("exit", cleanup);

    subProcess.stdout?.on("data", (data) => {
        stdTexts.push(data.toString());
    });
    subProcess.stderr?.on("data", (data) => {
        stdTexts.push(data.toString());
    });

    return Promise.race([
        new Promise<boolean>((_, reject) => {
            timeoutHandle = setTimeout(() => {
                if (!forkSucceeded) {
                    reject(new Error("Measuring using a sub-process timed out"));
                    cleanup();
                }
            }, processCreationTimeout);
        }),
        new Promise<boolean>((resolve, reject) => {
            function done() {
                if (!forkSucceeded)
                    reject(new Error(`Measuring a model failed to run a sub-process via file "${__filename}"`));
                else
                    resolve(isPlannedExit);

                cleanup();
            }

            subProcess.on("message", (message: ChildToParentMessage) => {
                if (message.type === "ready") {
                    forkSucceeded = true;
                    subProcess.send({
                        type: "start",
                        modelPath,
                        tests,
                        initialMaxContextSize,
                        maxContextSize,
                        minContextSize,
                        maxGpuLayers,
                        minGpuLayers,
                        flashAttention,
                        evaluateText
                    } satisfies ParentToChildMessage);

                    if (timeoutHandle != null) {
                        clearTimeout(timeoutHandle);
                        timeoutHandle = null;
                    }
                } else if (message.type === "done") {
                    isPlannedExit = true;
                    subProcess.send({type: "exit"} satisfies ParentToChildMessage);
                } else if (message.type === "error") {
                    lastGpuLayers = message.gpuLayers;

                    onInfo({
                        gpuLayers: lastGpuLayers,
                        result: {
                            type: "error",
                            error: message.error,
                            contextSize: message.contextSize
                        }
                    });
                } else if (message.type === "stats") {
                    lastGpuLayers = message.gpuLayers;

                    onInfo({
                        gpuLayers: message.gpuLayers,
                        result: {
                            type: "success",
                            modelVramUsage: message.modelVramUsage,
                            contextSize: message.contextSize,
                            contextVramUsage: message.contextVramUsage,
                            contextStateSize: message.contextStateSize,
                            totalVramUsage: message.totalVramUsage
                        }
                    });
                }
            });

            subProcess.on("exit", (code) => {
                if (code !== 0 || !isPlannedExit)
                    onInfo({
                        gpuLayers: lastGpuLayers,
                        result: {
                            type: "crash",
                            result: stdTexts.join("")
                        }
                    });

                done();
            });

            if (subProcess.killed || subProcess.exitCode != null) {
                if (subProcess.exitCode !== 0 || !isPlannedExit)
                    onInfo({
                        gpuLayers: lastGpuLayers,
                        result: {
                            type: "crash",
                            result: stdTexts.join("")
                        }
                    });

                done();
            }
        })
    ]);
}

if (process.env.MEASURE_MODEL_CP === "true" && process.send != null) {
    void runTestWorkerLogic();
}

async function runTestWorkerLogic() {
    const gpuEnvVar = process.env.MEASURE_MODEL_CP_GPU;
    const llama = (gpuEnvVar == null || gpuEnvVar === "")
        ? await getLlama("lastBuild", {
            logLevel: LlamaLogLevel.error
        })
        : await getLlama({
            gpu: JSON.parse(gpuEnvVar),
            logLevel: LlamaLogLevel.error
        });

    if (process.send == null)
        throw new Error("No IPC channel to parent process");

    function sendInfoBack(info: ChildToParentMessage) {
        if (process.send == null)
            process.exit(1);

        process.send(info);
    }

    async function testContextSizes({
        model, modelVramUsage, startContextSize, maxContextSize, minContextSize, tests, flashAttention, evaluateText
    }: {
        model: LlamaModel, modelVramUsage: number, startContextSize?: number, maxContextSize?: number, minContextSize?: number,
        tests: number, flashAttention?: boolean, evaluateText?: string
    }) {
        const contextSizeCheckPlan = getContextSizesCheckPlan(
            maxContextSize != null
                ? Math.min(model.trainContextSize, maxContextSize)
                : model.trainContextSize,
            tests,
            minContextSize
        );

        let currentContextSizeCheck = startContextSize == null
            ? -1
            : getNextItemInCheckContextSizesPlan(contextSizeCheckPlan, startContextSize);

        while (currentContextSizeCheck != null) {
            if (currentContextSizeCheck === -1)
                currentContextSizeCheck = null;

            try {
                const preContextVramUsage = (await llama.getVramState()).used;
                const context = await model.createContext({
                    contextSize: currentContextSizeCheck ?? (
                        maxContextSize != null
                            ? {max: maxContextSize}
                            : undefined
                    ),
                    ignoreMemorySafetyChecks: currentContextSizeCheck != null,
                    flashAttention,
                    failedCreationRemedy: false
                });

                if (evaluateText != null && evaluateText != "") {
                    const sequence = context.getSequence();
                    await sequence.evaluateWithoutGeneratingNewTokens(model.tokenize(evaluateText));
                }

                const postContextVramUsage = (await llama.getVramState()).used;

                sendInfoBack({
                    type: "stats",
                    gpuLayers: model.gpuLayers,
                    modelVramUsage,
                    contextSize: context.contextSize,
                    contextVramUsage: postContextVramUsage - preContextVramUsage,
                    contextStateSize: context.stateSize,
                    totalVramUsage: postContextVramUsage
                });
                currentContextSizeCheck = context.contextSize;

                await context.dispose();
            } catch (err) {
                sendInfoBack({
                    type: "error",
                    error: String(err),
                    gpuLayers: model.gpuLayers,
                    contextSize: currentContextSizeCheck == null
                        ? undefined
                        : currentContextSizeCheck
                });

                if (currentContextSizeCheck == null) {
                    currentContextSizeCheck = contextSizeCheckPlan[0]!;
                    continue;
                }
            }

            currentContextSizeCheck = getNextItemInCheckContextSizesPlan(contextSizeCheckPlan, currentContextSizeCheck);
        }
    }

    async function testWithGpuLayers({
        modelPath, gpuLayers, tests, startContextSize, maxContextSize, minContextSize, flashAttention, evaluateText
    }: {
        modelPath: string, gpuLayers: number, tests: number, startContextSize?: number, maxContextSize?: number, minContextSize?: number,
        flashAttention?: boolean, evaluateText?: string
    }) {
        try {
            const preModelVramUsage = (await llama.getVramState()).used;
            const model = await llama.loadModel({
                modelPath,
                gpuLayers,
                defaultContextFlashAttention: flashAttention,
                ignoreMemorySafetyChecks: true
            });
            const postModelVramUsage = (await llama.getVramState()).used;

            sendInfoBack({
                type: "stats",
                gpuLayers: model.gpuLayers,
                modelVramUsage: postModelVramUsage - preModelVramUsage,
                totalVramUsage: postModelVramUsage
            });

            await testContextSizes({
                model,
                modelVramUsage: postModelVramUsage - preModelVramUsage,
                startContextSize,
                maxContextSize,
                minContextSize,
                flashAttention,
                tests,
                evaluateText
            });

            await model.dispose();
        } catch (err) {
            sendInfoBack({
                type: "error",
                error: String(err),
                gpuLayers: gpuLayers
            });
        }
    }

    process.on("message", async (message: ParentToChildMessage) => {
        if (message.type === "start") {
            for (let gpuLayers = message.maxGpuLayers; gpuLayers >= (message.minGpuLayers ?? 0); gpuLayers--) {
                await testWithGpuLayers({
                    modelPath: message.modelPath,
                    gpuLayers,
                    tests: message.tests,
                    startContextSize: gpuLayers == message.maxGpuLayers
                        ? message.initialMaxContextSize
                        : undefined,
                    maxContextSize: message.maxContextSize,
                    minContextSize: message.minContextSize,
                    flashAttention: message.flashAttention,
                    evaluateText: message.evaluateText
                });
            }

            sendInfoBack({type: "done"});
        } else if (message.type === "exit") {
            await llama.dispose();
            process.exit(0);
        }
    });

    process.send({type: "ready"} satisfies ChildToParentMessage);
}

function getContextSizesCheckPlan(trainContextSize: number, tests: number = 10, minContextSize?: number) {
    const res: number[] = [];
    let shouldStop = false;

    const attemptToCoverSizes = [256, 512, 1024, 2048, 4096] as const;

    function addSize(size: number) {
        if (size > trainContextSize) {
            size = trainContextSize;
            shouldStop = true;
        }

        if (size < 2)
            size = 2;

        if (res[res.length - 1] === size) {
            shouldStop = true;
            return;
        }

        res.push(size);
    }

    while (!shouldStop && res.length < tests) {
        const lastSize = res[res.length - 1];

        if (lastSize == null) {
            addSize(Math.max(minContextSize ?? 0, Math.min(attemptToCoverSizes[0], trainContextSize / tests)));
            continue;
        }

        const stepSizesLeft = Math.floor(
            (trainContextSize - Math.min(lastSize, attemptToCoverSizes[attemptToCoverSizes.length - 1]!)) / (tests - res.length)
        );

        let stopAddingAttemptedSizes = false;
        for (const size of attemptToCoverSizes) {
            if (stepSizesLeft > lastSize && lastSize < size && size <= trainContextSize) {
                addSize(size);
                stopAddingAttemptedSizes = true;
                break;
            }
        }
        if (stopAddingAttemptedSizes)
            continue;

        addSize(lastSize + stepSizesLeft);
    }

    return res.reverse();
}

function getNextItemInCheckContextSizesPlan(plan: number[], currentSize: number) {
    for (const size of plan) {
        if (size < currentSize)
            return size;
    }

    return null;
}

type ParentToChildMessage = {
    type: "start",
    modelPath: string,
    tests: number,
    maxGpuLayers: number,
    minGpuLayers?: number,
    flashAttention?: boolean,
    initialMaxContextSize?: number,
    maxContextSize?: number,
    minContextSize?: number,
    evaluateText?: string
} | {
    type: "exit"
};

type ChildToParentMessage = {
    type: "ready" | "done"
} | {
    type: "stats",
    gpuLayers: number,
    modelVramUsage: number,
    contextSize?: number,
    contextVramUsage?: number,
    contextStateSize?: number,
    totalVramUsage: number
} | {
    type: "error",
    error: string,
    gpuLayers: number,
    contextSize?: number
};

function padStartAnsi(text: string, length: number, padChar: string = " ") {
    const textWithoutAnsi = stripAnsi(text);

    return padChar.repeat(Math.max(0, length - textWithoutAnsi.length)) + text;
}
