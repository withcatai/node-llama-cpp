const safeCallbackSymbol = Symbol("safeCallback");

/**
 * Wraps a callback in a try-catch block and logs any errors to the console
 */
export function safeEventCallback<const Params extends any[]>(
    callback: ((...args: Params) => void) | ((...args: Params) => Promise<void>) | ((...args: Params) => void | Promise<void>),
    message?: string
): ((...args: Params) => void);
export function safeEventCallback(callback?: undefined | void | never, message?: string): undefined;
export function safeEventCallback<const Params extends any[] = any[]>(
    callback?: undefined | void | never | ((...args: Params) => void) | ((...args: Params) => Promise<void>) |
        ((...args: Params) => void | Promise<void>),
    message?: string
): undefined | ((...args: Params) => void);
export function safeEventCallback<const Params extends any[] = any[]>(
    callback?: undefined | void | never | ((...args: Params) => void) | ((...args: Params) => Promise<void>) |
        ((...args: Params) => void | Promise<void>),
    message?: string
): undefined | ((...args: Params) => void) {
    if (callback == null)
        return undefined;

    // do not wrap the callback if it's already wrapped
    if ((callback as any)?.[safeCallbackSymbol] === true)
        return callback;

    const res = (...args: Params) => {
        try {
            const res = callback(...args);

            if (res instanceof Promise)
                res.catch((error) => {
                    if (message != null)
                        console.error(message, error);
                    else
                        console.error(error);
                });
        } catch (error) {
            if (message != null)
                console.error(message, error);
            else
                console.error(error);
        }
    };
    res[safeCallbackSymbol] = true;

    return res;
}
