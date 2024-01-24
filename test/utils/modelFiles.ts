import path from "path";
import {fileURLToPath} from "url";
import {CLIPullProgress, FastDownload} from "ipull";
import fs from "fs-extra";
import chalk from "chalk";
import withStatusLogs from "../../src/utils/withStatusLogs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const modelsFolder = path.join(__dirname, "..", ".models");
const supportedModels = {
    "functionary-small-v2.2.q4_0.gguf": "https://huggingface.co/meetkai/functionary-small-v2.2-GGUF/resolve/main/functionary-small-v2.2.q4_0.gguf?download=true"
} as const;

export async function getModelFile(modelName: keyof typeof supportedModels) {
    if (supportedModels[modelName] == null)
        throw new Error(`Model "${modelName}" is not supported`);

    const modelFilePath = path.join(modelsFolder, modelName);

    if (await fs.pathExists(modelFilePath))
        return modelFilePath;

    return await withStatusLogs({
        loading: chalk.blue(`Downloading model "${modelName}"`),
        success: chalk.blue(`Downloaded model "${modelName}"`),
        fail: chalk.blue(`Failed to download model "${modelName}"`)
    }, async () => {
        const temporaryModelFilePath = `${modelFilePath}.tmp`;
        const modelUrl = supportedModels[modelName];

        const download = new FastDownload(modelUrl, temporaryModelFilePath);
        await download.init();

        const cliPullProgress = new CLIPullProgress(download, modelName);
        await cliPullProgress.startPull();

        if (await fs.pathExists(modelFilePath))
            await fs.remove(modelFilePath);

        await fs.move(temporaryModelFilePath, modelFilePath);

        return modelFilePath;
    });
}

export async function downloadAllModels() {
    for (const modelName of Object.keys(supportedModels)) {
        await getModelFile(modelName as keyof typeof supportedModels);
    }
}
