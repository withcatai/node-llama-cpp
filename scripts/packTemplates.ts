import path from "path";
import fs from "fs-extra";
import ignore, {Ignore} from "ignore";
import {
    getProjectTemplateParameterText, PackagedFileEntry, ProjectTemplate, ProjectTemplateParameter
} from "../src/cli/utils/projectTemplates.js";
import {packedProjectTemplatesDirectory, projectTemplatesDirectory} from "../src/config.js";

const packedTemplatedDirectoryName = path.basename(packedProjectTemplatesDirectory);

async function packTemplates() {
    await fs.ensureDir(packedProjectTemplatesDirectory);

    for (const item of await fs.readdir(projectTemplatesDirectory, {withFileTypes: true})) {
        if (!item.isDirectory())
            continue;

        if (item.name === packedTemplatedDirectoryName || item.name === "node_modules")
            continue;

        await packTemplate(item.name);
    }
}

async function packTemplate(templateName: string) {
    const templateDirectory = path.join(projectTemplatesDirectory, templateName);
    const gitignorePath = path.join(templateDirectory, ".gitignore");
    const ig = (await fs.pathExists(gitignorePath))
        ? ignore().add(await fs.readFile(gitignorePath, "utf8"))
        : ignore();

    const files: PackagedFileEntry[] = [];

    await packDirectory({
        files, ig, currentPath: [], templateDirectory
    });

    const templateFile: ProjectTemplate = {
        files
    };

    await fs.writeFile(path.join(packedProjectTemplatesDirectory, `${templateName}.json`), JSON.stringify(templateFile));
}

async function packDirectory({
    files, ig, currentPath, templateDirectory
}: {
    files: PackagedFileEntry[],
    ig: Ignore,
    currentPath: string[],
    templateDirectory: string
}) {
    for (const item of await fs.readdir(path.join(templateDirectory, ...currentPath), {withFileTypes: true})) {
        const packItemPath = [...currentPath, item.name];
        const itemPath = path.join(templateDirectory, ...packItemPath);

        if (item.name === "package-lock.json" || ig.ignores(path.relative(templateDirectory, itemPath)))
            continue;

        if (item.isDirectory()) {
            await packDirectory({
                files, ig, currentPath: packItemPath, templateDirectory
            });
        } else {
            const fileContent = await fs.readFile(itemPath, "utf8");
            const packItem: PackagedFileEntry = {
                path: packItemPath,
                content: fileContent
            };
            transformPackedItem(packItem);

            files.push(packItem);
        }
    }
}

async function clearPackedTemplates() {
    await fs.remove(packedProjectTemplatesDirectory);
}

function transformPackedItem(item: PackagedFileEntry) {
    if (item.path.length === 1 && item.path[0] === "package.json") {
        const packageJson = JSON.parse(item.content);
        const moduleName = "node-llama-cpp";

        if (packageJson.dependencies?.[moduleName])
            packageJson.dependencies[moduleName] =
                "^" + getProjectTemplateParameterText(ProjectTemplateParameter.CurrentModuleVersion, 1);

        if (packageJson.devDependencies?.[moduleName])
            packageJson.devDependencies[moduleName] =
                "^" + getProjectTemplateParameterText(ProjectTemplateParameter.CurrentModuleVersion, 1);

        const newScripts: Record<string, string> = {};
        for (const [scriptName, scriptCommand] of (Object.entries(packageJson.scripts) as [string, string][])) {
            let transformedScriptName = scriptName;
            if (transformedScriptName.startsWith("_"))
                transformedScriptName = transformedScriptName.slice("_".length);

            newScripts[transformedScriptName] = scriptCommand;
        }
        packageJson.scripts = newScripts;

        item.content = JSON.stringify(packageJson, null, 2);
    }
}

export {};

await clearPackedTemplates();
await packTemplates();
