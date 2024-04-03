import path from "path";
import process from "process";

export async function resolveCommandGgufPath(modelPath: string) {
    return path.resolve(process.cwd(), modelPath);
}
