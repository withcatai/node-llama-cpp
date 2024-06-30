import {DefaultTheme, defineConfig} from "vitepress";
import path from "path";
import fs from "fs-extra";
import {fileURLToPath} from "url";
import {transformerTwoslash} from "@shikijs/vitepress-twoslash";
import ts from "typescript";
import typedocSidebar from "../docs/api/typedoc-sidebar.json"; // if this import fails, run `npm run docs:generateTypedoc`
import envVar from "env-var";
import process from "process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson: typeof import("../package.json") = fs.readJsonSync(path.join(__dirname, "..", "package.json"));
const env = envVar.from(process.env);

const urlBase = env.get("DOCS_URL_BASE").asString();
const packageVersion = env.get("DOCS_PACKAGE_VERSION").default(packageJson.version).asString();
const googleSiteVerificationCode = "7b4Hd_giIK0EFsin6a7PWLmM_OeaC7APLZUxVGwwI6Y";

const hostname = "https://withcatai.github.io/node-llama-cpp/";

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

export default defineConfig({
    title: "node-llama-cpp",
    description: "Run AI models locally on your machine with node.js bindings for llama.cpp",

    srcDir: "./docs",
    outDir: "./docs-site",
    cacheDir: "./.vitepress/.cache",

    cleanUrls: true,
    lastUpdated: true,

    base: urlBase,
    sitemap: {
        hostname,
        transformItems(items) {
            return items.map((item) => {
                if (item.url.includes("api/") || item.url.includes("guide/cli/")) {
                    item = {
                        ...item,
                        lastmod: undefined,
                    }
                }

                return item;
            });
        }
    },
    head: [
        ["link", {rel: "icon", type: "image/svg+xml", href: resolveHref("/favicon.svg")}],
        ["link", {rel: "icon", type: "image/png", href: resolveHref("/favicon.png")}],
        ["meta", {name: "theme-color", content: "#cd8156"}],
        ["meta", {name: "theme-color", content: "#dd773e", media: "(prefers-color-scheme: dark)"}],
        ["meta", {name: "og:type", content: "website"}],
        ["meta", {name: "og:locale", content: "en"}],
        ["meta", {name: "og:site_name", content: "node-llama-cpp"}],
        ["meta", {name: "og:title", content: "node-llama-cpp - node.js bindings for llama.cpp"}],
        ["meta", {name: "og:description", content: "Run AI models locally on your machine with node.js bindings for llama.cpp"}],
        ["meta", {name: "og:image", content: hostname + "social.poster.jpg"}],
        ["meta", {name: "og:image:width", content: "4096"}],
        ["meta", {name: "og:image:height", content: "2048"}],
        ["meta", {name: "twitter:image:src", content: hostname + "social.poster.jpg"}],
        ["meta", {name: "twitter:card", content: "summary_large_image"}],
        ["meta", {name: "twitter:title", content: "node-llama-cpp - node.js bindings for llama.cpp"}],
        ["meta", {name: "twitter:description", content: "Run AI models locally on your machine with node.js bindings for llama.cpp"}]
    ],
    transformHead({pageData, head}) {
        if (pageData.filePath === "index.md") {
            head.push(["meta", {name: "google-site-verification", content: googleSiteVerificationCode}]);
        }
    },
    transformPageData(pageData) {
        if (pageData.filePath.startsWith("api/")) {
            pageData.frontmatter.editLink = false;
            pageData.frontmatter.lastUpdated = false;
            pageData.frontmatter ||= {}
            pageData.frontmatter.outline = [2, 3];
        }

        if (pageData.filePath.startsWith("guide/cli/")) {
            pageData.frontmatter.editLink = false;
            pageData.frontmatter.lastUpdated = false;
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
        ])
    },
    markdown: {
        codeTransformers: [
            transformerTwoslash({
                // explicitTrigger: false,
                twoslashOptions: {
                    compilerOptions: {
                        ...(await fs.readJSON(path.join(__dirname, "..", "tsconfig.json"))).compilerOptions,
                        moduleResolution: undefined,
                        paths: {
                            "node-llama-cpp": [
                                path.resolve(__dirname, "..", "dist", "index.d.ts"),
                                path.resolve(__dirname, "..", "src", "index.ts")
                            ]
                        },
                        typeRoots: [
                            path.resolve(__dirname, "..", "node_modules"),
                            path.resolve(__dirname, "..", "node_modules", "@types")
                        ],
                        module: ts.ModuleKind.ES2022,
                        target: ts.ScriptTarget.ES2022
                    },
                    tsModule: ts
                }
            })
        ]
    },
    themeConfig: {
        editLink: {
            pattern: "https://github.com/withcatai/node-llama-cpp/edit/master/docs/:path"
        },
        nav: [
            {text: "Guide", link: "/guide/", activeMatch: "/guide/"},
            {text: "API Reference", link: "/api/functions/getLlama", activeMatch: "/api/"},
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
            provider: "local"
        },
        sidebar: {
            "/api/": orderApiReferenceSidebar(getApiReferenceSidebar()),

            "/guide/": [{
                text: "Guide",
                base: "/guide",
                items: [
                    {text: "Getting started", link: "/"},
                    {text: "Chat session", link: "/chat-session"},
                    {text: "Chat prompt wrapper", link: "/chat-prompt-wrapper"},
                    {text: "Using grammar", link: "/grammar"}
                ]
            }, {
                text: "Advanced",
                base: "/guide",
                items: [
                    {text: "Building from source", link: "/building-from-source"},
                    {text: "Metal support", link: "/Metal"},
                    {text: "CUDA support", link: "/CUDA"},
                    {text: "Vulkan support", link: "/vulkan"},
                    {text: "Troubleshooting", link: "/troubleshooting"}
                ]
            }, {
                text: "Contributing",
                base: "/guide",
                items: [
                    {text: "Setting up a dev environment", link: "/development"},
                    {text: "Pull request guidelines", link: "/contributing"}
                ]
            }, {
                text: "CLI",
                base: "/guide/cli",
                collapsed: true,
                link: "/",
                items: [
                    {text: "Pull", link: "/pull"},
                    {text: "Chat", link: "/chat"},
                    {text: "Init", link: "/init"},
                    {text: "Download", link: "/download"},
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
                        ]
                    },
                    {text: "Build", link: "/build"},
                    {text: "Clear", link: "/clear"}
                ]
            }]
        },
        socialLinks: [
            {icon: "npm", link: "https://www.npmjs.com/package/node-llama-cpp"},
            {icon: "github", link: "https://github.com/withcatai/node-llama-cpp"}
        ]
    }
});

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
                            if ((subItem as {collapsed?: boolean}).collapsed)
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
        delete (llamaTextFunction as {link?: string}).link;
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
    )

    groupItems(
        classes.items,
        (item) => item.text === "LlamaModelTokens",
        (item) => item.text != null && ["LlamaModelInfillTokens"].includes(item.text),
        {moveToEndIfGrouped: false}
    )
    groupItems(
        classes.items,
        (item) => item.text === "LlamaModel",
        (item) => item.text != null && ["LlamaModelTokens"].includes(item.text),
        {moveToEndIfGrouped: false}
    )

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
        )
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
    {collapsed = true, moveToEndIfGrouped = true}: {collapsed?: boolean, moveToEndIfGrouped?: boolean} = {}
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
