export type ProjectTemplateOption = {
    title: string,
    name: string,
    titleFormat?(title: string): string,
    description?: string
};
export const projectTemplates: ProjectTemplateOption[] = [{
    title: "Node + TypeScript",
    name: "node-typescript",
    description: "A Node.js project with TypeScript using vite-node, some ESLint configuration, basic setup with a selected model file, and a working example of a simple usage of node-llama-cpp with the model"
}, {
    title: "Electron + TypeScript + React",
    name: "electron-typescript-react",
    description: "An Electron project with TypeScript and React using Vite-Electron, some ESLint configuration, basic setup with a selected model file, and a working example of a simple usage of node-llama-cpp with the model"
}];
