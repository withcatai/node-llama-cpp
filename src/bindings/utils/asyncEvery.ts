import {getConsoleLogPrefix} from "../../utils/getConsoleLogPrefix.js";

/**
 * Returns a promise that resolves to true if every promise in the array resolves to true, otherwise false.
 * Note that this function will not throw on error and instead will log the error to the console.
 */
export async function asyncEvery(promises: Promise<boolean>[]): Promise<boolean> {
    try {
        return (await Promise.all(promises)).every(Boolean);
    } catch (err) {
        console.error(getConsoleLogPrefix(false, false), err);

        return false;
    }
}
