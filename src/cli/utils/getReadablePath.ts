import os from "os";
import path from "path";

export function getReadablePath(fsPath: string) {
    const resolvedPath = path.resolve(process.cwd(), fsPath);

    if (process.platform === "win32" || process.platform === "cygwin")
        return resolvedPath;

    let homedir = os.homedir();
    if (!homedir.endsWith("/"))
        homedir += "/";

    if (resolvedPath.startsWith(homedir))
        return "~" + resolvedPath.slice(homedir.length - "/".length);

    return resolvedPath;
}
