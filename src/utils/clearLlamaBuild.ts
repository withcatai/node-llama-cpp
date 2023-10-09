import path from "path";
import fs from "fs-extra";
import {llamaDirectory} from "../config.js";
import {clearTempFolder} from "./clearTempFolder.js";

export async function clearLlamaBuild() {
    await fs.remove(path.join(llamaDirectory, "Debug"));
    await fs.remove(path.join(llamaDirectory, "Release"));
    await fs.remove(path.join(llamaDirectory, "compile_commands.json"));
    await fs.remove(path.join(llamaDirectory, "build"));

    await clearTempFolder();
}
