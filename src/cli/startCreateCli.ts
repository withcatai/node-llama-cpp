#!/usr/bin/env node

import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import {setIsRunningFromCLI} from "../state.js";
import {CreateCliCommand} from "./commands/InitCommand.js";

/** @internal */
export function _startCreateCli({
    cliBinName,
    packageVersion,
    _enable
}: {
    cliBinName: string,
    packageVersion: string,
    _enable?: any
}) {
    if (_enable !== Symbol.for("internal"))
        return;

    setIsRunningFromCLI(true);

    const yarg = yargs(hideBin(process.argv));

    yarg
        .scriptName(cliBinName)
        .usage("Usage: $0 [options]")
        .command(CreateCliCommand)
        .demandCommand(1)
        .strict()
        .strictCommands()
        .alias("v", "version")
        .help("h")
        .alias("h", "help")
        .version(packageVersion)
        .wrap(Math.min(100, yarg.terminalWidth()))
        .parse();
}
