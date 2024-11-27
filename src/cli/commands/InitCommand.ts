import process from "process";
import path from "path";
import {CommandModule} from "yargs";
import chalk from "chalk";
import logSymbols from "log-symbols";
import validateNpmPackageName from "validate-npm-package-name";
import fs from "fs-extra";
import {consolePromptQuestion} from "../utils/consolePromptQuestion.js";
import {basicChooseFromListConsoleInteraction} from "../utils/basicChooseFromListConsoleInteraction.js";
import {splitAnsiToLines} from "../utils/splitAnsiToLines.js";
import {arrowChar} from "../../consts.js";
import {interactivelyAskForModel} from "../utils/interactivelyAskForModel.js";
import {BuildGpu, LlamaLogLevel, nodeLlamaCppGpuOptions, parseNodeLlamaCppGpuOption} from "../../bindings/types.js";
import {getLlama} from "../../bindings/getLlama.js";
import {ProjectTemplate, ProjectTemplateParameter, scaffoldProjectTemplate} from "../utils/projectTemplates.js";
import {documentationPageUrls, packedProjectTemplatesDirectory} from "../../config.js";
import {getModuleVersion} from "../../utils/getModuleVersion.js";
import withOra from "../../utils/withOra.js";
import {ProjectTemplateOption, projectTemplates} from "../projectTemplates.js";
import {getReadablePath} from "../utils/getReadablePath.js";
import {createModelDownloader} from "../../utils/createModelDownloader.js";
import {withCliCommandDescriptionDocsUrl} from "../utils/withCliCommandDescriptionDocsUrl.js";
import {resolveModelDestination} from "../../utils/resolveModelDestination.js";

type InitCommand = {
    name?: string,
    template?: string,
    model?: string,
    gpu?: BuildGpu | "auto"
};

export const InitCommand: CommandModule<object, InitCommand> = {
    command: "init [name]",
    describe: withCliCommandDescriptionDocsUrl(
        "Generate a new `node-llama-cpp` project from a template",
        documentationPageUrls.CLI.Init
    ),
    builder(yargs) {
        return yargs
            .option("name", {
                type: "string",
                description: "Project name"
            })
            .option("template", {
                type: "string",
                choices: projectTemplates.map((template) => template.name),
                description: "Template to use. If omitted, you will be prompted to select one"
            })
            .option("model", {
                type: "string",
                description: "Model URI to use. If omitted, you will be prompted to select one interactively"
            })
            .option("gpu", {
                type: "string",

                // yargs types don't support passing `false` as a choice, although it is supported by yargs
                choices: nodeLlamaCppGpuOptions as any as Exclude<typeof nodeLlamaCppGpuOptions[number], false>[],
                coerce: (value) => {
                    if (value == null || value == "")
                        return undefined;

                    return parseNodeLlamaCppGpuOption(value);
                },
                defaultDescription: "Uses the latest local build, and fallbacks to \"auto\"",
                description: "Compute layer implementation type to use for llama.cpp"
            });
    },
    handler: InitCommandHandler
};

export const CreateCliCommand: CommandModule<object, InitCommand> = {
    command: "$0",
    describe: withCliCommandDescriptionDocsUrl(
        "Scaffold a new `node-llama-cpp` project from a template",
        documentationPageUrls.CLI.Init
    ),
    builder: InitCommand.builder,
    handler: InitCommandHandler
};

export async function InitCommandHandler({name, template, model, gpu}: InitCommand) {
    const currentDirectory = path.resolve(process.cwd());
    const projectName = (name != null && validateNpmPackageName(name ?? "").validForNewPackages)
        ? name
        : await askForProjectName(currentDirectory);
    const selectedTemplateOption = (
        (template != null && template !== "")
            ? projectTemplates.find((item) => item.name === template)
            : undefined
    ) ?? await askForTemplate();

    async function resolveModelUri() {
        if (model != null && model !== "") {
            try {
                const resolvedModelDestination = resolveModelDestination(model, true);
                if (resolvedModelDestination.type === "uri")
                    return resolvedModelDestination.uri;
                else if (resolvedModelDestination.type === "url")
                    return resolvedModelDestination.url;
            } catch (err) {
                // do nothing
            }
        }

        const llama = gpu == null
            ? await getLlama("lastBuild", {
                logLevel: LlamaLogLevel.error
            })
            : await getLlama({
                gpu,
                logLevel: LlamaLogLevel.error
            });

        return await interactivelyAskForModel({
            llama,
            allowLocalModels: false,
            downloadIntent: false
        });
    }

    const modelUri = await resolveModelUri();

    const targetDirectory = path.join(currentDirectory, projectName);
    const readableTargetDirectoryPath = getReadablePath(targetDirectory);

    await withOra({
        loading: `Scaffolding a ${chalk.yellow(selectedTemplateOption.title)} project to ${chalk.yellow(readableTargetDirectoryPath)}`,
        success: `Scaffolded a ${chalk.yellow(selectedTemplateOption.title)} project to ${chalk.yellow(readableTargetDirectoryPath)}`,
        fail: `Failed to scaffold a ${chalk.yellow(selectedTemplateOption.title)} project to ${chalk.yellow(readableTargetDirectoryPath)}`
    }, async () => {
        const startTime = Date.now();
        const minScaffoldTime = 1000 * 2; // ensure the IDE has enough time to refresh and show some progress
        const template = await loadTemplate(selectedTemplateOption);

        await fs.ensureDir(targetDirectory);

        async function resolveModelInfo() {
            const resolvedModelDestination = resolveModelDestination(modelUri);

            if (resolvedModelDestination.type === "uri")
                return {
                    modelUriOrUrl: resolvedModelDestination.uri,
                    modelUriOrFilename: resolvedModelDestination.uri,
                    cancelDownloader: async () => void 0
                };

            if (resolvedModelDestination.type === "file")
                throw new Error("Unexpected file model destination");

            const modelDownloader = await createModelDownloader({
                modelUri: resolvedModelDestination.url,
                showCliProgress: false,
                deleteTempFileOnCancel: false
            });
            const modelEntrypointFilename = modelDownloader.entrypointFilename;

            return {
                modelUriOrUrl: resolvedModelDestination.url,
                modelUriOrFilename: modelEntrypointFilename,
                async cancelDownloader() {
                    try {
                        await modelDownloader.cancel();
                    } catch (err) {
                        // do nothing
                    }
                }
            };
        }

        const {modelUriOrFilename, modelUriOrUrl, cancelDownloader} = await resolveModelInfo();

        await scaffoldProjectTemplate({
            template,
            directoryPath: targetDirectory,
            parameters: {
                [ProjectTemplateParameter.ProjectName]: projectName,
                [ProjectTemplateParameter.ModelUriOrUrl]: modelUriOrUrl,
                [ProjectTemplateParameter.ModelUriOrFilename]: modelUriOrFilename,
                [ProjectTemplateParameter.CurrentModuleVersion]: await getModuleVersion()
            }
        });

        await cancelDownloader();

        await new Promise((resolve) => setTimeout(resolve, Math.max(0, minScaffoldTime - (Date.now() - startTime))));
    });

    console.info(chalk.green("Done."));
    console.info();
    console.info("Now run these commands:");
    console.info();
    console.info(chalk.greenBright("cd") + " " + projectName);
    console.info(chalk.greenBright("npm") + " install");
    console.info(chalk.greenBright("npm") + " start");
    console.info();
    console.info(chalk.gray("Note: running \"npm install\" may take a little while since it also downloads the model you selected"));
    process.exit(0);
}

async function askForTemplate() {
    const selectedTemplateOption = await basicChooseFromListConsoleInteraction({
        title: chalk.bold("Select a template:"),
        footer(item) {
            if (item.description == null)
                return undefined;

            const leftPad = 3;
            const maxWidth = Math.max(1, process.stdout.columns - 2 - leftPad);
            const lines = splitAnsiToLines(item.description, maxWidth);

            return " \n" +
                " ".repeat(leftPad) + chalk.bold.gray("Template description") + "\n" +
                lines.map((line) => (" ".repeat(leftPad) + line)).join("\n");
        },
        items: projectTemplates,
        renderItem(item, focused) {
            return renderSelectableItem(
                item.titleFormat != null
                    ? item.titleFormat(item.title)
                    : item.title,
                focused
            );
        },
        aboveItemsPadding: 1,
        belowItemsPadding: 1,
        renderSummaryOnExit(item) {
            if (item == null)
                return "";

            return logSymbols.success + " Selected template " + chalk.blue(item.title);
        },
        exitOnCtrlC: true
    });

    if (selectedTemplateOption == null)
        throw new Error("No template selected");

    return selectedTemplateOption;
}

async function askForProjectName(currentDirectory: string) {
    console.info();
    const projectName = await consolePromptQuestion(chalk.bold("Enter a project name:") + chalk.dim(" (node-llama-cpp-project) "), {
        defaultValue: "node-llama-cpp-project",
        exitOnCtrlC: true,
        async validate(input) {
            const {validForNewPackages, errors} = validateNpmPackageName(input);

            if (!validForNewPackages)
                return (errors ?? ["The given project name cannot be used in a package.json file"]).join("\n");

            if (await fs.pathExists(path.join(currentDirectory, input)))
                return "A directory with the given project name already exists";

            return null;
        },
        renderSummaryOnExit(item) {
            if (item == null)
                return "";

            return logSymbols.success + " Entered project name " + chalk.blue(item);
        }
    });

    if (projectName == null)
        throw new Error("No project name entered");

    return projectName;
}

function renderSelectableItem(text: string, focused: boolean) {
    if (focused)
        return " " + chalk.cyan(arrowChar) + " " + chalk.cyan(text);

    return " * " + text;
}

async function loadTemplate(templateOption: ProjectTemplateOption) {
    const templateFilePath = path.join(packedProjectTemplatesDirectory, `${templateOption.name}.json`);

    if (!(await fs.pathExists(templateFilePath)))
        throw new Error(`Template file was not found for template "${templateOption.title}" ("${templateOption.name}")`);

    const template: ProjectTemplate = await fs.readJSON(templateFilePath);

    return template;
}
