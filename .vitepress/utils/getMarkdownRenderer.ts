import {createMarkdownRenderer} from "vitepress";

const renderers = new Map<string, ReturnType<typeof createMarkdownRenderer>>();
export function getMarkdownRenderer(path: string = process.cwd()): ReturnType<typeof createMarkdownRenderer> {
    if (!renderers.has(path))
        renderers.set(path, createMarkdownRenderer(path));

    return renderers.get(path)!;
}
