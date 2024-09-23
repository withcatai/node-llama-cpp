import {createContentLoader} from "vitepress";
import {ensureLocalImage} from "../../.vitepress/utils/ensureLocalImage.js";
import {htmlEscape} from "../../.vitepress/utils/htmlEscape.js";

const loader = {
    async load() {
        const blogPosts = await createContentLoader("blog/*.md", {
            excerpt: true,
            render: true
        })
            .load();

        return {
            entries: await Promise.all(
                blogPosts
                    .filter((post) => post.url !== "/blog/")
                    .map(async (post) => {
                        return {
                            title: post.frontmatter.title as string | undefined,
                            date: post.frontmatter.date as string | undefined,
                            description: post.excerpt || (
                                (post.frontmatter.description as string | undefined) != null
                                    ? htmlEscape(post.frontmatter.description as string)
                                    : undefined
                            ),
                            link: post.url,
                            image: await getImage(
                                typeof post.frontmatter.image === "string"
                                    ? post.frontmatter.image
                                    : post.frontmatter.image?.url,
                                post.url.slice(1).split("/"),
                                post.frontmatter.image
                            )
                        };
                    })
            )
        } as const;
    }
} as const;

export default loader;

// purely for type checking
export const data: Awaited<ReturnType<(typeof loader)["load"]>> = undefined as any;

async function getImage(
    imageUrl: string | undefined,
    baseDestLocation: string[],
    imageFrontmatter: any | undefined
): Promise<BlogImage> {
    if (imageUrl == null)
        return {};

    const {
        urlPath, previewUrlPath, width, height
    } = await ensureLocalImage(imageUrl, "cover", {
        baseDestLocation
    });

    return {
        url: urlPath.absolute,
        lowResUrl: previewUrlPath.absolute,
        width: width ?? imageFrontmatter?.width as number | undefined,
        height: height ?? imageFrontmatter?.height as number | undefined,
        alt: imageFrontmatter?.alt as string | undefined
    };
}

type BlogImage = {
    url?: string,
    lowResUrl?: string,
    width?: number,
    height?: number,
    alt?: string
};
