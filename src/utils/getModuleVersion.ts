import path from "path";
import {fileURLToPath} from "url";
import fs from "fs-extra";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let moduleVersion: string | null = null;
export async function getModuleVersion(): Promise<string> {
    if (moduleVersion != null)
        return moduleVersion;

    const packageJson = await fs.readJson(path.join(__dirname, "..", "..", "package.json"));

    moduleVersion = packageJson.version as string;

    return moduleVersion;
}
