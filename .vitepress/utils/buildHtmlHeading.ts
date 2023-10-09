export function buildHtmlHeading(headingType: "h1" | "h2" | "h3" | "h4" | "h5" | "h6", content: string, id?: string) {
    return (
        `<${headingType}${id != null ? ` id="${id}"` : ""}>` +
        "" + content + (id != null ? `<a class="header-anchor" href="#${id}"></a>` : "") +
        `</${headingType}>\n`
    );
}
