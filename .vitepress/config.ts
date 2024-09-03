import {createContentLoader, DefaultTheme, defineConfig, HeadConfig} from "vitepress";
import path from "path";
import {createRequire} from "node:module";
import process from "process";
import fs from "fs-extra";
import {fileURLToPath} from "url";
import {transformerTwoslash} from "@shikijs/vitepress-twoslash";
import ts from "typescript";
import envVar from "env-var";
import {Feed} from "feed";
import {rehype} from "rehype";
import {Element as HastElement, Parent} from "hast";
import {GitChangelog, GitChangelogMarkdownSection} from "@nolebase/vitepress-plugin-git-changelog/vite";
import {buildEndGenerateOpenGraphImages} from "@nolebase/vitepress-plugin-og-image/vitepress";
import typedocSidebar from "../docs/api/typedoc-sidebar.json"; // if this import fails, run `npm run docs:generateTypedoc`
import {BlogPageInfoPlugin} from "./config/BlogPageInfoPlugin.js";

import type {Node as UnistNode} from "unist";
import type {ShikiTransformer} from "shiki";


const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson: typeof import("../package.json") = fs.readJsonSync(path.join(__dirname, "..", "package.json"));
const env = envVar.from(process.env);

const urlBase = env.get("DOCS_URL_BASE")
    .asString();
const packageVersion = env.get("DOCS_PACKAGE_VERSION")
    .default(packageJson.version)
    .asString();
const googleSiteVerificationCode = "7b4Hd_giIK0EFsin6a7PWLmM_OeaC7APLZUxVGwwI6Y";

const hostname = "https://withcatai.github.io/node-llama-cpp/";

const socialPosterLink = hostname + "social.poster.jpg";
const defaultPageTitle = "node-llama-cpp - node.js bindings for llama.cpp";
const defaultPageDescription = "Run AI models locally on your machine with node.js bindings for llama.cpp";

const chatWrappersOrder = [
    "GeneralChatWrapper",
    "Llama3ChatWrapper",
    "Llama2ChatWrapper",
    "ChatMLChatWrapper",
    "FalconChatWrapper"
] as const;

const categoryOrder = [
    "Functions",
    "Classes",
    "Types",
    "Enums"
] as const;

const functionsOrder = [
    "getLlama",
    "defineChatSessionFunction",
    "LlamaText"
] as const;

function resolveHref(href: string) {
    if (urlBase == null)
        return href;

    if (urlBase.endsWith("/") && href.startsWith("/"))
        return urlBase.slice(0, -1) + href;

    return urlBase + href;
}

const defaultImageMetaTags: HeadConfig[] = [
    ["meta", {name: "og:image", content: socialPosterLink}],
    ["meta", {name: "og:image:width", content: "4096"}],
    ["meta", {name: "og:image:height", content: "2048"}],
    ["meta", {name: "twitter:image", content: socialPosterLink}],
    ["meta", {name: "twitter:card", content: "summary_large_image"}]
];

export default defineConfig({
    title: "node-llama-cpp",
    description: defaultPageDescription,

    srcDir: "./docs",
    outDir: "./docs-site",
    cacheDir: "./.vitepress/.cache",

    cleanUrls: true,
    lastUpdated: true,

    contentProps: {
        packageVersion
    },

    base: urlBase,
    sitemap: {
        hostname,
        transformItems(items) {
            return items.map((item) => {
                if (item.url.includes("api/") || item.url.includes("cli/")) {
                    item = {
                        ...item,
                        lastmod: undefined
                    };
                }

                return item;
            });
        }
    },
    head: [
        ["link", {rel: "icon", type: "image/svg+xml", href: resolveHref("/favicon.svg")}],
        ["link", {rel: "icon", type: "image/png", href: resolveHref("/favicon.png")}],
        ["link", {rel: "alternate", title: "Blog", type: "application/atom+xml", href: resolveHref("/blog/feed.atom")}],
        ["meta", {name: "theme-color", content: "#cd8156"}],
        ["meta", {name: "theme-color", content: "#dd773e", media: "(prefers-color-scheme: dark)"}],
        ["meta", {name: "og:type", content: "website"}],
        ["meta", {name: "og:locale", content: "en"}],
        ["meta", {name: "og:site_name", content: "node-llama-cpp"}]
    ],
    transformHead({pageData, head}) {
        if (pageData.filePath === "index.md") {
            head.push(["meta", {name: "google-site-verification", content: googleSiteVerificationCode}]);
            head.push(...defaultImageMetaTags);
        } else if (pageData.relativePath === "404.md")
            head.push(...defaultImageMetaTags);

        const title = [
            pageData.title,
            pageData.titleTemplate
        ]
            .filter(Boolean)
            .join(" - ") || defaultPageTitle;
        const description = pageData.description || defaultPageDescription;

        head.push(["meta", {name: "og:title", content: title}]);
        head.push(["meta", {name: "og:description", content: description}]);
        head.push(["meta", {name: "twitter:title", content: title}]);
        head.push(["meta", {name: "twitter:description", content: description}]);
    },
    transformPageData(pageData) {
        if (pageData.filePath.startsWith("api/")) {
            pageData.frontmatter.editLink = false;
            pageData.frontmatter.lastUpdated = false;
            pageData.frontmatter ||= {};
            pageData.frontmatter.outline = [2, 3];
            pageData.frontmatter.nolebase = {
                gitChangelog: false
            };
        }

        if (pageData.filePath.startsWith("cli/")) {
            pageData.frontmatter.editLink = false;
            pageData.frontmatter.lastUpdated = false;
            pageData.frontmatter.nolebase = {
                gitChangelog: false
            };
        }

        if (pageData.filePath.startsWith("blog/")) {
            pageData.frontmatter.editLink = false;
            pageData.frontmatter.aside = false;
            pageData.frontmatter.nolebase = {
                gitChangelog: false
            };
        }

        let canonicalUrl = hostname + pageData.relativePath;
        if (canonicalUrl.endsWith("/index.html"))
            canonicalUrl = canonicalUrl.slice(0, -"index.html".length);
        if (canonicalUrl.endsWith("/index.md"))
            canonicalUrl = canonicalUrl.slice(0, -"index.md".length);
        else if (canonicalUrl.endsWith(".html"))
            canonicalUrl = canonicalUrl.slice(0, -".html".length);
        else if (canonicalUrl.endsWith(".md"))
            canonicalUrl = canonicalUrl.slice(0, -".md".length);

        pageData.frontmatter.head ??= [];
        pageData.frontmatter.head.push([
            "link",
            {rel: "canonical", href: canonicalUrl}
        ]);
    },
    vite: {
        plugins: [
            GitChangelog({
                repoURL: () => "https://github.com/withcatai/node-llama-cpp",
                cwd: path.join(__dirname, "..", "docs")
            }),
            GitChangelogMarkdownSection({
                exclude: (id) => (
                    id.includes(path.sep + "api" + path.sep) ||
                    id.includes(path.sep + "cli" + path.sep) ||
                    id.includes(path.sep + "blog" + path.sep)
                ),
                sections: {
                    disableContributors: true
                }
            }),
            BlogPageInfoPlugin({
                include: (id) => id.includes(path.sep + "blog" + path.sep) && !id.endsWith(path.sep + "blog" + path.sep + "index.md")
            })
        ]
    },
    markdown: {
        codeTransformers: [
            transformerTwoslash({
                explicitTrigger: false,
                filter(lang, code, options) {
                    return options.lang?.toLowerCase() === "typescript";
                },
                twoslashOptions: {
                    compilerOptions: {
                        ...(await fs.readJSON(path.join(__dirname, "..", "tsconfig.json"))).compilerOptions,
                        moduleResolution: undefined,
                        paths: {
                            "node-llama-cpp": [
                                path.resolve(__dirname, "..", "dist", "index.d.ts"),
                                path.resolve(__dirname, "..", "src", "index.ts")
                            ],
                            "node-llama-cpp/commands": [
                                path.resolve(__dirname, "..", "dist", "commands.d.ts"),
                                path.resolve(__dirname, "..", "src", "commands.ts")
                            ]
                        },
                        typeRoots: [
                            path.resolve(__dirname, "..", "node_modules"),
                            path.resolve(__dirname, "..", "node_modules", "@types")
                        ],
                        module: ts.ModuleKind.ES2022,
                        target: ts.ScriptTarget.ES2022,
                        moduleDetection: ts.ModuleDetectionKind.Force
                    },
                    tsModule: ts
                }
            }) as ShikiTransformer
        ]
    },
    themeConfig: {
        editLink: {
            pattern: "https://github.com/withcatai/node-llama-cpp/edit/master/docs/:path"
        },
        nav: [
            {text: "Guide", link: "/guide/", activeMatch: "/guide/"},
            {text: "CLI", link: "/cli/", activeMatch: "/cli/"},
            {text: "API Reference", link: "/api/functions/getLlama", activeMatch: "/api/"},
            {text: "Blog", link: "/blog/", activeMatch: "/blog/"},
            {
                text: packageVersion,
                items: [{
                    text: "Changelog",
                    link: "https://github.com/withcatai/node-llama-cpp/releases"
                }, {
                    text: "Roadmap",
                    link: "https://github.com/orgs/withcatai/projects/1"
                }, {
                    text: "npm",
                    link: "https://www.npmjs.com/package/node-llama-cpp"
                }, {
                    text: "GitHub Discussions",
                    link: "https://github.com/withcatai/node-llama-cpp/discussions"
                }, {
                    text: "Contribute",
                    link: "/guide/contributing"
                },
                ...(
                    packageJson?.funding?.url == null
                        ? []
                        : [{
                            text: "Sponsor",
                            link: packageJson?.funding?.url
                        }]
                )]
            }
        ],
        search: {
            provider: "local",
            options: {
                detailedView: true
            }
        },
        sidebar: {
            "/api/": orderApiReferenceSidebar(getApiReferenceSidebar()),

            "/guide/": [{
                text: "Guide",
                base: "/guide",
                items: [
                    {text: "Getting Started", link: "/"},
                    {text: "Chat Session", link: "/chat-session"},
                    {text: "Chat Wrapper", link: "/chat-wrapper"},
                    {text: "Grammar", link: "/grammar"},
                    {text: "Function Calling", link: "/function-calling"},
                    {text: "Embedding", link: "/embedding"},
                    {text: "Text Completion", link: "/text-completion"},
                    {text: "Choosing a Model", link: "/choosing-a-model"},
                ]
            }, {
                text: "Advanced",
                base: "/guide",
                items: [
                    {text: "Building From Source", link: "/building-from-source"},
                    {text: "Metal Support", link: "/Metal"},
                    {text: "CUDA Support", link: "/CUDA"},
                    {text: "Vulkan Support", link: "/Vulkan"},
                    {text: "Electron Support", link: "/electron"},
                    {text: "Using in Docker", link: "/docker"},
                    {text: "Using Tokens", link: "/tokens"},
                    {text: "LlamaText", link: "/llama-text"},
                    {text: "External Chat State", link: "/external-chat-state"},
                    {text: "Token Bias", link: "/token-bias"},
                    {text: "Objects Lifecycle", link: "/objects-lifecycle"},
                    {text: "Batching", link: "/batching"},
                    {text: "Awesome List", link: "/awesome"},
                    {text: "Troubleshooting", link: "/troubleshooting"},
                    {text: "Tips and Tricks", link: "/tips-and-tricks"}
                ]
            }, {
                text: "Contributing",
                base: "/guide",
                items: [
                    {text: "Setting Up a Dev Environment", link: "/development"},
                    {text: "Pull Request Guidelines", link: "/contributing"}
                ]
            }],

            "/cli/": [{
                text: "CLI",
                base: "/cli",
                link: "/",
                items: [
                    {text: "Init", link: "/init"},
                    {text: "Chat", link: "/chat"},
                    {text: "Pull", link: "/pull"},
                    {
                        text: "Source",
                        link: "/source",
                        collapsed: true,
                        items: [
                            {text: "Download", link: "/source/download"},
                            {text: "Build", link: "/source/build"},
                            {text: "Clear", link: "/source/clear"}
                        ]
                    },
                    {text: "Complete", link: "/complete"},
                    {text: "Infill", link: "/infill"},
                    {
                        text: "Inspect",
                        link: "/inspect",
                        collapsed: true,
                        items: [
                            {text: "GPU", link: "/inspect/gpu"},
                            {text: "GGUF", link: "/inspect/gguf"},
                            {text: "Measure", link: "/inspect/measure"},
                            {text: "Estimate", link: "/inspect/estimate"}
                        ]
                    }
                ]
            }]
        },
        socialLinks: [
            {icon: "npm", link: "https://www.npmjs.com/package/node-llama-cpp"},
            {icon: "github", link: "https://github.com/withcatai/node-llama-cpp"}
        ]
    },
    async buildEnd(siteConfig) {
        const blogPosts = await createContentLoader("blog/*.md", {
            excerpt: true,
            render: true
        })
            .load();

        async function addOgImages() {
            const svgImages: Record<string, Buffer> = {
                "https://raw.githubusercontent.com/withcatai/node-llama-cpp/master/assets/logo.roundEdges.png":
                    await fs.readFile(path.join(__dirname, "..", "assets", "logo.roundEdges.png"))
            };

            const interFontFilesDirectoryPath = path.join(require.resolve("@fontsource/inter"), "..", "files");
            const interFontFilesToLoad = [
                "inter-latin-400-normal.woff2",
                "inter-latin-500-normal.woff2",
                "inter-latin-600-normal.woff2",
                "inter-latin-700-normal.woff2",
                "inter-latin-ext-400-normal.woff2",
                "inter-latin-ext-500-normal.woff2",
                "inter-latin-ext-600-normal.woff2",
                "inter-latin-ext-700-normal.woff2",
            ];

            await buildEndGenerateOpenGraphImages({
                baseUrl: resolveHref(""),
                category: {
                    byCustomGetter(page) {
                        if (page.link?.startsWith("/api/")) return "API";
                        if (page.link?.startsWith("/guide/")) return "Guide";
                        if (page.link?.startsWith("/cli/")) return "CLI";
                        if (page.link === "/blog/") return " ";
                        if (page.link?.startsWith("/blog/")) return "Blog";

                        return " ";
                    }
                },
                async svgImageUrlResolver(imageUrl: string) {
                    if (svgImages[imageUrl] != null)
                        return svgImages[imageUrl];

                    throw new Error(`Unknown SVG image URL: ${imageUrl}`);
                },
                svgFontBuffers: await Promise.all(
                    interFontFilesToLoad.map((fontFilename) => (
                        fs.readFile(path.join(interFontFilesDirectoryPath, fontFilename))
                    ))
                ),
                templateSvgPath: path.join(__dirname, "assets", "ogTemplate.svg"),
                resultImageWidth: 1200,
                maxCharactersPerLine: 20
            })({
                ...siteConfig,
                site: {
                    ...siteConfig.site,
                    themeConfig: {
                        ...siteConfig.site.themeConfig,
                        sidebar: {
                            ...siteConfig.site.themeConfig.sidebar,
                            "/_blog/": {
                                text: "Blog",
                                link: "/blog/",
                                items: blogPosts.map((post) => ({
                                    text: post.frontmatter.title,
                                    link: post.url
                                }))
                            }
                        }
                    }
                }
            });
        }

        async function addBlogRssFeed() {
            const feedFilePath = path.join(siteConfig.outDir, "blog", "feed.atom");

            const feed = new Feed({
                title: "node-llama-cpp",
                description: "Run AI models locally on your machine",
                id: hostname,
                link: hostname,
                language: "en",
                image: socialPosterLink,
                favicon: resolveHref("/favicon.ico"),
                copyright: "node-llama-cpp",
                generator: "node-llama-cpp",
                feed: resolveHref("/blog/feed.atom"),
                author: {
                    name: typeof packageJson.author === "string"
                        ? packageJson.author
                        : (packageJson.author as undefined | { name?: string })?.name
                },
                hub: "https://pubsubhubbub.appspot.com/"
            });

            blogPosts.sort((a, b) => {
                const aDate = a.frontmatter.date
                    ? new Date(a.frontmatter.date)
                    : null;
                const bDate = b.frontmatter.date
                    ? new Date(b.frontmatter.date)
                    : null;

                if (aDate == null)
                    return -1;
                if (bDate == null)
                    return 1;

                return bDate.getTime() - aDate.getTime();
            });

            for (const {url, excerpt, frontmatter, html} of blogPosts) {
                const ogImageElement = findElementInHtml(html, (element) => element.tagName === "meta" && element.properties?.name === "og:imag");
                const date = new Date(frontmatter.date);
                if (Number.isNaN(date.getTime()))
                    throw new Error(`Invalid date for blog post: ${url}`);
                else if (frontmatter.title == null || frontmatter.title === "")
                    throw new Error(`Invalid title for blog post: ${url}`);

                feed.addItem({
                    title: frontmatter.title,
                    id: resolveHref(url),
                    link: resolveHref(url),
                    description: excerpt || frontmatter.description || undefined,
                    content: html,
                    author: [{
                        name: frontmatter.author?.name,
                        link: frontmatter.author?.link != null
                            ? frontmatter.author?.link
                            : frontmatter.author?.github != null
                                ? `https://github.com/${frontmatter.author.github}`
                                : undefined,
                        email: frontmatter.author?.github != null
                            ? (
                                frontmatter.author?.github +
                                "@users.noreply.github.com" + (
                                    frontmatter.author?.name != null
                                        ? ` (${frontmatter.author.name})`
                                        : ""
                                )
                            )
                            : undefined
                    }],
                    published: date,
                    date: date,
                    image: ogImageElement?.properties?.content as string | undefined,
                    category: typeof frontmatter.category === "string"
                        ? [{term: frontmatter.category}]
                        : frontmatter.category instanceof Array
                            ? frontmatter.category.map((category: string) => ({term: category}))
                            : frontmatter.categories instanceof Array
                                ? frontmatter.categories.map((category: string) => ({term: category}))
                                : undefined
                });
            }

            await fs.writeFile(feedFilePath, feed.atom1());
        }

        await addOgImages();

        const indexPageIndex = blogPosts.findIndex((post) => post.url === "/blog/");
        if (indexPageIndex < 0)
            throw new Error("Blog index page not found");

        blogPosts.splice(indexPageIndex, 1);

        await addBlogRssFeed();
    }
});

function findElementInHtml(html: string | undefined, matcher: (element: HastElement) => boolean) {
    function isElement(node: UnistNode): node is HastElement {
        return node.type === "element";
    }

    function isParent(node: UnistNode): node is Parent {
        return node.type === "element" || node.type === "root";
    }

    if (html == null)
        return undefined;

    const parsedHtml = rehype()
        .parse(html);

    const queue: Parent[] = [parsedHtml];
    while (queue.length > 0) {
        const item = queue.shift();
        if (item == null)
            continue;

        if (isElement(item) && matcher(item))
            return item;

        if (item.children == null)
            continue;

        for (let i = 0; i < item.children.length; i++) {
            const child = item.children[i]!;

            if (isParent(child))
                queue.push(child);
        }
    }

    return undefined;
}

function getApiReferenceSidebar(): typeof typedocSidebar {
    return structuredClone(typedocSidebar)
        .map((item) => {
            switch (item.text) {
                case "README":
                case "API":
                    return null;

                case "Classes":
                case "Type Aliases":
                case "Functions":
                    if (item.text === "Type Aliases")
                        item.text = "Types";

                    if (item.collapsed)
                        item.collapsed = false;

                    if (item.items instanceof Array)
                        item.items = item.items.map((subItem) => {
                            if ((subItem as { collapsed?: boolean }).collapsed)
                                // @ts-ignore
                                delete subItem.collapsed;

                            return subItem;
                        });

                    return item;

                case "Enumerations":
                    item.text = "Enums";

                    if (item.collapsed)
                        item.collapsed = false;
                    return item;

                case "Variables":
                    if (item.collapsed)
                        item.collapsed = false;

                    return item;
            }

            return item;
        })
        .filter((item) => item != null) as typeof typedocSidebar;
}

function orderApiReferenceSidebar(sidebar: typeof typedocSidebar): typeof typedocSidebar {
    applyOverrides(sidebar);
    orderClasses(sidebar);
    orderTypes(sidebar);
    orderFunctions(sidebar);

    sortItemsInOrder(sidebar, categoryOrder);

    return sidebar;
}

function applyOverrides(sidebar: typeof typedocSidebar) {
    const functions = sidebar.find((item) => item.text === "Functions");

    const llamaTextFunction = functions?.items?.find((item) => item.text === "LlamaText");
    if (llamaTextFunction != null) {
        delete (llamaTextFunction as { link?: string }).link;
    }

    const classes = sidebar.find((item) => item.text === "Classes");
    if (classes != null && classes.items instanceof Array && !classes.items.some((item) => item.text === "LlamaText")) {
        classes.items.push({
            text: "LlamaText",
            link: "/api/classes/LlamaText.md"
        });
    }
}

function orderClasses(sidebar: typeof typedocSidebar) {
    const baseChatWrapper = "ChatWrapper";
    const chatWrapperItems: DefaultTheme.SidebarItem[] = [];

    const classes = sidebar.find((item) => item.text === "Classes");

    if (classes == null || !(classes.items instanceof Array))
        return;

    const chatWrappersGroup = {
        text: "Chat wrappers",
        collapsed: false,
        items: chatWrapperItems
    };
    (classes.items as DefaultTheme.SidebarItem[]).unshift(chatWrappersGroup);

    moveItem(
        classes.items,
        (item) => item.text === baseChatWrapper,
        0
    );

    groupItems(
        classes.items,
        (item) => item === chatWrappersGroup,
        (item) => item.text !== baseChatWrapper && item.text?.endsWith(baseChatWrapper),
        {moveToEndIfGrouped: false, collapsed: false}
    );

    groupItems(
        classes.items,
        (item) => item.text === "LlamaModelTokens",
        (item) => item.text != null && ["LlamaModelInfillTokens"].includes(item.text),
        {moveToEndIfGrouped: false}
    );
    groupItems(
        classes.items,
        (item) => item.text === "LlamaModel",
        (item) => item.text != null && ["LlamaModelTokens"].includes(item.text),
        {moveToEndIfGrouped: false}
    );

    let LlamaTextGroup = classes.items.find((item) => item.text === "LlamaText") as {
        text: string,
        collapsed?: boolean,
        items?: []
    } | undefined;
    if (LlamaTextGroup == null) {
        LlamaTextGroup = {
            text: "LlamaText",
            collapsed: true,
            items: []
        };
        (classes.items as DefaultTheme.SidebarItem[]).push(LlamaTextGroup);
    }

    if (LlamaTextGroup != null) {
        LlamaTextGroup.collapsed = true;

        if (LlamaTextGroup.items == null)
            LlamaTextGroup.items = [];

        const LlamaTextGroupItemsOrder = ["SpecialTokensText", "SpecialToken"];

        groupItems(
            classes.items,
            (item) => item === LlamaTextGroup,
            (item) => item.text != null && LlamaTextGroupItemsOrder.includes(item.text),
            {moveToEndIfGrouped: false}
        );
        sortItemsInOrder(LlamaTextGroup.items, LlamaTextGroupItemsOrder);
    }

    sortItemsInOrder(chatWrapperItems, chatWrappersOrder);
}

function orderTypes(sidebar: typeof typedocSidebar) {
    const types = sidebar.find((item) => item.text === "Types");

    if (types == null || !(types.items instanceof Array))
        return;

    groupItems(
        types.items,
        (item) => item.text === "BatchingOptions",
        (item) => (
            item.text === "BatchItem" ||
            item.text === "CustomBatchingDispatchSchedule" ||
            item.text === "CustomBatchingPrioritizationStrategy" ||
            item.text === "PrioritizedBatchItem"
        ),
        {collapsed: false}
    );
    groupItems(
        types.items,
        (item) => item.text === "LlamaContextOptions",
        (item) => item.text === "BatchingOptions"
    );
    groupItems(
        types.items,
        (item) => item.text === "GbnfJsonSchema",
        (item) => item.text?.startsWith("GbnfJson")
    );

    groupItems(
        types.items,
        (item) => item.text === "LlamaChatSessionOptions",
        (item) => item.text != null && ["LlamaChatSessionContextShiftOptions"].includes(item.text)
    );

    groupItems(
        types.items,
        (item) => item.text === "LLamaChatPromptOptions",
        (item) => item.text != null && ["LlamaChatSessionRepeatPenalty", "ChatSessionModelFunctions"].includes(item.text)
    );

    groupItems(
        types.items,
        (item) => item.text === "ChatModelResponse",
        (item) => item.text === "ChatModelFunctionCall"
    );
    groupItems(
        types.items,
        (item) => item.text === "ChatHistoryItem",
        (item) => item.text != null && ["ChatSystemMessage", "ChatUserMessage", "ChatModelResponse"].includes(item.text)
    );

    groupItems(
        types.items,
        (item) => item.text === "LlamaChatResponse",
        (item) => item.text === "LlamaChatResponseFunctionCall"
    );

    groupItems(
        types.items,
        (item) => item.text === "LlamaText",
        (item) => item.text?.startsWith("LlamaText")
    );

    moveCollapseItemsToTheEnd(types.items);
}

function orderFunctions(sidebar: typeof typedocSidebar) {
    const functions = sidebar.find((item) => item.text === "Functions");

    if (functions == null || !(functions.items instanceof Array))
        return;

    groupItems(
        functions.items,
        (item) => item.text === "LlamaText",
        (item) => item.text != null && ["isLlamaText", "tokenizeText"].includes(item.text)
    );

    sortItemsInOrder(functions.items, functionsOrder);

    moveCollapseItemsToTheEnd(functions.items);
}


function groupItems(
    items: DefaultTheme.SidebarItem[] | undefined,
    findParent: (item: DefaultTheme.SidebarItem) => boolean | undefined,
    findChildren: (item: DefaultTheme.SidebarItem) => boolean | undefined,
    {collapsed = true, moveToEndIfGrouped = true}: { collapsed?: boolean, moveToEndIfGrouped?: boolean } = {}
) {
    const children: DefaultTheme.SidebarItem[] = [];

    if (items == null || !(items instanceof Array))
        return;

    const parent = items.find(findParent) as DefaultTheme.SidebarItem | null;

    if (parent == null)
        return;

    for (const item of items.slice()) {
        if (item === parent || !findChildren(item))
            continue;

        items.splice(items.indexOf(item), 1);
        children.push(item);
    }

    if (children.length > 0) {
        parent.collapsed = collapsed;
        parent.items = children;

        if (moveToEndIfGrouped) {
            items.splice(items.indexOf(parent as typeof items[number]), 1);
            items.push(parent as typeof items[number]);
        }
    }
}

function moveItem(
    items: DefaultTheme.SidebarItem[] | undefined,
    findItem: (item: DefaultTheme.SidebarItem) => boolean | undefined,
    newIndex: number
) {
    if (items == null || !(items instanceof Array))
        return;

    const item = items.find(findItem);
    if (item != null) {
        items.splice(items.indexOf(item), 1);
        items.splice(newIndex, 0, item);
    }
}

function moveCollapseItemsToTheEnd(items: DefaultTheme.SidebarItem[] | undefined) {
    if (items == null || !(items instanceof Array))
        return;

    items.sort((a, b) => {
        if (a.collapsed && !b.collapsed)
            return 1;
        if (!a.collapsed && b.collapsed)
            return -1;

        return 0;
    });
}

function sortItemsInOrder(items: DefaultTheme.SidebarItem[] | undefined, order: readonly string[]) {
    if (items == null || !(items instanceof Array))
        return;

    items.sort((a, b) => {
        const aIndex = order.indexOf(a.text as typeof order[number]);
        const bIndex = order.indexOf(b.text as typeof order[number]);

        if (aIndex < 0 && bIndex < 0)
            return 0;
        if (aIndex < 0)
            return 1;
        if (bIndex < 0)
            return -1;

        return aIndex - bIndex;
    });
}
