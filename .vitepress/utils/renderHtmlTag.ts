export function renderHtmlTag(
    tagName: string,
    attributes: Record<string, string | number | boolean | null | undefined>,
    htmlContent?: string
) {
    const renderedAttributes: string[] = [];
    for (const key of Object.keys(attributes)) {
        const value = attributes[key];
        if (value === true || value == null)
            renderedAttributes.push(key);
        else if (value === false)
            continue;

        renderedAttributes.push(`${key}="${escapeAttributeValue(String(value))}"`);
    }

    const attributesString = renderedAttributes.length === 0
        ? ""
        : " " + renderedAttributes.join(" ");

    if (htmlContent == null)
        return `<${tagName}${attributesString} />`;
    else
        return `<${tagName}${attributesString}>${htmlContent}</${tagName}>`;
}

function escapeAttributeValue(text: string) {
    return text
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/&(?![\w#]+;)/g, "&amp;");
}
