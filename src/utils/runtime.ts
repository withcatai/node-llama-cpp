import path from "path";
import {fileURLToPath} from "url";

const __filename = fileURLToPath(import.meta.url);

export const runningInElectron = process.versions.electron != null;
export const runningInsideAsar = runningInElectron && __filename.toLowerCase().includes(".asar" + path.sep);
export const runningInBun = process.versions.bun != null;
export const runningInNode = !runningInElectron && !runningInBun;

