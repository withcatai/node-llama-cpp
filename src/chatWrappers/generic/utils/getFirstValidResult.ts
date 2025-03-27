/**
 * Call the functions in the array one by one and return the result of the first one that doesn't throw an error.
 *
 * If all functions throw an error, throw the error of the last function.
 */
export function getFirstValidResult<const T extends (() => any)[]>(options: T): ReturnType<T[number]> {
    for (let i = 0; i < options.length; i++) {
        if (i === options.length - 1)
            return options[i]!();

        try {
            return options[i]!();
        } catch (err) {
            // do nothing
        }
    }

    throw new Error("All options failed");
}
