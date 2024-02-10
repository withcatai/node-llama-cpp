import os from "os";
import {CommandModule} from "yargs";
import bytes from "bytes";
import chalk from "chalk";
import {getLlama} from "../../bindings/getLlama.js";

const debugFunctions = ["vram"] as const;
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
        if (func === "vram") {
            await DebugVramFunction();
        }
    }
};

async function DebugVramFunction() {
    const llama = await getLlama("lastBuild");

    const vramStatus = llama.getVramState();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    if (llama.metal)
        console.log(`${chalk.yellow("Metal:")} enabled`);

    if (llama.cuda)
        console.log(`${chalk.yellow("Metal:")} enabled`);

    console.info(`${chalk.yellow("Used VRAM:")} ${Math.ceil((vramStatus.used / vramStatus.total) * 100 * 100) / 100}% ${chalk.grey("(" + bytes(vramStatus.used) + "/" + bytes(vramStatus.total) + ")")}`);
    console.info(`${chalk.yellow("Free VRAM:")} ${Math.floor((vramStatus.free / vramStatus.total) * 100 * 100) / 100}% ${chalk.grey("(" + bytes(vramStatus.free) + "/" + bytes(vramStatus.total) + ")")}`);
    console.info();
    console.info(`${chalk.yellow("Used RAM:")} ${Math.ceil((usedMemory / totalMemory) * 100 * 100) / 100}% ${chalk.grey("(" + bytes(usedMemory) + "/" + bytes(totalMemory) + ")")}`);
    console.info(`${chalk.yellow("Free RAM:")} ${Math.floor((freeMemory / totalMemory) * 100 * 100) / 100}% ${chalk.grey("(" + bytes(freeMemory) + "/" + bytes(totalMemory) + ")")}`);
}
