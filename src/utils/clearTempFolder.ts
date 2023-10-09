import process from "process";
import fs from "fs-extra";
import {tempDownloadDirectory} from "../config.js";

export async function clearTempFolder() {
    if (process.platform === "win32") {
        try {
            await fs.remove(tempDownloadDirectory);
        } catch (err) {
            // do nothing as it fails sometime on Windows, and since it's a temp folder, it's not a big deal
        }

        return;
    }

    await fs.remove(tempDownloadDirectory);
}
