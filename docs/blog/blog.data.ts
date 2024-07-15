import {createContentLoader} from "vitepress";

const loader = {
    async load() {
        const blogPosts = await createContentLoader("blog/*.md", {
            excerpt: true,
            render: true
        })
            .load();

        return {
            entries: blogPosts
                .filter((post) => post.url !== "/blog/")
                .map((post) => ({
                    title: post.frontmatter.title as string | undefined,
                    date: post.frontmatter.date as string | undefined,
                    description: post.excerpt || post.frontmatter.description as string | undefined,
                    link: post.url
                }))
        } as const;
    }
} as const;

export default loader;

// purely for type checking
export const data: Awaited<ReturnType<(typeof loader)["load"]>> = undefined as any;
