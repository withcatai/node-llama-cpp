import chalk from "chalk";
import stripAnsi from "strip-ansi";

export function printInfoLine(options: Parameters<typeof renderInfoLine>[0]) {
    console.info(renderInfoLine(options));
}

export function renderInfoLine({
    title, padTitle = 0, separateLines = false, info, maxWidth = process.stdout.columns - 1
}: {
    title?: string,
    padTitle?: number,
    separateLines?: boolean,
    info: Array<{
        title: string,
        value: string | (() => string),
        show?: boolean
    }>,
    maxWidth?: number
}) {
    const res: string[] = [];
    const items: string[] = [];
    if (separateLines) {
        if (title != null && title.length > 0)
            res.push(chalk.yellowBright(`${title.trim()}`));

        for (const {title, value, show} of info) {
            if (show === false)
                continue;

            if (title == null || title === "")
                items.push(value instanceof Function ? value() : value);
            else
                items.push(`${chalk.yellow(title + ":")} ${value instanceof Function ? value() : value}`);
        }

        const itemPrefix = `${chalk.dim("|")} `;
        res.push(itemPrefix + items.join("\n" + itemPrefix));
        return res.join("\n") + "\n";
    } else {
        if (title != null && title.length > 0)
            res.push(chalk.yellowBright(`${title.padEnd(padTitle, " ")}`));

        for (const {title, value, show} of info) {
            if (show === false)
                continue;

            if (title == null || title === "")
                items.push(chalk.bgGray(` ${value instanceof Function ? value() : value} `));
            else
                items.push(chalk.bgGray(` ${chalk.yellow(title + ":")} ${value instanceof Function ? value() : value} `));
        }

        const startPad = stripAnsi(res.join(" ")).length + (res.length > 0 ? " ".length : 0);
        res.push(splitItemsIntoLines(items, maxWidth - startPad).join("\n" + " ".repeat(startPad)));
        return res.join(" ");
    }
}

function splitItemsIntoLines(items: string[], maxLineLength: number) {
    const lines: string[] = [];
    let currentLine: string[] = [];

    for (const item of items) {
        if (stripAnsi([...currentLine, item].join(" ")).length > maxLineLength) {
            lines.push(currentLine.join(" "));
            currentLine = [];
        }

        currentLine.push(item);
    }

    if (currentLine.length > 0)
        lines.push(currentLine.join(" "));

    return lines;
}
