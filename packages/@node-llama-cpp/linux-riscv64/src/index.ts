import path from "path";
import {fileURLToPath} from "url";
import fs from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binsDir = path.join(__dirname, "..", "bins");
const packageVersion: string = (JSON.parse(await fs.readFile(path.join(__dirname, "..", "package.json"), "utf8"))).version;

export function getBinsDir() {
    return {
        binsDir,
        packageVersion
    };
}
