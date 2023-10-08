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
        hostname: "https://withcatai.github.io/node-llama-cpp/"
    },
    head: [
        ["link", {rel: "icon", type: "image/svg+xml", href: resolveHref("/favicon.svg")}],
        ["link", {rel: "icon", type: "image/png", href: resolveHref("/favicon.png")}],
        ["meta", {name: "theme-color", content: "#cd8156"}],
        ["meta", {name: "theme-color", content: "#dd773e", media: "(prefers-color-scheme: dark)"}],
        ["meta", {name: "og:type", content: "website"}],
        ["meta", {name: "og:locale", content: "en"}],
        ["meta", {name: "og:site_name", content: "node-llama-cpp"}]
    ],
    transformPageData(pageData) {
        if (pageData.filePath.startsWith("api/") || pageData.filePath.startsWith("guide/cli/")) {
            pageData.frontmatter.editLink = false;
            pageData.frontmatter.lastUpdated = false;
        }
    },
    themeConfig: {
        editLink: {
            pattern: "https://github.com/withcatai/node-llama-cpp/edit/main/docs/:path"
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
    const baseChatPromptWrapper = "ChatPromptWrapper";
    const chatPromptWrapperItems: DefaultTheme.SidebarItem[] = [];

    const classes = sidebar.find((item) => item.text === "Classes");

    if (classes == null || !(classes.items instanceof Array))
        return sidebar;

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

    return sidebar;
}

