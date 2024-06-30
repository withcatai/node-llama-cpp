import path from "path";
import {fileURLToPath} from "url";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import fs from "fs-extra";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const createPackageModulePackageJsonPath = path.join(__dirname, "..", "packages", "create-node-llama-cpp", "package.json");

const argv = await yargs(hideBin(process.argv))
    .option("packageVersion", {
        type: "string",
        demandOption: true
    })
    .argv;

const {packageVersion} = argv;
if (packageVersion === "")
    throw new Error("packageVersion is empty");

const packageJson = await fs.readJson(createPackageModulePackageJsonPath);
packageJson.version = packageVersion;
packageJson.dependencies["node-llama-cpp"] = packageVersion;
delete packageJson.devDependencies;

await fs.writeJson(createPackageModulePackageJsonPath, packageJson, {spaces: 2});
console.info(`Updated "create-node-llama-cpp/package.json" to version "${packageVersion}"`);
