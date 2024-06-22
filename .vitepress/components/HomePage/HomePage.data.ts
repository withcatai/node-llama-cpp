import {createMarkdownRenderer, LoaderModule} from "vitepress";
import vitepressConfig from "../../config.js";


const loader = {
    async load() {
        const markdownRenderer = await createMarkdownRenderer(process.cwd(), vitepressConfig.markdown);

        const renderCommand = (command: string) => markdownRenderer.render("```shell\n" + command + "\n```");

        return {
            chatCommand: renderCommand("npx -y node-llama-cpp chat"),
            inspectCommand: renderCommand("npx -y node-llama-cpp inspect gpu")
        }
    }
} as const satisfies LoaderModule;

export default loader;

// purely for type checking
export const data: Awaited<ReturnType<(typeof loader)["load"]>> = undefined as any;
