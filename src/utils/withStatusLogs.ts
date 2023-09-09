import chalk from "chalk";
import logSymbols from "log-symbols";

const clockChar = "\u25f7";

export default async function withStatusLogs<T>(
    message: string | {
        loading: string,
        success?: string,
        fail?: string,
    },
    callback: () => Promise<T>
): Promise<T> {
    console.log(`${chalk.cyan(clockChar)} ${typeof message === "string" ? message : message.loading}`);

    try {
        const res = await callback();

        if (typeof message !== "string")
            console.log(`${logSymbols.success} ${message.success}`);
        else
            console.log(`${logSymbols.success} ${message}`);

        return res;
    } catch (er) {
        if (typeof message !== "string")
            console.log(`${logSymbols.error} ${message.fail}`);
        else
            console.log(`${logSymbols.error} ${message}`);

        throw er;
    }
}
