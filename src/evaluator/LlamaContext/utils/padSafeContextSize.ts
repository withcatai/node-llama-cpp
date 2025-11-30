import {contextSizePad} from "../../../config.js";

export function padSafeContextSize(value: number, padDirection: "up" | "down", padding: number = contextSizePad) {
    const paddedSize = ggmlPad(value, padding);

    if (paddedSize === value)
        return value;
    else if (padDirection === "up")
        return paddedSize;
    else if (padDirection === "down") {
        const smallerPaddedSize = ggmlPad(value - padding, padding);
        if (smallerPaddedSize >= padding)
            return smallerPaddedSize;
    }

    return paddedSize;
}
function ggmlPad(value: number, padding: number): number {
    return ((value + padding - 1) & ~(padding - 1));
}
