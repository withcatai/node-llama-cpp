import {createMarkdownRenderer} from "vitepress";
import {htmlEscape} from "./htmlEscape.js";

export function getInlineCodeBlockHtml(
    markdownRenderer: Awaited<ReturnType<typeof createMarkdownRenderer>>, code: string, lang: string, link?: string
) {
    if (markdownRenderer.options.highlight != null) {
        const codeBlock = markdownRenderer.options.highlight(code, lang, "");

        if (link != null && link !== "")
            return `<a class="inlineCodeLink" href="${link}">${codeBlock}</a>`;

        return `<a class="inlineCodeLink">${codeBlock}</a>`;
    }

    if (link != null && link !== "")
        return `<a href="${link}"><code>${htmlEscape(code)}</code></a>`;

    return `<code>${htmlEscape(code)}</code>`;
}
