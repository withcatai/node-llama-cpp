import chalk from "chalk";
import {ResolveModelDestination} from "../../utils/resolveModelDestination.js";
import {getReadablePath} from "./getReadablePath.js";

export function printModelDestination(modelDestination: ResolveModelDestination) {
    if (modelDestination.type === "url")
        console.info(`${chalk.yellow("URL:")} ${modelDestination.url}`);
    else if (modelDestination.type === "uri")
        console.info(`${chalk.yellow("URI:")} ${modelDestination.uri}`);
    else
        console.info(`${chalk.yellow("File:")} ${getReadablePath(modelDestination.path)}`);
}
