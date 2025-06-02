import path from "path";
import {createRequire} from "node:module";
import process from "process";
import {fileURLToPath} from "url";
import fs from "fs-extra";
import {createContentLoader, defineConfig, HeadConfig, Plugin as VitepressPlugin} from "vitepress";
import {transformerTwoslash} from "@shikijs/vitepress-twoslash";
import ts from "typescript";
import envVar from "env-var";
import {Feed} from "feed";
import {rehype} from "rehype";
import sharp from "sharp";
import {GitChangelog, GitChangelogMarkdownSection} from "@nolebase/vitepress-plugin-git-changelog/vite";
import {buildEndGenerateOpenGraphImages} from "@nolebase/vitepress-plugin-og-image/vitepress";
import llmstxt from "vitepress-plugin-llms";
import {Resvg, initWasm as initResvgWasm, type ResvgRenderOptions} from "@resvg/resvg-wasm";
import {BlogPageInfoPlugin} from "./config/BlogPageInfoPlugin.js";
import {ensureLocalImage} from "./utils/ensureLocalImage.js";
import {getExcerptFromMarkdownFile} from "./utils/getExcerptFromMarkdownFile.js";
import {getVitepressSidebar, getVitepressSidebarWithBlog} from "./config/sidebar.js";
import {getBlogPosts} from "./config/getBlogPosts.js";
import type {Element as HastElement, Parent} from "hast";

import type {Node as UnistNode} from "unist";
import type {ShikiTransformer} from "shiki";


const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson: typeof import("../package.json") = fs.readJsonSync(path.join(__dirname, "..", "package.json"));
const env = envVar.from(process.env);

const docsDir = path.join(__dirname, "..", "docs");
const urlBase = env.get("DOCS_URL_BASE")
    .asString();
const packageVersion = env.get("DOCS_PACKAGE_VERSION")
    .default(packageJson.version)
    .asString();

const hostname = "https://node-llama-cpp.withcat.ai/";
const buildDate = new Date();

const socialPosterLink = hostname + "social.poster.jpg";
const defaultPageTitle = "node-llama-cpp - node.js bindings for llama.cpp";
const defaultPageDescription = "Run AI models locally on your machine with node.js bindings for llama.cpp";

function resolveHref(href: string, withDomain: boolean = false): string {
    if (withDomain) {
        const resolvedHref = resolveHref(href, false);

        if (hostname.endsWith("/") && resolvedHref.startsWith("/"))
            return hostname + resolvedHref.slice("/".length);
        else if (!hostname.endsWith("/") && !resolvedHref.startsWith("/"))
            return hostname + "/" + resolvedHref;

        return hostname + resolvedHref;
    }

    if (urlBase == null)
        return href;

    if (urlBase.endsWith("/") && href.startsWith("/"))
        return urlBase.slice(0, -1) + href;

    if (href.startsWith("http://") || href.startsWith("https://"))
        return href;

    return urlBase + href;
}

const defaultImageMetaTags: HeadConfig[] = [
    ["meta", {property: "og:image", content: socialPosterLink}],
    ["meta", {property: "og:image:width", content: "4096"}],
    ["meta", {property: "og:image:height", content: "2048"}],
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
        async transformItems(items) {
            function priorityMatch(a: {url: string}, b: {url: string}, matchers: ((url: string) => boolean)[]): number {
                for (const matcher of matchers) {
                    const aMatch = matcher(a.url);
                    const bMatch = matcher(b.url);

                    if (aMatch && !bMatch)
                        return -1;
                    else if (!aMatch && bMatch)
                        return 1;
                }

                return 0;
            }

            const blogPosts = await createContentLoader("blog/*.md", {
                excerpt: true,
                render: true
            })
                .load();
            const blogPostMap = new Map<string, typeof blogPosts[number]>();
            for (const blogPost of blogPosts) {
                let url = blogPost.url;
                if (url.startsWith("/"))
                    url = url.slice("/".length);

                blogPostMap.set(url, blogPost);
            }

            return items
                .map((item) => {
                    if (item.url === "") {
                        item.lastmod = undefined;
                        item.changefreq = "daily";
                        item.priority = 1;
                    } else if (item.url === "blog/") {
                        item.lastmod = new Date(buildDate);
                        item.changefreq = "daily";
                        item.priority = 0.9;
                    } else if (item.url === "guide/") {
                        item.changefreq = "daily";
                        item.priority = 0.7;
                    } else if (item.url.startsWith("api/") || item.url.startsWith("cli/")) {
                        item = {
                            ...item,
                            lastmod: new Date(buildDate),
                            changefreq: "weekly",
                            priority: item.url.startsWith("cli/")
                                ? 0.6
                                : 0.5
                        };
                    } else if (item.lastmod == null && item.url.startsWith("blog/")) {
                        const postDate = blogPostMap.get(item.url)?.frontmatter.date;
                        if (postDate != null) {
                            const parsedDate = new Date(postDate);
                            if (Number.isFinite(parsedDate.getTime()))
                                item.lastmod = parsedDate;
                        }
                    } else if (item.lastmod == null) {
                        item.lastmod = new Date(buildDate);
                        item.changefreq = "weekly";
                        item.priority = 0.4;
                    }

                    if (item.url !== "blog/" && item.url.startsWith("blog/")) {
                        item.priority = 0.8;
                        item.changefreq = "hourly";
                    }

                    return item;
                })
                .sort((a, b) => {
                    return priorityMatch(a, b, [
                        (url) => url === "",
                        (url) => url === "blog/",
                        (url) => url.startsWith("blog/"),
                        (url) => url === "guide/",
                        (url) => url.startsWith("guide/"),
                        (url) => url === "cli/",
                        (url) => url.startsWith("cli/"),
                        (url) => url === "api/",
                        (url) => url.startsWith("api/functions/"),
                        (url) => url.startsWith("api/classes/"),
                        (url) => url.startsWith("api/type-aliases/"),
                        (url) => url.startsWith("api/enumerations/"),
                        (url) => url.startsWith("api/variables/"),
                        (url) => url.startsWith("api/")
                    ]);
                });
        }
    },
    head: [
        ["link", {rel: "icon", type: "image/svg+xml", href: resolveHref("/favicon.svg")}],
        ["link", {rel: "icon", type: "image/png", href: resolveHref("/favicon.png")}],
        ["link", {rel: "alternate", title: "Blog", type: "application/atom+xml", href: resolveHref("/blog/feed.atom", true)}],
        ["meta", {name: "theme-color", content: "#cd8156"}],
        ["meta", {name: "theme-color", content: "#dd773e", media: "(prefers-color-scheme: dark)"}],
        ["meta", {property: "og:type", content: "website"}],
        ["meta", {property: "og:locale", content: "en"}],
        ["meta", {property: "og:site_name", content: "node-llama-cpp"}],
        ["script", {async: "", src: "https://www.googletagmanager.com/gtag/js?id=G-Q2SWE5Z1ST"}],
        [
            "script",
            {},
            "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());" +
            "gtag('config','G-Q2SWE5Z1ST');"
        ],
        ["style", {}]
    ],
    async transformHead({pageData, head}) {
        let description = pageData.description;
        if (pageData.filePath === "index.md") {
            head.push(...defaultImageMetaTags);
            description ||= defaultPageDescription;
        } else if (pageData.relativePath === "404.md")
            head.push(...defaultImageMetaTags);

        const title = [
            pageData.title,
            pageData.titleTemplate
        ]
            .filter(Boolean)
            .join(" - ") || defaultPageTitle;

        if (pageData.filePath.startsWith("blog/") && pageData.frontmatter.image != null) {
            let imageDir = pageData.filePath;
            if (imageDir.toLowerCase().endsWith(".md"))
                imageDir = imageDir.slice(0, -".md".length);

            if (typeof pageData.frontmatter.image === "string") {
                const coverImage = await ensureLocalImage(pageData.frontmatter.image, "cover", {
                    baseDestLocation: imageDir.split("/")
                });
                const imageUrl = resolveHref(coverImage.urlPath.absolute, true);
                head.push(["meta", {property: "og:image", content: imageUrl}]);
                head.push(["meta", {property: "twitter:image", content: imageUrl}]);
                head.push(["meta", {property: "twitter:card", content: "summary_large_image"}]);
            } else if (typeof pageData.frontmatter.image === "object") {
                const coverImage = typeof pageData.frontmatter.image.url === "string"
                    ? await ensureLocalImage(pageData.frontmatter.image.url, "cover", {
                        baseDestLocation: imageDir.split("/")
                    })
                    : undefined;

                if (typeof pageData.frontmatter.image.url === "string") {
                    const imageUrl = resolveHref(coverImage?.urlPath.absolute ?? pageData.frontmatter.image.url, true);
                    head.push(["meta", {
                        property: "og:image",
                        content: imageUrl
                    }]);
                    head.push(["meta", {
                        property: "twitter:image",
                        content: imageUrl
                    }]);
                    head.push(["meta", {
                        property: "twitter:card",
                        content: "summary_large_image"
                    }]);
                }

                if (pageData.frontmatter.image.width != null)
                    head.push(["meta", {
                        property: "og:image:width",
                        content: String(coverImage?.width ?? pageData.frontmatter.image.width)
                    }]);

                if (pageData.frontmatter.image.height != null)
                    head.push(["meta", {
                        property: "og:image:height",
                        content: String(coverImage?.height ?? pageData.frontmatter.image.height)
                    }]);
            }
        }

        const markdownFilePath = path.join(docsDir, pageData.filePath);
        if ((description == null || description === "") && await fs.pathExists(markdownFilePath) && !pageData.filePath.startsWith("api/")) {
            const excerpt = await getExcerptFromMarkdownFile(await fs.readFile(markdownFilePath, "utf8"));
            if (excerpt != null && excerpt !== "")
                description = excerpt.replaceAll('"', "'").replaceAll("\n", " ");
        }

        pageData.description = description;

        if (description != null && description !== "" &&
            (pageData.frontmatter.description == null || pageData.frontmatter.description === "")
        ) {
            pageData.frontmatter.description = description;
            for (let i = 0; i < head.length; i++) {
                const header = head[i]!;
                if (header[0] === "meta" && header[1]?.name === "description") {
                    head[i] = ["meta", {name: "description", content: description}];
                    break;
                }
            }
        }

        head.push(["meta", {property: "og:title", content: title}]);
        if (description != null && description !== "")
            head.push(["meta", {property: "og:description", content: description}]);

        head.push(["meta", {name: "twitter:title", content: title}]);
        if (description != null && description !== "")
            head.push(["meta", {name: "twitter:description", content: description}]);
    },
    transformPageData(pageData) {
        if (pageData.filePath.startsWith("api/")) {
            pageData.frontmatter ||= {};
            pageData.frontmatter.editLink = false;
            pageData.frontmatter.lastUpdated = false;
            pageData.lastUpdated = undefined;
            pageData.frontmatter.outline = [2, 3];
            pageData.frontmatter.nolebase = {
                gitChangelog: false
            };
        }

        if (pageData.filePath.startsWith("cli/")) {
            pageData.frontmatter ||= {};
            pageData.frontmatter.editLink = false;
            pageData.frontmatter.lastUpdated = false;
            pageData.lastUpdated = undefined;
            pageData.frontmatter.nolebase = {
                gitChangelog: false
            };
        }

        if (pageData.filePath.startsWith("blog/")) {
            pageData.frontmatter ||= {};
            pageData.frontmatter.editLink = false;
            pageData.frontmatter.lastUpdated = false;
            pageData.frontmatter.aside = false;
            pageData.frontmatter.outline = false;
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
            {rel: "canonical", href: canonicalUrl},
            {rel: "giscus:backlink", href: canonicalUrl}
        ]);
    },
    vite: {
        plugins: [
            GitChangelog({
                repoURL: () => "https://github.com/withcatai/node-llama-cpp",
                cwd: docsDir
            }) as VitepressPlugin,
            GitChangelogMarkdownSection({
                exclude: (id) => (
                    id.includes(path.sep + "api" + path.sep) ||
                    id.includes(path.sep + "cli" + path.sep) ||
                    id.includes(path.sep + "blog" + path.sep)
                ),
                sections: {
                    disableContributors: true
                }
            }) as VitepressPlugin,
            BlogPageInfoPlugin({
                include: (id) => id.includes(path.sep + "blog" + path.sep) && !id.endsWith(path.sep + "blog" + path.sep + "index.md")
            }),
            llmstxt({
                ignoreFiles: ["index.md"],
                domain: resolveHref("/test").slice(0, -"/test".length) || undefined,
                excludeBlog: false,
                sidebar: () => getVitepressSidebarWithBlog(true, false)
            })
        ],
        build: {
            rollupOptions: {
                external: ["/logo.preview.avif"]
            }
        }
    },
    markdown: {
        languageAlias: {
            "js-highlight": "javascript"
        },
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
        logo: "/icon.svg",
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
                    text: "Awesome List",
                    link: "/guide/awesome"
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
                detailedView: true,
                miniSearch: {
                    searchOptions: {
                        boostDocument(term, documentId, storedFields) {
                            const firstTitle = (storedFields?.titles as string[])?.[0];
                            if (firstTitle?.startsWith("Type Alias: "))
                                return -0.8;
                            else if (firstTitle?.startsWith("Class: "))
                                return -0.9;
                            else if (firstTitle?.startsWith("Function: "))
                                return -0.95;

                            return 1;
                        }
                    }
                }
            }
        },
        sidebar: getVitepressSidebar(),
        socialLinks: [
            {icon: "npm", link: "https://www.npmjs.com/package/node-llama-cpp"},
            {icon: "github", link: "https://github.com/withcatai/node-llama-cpp"}
        ]
    },
    async buildEnd(siteConfig) {
        const blogPosts = await getBlogPosts(false);

        async function loadSvgFontBuffers() {
            const interFontFilesDirectoryPath = path.join(require.resolve("@fontsource/inter"), "..", "files");
            const interFontFilePaths = [
                "inter-latin-400-normal.woff2",
                "inter-latin-500-normal.woff2",
                "inter-latin-600-normal.woff2",
                "inter-latin-700-normal.woff2",
                "inter-latin-ext-400-normal.woff2",
                "inter-latin-ext-500-normal.woff2",
                "inter-latin-ext-600-normal.woff2",
                "inter-latin-ext-700-normal.woff2"
            ];

            return await Promise.all(
                interFontFilePaths.map((filename) => (
                    fs.readFile(path.join(interFontFilesDirectoryPath, filename))
                ))
            );
        }

        async function loadInnerSvgImages() {
            const svgImages: Record<string, Buffer> = {
                "https://raw.githubusercontent.com/withcatai/node-llama-cpp/master/assets/logo.v3.roundEdges.png":
                    await fs.readFile(path.join(__dirname, "..", "assets", "logo.v3.roundEdges.png")),
                "https://raw.githubusercontent.com/withcatai/node-llama-cpp/master/assets/logo.v3.png":
                    await fs.readFile(path.join(__dirname, "..", "assets", "logo.v3.png"))
            };

            return svgImages;
        }

        const svgFontBuffers = loadSvgFontBuffers();
        const innerSvgImages = loadInnerSvgImages();

        async function renderSvg(svgPath: string, destPngPath: string, options: ResvgRenderOptions) {
            console.info(`Rendering "${svgPath}" to "${destPngPath}"`);

            const svgContent = await fs.readFile(svgPath, "utf8");
            const svgImages = await innerSvgImages;

            const resvg = new Resvg(svgContent, {
                ...(options ?? {}),
                font: {
                    ...(options.font ?? {}),
                    fontBuffers: await svgFontBuffers,
                    loadSystemFonts: false
                }
            });

            for (const url of resvg.imagesToResolve()) {
                if (svgImages[url] != null)
                    resvg.resolveImage(url, svgImages[url]);
                else {
                    console.info(`Fetching image: "${url}" for SVG "${svgPath}"`);
                    const fetchRes = await fetch(url);
                    if (!fetchRes.ok)
                        throw new Error(`Failed to fetch image: ${url}`);

                    resvg.resolveImage(url, Buffer.from(await fetchRes.arrayBuffer()));
                }
            }

            const res = resvg.render();

            await fs.writeFile(destPngPath, res.asPng(), "binary");
        }

        async function convertPngToJpg(pngPath: string, jpgPath: string, quality: number = 75) {
            console.info(`Converting "${pngPath}" to "${jpgPath}" with quality ${quality}`);

            const pngBuffer = await fs.readFile(pngPath);
            const jpgBuffer = await sharp(pngBuffer)
                .jpeg({quality})
                .toBuffer();

            await fs.writeFile(jpgPath, jpgBuffer, "binary");
        }

        async function convertPngToPreviewAvif(pngPath: string, avifPath: string, quality: number = 24, maxSize: number = 640) {
            console.info(`Converting "${pngPath}" to "${avifPath}" with quality ${quality}`);

            const pngBuffer = await fs.readFile(pngPath);
            const avifBuffer = await sharp(pngBuffer)
                .resize({
                    width: maxSize,
                    height: maxSize,
                    fit: "outside",
                    withoutEnlargement: true
                })
                .avif({
                    quality,
                    effort: 9
                })
                .toBuffer();

            await fs.writeFile(avifPath, avifBuffer, "binary");
        }

        async function addOgImages() {
            const svgImages = await innerSvgImages;

            let baseUrl = resolveHref("", true);
            if (baseUrl.endsWith("/"))
                baseUrl = baseUrl.slice(0, -"/".length);

            await buildEndGenerateOpenGraphImages({
                baseUrl,
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
                svgFontBuffers: await svgFontBuffers,
                templateSvgPath: path.join(__dirname, "assets", "ogTemplate.svg"),
                resultImageWidth: 1200,
                maxCharactersPerLine: 20,
                overrideExistingMetaTags: false
            })({
                ...siteConfig,
                site: {
                    ...siteConfig.site,
                    themeConfig: {
                        ...siteConfig.site.themeConfig,
                        sidebar: await getVitepressSidebarWithBlog(true, true)
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
                favicon: resolveHref("/favicon.ico", true),
                copyright: "node-llama-cpp",
                generator: "node-llama-cpp",
                feed: resolveHref("/blog/feed.atom", true),
                author: {
                    name: typeof packageJson.author === "string"
                        ? packageJson.author
                        : (packageJson.author as undefined | {name?: string})?.name
                },
                hub: "https://pubsubhubbub.appspot.com/"
            });

            for (const {url, frontmatter, html, src, excerpt: originalExcerpt} of blogPosts) {
                const ogImageElement = findElementInHtml(html, (element) => (
                    element.tagName === "meta" && (element.properties?.name === "og:image" || element.properties?.property === "og:image")
                ));
                const date = new Date(frontmatter.date);
                if (Number.isNaN(date.getTime()))
                    throw new Error(`Invalid date for blog post: ${url}`);
                else if (frontmatter.title == null || frontmatter.title === "")
                    throw new Error(`Invalid title for blog post: ${url}`);

                let description: string | undefined = frontmatter.description;
                if ((description == null || description == "") && src != null)
                    description = await getExcerptFromMarkdownFile(src);

                if ((description == null || description === "") && originalExcerpt != null && originalExcerpt !== "")
                    description = originalExcerpt;

                feed.addItem({
                    title: frontmatter.title,
                    id: resolveHref(url, true),
                    link: resolveHref(url, true),
                    description,
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

        await addBlogRssFeed();

        try {
            await initResvgWasm(await fs.readFile(require.resolve("@resvg/resvg-wasm/index_bg.wasm")));
        } catch (err) {
            // do nothing if wasm is already loaded
        }

        await renderSvg(
            path.join(__dirname, "assets", "social.poster.svg"),
            path.join(siteConfig.outDir, "social.poster.png"),
            {
                fitTo: {
                    mode: "height",
                    value: 2048
                }
            }
        );
        await convertPngToJpg(
            path.join(siteConfig.outDir, "social.poster.png"),
            path.join(siteConfig.outDir, "social.poster.jpg"),
            75
        );
        await convertPngToPreviewAvif(
            path.join(__dirname, "..", "assets", "logo.v3.png"),
            path.join(siteConfig.outDir, "logo.preview.avif"),
            24
        );

        await Promise.all([
            fs.copy(path.join(siteConfig.outDir, "llms.txt"), path.join(siteConfig.outDir, "llms.md")),
            fs.copy(path.join(siteConfig.outDir, "llms-full.txt"), path.join(siteConfig.outDir, "llms-full.md"))
        ]);
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

