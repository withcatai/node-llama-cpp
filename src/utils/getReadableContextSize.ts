export function getReadableContextSize(contextSize: number) {
    return contextSize.toLocaleString("en-US", {
        notation: "compact",
        compactDisplay: "short"
    });
}
