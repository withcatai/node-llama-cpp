import {CommandModule} from "yargs";
import {getCommandHtmlDoc} from "../../../.vitepress/utils/getCommandHtmlDoc.js";
import {BuildCommand} from "../../../src/cli/commands/BuildCommand.js";
import {ChatCommand} from "../../../src/cli/commands/ChatCommand.js";
import {CompleteCommand} from "../../../src/cli/commands/CompleteCommand.js";
import {InfillCommand} from "../../../src/cli/commands/InfillCommand.js";
import {InspectCommand} from "../../../src/cli/commands/inspect/InspectCommand.js";
import {InspectGpuCommand} from "../../../src/cli/commands/inspect/commands/InspectGpuCommand.js";
import {InspectGgufCommand} from "../../../src/cli/commands/inspect/commands/InspectGgufCommand.js";
import {DownloadCommand} from "../../../src/cli/commands/DownloadCommand.js";
import {ClearCommand} from "../../../src/cli/commands/ClearCommand.js";
import {htmlEscape} from "../../../.vitepress/utils/htmlEscape.js";
import {cliBinName, npxRunPrefix} from "../../../src/config.js";
import {buildHtmlHeading} from "../../../.vitepress/utils/buildHtmlHeading.js";
import {buildHtmlTable} from "../../../.vitepress/utils/buildHtmlTable.js";
import {setIsInDocumentationMode} from "../../../src/state.js";
import {InspectMeasureCommand} from "../../../src/cli/commands/inspect/commands/InspectMeasureCommand.js";
import {htmlEscapeWithCodeMarkdown} from "../../../.vitepress/utils/htmlEscapeWithCodeMarkdown.js";

export default {
    async load() {
        setIsInDocumentationMode(true);

        return {
            index: buildIndexTable([
                ["chat", ChatCommand],
                ["complete", CompleteCommand],
                ["infill", InfillCommand],
                ["inspect", InspectCommand],
                ["download", DownloadCommand],
                ["build", BuildCommand],
                ["clear", ClearCommand]
            ]),

            chat: await getCommandHtmlDoc(ChatCommand),
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

function buildIndexTable(commands: [pageLink: string, command: CommandModule<any, any>][], cliName: string = cliBinName) {
    let res = "";

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
                    `<a href="${pageLink}"><code>` + htmlEscape(cliName + " " + command.command) + "</code></a>",
                    htmlEscapeWithCodeMarkdown(String(command.describe ?? ""))
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

    return {
        title: "CLI",
        description: null,
        usage: npxRunPrefix + cliName + " <command> [options]",
        options: res
    };
}
