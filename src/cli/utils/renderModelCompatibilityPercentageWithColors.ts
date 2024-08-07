import chalk from "chalk";

export function renderModelCompatibilityPercentageWithColors(percentage: number, {
    greenBright = 100,
    green = 95,
    yellow = 85,
    yellowBright = 75
}: {
    greenBright?: number,
    green?: number,
    yellow?: number,
    yellowBright?: number
} = {}): string {
    const percentageText = String(Math.floor(percentage)) + "%";

    if (percentage >= greenBright)
        return chalk.greenBright(percentageText);
    else if (percentage >= green)
        return chalk.green(percentageText);
    else if (percentage >= yellow)
        return chalk.yellow(percentageText);
    else if (percentage >= yellowBright)
        return chalk.yellowBright(percentageText);

    return chalk.red(percentageText);
}
