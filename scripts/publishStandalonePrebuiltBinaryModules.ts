import path from "path";
import {fileURLToPath} from "url";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import fs from "fs-extra";
import {$, cd} from "zx";
import envVar from "env-var";

const env = envVar.from(process.env);
const GH_RELEASE_REF = env.get("GH_RELEASE_REF")
    .required()
    .asString();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDirectory = path.join(__dirname, "..", "packages");
const packageScope = "@node-llama-cpp";
const subPackagesDirectory = path.join(packageDirectory, packageScope);

const argv = await yargs(hideBin(process.argv))
    .option("packageVersion", {
        type: "string",
        demandOption: true
    })
    .argv;

const {packageVersion} = argv;
if (packageVersion === "")
    throw new Error("packageVersion is empty");

const packageNames = (await fs.readdir(subPackagesDirectory))
    .sort((a, b) => {
        if (a.endsWith("-ext"))
            return -1;
        else if (b.endsWith("-ext"))
            return 1;

        return a.localeCompare(b);
    });

for (const packageName of packageNames) {
    const packagePath = path.join(subPackagesDirectory, packageName);
    const packagePackageJsonPath = path.join(packagePath, "package.json");

    if ((await fs.stat(packagePath)).isFile())
        continue;

    const packageJson = await fs.readJson(packagePackageJsonPath);
    packageJson.version = packageVersion;
    await fs.writeJson(packagePackageJsonPath, packageJson, {spaces: 2});
    console.info(`Updated "${packageScope}/${packageName}/package.json" to version "${packageVersion}"`);

    $.verbose = true;
    cd(packagePath);

    if (GH_RELEASE_REF === "refs/heads/beta") {
        console.info(`Publishing "${packageScope}/${packageName}@${packageVersion}" to "beta" tag`);
        await $`npm publish --tag beta`;
    } else {
        console.info(`Publishing "${packageScope}/${packageName}@${packageVersion}"`);
        await $`npm publish`;
    }
}
