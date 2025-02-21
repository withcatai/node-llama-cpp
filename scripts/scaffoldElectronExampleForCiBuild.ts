import path from "path";
import {fileURLToPath} from "url";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import fs from "fs-extra";
import {ProjectTemplate, ProjectTemplateParameter, scaffoldProjectTemplate} from "../src/cli/utils/projectTemplates.js";
import {packedProjectTemplatesDirectory} from "../src/config.js";

import "./packTemplates.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const electronTemplateName = "electron-typescript-react";
const projectName = "node-llama-cpp-electron-example";

const argv = await yargs(hideBin(process.argv))
    .option("packageVersion", {
        type: "string",
        demandOption: true
    })
    .option("packageFolderPath", {
        type: "string",
        demandOption: true
    })
    .argv;

const {packageVersion, packageFolderPath} = argv;
if (packageVersion === "")
    throw new Error("packageVersion is empty");

console.info("node-llama-cpp version:", packageVersion);

const resolvedPackageFolderPath = path.resolve(process.cwd(), packageFolderPath);

const templateFilePath = path.join(packedProjectTemplatesDirectory, `${electronTemplateName}.json`);
if (!(await fs.pathExists(templateFilePath)))
    throw new Error(`Template file was not found for template "${electronTemplateName}"`);

const template: ProjectTemplate = await fs.readJSON(templateFilePath);

await scaffoldProjectTemplate({
    template,
    directoryPath: resolvedPackageFolderPath,
    parameters: {
        [ProjectTemplateParameter.ProjectName]: projectName,
        [ProjectTemplateParameter.ModelUriOrUrl]: "https://github.com/withcatai/node-llama-cpp",
        [ProjectTemplateParameter.ModelUriOrFilename]: "model.gguf",
        [ProjectTemplateParameter.CurrentModuleVersion]: packageVersion
    }
});

const packageJsonPath = path.join(resolvedPackageFolderPath, "package.json");
const packageJson = await fs.readJson(packageJsonPath);
packageJson.version = packageVersion;
delete packageJson.scripts.postinstall;
delete packageJson.scripts["models:pull"];

await fs.writeJson(packageJsonPath, packageJson, {spaces: 2});

const sourceAppIconPath = path.join(__dirname, "..", "assets", "electronTemplate.icon.png");
const appIconPath = path.join(resolvedPackageFolderPath, "public", "app-icon.png");

await fs.copyFile(sourceAppIconPath, appIconPath);

console.info(`Scaffolded ${projectName} in ${resolvedPackageFolderPath} with package version ${packageVersion}`);
