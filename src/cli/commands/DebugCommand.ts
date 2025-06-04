import os from "os";
import {CommandModule} from "yargs";
import chalk from "chalk";
import {getLlama} from "../../bindings/getLlama.js";
import {prettyPrintObject} from "../../utils/prettyPrintObject.js";
import {logUsedGpuTypeOption} from "../utils/logUsedGpuTypeOption.js";
import {toBytes} from "../utils/toBytes.js";

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

    const vramStatus = await llama.getVramState();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    const getPercentageString = (amount: number, total: number) => {
        if (total === 0)
            return "0";

        return String(Math.floor((amount / total) * 100 * 100) / 100);
    };

    logUsedGpuTypeOption(llama.gpu);
    console.info();

    console.info(`${chalk.yellow("Used VRAM:")} ${getPercentageString(vramStatus.used, vramStatus.total)}% ${chalk.gray("(" + toBytes(vramStatus.used) + "/" + toBytes(vramStatus.total) + ")")}`);
    console.info(`${chalk.yellow("Free VRAM:")} ${getPercentageString(vramStatus.free, vramStatus.total)}% ${chalk.gray("(" + toBytes(vramStatus.free) + "/" + toBytes(vramStatus.total) + ")")}`);
    console.info();
    console.info(`${chalk.yellow("Used RAM:")} ${getPercentageString(usedMemory, totalMemory)}% ${chalk.gray("(" + toBytes(usedMemory) + "/" + toBytes(totalMemory) + ")")}`);
    console.info(`${chalk.yellow("Free RAM:")} ${getPercentageString(freeMemory, totalMemory)}% ${chalk.gray("(" + toBytes(freeMemory) + "/" + toBytes(totalMemory) + ")")}`);
}

async function DebugCmakeOptionsFunction() {
    const llama = await getLlama("lastBuild");

    logUsedGpuTypeOption(llama.gpu);
    console.info();

    console.info(`${chalk.yellow("CMake options:")} ${prettyPrintObject(llama.cmakeOptions)}`);
    console.info(`${chalk.yellow("Release:")} ${prettyPrintObject(llama.llamaCppRelease)}`);
}

