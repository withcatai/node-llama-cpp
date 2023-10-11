import {CommandModule} from "yargs";
import {getCommandHtmlDoc} from "../../../.vitepress/utils/getCommandHtmlDoc.js";
import {BuildCommand} from "../../../src/cli/commands/BuildCommand.js";
import {ChatCommand} from "../../../src/cli/commands/ChatCommand.js";
import {DownloadCommand} from "../../../src/cli/commands/DownloadCommand.js";
import {ClearCommand} from "../../../src/cli/commands/ClearCommand.js";
import {htmlEscape} from "../../../.vitepress/utils/htmlEscape.js";
import {cliBinName, npxRunPrefix} from "../../../src/config.js";
import {buildHtmlHeading} from "../../../.vitepress/utils/buildHtmlHeading.js";
import {buildHtmlTable} from "../../../.vitepress/utils/buildHtmlTable.js";
import {setIsInDocumentationMode} from "../../../src/state.js";

export default {
    async load() {
        setIsInDocumentationMode(true);

        return {
            index: buildIndexTable([
                ["chat", ChatCommand],
                ["download", DownloadCommand],
                ["build", BuildCommand],
                ["clear", ClearCommand]
            ]),

            chat: await getCommandHtmlDoc(ChatCommand),
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
                    htmlEscape(String(command.describe ?? ""))
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
