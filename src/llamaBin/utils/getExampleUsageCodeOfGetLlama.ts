import chalk from "chalk";
import stripAnsi from "strip-ansi";
import {prettyPrintObject} from "../../utils/prettyPrintObject.js";
import {getLlamaFunctionName, LlamaOptions} from "../getLlama.js";

export function getExampleUsageCodeOfGetLlama(getLlamaOptions: LlamaOptions | "lastBuild" | undefined, prefix: string = "", wrapWithSeparators: boolean = true) {
    let res = prefix + [
        chalk.magenta.italic("import "), chalk.whiteBright("{"), chalk.yellow(getLlamaFunctionName), chalk.whiteBright("} "),
        chalk.magenta.italic("from "), chalk.green("\"node-llama-cpp\""), chalk.whiteBright(";"),
        "\n\n",
        chalk.magenta.italic("const "), chalk.whiteBright("llama "), chalk.whiteBright("= "), chalk.magenta.italic("await "), chalk.yellow(getLlamaFunctionName), chalk.whiteBright("("),
        getLlamaOptions === undefined ? "" : prettyPrintObject(getLlamaOptions),
        chalk.whiteBright(")"), chalk.whiteBright(";")
    ].join(prefix);

    if (wrapWithSeparators) {
        const longestLineLength = res.split("\n")
            .reduce((max, line) => Math.max(max, stripAnsi(line).length), 0);
        res = chalk.blue("-".repeat(longestLineLength)) + "\n" + res + "\n" + chalk.blue("-".repeat(longestLineLength));
    }

    return res;
}
