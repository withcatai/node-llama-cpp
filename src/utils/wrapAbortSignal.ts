export function wrapAbortSignal(abortSignal?: AbortSignal) {
    const controller = new AbortController();

    if (abortSignal != null)
        abortSignal.addEventListener("abort", () => {
            controller.abort(abortSignal.reason);
        });

    return controller;
}
