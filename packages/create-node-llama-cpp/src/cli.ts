#!/usr/bin/env node

import path from "path";
import {fileURLToPath} from "url";
import fs from "node:fs/promises";
/* eslint import/no-unresolved: "off" */
// @ts-ignore
import {_startCreateCli} from "node-llama-cpp/commands";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const packageJson = JSON.parse(await fs.readFile(path.join(__dirname, "..", "package.json"), "utf8"));

_startCreateCli({
    cliBinName: packageJson.name,
    packageVersion: packageJson.version,
    _enable: Symbol.for("internal")
});

export {};
