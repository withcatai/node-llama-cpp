import {Argv, CommandModule, Options} from "yargs";
import {htmlEscape} from "./htmlEscape.js";
import {cliBinName, npxRunPrefix} from "../../src/config.js";
import {buildHtmlTable} from "./buildHtmlTable.js";
import {buildHtmlHeading} from "./buildHtmlHeading.js";

export async function getCommandHtmlDoc(command: CommandModule<any, any>, cliName: string = cliBinName) {
    const title = cliName + " " + command.command ?? "";
    const description = command.describe ?? "";
    const optionGroups = await getOptionsGroupFromCommand(command);

    let res = "";

    if (optionGroups.length !== 0) {
        res += buildHtmlHeading("h2", htmlEscape("Options"), "options");

        if (optionGroups.length === 1) {
            res += renderOptionsGroupOptionsTable(optionGroups[0].options) + "\n";
        } else {
            for (const group of optionGroups) {
                let groupName = group.name;
                if (groupName !== "default") {
                    res += buildHtmlHeading("h3", htmlEscape(groupName), encodeURIComponent(groupName.toLowerCase()));
                }

                res += renderOptionsGroupOptionsTable(group.options) + "\n";
            }
        }
    }

    return {
        title,
        description,
        usage: npxRunPrefix + title,
        options: res
    };
}


async function getOptionsGroupFromCommand(command: CommandModule<any, any>): Promise<OptionsGroup[]> {
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

        return {option};
    }

    const options: Record<string, {name: string, option: Options}[]> = {};
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

    return groups.map((group) => ({
        name: normalizeGroupName(group),
        options: options[group]!
    }));
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

        let optionDescription: string[] = option.description != null ? [htmlEscape(option.description)] : [];

        if (option.default != null) {
            optionDescription.push(`(${htmlEscape("default: ")}<code>${htmlEscape(option.default)}</code>)`);
        }

        if (option.type != null) {
            optionDescription.push(`(<code>${htmlEscape(option.type)}</code>)`);
        }

        if (option.demandOption) {
            optionDescription.push(`(<code>${htmlEscape("required")}</code>)`);
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

        tableRows.push([optionName.join(", "), optionDescription.join(" ")])
    }

    return buildHtmlTable(tableHeaders, tableRows);
}

type OptionsGroup = {
    name: string,
    options: Array<{
        name: string,
        option: Options
    }>
};
