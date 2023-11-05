import {defineConfig, DefaultTheme} from "vitepress";
import path from "path";
import fs from "fs-extra";
import {fileURLToPath} from "url";
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
    "GeneralChatPromptWrapper",
    "LlamaChatPromptWrapper",
    "ChatMLChatPromptWrapper",
    "FalconChatPromptWrapper"
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
    },
    themeConfig: {
        editLink: {
            pattern: "https://github.com/withcatai/node-llama-cpp/edit/master/docs/:path"
        },
        nav: [
            {text: "Guide", link: "/guide/", activeMatch: "/guide/"},
            {text: "API Reference", link: "/api/classes/LlamaModel", activeMatch: "/api/"},
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
                    text: "Contributing",
                    link: "/guide/contributing"
                }]
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
                    {text: "CUDA support", link: "/CUDA"}
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
                    {text: "Chat", link: "/chat"},
                    {text: "Download", link: "/download"},
                    {text: "Build", link: "/build"},
                    {text: "Clear", link: "/clear"}
                ]
            }]
        },
        socialLinks: [
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
                            if (subItem.collapsed)
                                // @ts-ignore
                                delete subItem.collapsed;

                            return subItem;
                        })
                    return item;
            }

            return item;
        })
        .filter((item) => item != null) as typeof typedocSidebar;
}

function orderApiReferenceSidebar(sidebar: typeof typedocSidebar): typeof typedocSidebar {
    orderClasses(sidebar);
    orderTypes(sidebar);

    return sidebar;
}

function orderClasses(sidebar: typeof typedocSidebar) {
    const baseChatPromptWrapper = "ChatPromptWrapper";
    const chatPromptWrapperItems: DefaultTheme.SidebarItem[] = [];

    const classes = sidebar.find((item) => item.text === "Classes");

    if (classes == null || !(classes.items instanceof Array))
        return;

    (classes.items as DefaultTheme.SidebarItem[]).unshift({
        text: "Chat wrappers",
        collapsed: false,
        items: chatPromptWrapperItems
    });

    const chatPromptWrapper = classes.items.find((item) => item.text === baseChatPromptWrapper);
    if (chatPromptWrapper != null) {
        classes.items.splice(classes.items.indexOf(chatPromptWrapper), 1);
        classes.items.unshift(chatPromptWrapper);
    }

    for (const item of classes.items.slice()) {
        if (item.text === baseChatPromptWrapper || !item.text.endsWith(baseChatPromptWrapper))
            continue;

        classes.items.splice(classes.items.indexOf(item), 1);
        chatPromptWrapperItems.push(item);
    }

    chatPromptWrapperItems.sort((a, b) => {
        const aIndex = chatWrappersOrder.indexOf(a.text as typeof chatWrappersOrder[number]);
        const bIndex = chatWrappersOrder.indexOf(b.text as typeof chatWrappersOrder[number]);

        if (aIndex < 0 && bIndex < 0)
            return 0;
        if (aIndex < 0)
            return 1;
        if (bIndex < 0)
            return -1;

        return aIndex - bIndex;
    });
}

function orderTypes(sidebar: typeof typedocSidebar) {
    const types = sidebar.find((item) => item.text === "Types");

    if (types == null || !(types.items instanceof Array))
        return;

    function groupGbnfJsonSchema() {
        if (types == null || !(types.items instanceof Array))
            return;

        const gbnfJsonSchemaItemTitle = "GbnfJsonSchema";
        const gbnfItemsPrefix = "GbnfJson";
        const gbnfJsonSchemaItems: DefaultTheme.SidebarItem[] = [];

        const gbnfJsonSchemaItem = types.items
            .find((item) => item.text === gbnfJsonSchemaItemTitle) as DefaultTheme.SidebarItem | null;

        if (gbnfJsonSchemaItem == null)
            return;

        gbnfJsonSchemaItem.collapsed = true;
        gbnfJsonSchemaItem.items = gbnfJsonSchemaItems;

        for (const item of types.items.slice()) {
            if (item.text === gbnfJsonSchemaItemTitle || !item.text.startsWith(gbnfItemsPrefix))
                continue;

            types.items.splice(types.items.indexOf(item), 1);
            gbnfJsonSchemaItems.push(item);
        }
    }

    function moveCollapseItemsToTheEnd() {
        if (types == null || !(types.items instanceof Array))
            return;

        types.items.sort((a, b) => {
            if (a.collapsed && !b.collapsed)
                return 1;
            if (!a.collapsed && b.collapsed)
                return -1;

            return 0;
        });
    }

    groupGbnfJsonSchema();
    moveCollapseItemsToTheEnd();
}
