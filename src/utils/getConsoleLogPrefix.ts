import chalk from "chalk";
import {getIsRunningFromCLI} from "../state.js";

export function getConsoleLogPrefix(forcePrefix: boolean = false) {
    const isInCLI = getIsRunningFromCLI();

    if (!isInCLI || forcePrefix)
        return chalk.grey("[node-llama-cpp] ");

    return "";
}

