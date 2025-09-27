export function signalSleep(delay: number, abortSignal?: AbortSignal): Promise<void> {
    return new Promise<void>((accept, reject) => {
        if (abortSignal?.aborted)
            return void reject(abortSignal.reason);

        let timeout: ReturnType<typeof setTimeout> | undefined = undefined;
        function onAbort() {
            reject(abortSignal?.reason);
            clearTimeout(timeout);
            abortSignal?.removeEventListener("abort", onAbort);
        }

        function onTimeout() {
            accept();
            timeout = undefined;
            abortSignal?.removeEventListener("abort", onAbort);
        }

        abortSignal?.addEventListener("abort", onAbort);
        timeout = setTimeout(onTimeout, delay);
    });
}
