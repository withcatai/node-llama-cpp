/**
 * Iterate of all possible combinations of the given options.
 * @example
 * ```typescript
 * for (const {a, b} of optionsMatrix({a: [1, 2], b: ["x", "y"]}))
 *    console.log(a, b);
 * ```
 *
 * Will output:
 * ```txt
 * 1 x
 * 1 y
 * 2 x
 * 2 y
 * ```
 */
export function* optionsMatrix<const T extends Record<string, any>>(options: {[K in keyof T]: T[K][]}): Generator<{[K in keyof T]: T[K]}> {
    const keys: Array<keyof T> = Object.keys(options);
    const indexes = keys.map(() => 0);

    while (true) {
        const result: any = {} as {[K in keyof T]: T[K]};
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]!;
            const keyOptions = options[key]!;
            result[key] = keyOptions[indexes[i]!];
        }

        yield result;

        let moved: boolean = false;
        for (let i = keys.length - 1; i >= 0; i--) {
            const key = keys[i]!;
            const keyOptions = options[key]!;

            if (indexes[i]! >= keyOptions.length - 1) {
                if (i === 0)
                    return;

                indexes[i] = 0;
            } else if (indexes[i]! < keyOptions.length - 1) {
                indexes[i]!++;
                moved = true;
                break;
            }
        }

        if (!moved)
            return;
    }
}

/**
 * Iterate of all possible combinations of the given options and call the callback with each combination.
 *
 * The result of the first combination that doesn't throw an error will be returned as the result of this function.
 *
 * If all combinations throw an error, the error of the last combination will be thrown.
 * @example
 * ```typescript
 * const result = tryMatrix({
 *     a: [1, 2],
 *     b: ["x", "y"]
 * }, ({a, b}) => {
 *     console.log(a, b);
 *
 *     if (a === 2 && b === "y")
 *         return `success ${a} ${b}`;
 *
 *    throw new Error("fail");
 * });
 *
 * console.log(result);
 * ```
 *
 * Will output:
 * ```txt
 * 1 x
 * 1 y
 * 2 x
 * 2 y
 * success 2 y
 * ```
 */
export function tryMatrix<const T extends Record<string, any>, R>(
    options: {[K in keyof T]: T[K][]},
    callback: (options: {[K in keyof T]: T[K]}) => R
): R {
    let nextOption: {[K in keyof T]: T[K]} | undefined = undefined;

    for (const option of optionsMatrix(options)) {
        if (nextOption == null) {
            nextOption = option;
            continue;
        }

        try {
            return callback(nextOption);
        } catch (err) {
            nextOption = option;
        }
    }

    if (nextOption != null)
        return callback(nextOption);

    throw new Error("All options failed");
}
