import path from "path";
import {fileURLToPath} from "url";
import fs from "fs-extra";
import {$, cd} from "zx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDirectory = path.join(__dirname, "..", "packages");
const packageScope = "@node-llama-cpp";
const subPackagesDirectory = path.join(packageDirectory, packageScope);

for (const packageName of await fs.readdir(subPackagesDirectory)) {
    const packagePath = path.join(subPackagesDirectory, packageName);
    const packagePackageJsonPath = path.join(packagePath, "package.json");

    if ((await fs.stat(packagePath)).isFile())
        continue;

    $.verbose = true;
    cd(packagePath);
    await $`npm ci -f`;
    await $`npm run build`;

    const packageJson = await fs.readJson(packagePackageJsonPath);
    delete packageJson.devDependencies;
    const postinstall = packageJson.scripts?.postinstall;
    delete packageJson.scripts;

    if (postinstall != null)
        packageJson.scripts = {postinstall};

    await fs.writeJson(packagePackageJsonPath, packageJson, {spaces: 2});
}
