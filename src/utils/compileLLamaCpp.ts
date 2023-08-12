import path from "path";
import {fileURLToPath} from "url";
import process from "process";
import fs from "fs-extra";
import {llamaCppDirectory, llamaDirectory} from "../config.js";
import {clearLlamaBuild} from "./clearLlamaBuild.js";
import {setUsedBinFlag} from "./usedBinFlag.js";
import {spawnCommand} from "./spawnCommand.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function compileLlamaCpp({arch = process.arch, nodeTarget = process.version, setUsedBingFlag = true}: {
    arch?: string, nodeTarget?: string, setUsedBingFlag?: boolean
}) {
    try {
        if (!(await fs.exists(llamaCppDirectory))) {
            throw new Error(`"${llamaCppDirectory}" directory does not exist`);
        }

        await clearLlamaBuild();

        await spawnCommand("npm", ["run", "-s", "node-gyp-llama", "--", "configure", "--arch=" + arch, "--target=" + nodeTarget], __dirname);

        await spawnCommand("npm", ["run", "-s", "node-gyp-llama", "--", "configure", "--arch=" + arch, "--target=" + nodeTarget, "--", "-f", "compile_commands_json"], __dirname);

        if (await fs.exists(path.join(llamaDirectory, "Release", "compile_commands.json"))) {
            await fs.move(
                path.join(llamaDirectory, "Release", "compile_commands.json"),
                path.join(llamaDirectory, "compile_commands.json")
            );
        } else if (await fs.exists(path.join(llamaDirectory, "Debug", "compile_commands.json"))) {
            await fs.move(
                path.join(llamaDirectory, "Debug", "compile_commands.json"),
                path.join(llamaDirectory, "compile_commands.json")
            );
        }

        await fs.remove(path.join(llamaDirectory, "Release"));
        await fs.remove(path.join(llamaDirectory, "Debug"));


        await spawnCommand("npm", ["run", "-s", "node-gyp-llama-build", "--", "--arch=" + arch, "--target=" + nodeTarget], __dirname);

        if (setUsedBingFlag) {
            await setUsedBinFlag("localBuildFromSource");
        }
    } catch (err) {
        if (setUsedBingFlag)
            await setUsedBinFlag("prebuiltBinaries");

        throw err;
    }
}

export async function getCompiledLlamaCppBinaryPath() {
    const modulePath = path.join(__dirname, "..", "..", "llama", "build", "Release", "llama.node");

    if (await fs.exists(modulePath))
        return modulePath;

    return null;
}
