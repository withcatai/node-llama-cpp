#!/usr/bin/env node

import {fileURLToPath} from "url";
import path from "path";
import yargs from "yargs";
// eslint-disable-next-line n/file-extension-in-import
import {hideBin} from "yargs/helpers";
import fs from "fs-extra";
import {cliBinName} from "../config.js";
import {setIsRunningFromCLI} from "../state.js";
import {DownloadCommand} from "./commands/DownloadCommand.js";
import {BuildCommand} from "./commands/BuildCommand.js";
import {OnPostInstallCommand} from "./commands/OnPostInstallCommand.js";
import {ClearCommand} from "./commands/ClearCommand.js";
import {ChatCommand} from "./commands/ChatCommand.js";
import {CompleteCommand} from "./commands/CompleteCommand.js";
import {InfillCommand} from "./commands/InfillCommand.js";
import {DebugCommand} from "./commands/DebugCommand.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const packageJson = fs.readJSONSync(path.join(__dirname, "..", "..", "package.json"));

setIsRunningFromCLI(true);

const yarg = yargs(hideBin(process.argv));

yarg
    .scriptName(cliBinName)
    .usage("Usage: $0 <command> [options]")
    .command(DownloadCommand)
    .command(BuildCommand)
    .command(ClearCommand)
    .command(ChatCommand)
    .command(CompleteCommand)
    .command(InfillCommand)
    .command(OnPostInstallCommand)
    .command(DebugCommand)
    .recommendCommands()
    .demandCommand(1)
    .strict()
    .strictCommands()
    .alias("v", "version")
    .help("h")
    .alias("h", "help")
    .version(packageJson.version)
    .wrap(Math.min(100, yarg.terminalWidth()))
    .parse();