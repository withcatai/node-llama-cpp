import path from "path";
import fs from "fs-extra";

export const enum ProjectTemplateParameter {
    ProjectName = "projectName",
    CurrentModuleVersion = "currentNodeLlamaCppModuleVersion",
    ModelUriOrUrl = "modelUriOrUrl",
    ModelUriOrFilename = "modelUriOrFilename"
}

export type PackagedFileEntry = {
    path: string[],
    content: string
};

export type ProjectTemplate = {
    files: PackagedFileEntry[]
};

export function getProjectTemplateParameterText(parameter: ProjectTemplateParameter, escapeText: boolean | 0 | 1 | 2 = true) {
    let escapes = "";
    if (escapeText === true || escapeText === 1)
        escapes = "|escape";
    else if (escapeText === 2)
        escapes = "|escape|escape";

    return "{{" + parameter + escapes + "}}";
}

function applyProjectTemplateParameters(template: string, parameters: Record<ProjectTemplateParameter, string>) {
    for (const [parameter, value] of (Object.entries(parameters) as [ProjectTemplateParameter, string][])) {
        template = template.split(getProjectTemplateParameterText(parameter, 0)).join(String(value));
        template = template.split(getProjectTemplateParameterText(parameter, 1)).join(JSON.stringify(String(value)).slice(1, -1));
        template = template.split(getProjectTemplateParameterText(parameter, 2)).join(
            JSON.stringify(
                JSON.stringify(
                    String(value)
                ).slice(1, -1)
            ).slice(1, -1)
        );
    }

    return template;
}

export async function scaffoldProjectTemplate({
    template, parameters, directoryPath
}: {
    template: ProjectTemplate,
    parameters: Record<ProjectTemplateParameter, string>,
    directoryPath: string
}) {
    for (const file of template.files) {
        const filePath = path.join(directoryPath, ...file.path);
        const fileContent = transformFileContent({
            content: applyProjectTemplateParameters(file.content, parameters),
            originalPath: file.path,
            parameters
        });

        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, fileContent, "utf8");
    }
}

function transformFileContent({
    content, originalPath, parameters
}: {
    content: string, originalPath: string[], parameters: Record<ProjectTemplateParameter, string>
}) {
    if (originalPath.length === 1 && originalPath[0] === "package.json") {
        const packageJson = JSON.parse(content);

        if (parameters[ProjectTemplateParameter.ProjectName] != null)
            packageJson.name = parameters[ProjectTemplateParameter.ProjectName];

        return JSON.stringify(packageJson, null, 2);
    }

    return content;
}
