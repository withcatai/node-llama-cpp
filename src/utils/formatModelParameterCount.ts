/**
 * Format a parameter count as compact text, such as `560M`, `2B`, or `2T`.
 * Promotes `950K` to `1M`, `950M` to `1B`, `980B` to `1T`, and `980T` to `1Q`.
 */
export function formatModelParameterCount(parameters: number): string {
    if (parameters < 1000)
        return String(parameters);
    else if (parameters < 950 * 1000)
        return Math.round(parameters / 1000) + "K";
    else if (parameters < 950 * (1000 ** 2))
        return Math.round(parameters / (1000 ** 2)) + "M";
    else if (parameters < 980 * (1000 ** 3))
        return Math.round(parameters / (1000 ** 3)) + "B";
    else if (parameters < 980 * (1000 ** 4))
        return Math.round(parameters / (1000 ** 4)) + "T";

    return Math.round(parameters / (1000 ** 5)) + "Q";
}
