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
                    link: post.url,
                    image: {
                        url: typeof post.frontmatter.image === "string"
                            ? post.frontmatter.image
                            : post.frontmatter.image?.url as string | undefined,
                        lowResUrl: post.frontmatter.image?.lowResUrl as string | undefined,
                        width: post.frontmatter.image?.width as number | undefined,
                        height: post.frontmatter.image?.height as number | undefined,
                        alt: post.frontmatter.image?.alt as string | undefined
                    }
                }))
        } as const;
    }
} as const;

export default loader;

// purely for type checking
export const data: Awaited<ReturnType<(typeof loader)["load"]>> = undefined as any;
