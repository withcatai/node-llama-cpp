import {DefaultTheme} from "vitepress";
import {getApiReferenceSidebar} from "./apiReferenceSidebar.js";
import {getBlogPosts} from "./getBlogPosts.js";

const apiReferenceSidebar = getApiReferenceSidebar();

export function getVitepressSidebar(blog?: DefaultTheme.SidebarItem[]): DefaultTheme.Sidebar {
    return {
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
                {text: "Downloading Models", link: "/downloading-models"}
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
                {text: "Chat Context Shift", link: "/chat-context-shift"},
                {text: "Batching", link: "/batching"},
                {text: "Token Prediction", link: "/token-prediction"},
                {text: "Low Level API", link: "/low-level-api"},
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

        ...(
            blog != null
                ? {
                    "/_blog/": [{
                        text: "Blog",
                        link: "/blog/",
                        items: blog
                    }]
                }
                : {}
        ),

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
        }],

        "/api/": structuredClone(apiReferenceSidebar)
    };
}

export async function getSidebarBlogPostItems(
    includeIndex: boolean = false,
    onlyItemsWithoutCoverImage: boolean = false
): Promise<DefaultTheme.SidebarItem[]> {
    const blogPosts = await getBlogPosts(includeIndex);

    return blogPosts
        .filter((post) => {
            if (!onlyItemsWithoutCoverImage)
                return true;

            const hasCoverImage = typeof post.frontmatter?.image === "string" ||
                typeof post.frontmatter?.image?.url === "string";

            return !hasCoverImage;
        })
        .map((post) => ({
            text: post.frontmatter.title,
            link: post.url
        }));
}

export async function getVitepressSidebarWithBlog(
    includeIndex: boolean = false,
    onlyItemsWithoutCoverImage: boolean = false
) {
    const blogItems = await getSidebarBlogPostItems(includeIndex, onlyItemsWithoutCoverImage);

    return getVitepressSidebar(blogItems);
}
