import os from "os";
import {CommandModule} from "yargs";
import bytes from "bytes";
import chalk from "chalk";
import {getLlamaForOptions} from "../../../../bindings/getLlama.js";
import {detectAvailableComputeLayers} from "../../../../bindings/utils/detectAvailableComputeLayers.js";
import {getPlatform} from "../../../../bindings/utils/getPlatform.js";
import {BuildGpu, LlamaLogLevel} from "../../../../bindings/types.js";
import {getPrettyBuildGpuName} from "../../../../bindings/consts.js";
import {getModuleVersion} from "../../../../utils/getModuleVersion.js";
import {withCliCommandDescriptionDocsUrl} from "../../../utils/withCliCommandDescriptionDocsUrl.js";
import {documentationPageUrls} from "../../../../config.js";
import {Llama} from "../../../../bindings/Llama.js";
import {getPlatformInfo} from "../../../../bindings/utils/getPlatformInfo.js";
import {getLinuxDistroInfo} from "../../../../bindings/utils/getLinuxDistroInfo.js";

type InspectGpuCommand = {
    // no options for now
};

export const InspectGpuCommand: CommandModule<object, InspectGpuCommand> = {
    command: "gpu",
    describe: withCliCommandDescriptionDocsUrl(
        "Show the detected GPU types and their VRAM usage",
        documentationPageUrls.CLI.Inspect.GPU
    ),
    async handler() {
        const platform = getPlatform();
        const arch = process.arch;
        const availableComputeLayers = await detectAvailableComputeLayers({platform});
        const gpusToLogVramUsageOf: BuildGpu[] = [];
        const gpuToLlama = new Map<BuildGpu, Llama | undefined>();
        let lastLlama: Llama | undefined;

        async function loadLlamaForGpu(gpu: BuildGpu) {
            if (!gpuToLlama.has(gpu)) {
                const loadedLlama = await getLlamaForGpu(gpu);
                gpuToLlama.set(gpu, loadedLlama);

                if (loadedLlama != null)
                    lastLlama = loadedLlama;
            }

            return gpuToLlama.get(gpu);
        }

        if (platform === "linux") {
            const linuxDistroInfo = await getLinuxDistroInfo();

            if (linuxDistroInfo.prettyName !== "")
                console.info(`${chalk.yellow("OS:")} ${linuxDistroInfo.prettyName} ${chalk.dim("(" + os.arch() + ")")}`);
            else
                console.info(`${chalk.yellow("OS:")} ${linuxDistroInfo.name || os.type()} ${linuxDistroInfo.version || os.release()} ${chalk.dim("(" + os.arch() + ")")}`);
        } else {
            const platformInfo = await getPlatformInfo();
            const osName = platformInfo.name === "Unknown"
                ? os.type()
                : platformInfo.name;

            console.info(`${chalk.yellow("OS:")} ${osName} ${platformInfo.version} ${chalk.dim("(" + os.arch() + ")")}`);
        }

        if (process.versions.node != null)
            console.info(`${chalk.yellow("Node:")} ${process.versions.node} ${chalk.dim("(" + arch + ")")}`);

        if (process.versions.bun != null)
            console.info(`${chalk.yellow("Bun:")} ${process.versions.bun}`);

        const typeScriptVersion = await getInstalledTypescriptVersion();
        if (typeScriptVersion != null)
            console.info(`${chalk.yellow("TypeScript:")} ${typeScriptVersion}`);

        try {
            const moduleVersion = await getModuleVersion();

            if (moduleVersion != null)
                console.info(`${chalk.yellow("node-llama-cpp:")} ${moduleVersion}`);
        } catch (err) {
            // do nothing
        }

        console.info();

        if (platform === "mac" && arch === "arm64") {
            const llama = await loadLlamaForGpu("metal");

            if (llama == null) {
                console.info(`${chalk.yellow("Metal:")} ${chalk.red("Metal is detected, but using it failed")}`);
            } else {
                console.info(`${chalk.yellow("Metal:")} ${chalk.green("available")}`);
                gpusToLogVramUsageOf.push("metal");
            }
        } else if (platform === "mac") {
            console.info(`${chalk.yellow("Metal:")} ${chalk.red("not supported by llama.cpp on Intel Macs")}`);

            const llama = await loadLlamaForGpu(false);
            if (llama == null) {
                console.info(`${chalk.yellow("CPU:")} ${chalk.red("Loading a binding with only CPU support failed")}`);
            }
        }

        if (availableComputeLayers.cuda.hasNvidiaDriver && !availableComputeLayers.cuda.hasCudaRuntime) {
            console.info(`${chalk.yellow("CUDA:")} ${chalk.red("NVIDIA driver is installed, but CUDA runtime is not")}`);
            console.info(chalk.yellow("To resolve errors related to CUDA, see the CUDA guide: ") + documentationPageUrls.CUDA);
        } else if (availableComputeLayers.cuda.hasCudaRuntime && !availableComputeLayers.cuda.hasNvidiaDriver) {
            console.info(`${chalk.yellow("CUDA:")} ${chalk.red("CUDA runtime is installed, but NVIDIA driver is not")}`);
            console.info(chalk.yellow("To resolve errors related to CUDA, see the CUDA guide: ") + documentationPageUrls.CUDA);
        } else if (availableComputeLayers.cuda.hasCudaRuntime && availableComputeLayers.cuda.hasNvidiaDriver) {
            const llama = await loadLlamaForGpu("cuda");

            if (llama == null) {
                console.info(`${chalk.yellow("CUDA:")} ${chalk.red("CUDA is detected, but using it failed")}`);
                console.info(chalk.yellow("To resolve errors related to CUDA, see the CUDA guide: ") + documentationPageUrls.CUDA);
            } else {
                console.info(`${chalk.yellow("CUDA:")} ${chalk.green("available")}`);
                gpusToLogVramUsageOf.push("cuda");
            }
        }

        if (availableComputeLayers.vulkan) {
            const llama = await loadLlamaForGpu("vulkan");

            if (llama == null) {
                console.info(`${chalk.yellow("Vulkan:")} ${chalk.red("Vulkan is detected, but using it failed")}`);
                console.info(chalk.yellow("To resolve errors related to Vulkan, see the Vulkan guide: ") + documentationPageUrls.Vulkan);
            } else {
                console.info(`${chalk.yellow("Vulkan:")} ${chalk.green("available")}`);
                gpusToLogVramUsageOf.push("vulkan");
            }
        }

        if (lastLlama == null)
            await loadLlamaForGpu(false);

        for (const gpu of gpusToLogVramUsageOf) {
            const llama = gpuToLlama.get(gpu);
            if (llama == null)
                continue;

            console.info();
            await logGpuVramUsage(gpu, llama);
        }

        console.info();
        await logRamUsage(lastLlama?.cpuMathCores);

        if (lastLlama != null)
            await logSwapUsage(lastLlama);
    }
};

async function getLlamaForGpu(gpu: BuildGpu) {
    try {
        return await getLlamaForOptions({
            gpu: gpu,
            build: "never",
            progressLogs: false,
            logLevel: LlamaLogLevel.warn,
            vramPadding: 0
        }, {
            skipLlamaInit: true
        });
    } catch (err) {
        return undefined;
    }
}

async function logGpuVramUsage(gpu: BuildGpu, llama: Llama) {
    try {
        const gpuName = getPrettyBuildGpuName(gpu);
        const vramState = await llama.getVramState();
        const gpuDeviceNames = await llama.getGpuDeviceNames();

        if (gpuDeviceNames.length > 0)
            console.info(`${chalk.yellow(`${gpuName} device${gpuDeviceNames.length > 1 ? "s" : ""}:`)} ${gpuDeviceNames.join(", ")}`);

        console.info(`${chalk.yellow(`${gpuName} used VRAM:`)} ${getPercentageString(vramState.used, vramState.total)}% ${chalk.gray("(" + bytes(vramState.used) + "/" + bytes(vramState.total) + ")")}`);
        console.info(`${chalk.yellow(`${gpuName} free VRAM:`)} ${getPercentageString(vramState.free, vramState.total)}% ${chalk.gray("(" + bytes(vramState.free) + "/" + bytes(vramState.total) + ")")}`);

        if (vramState.unifiedSize > 0)
            console.info(`${chalk.yellow(`${gpuName} unified memory:`)} ${bytes(vramState.unifiedSize)} ${chalk.gray("(" + getPercentageString(vramState.unifiedSize, vramState.total) + "%)")}`);
    } catch (err) {}
}

async function logRamUsage(cpuMathCores?: number) {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const cpuDeviceNames = Array.from(
        new Set(
            os.cpus()
                .map((cpu) => (cpu.model?.trim?.() ?? ""))
                .filter((deviceName) => deviceName.length > 0)
        )
    );

    if (cpuDeviceNames.length > 0)
        console.info(`${chalk.yellow("CPU model" + (cpuDeviceNames.length > 1 ? "s" : "") + ":")} ${cpuDeviceNames.join(", ")}`);

    if (cpuMathCores != null)
        console.info(`${chalk.yellow("Math cores:")} ${cpuMathCores}`);

    console.info(`${chalk.yellow("Used RAM:")} ${getPercentageString(usedMemory, totalMemory)}% ${chalk.gray("(" + bytes(usedMemory) + "/" + bytes(totalMemory) + ")")}`);
    console.info(`${chalk.yellow("Free RAM:")} ${getPercentageString(freeMemory, totalMemory)}% ${chalk.gray("(" + bytes(freeMemory) + "/" + bytes(totalMemory) + ")")}`);
}

async function logSwapUsage(llama: Llama) {
    const swapState = await llama.getSwapState();

    console.info(`${chalk.yellow("Used swap:")} ${getPercentageString(swapState.used, swapState.allocated)}% ${chalk.gray("(" + bytes(swapState.used) + "/" + bytes(swapState.allocated) + ")")}`);
    console.info(`${chalk.yellow("Max swap size:")} ${swapState.maxSize === Infinity ? "dynamic" : bytes(swapState.maxSize)}`);
}

function getPercentageString(amount: number, total: number) {
    if (total === 0)
        return "0";

    return String(Math.floor((amount / total) * 100 * 100) / 100);
}

async function getInstalledTypescriptVersion() {
    try {
        const ts = await import("typescript");
        const version = ts?.version ?? ts?.default?.version;

        if (version != null && typeof version === "string" && version.length > 0)
            return version;

        return null;
    } catch (err) {
        return null;
    }
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
