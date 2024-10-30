import {Argv, CommandModule, Options} from "yargs";
import {cliBinName, npxRunPrefix} from "../../src/config.js";
import {withoutCliCommandDescriptionDocsUrl} from "../../src/cli/utils/withCliCommandDescriptionDocsUrl.js";
import {htmlEscape} from "./htmlEscape.js";
import {buildHtmlTable} from "./buildHtmlTable.js";
import {buildHtmlHeading} from "./buildHtmlHeading.js";
import {htmlEscapeWithCodeMarkdown} from "./htmlEscapeWithCodeMarkdown.js";
import {getInlineCodeBlockHtml} from "./getInlineCodeBlockHtml.js";
import {getMarkdownRenderer} from "./getMarkdownRenderer.js";

export async function getCommandHtmlDoc(command: CommandModule<any, any>, {
    cliName = cliBinName,
    parentCommand,
    subCommandsParentPageLink
}: {
    cliName?: string,
    parentCommand?: CommandModule<any, any>,
    subCommandsParentPageLink?: string
} = {}) {
    const currentCommandCliCommand = resolveCommandCliCommand(command);
    const resolvedParentCommandCliCommand = resolveCommandCliCommand(parentCommand);
    const title = cliName + " " + (resolvedParentCommandCliCommand ?? "<command>").replace("<command>", currentCommandCliCommand ?? "");
    const description = command.describe ?? "";
    const {subCommands, optionGroups} = await parseCommandDefinition(command);
    const markdownRenderer = await getMarkdownRenderer();

    let res = "";

    if (subCommands.length > 0) {
        res += buildHtmlHeading("h2", htmlEscape("Commands"), "commands");

        res += buildHtmlTable(
            [
                "Command",
                "Description"
            ].map(htmlEscape),
            subCommands
                .map((subCommand) => {
                    if (subCommand.command == null || subCommand.describe === false)
                        return null;

                    const resolvedCommandCliCommand = resolveCommandCliCommand(subCommand) ?? "";
                    const commandPageLink = resolveCommandPageLink(subCommand);

                    let cliCommand = resolvedCommandCliCommand;
                    cliCommand = (currentCommandCliCommand ?? "<command>").replace("<command>", cliCommand);

                    if (parentCommand != null)
                        cliCommand = (resolvedParentCommandCliCommand ?? "<command>").replace("<command>", cliCommand);

                    return [
                        getInlineCodeBlockHtml(
                            markdownRenderer,
                            cliName + " " + cliCommand,
                            "shell",
                            (
                                subCommandsParentPageLink != null
                                    ? (subCommandsParentPageLink + "/")
                                    : ""
                            ) + commandPageLink
                        ),
                        htmlEscapeWithCodeMarkdown(withoutCliCommandDescriptionDocsUrl(String(subCommand.describe ?? "")))
                    ];
                })
                .filter((row): row is string[] => row != null)
        );
    }

    if (optionGroups.length !== 0) {
        res += buildHtmlHeading("h2", htmlEscape("Options"), "options");

        if (optionGroups.length === 1) {
            res += renderOptionsGroupOptionsTable(optionGroups[0]!.options) + "\n";
        } else {
            for (const group of optionGroups) {
                const groupName = group.name;
                if (groupName !== "default") {
                    res += buildHtmlHeading("h3", htmlEscapeWithCodeMarkdown(groupName), encodeURIComponent(groupName.toLowerCase()));
                }

                res += renderOptionsGroupOptionsTable(group.options) + "\n";
            }
        }
    }

    return {
        title,
        description: htmlEscapeWithCodeMarkdown(withoutCliCommandDescriptionDocsUrl(description)),
        usage: npxRunPrefix + title,
        usageHtml: markdownRenderer.render("```shell\n" + npxRunPrefix + title + "\n```"),
        options: res
    };
}


async function parseCommandDefinition(command: CommandModule<any, any>): Promise<{
    subCommands: CommandModule<any, any>[],
    optionGroups: OptionsGroup[]
}> {
    const yargsStub = getYargsStub();
    function getYargsStub() {
        function option(name: string, option: Options) {
            if (option.hidden)
                return yargsStub;

            const group = option.group ?? "default";

            if (options[group] == null)
                options[group] = [];

            options[group].push({name, option});

            if (!groups.includes(group))
                groups.push(group);

            return yargsStub;
        }

        function command(subCommand: CommandModule<any, any>) {
            subCommands.push(subCommand);
            return yargsStub;
        }

        return {option, command};
    }

    const options: Record<string, {name: string, option: Options}[]> = {};
    const subCommands: CommandModule<any, any>[] = [];
    const groups: string[] = [];

    if (command.builder instanceof Function)
        await command.builder?.(yargsStub as any as Argv);
    else if (command.builder != null) {
        for (const [name, option] of Object.entries(command.builder)) {
            yargsStub.option(name, option);
        }
    }

    const hasGroups = groups.length > 1;
    yargsStub.option("help", {
        description: "Show help",
        alias: "h",
        group: hasGroups ? "Other" : undefined
    });
    yargsStub.option("version", {
        description: "Show version number",
        alias: "v",
        group: hasGroups ? "Other" : undefined
    });

    groups.sort((a, b) => {
        if (a === "default")
            return -1;
        if (b === "default")
            return 1;

        if (a === "Other")
            return 1;
        if (b === "Other")
            return -1;

        return 0;
    });

    return {
        subCommands,
        optionGroups: groups.map((group) => ({
            name: normalizeGroupName(group),
            options: options[group]!
        }))
    };
}

function normalizeGroupName(groupName: string): string {
    if (groupName.endsWith(":"))
        groupName = groupName.slice(0, -1);

    return groupName;
}

function renderOptionsGroupOptionsTable(options: {name: string, option: Options}[]): string {
    const tableHeaders = ["Option", "Description"].map(htmlEscape);
    const tableRows: string[][] = [];

    const sortedOptions = options.slice().sort((a, b) => {
        if (a.option.demandOption && !b.option.demandOption)
            return -1;
        if (!a.option.demandOption && b.option.demandOption)
            return 1;

        return 0;
    });

    for (const {name, option} of sortedOptions) {
        let optionValue = "";

        if (option.type === "string") {
            optionValue += " [string]";
        } else if (option.type === "number") {
            optionValue += " <number>";
        }

        const optionName: string[] = [];

        if (option.alias != null) {
            for (const alias of (option.alias instanceof Array ? option.alias : [option.alias])) {
                if (alias.length !== 1)
                    continue;

                optionName.push(`<code style="white-space: nowrap">${htmlEscape("-" + alias + optionValue)}</code>`);
            }
        }

        optionName.push(`<code style="white-space: nowrap">${htmlEscape("--" + name + optionValue)}</code>`);

        if (option.alias != null) {
            for (const alias of (option.alias instanceof Array ? option.alias : [option.alias])) {
                if (alias.length === 1)
                    continue;

                optionName.push(`<code style="white-space: nowrap">${htmlEscape("--" + alias + optionValue)}</code>`);
            }
        }

        const optionDescription: string[] = option.description != null ? [htmlEscapeWithCodeMarkdown(option.description)] : [];

        const hasDefaultDescription = option.defaultDescription != null && option.defaultDescription.trim().length > 0;
        if (option.default != null || hasDefaultDescription) {
            if (hasDefaultDescription && option.defaultDescription != null)
                optionDescription.push(`<span style="opacity: 0.72">(${htmlEscape("default: ")}${htmlEscapeWithCodeMarkdown(option.defaultDescription.trim())})</span>`);
            else
                optionDescription.push(`<span style="opacity: 0.72">(${htmlEscape("default: ")}<code>${htmlEscape(option.default)}</code>)</span>`);
        }

        if (option.type != null) {
            optionDescription.push(`<code><span style="opacity: 0.4">(</span>${htmlEscape(option.type + (option.array ? "[]" : ""))}<span style="opacity: 0.4">)</span></code>`);
        }

        if (option.demandOption) {
            optionDescription.push(`<code><span style="opacity: 0.4">(</span>${htmlEscape("required")}<span style="opacity: 0.4">)</span></code>`);
        }

        if (option.choices != null) {
            optionDescription.push(
                `\n<blockquote><p>${htmlEscape("choices: ")}${
                    option.choices
                        .map((choice) => `<code>${htmlEscape(choice)}</code>`)
                        .join(", ")
                }</p></blockquote>`
            );
        }

        tableRows.push([optionName.join(", "), optionDescription.join(" ")]);
    }

    return buildHtmlTable(tableHeaders, tableRows);
}

function resolveCommandCliCommand(command?: CommandModule<any, any>) {
    if (command == null)
        return undefined;

    return command.command instanceof Array
        ? command.command[0]
        : command.command;
}

function resolveCommandPageLink(command: CommandModule<any, any>) {
    return resolveCommandCliCommand(command)?.split(" ")?.[0];
}

type OptionsGroup = {
    name: string,
    options: Array<{
        name: string,
        option: Options
    }>
};
