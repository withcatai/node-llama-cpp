import path from "path";
import {fileURLToPath} from "url";
import fs from "fs-extra";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDirectory = path.join(__dirname, "..", "packages");
const binsDirectory = path.join(__dirname, "..", "bins");

async function moveBinariesFolderToStandaloneModule(folderNameFilter: (folderName: string) => boolean, packageName: string) {
    for (const folderName of await fs.readdir(binsDirectory)) {
        if (!folderNameFilter(folderName))
            continue;

        const packagePath = path.join(packageDirectory, packageName);
        const packageBinsPath = path.join(packagePath, "bins");

        console.info(`Moving "${folderName}" to "${packageName}"`);

        await fs.ensureDir(packageBinsPath);
        await fs.move(path.join(binsDirectory, folderName), path.join(packageBinsPath, folderName));

        await fs.writeFile(
            path.join(binsDirectory, "_" + folderName + ".moved.txt"),
            `Moved to package "${packageName}"`,
            "utf8"
        );
    }
}

await moveBinariesFolderToStandaloneModule((folderName) => folderName.startsWith("linux-x64-cuda"), "@node-llama-cpp/linux-x64-cuda");
await moveBinariesFolderToStandaloneModule((folderName) => folderName.startsWith("win-x64-cuda"), "@node-llama-cpp/win-x64-cuda");
