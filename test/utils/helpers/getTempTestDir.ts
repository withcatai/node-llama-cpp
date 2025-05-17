import path from "path";
import {fileURLToPath} from "url";
import fs from "fs-extra";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(__dirname, "..", "..", ".temp");

export async function getTempTestDir() {
    await fs.ensureDir(tempDir);
    return tempDir;
}

export async function getTempTestFilePath(fileName: string) {
    const tempDir = await getTempTestDir();
    const currentDate = new Date();
    const fileDateString = [
        String(currentDate.getFullYear()),
        String(currentDate.getMonth() + 1).padStart(2, "0"),
        String(currentDate.getDate()).padStart(2, "0"),
        String(currentDate.getHours()).padStart(2, "0"),
        String(currentDate.getMinutes()).padStart(2, "0"),
        String(currentDate.getSeconds()).padStart(2, "0"),
        String(currentDate.getMilliseconds()).padStart(3, "0")
    ].join("");
    const randomText = Math.random()
        .toString(36)
        .slice(2, 10 + 2);

    const resolvedFilename = fileDateString + "_" + randomText + "_" + fileName;

    return path.join(tempDir, resolvedFilename);
}
