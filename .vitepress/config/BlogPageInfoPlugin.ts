import path from "path";
import {MarkdownEnv, Plugin} from "vitepress";
import {getMarkdownRenderer} from "../utils/getMarkdownRenderer.js";
import {renderHtmlTag} from "../utils/renderHtmlTag.js";
import {ensureLocalImage, resolveImageBuffers, relativeToAbsoluteImageUrls} from "../utils/ensureLocalImage.js";

export function BlogPageInfoPlugin({
    include
}: {
    include(id: string): boolean
}): Plugin {
    const refIdToUrlPath = new Map<string, string>();
    let root = "";

    return {
        name: "blog-page-info",
        enforce: "pre",
        configResolved(config) {
            root = config.root ?? "";
        },
        async load(id, options) {
            if (relativeToAbsoluteImageUrls.has(id))
                return `export default ${JSON.stringify(relativeToAbsoluteImageUrls.get(id))};`;

            return undefined;
        },
        resolveId(id) {
            if (relativeToAbsoluteImageUrls.has(id))
                return id;

            return undefined;
        },
        async buildEnd() {
            for (const imageBuffer of resolveImageBuffers.values()) {
                refIdToUrlPath.set(
                    this.emitFile({
                        type: "asset",
                        fileName: imageBuffer.mainImage.path.relative,
                        source: imageBuffer.mainImage.buffer
                    }),
                    imageBuffer.mainImage.path.relative
                );
                refIdToUrlPath.set(
                    this.emitFile({
                        type: "asset",
                        fileName: imageBuffer.previewImage.path.relative,
                        source: imageBuffer.previewImage.buffer
                    }),
                    imageBuffer.previewImage.path.relative
                );
            }
        },
        resolveFileUrl({referenceId, fileName}) {
            if (refIdToUrlPath.has(referenceId))
                return refIdToUrlPath.get(referenceId);

            return undefined;
        },
        async transform(code, id) {
            if (!id.endsWith(".md"))
                return code;
            else if (!include(id))
                return code;

            const markdownRenderer = await getMarkdownRenderer();
            const mdEnv: MarkdownEnv = {
                path: path.resolve(root, id),
                relativePath: path.relative(root, id),
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

            const frontmatterDate = new Date(frontmatter.date);
            let newCode = frontmatterCode + (
                "# " + frontmatter.title + "\n\n" +
                    [
                        "",
                        '<script setup lang="ts">',
                        `const articleDate = new Date(${JSON.stringify(frontmatterDate.toISOString())}).toLocaleDateString("en-US", {`,
                        '    year: "numeric",',
                        '    month: "long",',
                        '    day: "numeric"',
                        "});",
                        "</script>",
                        "",
                        '<p class="blog-date">{{ articleDate }}</p>',
                        ""
                    ].join("\n")
            );

            if (frontmatter.image != null) {
                let imageDir = path.relative(root, id);
                if (imageDir.toLowerCase().endsWith(".md"))
                    imageDir = imageDir.slice(0, -".md".length);

                if (typeof frontmatter.image === "string") {
                    const {
                        urlPath, previewUrlPath, width, height
                    } = await ensureLocalImage(frontmatter.image, "cover", {
                        baseDestLocation: imageDir.split(path.sep)
                    });
                    newCode += renderHtmlTag("img", {
                        "class": "blog-coverImage",
                        src: urlPath.relative,
                        alt: frontmatter.title,
                        width: width,
                        height: height,
                        style: "background-image: url(" + JSON.stringify(previewUrlPath.absolute) + ");"
                    });
                } else if (typeof (frontmatter.image as any).url === "string") {
                    const {
                        urlPath, previewUrlPath, width, height
                    } = await ensureLocalImage((frontmatter.image as any).url, "cover", {
                        baseDestLocation: imageDir.split(path.sep)
                    });
                    newCode += renderHtmlTag("img", {
                        "class": "blog-coverImage",
                        src: urlPath.relative,
                        alt: (frontmatter.image as any).alt ?? frontmatter.title,
                        width: width ?? (frontmatter.image as any).width,
                        height: height ?? (frontmatter.image as any).height,
                        style: "background-image: url(" + JSON.stringify(previewUrlPath.absolute) + ");"
                    });
                }
            }

            newCode += "\n\n";
            newCode += markdownCode;

            return newCode;
        }
    };
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
