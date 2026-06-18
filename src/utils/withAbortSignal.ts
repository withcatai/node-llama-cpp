export function withAbortSignal<T>(signal: AbortSignal | undefined, promise: Promise<T>): Promise<T> {
    if (signal == null)
        return promise;
    else if (signal.aborted)
        return Promise.reject(signal.reason);

    return new Promise((accept, reject) => {
        function onAbort() {
            signal!.removeEventListener("abort", onAbort);
            reject(signal!.reason);
        }

        signal.addEventListener("abort", onAbort);

        promise.then((value) => {
            signal.removeEventListener("abort", onAbort);
            accept(value);
        }, (error) => {
            signal.removeEventListener("abort", onAbort);
            reject(error);
        });
    });
}
