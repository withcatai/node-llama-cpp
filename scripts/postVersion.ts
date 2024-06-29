import path from "path";
import {fileURLToPath} from "url";
import fs from "fs-extra";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.join(__dirname, "..", "package.json");

const packageJson = await fs.readJson(packageJsonPath);
const currentVersion = packageJson.version;

if (packageJson.optionalDependencies != null) {
    for (const packageName of Object.keys(packageJson.optionalDependencies)) {
        if (!packageName.startsWith("@node-llama-cpp/"))
            continue;

        console.info(`Updating optional dependency "${packageName}" to version "${currentVersion}"`);
        packageJson.optionalDependencies[packageName] = currentVersion;
    }
}

await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), "utf8");
