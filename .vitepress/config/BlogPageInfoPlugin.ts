import {createMarkdownRenderer, MarkdownEnv, Plugin} from "vitepress";
import path from "path";
import {htmlEscape} from "../utils/htmlEscape.js";
import {getMarkdownRenderer} from "../utils/getMarkdownRenderer.js";
import {renderHtmlTag} from "../utils/renderHtmlTag.js";

export function BlogPageInfoPlugin({
    include
}: {
    include(id: string): boolean,
}): Plugin {
    let root = "";

    return {
        name: "blog-page-info",
        enforce: "pre",
        configResolved(config) {
            root = config.root ?? "";
        },
        async transform(code, id) {
            if (!id.endsWith(".md"))
                return code;
            else if (!include(id))
                return code;

            const markdownRenderer = await getMarkdownRenderer();
            const mdEnv: MarkdownEnv = {
                path: path.join(root, id),
                relativePath: id,
                cleanUrls: true
            };
            markdownRenderer.render(code, mdEnv);
            const {frontmatter = {}} = mdEnv;

            const frontmatterEndIndex = findFrontmatterEndIndex(code);

            if (typeof frontmatter.title !== "string")
                throw new Error(`No title found in frontmatter of ${id}`);
            else if (typeof frontmatter.date !== "string" && !(frontmatter.date instanceof Date))
                throw new Error(`No date found in frontmatter of ${id}`);
            else if (frontmatterEndIndex < 0)
                throw new Error(`No frontmatter found in ${id}`);

            const frontmatterCode = code.slice(0, frontmatterEndIndex);
            const markdownCode = code.slice(frontmatterEndIndex);

            let newCode = frontmatterCode + (
                "# " + frontmatter.title + "\n\n" +
                `<p class="blog-date">${
                    htmlEscape(new Date(frontmatter.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric"
                    }))
                }</p>`
            );

            if (frontmatter.image != null) {
                if (typeof frontmatter.image === "string")
                    newCode += renderHtmlTag("img", {
                        "class": "blog-coverImage",
                        src: frontmatter.image,
                        alt: frontmatter.title
                    });
                else if (typeof (frontmatter.image as any).url === "string")
                    newCode += renderHtmlTag("img", {
                        "class": "blog-coverImage",
                        src: (frontmatter.image as any).url,
                        alt: (frontmatter.image as any).alt ?? frontmatter.title,
                        width: (frontmatter.image as any).width,
                        height: (frontmatter.image as any).height,
                        style: (frontmatter.image as any).lowResUrl != null
                            ? 'background-image: url(' + JSON.stringify((frontmatter.image as any).lowResUrl) + ');'
                            : undefined
                    });
            }

            newCode += "\n\n";
            newCode += markdownCode;

            return newCode;
        }
    }
}

function findFrontmatterEndIndex(mdCode: string): number {
    const lines = mdCode.split("\n");
    let countedSeparators = 0;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex]!;

        if (line.startsWith("---")) {
            countedSeparators++;

            if (countedSeparators === 2)
                return lines
                    .slice(0, lineIndex + 1)
                    .reduce((res, line) => res + line.length + 1, 0);
        }
    }

    return -1;
}
