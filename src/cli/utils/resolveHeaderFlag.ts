export function resolveHeaderFlag(header?: string[] | string) {
    if (typeof header === "string")
        header = [header];

    if (header == null || header.length === 0)
        return {};

    const res: Record<string, string> = {};

    for (const headerItem of header) {
        const colonIndex = headerItem.indexOf(":");

        if (colonIndex < 0)
            throw new Error(`Invalid header item: ${headerItem}`);

        const key = headerItem.slice(0, colonIndex).trim();

        if (Object.hasOwn(res, key))
            throw new Error(`Duplicate header key: ${key}`);

        let value = headerItem.slice(colonIndex + 1);
        if (value.startsWith(" "))
            value = value.slice(1);

        res[key] = value;
    }

    return res;
}
