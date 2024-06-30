import path from "path";
import {fileURLToPath} from "url";
import {downloadFile, downloadSequence} from "ipull";
import fs from "fs-extra";
import chalk from "chalk";
import withStatusLogs from "../../src/utils/withStatusLogs.js";
import {withLockfile} from "../../src/utils/withLockfile.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const modelsFolder = path.join(__dirname, "..", ".models");
const supportedModels = {
    "functionary-small-v2.5.Q4_0.gguf": "https://huggingface.co/meetkai/functionary-small-v2.5-GGUF/resolve/main/functionary-small-v2.5.Q4_0.gguf?download=true",
    "stable-code-3b-Q5_K_M.gguf": "https://huggingface.co/stabilityai/stable-code-3b/resolve/main/stable-code-3b-Q5_K_M.gguf?download=true",
    "bge-small-en-v1.5-q8_0.gguf": "https://huggingface.co/CompendiumLabs/bge-small-en-v1.5-gguf/resolve/main/bge-small-en-v1.5-q8_0.gguf?download=true",
    "Meta-Llama-3-8B-Instruct.Q4_K_M.gguf": "https://huggingface.co/mradermacher/Meta-Llama-3-8B-Instruct-GGUF/resolve/main/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf?download=true"
} as const;

export async function getModelFile(modelName: keyof typeof supportedModels) {
    if (supportedModels[modelName] == null)
        throw new Error(`Model "${modelName}" is not supported`);

    const modelFilePath = path.join(modelsFolder, modelName);

    if (await fs.pathExists(modelFilePath))
        return modelFilePath;

    await fs.ensureDir(modelsFolder);

    return await withStatusLogs({
        loading: chalk.blue(`Downloading model "${modelName}"`),
        success: chalk.blue(`Downloaded model "${modelName}"`),
        fail: chalk.blue(`Failed to download model "${modelName}"`)
    }, async () => {
        return await withLockfile({
            resourcePath: modelFilePath
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
            cliProgress: true,
            parallelDownloads: 4
        }, ...pendingDownloads);
        await downloader.download();
    }
}
