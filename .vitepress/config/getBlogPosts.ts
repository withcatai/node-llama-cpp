import {ContentData, createContentLoader} from "vitepress";

let blogPosts: ContentData[] | undefined = undefined;
export async function getBlogPosts(includeIndex: boolean = false) {
    if (includeIndex)
        return await _getBlogPosts();

    const blogPosts = (await _getBlogPosts()).slice();

    const indexPageIndex = blogPosts.findIndex((post) => post.url === "/blog/");
    if (indexPageIndex < 0)
        throw new Error("Blog index page not found");

    blogPosts.splice(indexPageIndex, 1);

    return blogPosts;
}

async function _getBlogPosts() {
    if (blogPosts != null)
        return blogPosts;

    blogPosts = await createContentLoader("blog/*.md", {
        excerpt: true,
        render: true
    })
        .load();

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

    return blogPosts;
}
