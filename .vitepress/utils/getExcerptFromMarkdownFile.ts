import {getMarkdownRenderer} from "./getMarkdownRenderer.js";

export async function getExcerptFromMarkdownFile(
    markdownContent: string,
    removeTitle: boolean = true,
    maxLength: number = 80
) {
    const renderer = await getMarkdownRenderer();
    let content = markdownContent.trim().replaceAll("\r\n", "\n");

    if (content.startsWith("---")) {
        const frontMatterEndIndex = content.indexOf("\n---", "---".length);
        const nextNewLine = content.indexOf("\n", frontMatterEndIndex + "\n---".length);
        if (frontMatterEndIndex >= 0 && nextNewLine >= 0)
            content = content.slice(nextNewLine + 1).trim();
    }

    if (removeTitle && content.startsWith("# ")) {
        const nextNewLine = content.indexOf("\n");
        if (nextNewLine >= 0)
            content = content.slice(nextNewLine + "\n".length).trim();
    }

    const renderedText = markdownToPlainText(renderer, content).trim();

    if (renderedText.length > maxLength) {
        if (renderedText[maxLength] === " ")
            return renderedText.slice(0, maxLength);

        const lastSpaceIndex = renderedText.lastIndexOf(" ", maxLength);
        if (lastSpaceIndex >= 0)
            return renderedText.slice(0, lastSpaceIndex);

        return renderedText.slice(0, maxLength);
    }

    return renderedText;
}

function markdownToPlainText(
    markdownIt: Awaited<ReturnType<typeof getMarkdownRenderer>>,
    markdown: string,
    includeNotes: boolean = false,
    includeCode: boolean = false
) {
    const env = {};
    const pageTokens = markdownIt.parse(markdown, env);

    function toText(tokens: typeof pageTokens) {
        let text = "";
        let addedParagraphSpace = false;

        for (const token of tokens) {
            if (!includeNotes && token.type === "inline" && token.level === 2)
                continue;

            if (token.children != null) {
                const childrenText = toText(token.children);
                if (addedParagraphSpace && childrenText.startsWith(" "))
                    text += childrenText.slice(" ".length);
                else
                    text += childrenText;
            } else if (
                ["text", "code_block", "code_inline", "emoji"].includes(token.type) ||
                (includeCode && ["fence"].includes(token.type))
            ) {
                if (addedParagraphSpace && token.content.startsWith(" "))
                    text += token.content.slice(" ".length);
                else
                    text += token.content;

                addedParagraphSpace = false;
            } else if (token.type.endsWith("_close")) {
                text += " ";
                addedParagraphSpace = true;
            }
        }

        return text;
    }

    return toText(pageTokens);
}
