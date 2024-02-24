import os from "os";
import {CommandModule} from "yargs";
import bytes from "bytes";
import chalk from "chalk";
import {getLlama} from "../../bindings/getLlama.js";
import {Llama} from "../../bindings/Llama.js";
import {prettyPrintObject} from "../../utils/prettyPrintObject.js";
import {logEnabledComputeLayers} from "../utils/logEnabledComputeLayers.js";

const debugFunctions = ["vram", "cmakeOptions"] as const;
type DebugCommand = {
    function: (typeof debugFunctions)[number]
};

export const DebugCommand: CommandModule<object, DebugCommand> = {
    command: "debug [function]",
    describe: false,
    builder(yargs) {
        return yargs
            .option("function", {
                type: "string",
                choices: debugFunctions,
                demandOption: true,
                description: "debug function to run"
            });
    },
    async handler({function: func}: DebugCommand) {
        if (func === "vram")
            await DebugVramFunction();
        else if (func === "cmakeOptions")
            await DebugCmakeOptionsFunction();
        else
            void (func satisfies never);
    }
};

async function DebugVramFunction() {
    const llama = await getLlama("lastBuild");

    const vramStatus = llama.getVramState();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    logComputeLayers(llama);

    console.info(`${chalk.yellow("Used VRAM:")} ${Math.ceil((vramStatus.used / vramStatus.total) * 100 * 100) / 100}% ${chalk.grey("(" + bytes(vramStatus.used) + "/" + bytes(vramStatus.total) + ")")}`);
    console.info(`${chalk.yellow("Free VRAM:")} ${Math.floor((vramStatus.free / vramStatus.total) * 100 * 100) / 100}% ${chalk.grey("(" + bytes(vramStatus.free) + "/" + bytes(vramStatus.total) + ")")}`);
    console.info();
    console.info(`${chalk.yellow("Used RAM:")} ${Math.ceil((usedMemory / totalMemory) * 100 * 100) / 100}% ${chalk.grey("(" + bytes(usedMemory) + "/" + bytes(totalMemory) + ")")}`);
    console.info(`${chalk.yellow("Free RAM:")} ${Math.floor((freeMemory / totalMemory) * 100 * 100) / 100}% ${chalk.grey("(" + bytes(freeMemory) + "/" + bytes(totalMemory) + ")")}`);
}

async function DebugCmakeOptionsFunction() {
    const llama = await getLlama("lastBuild");

    logComputeLayers(llama);

    console.info(`${chalk.yellow("CMake options:")} ${prettyPrintObject(llama.cmakeOptions)}`);
}

function logComputeLayers(llama: Llama) {
    logEnabledComputeLayers({
        metal: llama.metal,
        cuda: llama.cuda,
        vulkan: llama.vulkan
    });

    const hasEnabledLayers = llama.metal || llama.cuda || llama.vulkan;

    if (hasEnabledLayers)
        console.info();
}
