export function includesText(
    value: string | string[] | null | undefined,
    textToCheckFor: string | string[],
    strictCase: boolean = false
): boolean {
    if (value instanceof Array)
        return value.some((v) => includesText(v, textToCheckFor, strictCase));
    else if (typeof value !== "string")
        return false;

    if (textToCheckFor instanceof Array)
        return textToCheckFor.some((t) => includesText(value, t, strictCase));

    if (strictCase)
        return value.includes(textToCheckFor);

    return value.toLowerCase().includes(textToCheckFor.toLowerCase());
}
