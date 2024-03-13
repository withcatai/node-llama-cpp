import path from "path";
import {fileURLToPath} from "url";
import {downloadFile, downloadSequence} from "ipull";
import fs from "fs-extra";
import chalk from "chalk";
import withStatusLogs from "../../src/utils/withStatusLogs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const modelsFolder = path.join(__dirname, "..", ".models");
const supportedModels = {
    "functionary-small-v2.2.q4_0.gguf": "https://huggingface.co/meetkai/functionary-small-v2.2-GGUF/resolve/main/functionary-small-v2.2.q4_0.gguf?download=true",
    "stable-code-3b.Q5_K_M.gguf": "https://huggingface.co/TheBloke/stable-code-3b-GGUF/resolve/main/stable-code-3b.Q5_K_M.gguf?download=true"
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
        const modelUrl = supportedModels[modelName];

        const downloader = await downloadFile({
            url: modelUrl,
            directory: path.dirname(modelFilePath),
            fileName: path.basename(modelFilePath),
            cliProgress: true
        });
        await downloader.download();

        return modelFilePath;
    });
}

export async function downloadAllModels() {
    const existingModels = new Set<string>();
    const pendingDownloads: ReturnType<typeof downloadFile>[] = [];

    for (const modelName of Object.keys(supportedModels)) {
        if (supportedModels[modelName as keyof typeof supportedModels] == null)
            continue;

        const modelFilePath = path.join(modelsFolder, modelName);

        if (await fs.pathExists(modelFilePath)) {
            existingModels.add(modelName);
            continue;
        }

        const modelUrl = supportedModels[modelName as keyof typeof supportedModels];
        pendingDownloads.push(
            downloadFile({
                url: modelUrl,
                directory: path.dirname(modelFilePath),
                fileName: path.basename(modelFilePath)
            })
        );
    }

    if (existingModels.size > 0) {
        if (pendingDownloads.length === 0)
            console.info("All models are already downloaded");
        else
            console.info(`Already downloaded ${existingModels.size} model${existingModels.size === 1 ? "" : "s"}\n`);
    }

    if (pendingDownloads.length > 0) {
        console.info(`Downloading ${pendingDownloads.length} model${pendingDownloads.length === 1 ? "" : "s"}`);
        const downloader = await downloadSequence({
            cliProgress: true
        }, ...pendingDownloads);
        await downloader.download();
    }
}
