import chalk from "chalk";
import logSymbols from "log-symbols";
import {clockChar} from "../consts.js";
import {getConsoleLogPrefix} from "./getConsoleLogPrefix.js";


export default async function withStatusLogs<T>(
    messageAndOptions: string | {
        loading: string,
        success?: string,
        fail?: string,
        disableLogs?: boolean
    },
    callback: () => Promise<T>
): Promise<T> {
    if (typeof messageAndOptions !== "string" && messageAndOptions.disableLogs)
        return await callback();

    console.warn(getConsoleLogPrefix() + `${chalk.cyan(clockChar)} ${typeof messageAndOptions === "string" ? messageAndOptions : messageAndOptions.loading}`);

    try {
        const res = await callback();

        if (typeof messageAndOptions !== "string")
            console.warn(getConsoleLogPrefix() + `${logSymbols.success} ${messageAndOptions.success}`);
        else
            console.warn(getConsoleLogPrefix() + `${logSymbols.success} ${messageAndOptions}`);

        return res;
    } catch (er) {
        if (typeof messageAndOptions !== "string")
            console.warn(getConsoleLogPrefix() + `${logSymbols.error} ${messageAndOptions.fail}`);
        else
            console.warn(getConsoleLogPrefix() + `${logSymbols.error} ${messageAndOptions}`);

        throw er;
    }
}
