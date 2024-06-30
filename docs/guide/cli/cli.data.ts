import {CommandModule} from "yargs";
import {createMarkdownRenderer} from "vitepress";
import {PullCommand} from "../../../src/cli/commands/PullCommand.js";
import {BuildCommand} from "../../../src/cli/commands/BuildCommand.js";
import {ChatCommand} from "../../../src/cli/commands/ChatCommand.js";
import {CompleteCommand} from "../../../src/cli/commands/CompleteCommand.js";
import {InfillCommand} from "../../../src/cli/commands/InfillCommand.js";
import {InspectCommand} from "../../../src/cli/commands/inspect/InspectCommand.js";
import {InspectGpuCommand} from "../../../src/cli/commands/inspect/commands/InspectGpuCommand.js";
import {InspectGgufCommand} from "../../../src/cli/commands/inspect/commands/InspectGgufCommand.js";
import {DownloadCommand} from "../../../src/cli/commands/DownloadCommand.js";
import {ClearCommand} from "../../../src/cli/commands/ClearCommand.js";
import {InspectMeasureCommand} from "../../../src/cli/commands/inspect/commands/InspectMeasureCommand.js";
import {InitCommand} from "../../../src/cli/commands/InitCommand.js";
import {cliBinName, npxRunPrefix} from "../../../src/config.js";
import {htmlEscape} from "../../../.vitepress/utils/htmlEscape.js";
import {getCommandHtmlDoc} from "../../../.vitepress/utils/getCommandHtmlDoc.js";
import {buildHtmlHeading} from "../../../.vitepress/utils/buildHtmlHeading.js";
import {buildHtmlTable} from "../../../.vitepress/utils/buildHtmlTable.js";
import {setIsInDocumentationMode} from "../../../src/state.js";
import {htmlEscapeWithCodeMarkdown} from "../../../.vitepress/utils/htmlEscapeWithCodeMarkdown.js";
import {getInlineCodeBlockHtml} from "../../../.vitepress/utils/getInlineCodeBlockHtml.js";
import {withoutCliCommandDescriptionDocsUrl} from "../../../src/cli/utils/withCliCommandDescriptionDocsUrl.js";

export default {
    async load() {
        setIsInDocumentationMode(true);

        return {
            index: await buildIndexTable([
                ["pull", PullCommand],
                ["chat", ChatCommand],
                ["init", InitCommand],
                ["complete", CompleteCommand],
                ["infill", InfillCommand],
                ["inspect", InspectCommand],
                ["download", DownloadCommand],
                ["build", BuildCommand],
                ["clear", ClearCommand]
            ]),

            pull: await getCommandHtmlDoc(PullCommand),
            chat: await getCommandHtmlDoc(ChatCommand),
            init: await getCommandHtmlDoc(InitCommand),
            complete: await getCommandHtmlDoc(CompleteCommand),
            infill: await getCommandHtmlDoc(InfillCommand),
            inspect: {
                index: await getCommandHtmlDoc(InspectCommand, {
                    subCommandsParentPageLink: "inspect"
                }),
                gpu: await getCommandHtmlDoc(InspectGpuCommand, {
                    parentCommand: InspectCommand
                }),
                gguf: await getCommandHtmlDoc(InspectGgufCommand, {
                    parentCommand: InspectCommand
                }),
                measure: await getCommandHtmlDoc(InspectMeasureCommand, {
                    parentCommand: InspectCommand
                })
            },
            download: await getCommandHtmlDoc(DownloadCommand),
            build: await getCommandHtmlDoc(BuildCommand),
            clear: await getCommandHtmlDoc(ClearCommand)
        };
    }
};

async function buildIndexTable(commands: [pageLink: string, command: CommandModule<any, any>][], cliName: string = cliBinName) {
    let res = "";
    const markdownRenderer = await createMarkdownRenderer(process.cwd());

    res += buildHtmlHeading("h2", htmlEscape("Commands"), "commands");
    res += buildHtmlTable(
        [
            "Command",
            "Description"
        ].map(htmlEscape),
        commands
            .map(([pageLink, command]) => {
                if (command.describe === false)
                    return null;

                return [
                    getInlineCodeBlockHtml(markdownRenderer, cliName + " " + command.command, "shell", pageLink),
                    htmlEscapeWithCodeMarkdown(withoutCliCommandDescriptionDocsUrl(String(command.describe ?? "")))
                ];
            })
            .filter((row): row is string[] => row != null)
    );

    res += buildHtmlHeading("h2", htmlEscape("Options"), "options");
    res += buildHtmlTable(
        [
            "Command",
            "Description"
        ].map(htmlEscape),
        [
            [
                `<code style="white-space: nowrap">${htmlEscape("-h")}</code>` +
                `${htmlEscape(", ")}` +
                `<code style="white-space: nowrap">${htmlEscape("--help")}</code>`,

                htmlEscape("Show help")
            ],
            [
                `<code style="white-space: nowrap">${htmlEscape("-v")}</code>` +
                `${htmlEscape(", ")}` +
                `<code style="white-space: nowrap">${htmlEscape("--version")}</code>`,

                htmlEscape("Show version number")
            ]
        ]
    );

    const usage = npxRunPrefix + cliName + " <command> [options]";

    return {
        title: "CLI",
        description: null,
        usage,
        usageHtml: markdownRenderer.render("```shell\n" + usage + "\n```"),
        options: res
    };
}
