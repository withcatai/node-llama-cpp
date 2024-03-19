import chalk from "chalk";

type PrettyPrintObjectOptions = {
    maxArrayValues?: number,
    useNumberGrouping?: boolean
};

export function prettyPrintObject(obj: any, indent: number = 4, options: PrettyPrintObjectOptions = {}): string {
    if (typeof obj === "string")
        return chalk.green(JSON.stringify(obj, null, 4));
    else if (typeof obj === "number")
        return chalk.yellow(
            options.useNumberGrouping
                ? obj.toLocaleString("en-US", {
                    style: "decimal",
                    useGrouping: true
                }).replaceAll(",", "_")
                : obj
        );
    else if (typeof obj === "boolean")
        return chalk.magenta.italic(obj);
    else if (obj === null)
        return chalk.magenta.italic("null");
    else if (obj === undefined)
        return chalk.magenta.italic("undefined");
    else if (obj instanceof Array)
        return prettyPrintArray(obj, indent, options);

    const rows: string[] = [];
    for (const key of Object.keys(obj)) {
        const value = obj[key as keyof typeof obj];

        rows.push([
            " ".repeat(indent),
            canStringBeKeyWithoutQuotes(key)
                ? chalk.red(key)
                : chalk.green(JSON.stringify(key)),
            chalk.whiteBright(": "),
            prettyPrintObject(value, indent, options)
                .replaceAll("\n", "\n" + " ".repeat(indent))
        ].join(""));
    }

    if (rows.length === 0)
        return chalk.whiteBright("{}");

    return chalk.whiteBright("{\n") + rows.join(chalk.whiteBright(",\n")) + chalk.whiteBright("\n") + chalk.whiteBright("}");
}

function canStringBeKeyWithoutQuotes(key: string): boolean {
    return JSON.stringify(key).slice(1, -1) === key && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key);
}

function prettyPrintArray(arr: any[], indent: number = 4, options: PrettyPrintObjectOptions = {}) {
    const slicedArray = (options.maxArrayValues != null && arr.length > options.maxArrayValues)
        ? arr.slice(0, options.maxArrayValues)
        : arr;
    const hiddenItems = arr.length - slicedArray.length;

    return [
        chalk.whiteBright("["),
        slicedArray.map((item) => prettyPrintObject(item, indent, options))
            .concat(
                hiddenItems > 0
                    ? [chalk.white("..." + hiddenItems + " more item" + (hiddenItems !== 1 ? "s" : ""))]
                    : []
            )
            .join(chalk.whiteBright(", ")),
        chalk.whiteBright("]")
    ].join("");
}
