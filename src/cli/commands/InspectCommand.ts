import os from "os";
import {CommandModule} from "yargs";
import bytes from "bytes";
import chalk from "chalk";
import {getLlamaForOptions} from "../../bindings/getLlama.js";
import {detectAvailableComputeLayers} from "../../bindings/utils/detectAvailableComputeLayers.js";
import {getPlatform} from "../../bindings/utils/getPlatform.js";
import {BuildGpu, LlamaLogLevel} from "../../bindings/types.js";
import {getPrettyBuildGpuName} from "../../bindings/consts.js";

const inspectFunctions = ["gpu"] as const;
type InspectCommand = {
    function: (typeof inspectFunctions)[number]
};

export const InspectCommand: CommandModule<object, InspectCommand> = {
    command: "inspect [function]",
    describe: "Inspect the inner workings of node-llama-cpp",
    builder(yargs) {
        return yargs
            .option("function", {
                type: "string",
                choices: inspectFunctions,
                demandOption: true,
                description: "inspect function to run"
            });
    },
    async handler({function: func}: InspectCommand) {
        if (func === "gpu")
            await InspectGpuFunction();
        else
            void (func satisfies never);
    }
};

async function InspectGpuFunction() {
    const platform = getPlatform();
    const arch = process.arch;
    const availableComputeLayers = await detectAvailableComputeLayers({platform});
    const gpusToLogVramUsageOf: BuildGpu[] = [];

    if (platform === "mac" && arch === "arm64") {
        console.info(`${chalk.yellow("Metal:")} ${chalk.green("available")}`);
        gpusToLogVramUsageOf.push("metal");
    } else if (platform === "mac") {
        console.info(`${chalk.yellow("Metal:")} ${chalk.red("not supported by llama.cpp on Intel Macs")}`);
    }

    if (availableComputeLayers.cuda.hasNvidiaDriver && !availableComputeLayers.cuda.hasCudaRuntime) {
        console.info(`${chalk.yellow("CUDA:")} ${chalk.red("NVIDIA driver is installed, but CUDA runtime is not")}`);
    } else if (availableComputeLayers.cuda.hasCudaRuntime && !availableComputeLayers.cuda.hasNvidiaDriver) {
        console.info(`${chalk.yellow("CUDA:")} ${chalk.red("CUDA runtime is installed, but NVIDIA driver is not")}`);
    } else if (availableComputeLayers.cuda.hasCudaRuntime && availableComputeLayers.cuda.hasNvidiaDriver) {
        console.info(`${chalk.yellow("CUDA:")} ${chalk.green("available")}`);
        gpusToLogVramUsageOf.push("cuda");
    }

    if (availableComputeLayers.vulkan) {
        console.info(`${chalk.yellow("Vulkan:")} ${chalk.green("available")}`);
        gpusToLogVramUsageOf.push("vulkan");
    }

    for (const gpu of gpusToLogVramUsageOf) {
        console.info();
        await logGpuVramUsage(gpu);
    }

    console.info();
    await logRamUsage();
}

async function logGpuVramUsage(gpu: BuildGpu) {
    try {
        const llama = await getLlamaForOptions({
            gpu: gpu,
            build: "never",
            progressLogs: false,
            logLevel: LlamaLogLevel.warn
        }, {
            skipLlamaInit: true
        });
        const gpuName = getPrettyBuildGpuName(gpu);
        const vramStatus = llama.getVramState();

        console.info(`${chalk.yellow(`${gpuName} used VRAM:`)} ${getPercentageString(vramStatus.used, vramStatus.total)}% ${chalk.grey("(" + bytes(vramStatus.used) + "/" + bytes(vramStatus.total) + ")")}`);
        console.info(`${chalk.yellow(`${gpuName} free VRAM:`)} ${getPercentageString(vramStatus.free, vramStatus.total)}% ${chalk.grey("(" + bytes(vramStatus.free) + "/" + bytes(vramStatus.total) + ")")}`);
    } catch (err) {}
}

async function logRamUsage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    console.info(`${chalk.yellow("Used RAM:")} ${getPercentageString(usedMemory, totalMemory)}% ${chalk.grey("(" + bytes(usedMemory) + "/" + bytes(totalMemory) + ")")}`);
    console.info(`${chalk.yellow("Free RAM:")} ${getPercentageString(freeMemory, totalMemory)}% ${chalk.grey("(" + bytes(freeMemory) + "/" + bytes(totalMemory) + ")")}`);
}

function getPercentageString(amount: number, total: number) {
    if (total === 0)
        return "0";

    return String(Math.floor((amount / total) * 100 * 100) / 100);
}

// // simple script to copy console logs as ansi to clipboard. Used to update the documentation
// import {spawn} from "child_process";
// const pendingLog: string[] = [];
// const originalConsoleInfo = console.info;
// console.info = function info(...args: any[]) {
//     originalConsoleInfo.call(console, ...args);
//     pendingLog.push(args.join(" "));
// };
//
// function copyLogs() {
//     const res = pendingLog.join("\n");
//
//     pbcopy(res);
//     originalConsoleInfo.call(console, "Copied logs to clipboard");
// }
// function pbcopy(text: string) {
//     const pbcopyProcess = spawn("pbcopy");
//     pbcopyProcess.stdin.write(text);
//     pbcopyProcess.stdin.end();
// }
//
// process.on("exit", copyLogs);
