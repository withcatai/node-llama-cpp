import process from "process";
import path from "path";
import {CommandModule} from "yargs";
import chalk from "chalk";
import logSymbols from "log-symbols";
import validateNpmPackageName from "validate-npm-package-name";
import fs from "fs-extra";
import {consolePromptQuestion} from "../utils/consolePromptQuestion.js";
import {isUrl} from "../../utils/isUrl.js";
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

type InitCommand = {
    name?: string,
    template?: string,
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

export async function InitCommandHandler({name, template, gpu}: InitCommand) {
    const currentDirectory = path.resolve(process.cwd());
    const projectName = (name != null && validateNpmPackageName(name ?? "").validForNewPackages)
        ? name
        : await askForProjectName(currentDirectory);
    const selectedTemplateOption = (
        (template != null && template !== "")
            ? projectTemplates.find((item) => item.name === template)
            : undefined
    ) ?? await askForTemplate();

    const llama = gpu == null
        ? await getLlama("lastBuild", {
            logLevel: LlamaLogLevel.error
        })
        : await getLlama({
            gpu,
            logLevel: LlamaLogLevel.error
        });

    const modelUrl = await interactivelyAskForModel({
        llama,
        allowLocalModels: false,
        downloadIntent: false
    });

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

        const modelDownloader = await createModelDownloader({
            modelUrl,
            showCliProgress: false,
            deleteTempFileOnCancel: false
        });
        const modelEntrypointFilename = modelDownloader.entrypointFilename;

        await scaffoldProjectTemplate({
            template,
            directoryPath: targetDirectory,
            parameters: {
                [ProjectTemplateParameter.ProjectName]: projectName,
                [ProjectTemplateParameter.ModelUrl]: modelUrl,
                [ProjectTemplateParameter.ModelFilename]: modelEntrypointFilename,
                [ProjectTemplateParameter.CurrentModuleVersion]: await getModuleVersion()
            }
        });

        try {
            await modelDownloader.cancel();
        } catch (err) {
            // do nothing
        }

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
    console.info(chalk.grey("Note: running \"npm install\" may take a little while since it also downloads the model you selected"));
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

            if (isUrl(item, false))
                return logSymbols.success + " Entered project name " + chalk.blue(item);
            else
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
