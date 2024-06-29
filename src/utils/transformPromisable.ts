/**
 * Transform a value that can be a promise or a value.
 *
 * This is used as a performance optimization to avoid adding many microtasks to the event loop,
 * which makes reading from buffers significantly faster.
 * @param value - The value to transform, can be a promise or a value
 * @param transformer - The transformer function
 * @returns The transformed value. If the input value is a promise, the return value will also be a promise.
 */
export function transformPromisable<T, R>(value: Promisable<T>, transformer: (value: T) => Promisable<R>): Promisable<R> {
    if (value instanceof Promise)
        return value.then(transformer);

    return transformer(value);
}

/**
 * Transform multiple values that can be promises or values.
 *
 * This is used as a performance optimization to avoid adding many microtasks to the event loop,
 * which makes reading from buffers significantly faster.
 * @param values - The values to transform, can be promises or values
 * @param transformer - The transformer function
 */
export function transformPromisables<const Types extends readonly any[], R>(
    values: { [Index in keyof Types]: Promisable<Types[Index]> },
    transformer: (values: { [Index in keyof Types]: Types[Index] }) => Promisable<R>
): Promisable<R> {
    if (values.some(value => value instanceof Promise))
        return Promise.all(values).then(transformer);

    return transformer(values);
}

/**
 * An implementation of a loop that waits on promises only when the value is a promise, and otherwise continues synchronously.
 *
 * This is a performance optimization to avoid adding many microtasks to the event loop,
 * which makes reading from buffers significantly faster.
 */
export function promisableLoop<R>({
    condition,
    callback,
    afterthought = () => void 0,
    returnValue
}: {
    /** The condition to check before each iteration */
    condition: () => Promisable<boolean>,

    /** The callback to run on each iteration */
    callback: () => Promisable<void>,

    /** An afterthought to run after each iteration */
    afterthought?: () => Promisable<void>,

    /** The value to return when the loop is done */
    returnValue: () => Promisable<R>
}): Promisable<R> {
    function iterate(): Promisable<R> {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const shouldContinue = condition();

            if (shouldContinue instanceof Promise)
                return shouldContinue
                    .then((shouldContinue): Promisable<R> => {
                        if (shouldContinue) {
                            const value = callback();
                            if (value instanceof Promise)
                                return value.then(() => transformPromisable(afterthought(), iterate));

                            return transformPromisable(afterthought(), iterate);
                        }

                        return returnValue();
                    });

            if (shouldContinue) {
                const value = callback();
                if (value instanceof Promise)
                    return value.then(() => transformPromisable(afterthought(), iterate));

                const afterthoughtValue = afterthought();
                if (afterthoughtValue instanceof Promise)
                    return afterthoughtValue.then(iterate);

                continue;
            }

            return returnValue();
        }
    }

    return iterate();
}

export type Promisable<T> = T | Promise<T>;
