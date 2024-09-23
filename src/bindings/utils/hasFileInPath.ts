import path from "path";
import fs from "fs-extra";
import {asyncSome} from "./asyncSome.js";

export async function hasFileInPath(fileToSearch: string, additionalSearchPaths: (string | null | undefined)[] = []) {
    const searchPaths = resolveSearchPaths(additionalSearchPaths);

    return await asyncSome(
        searchPaths.map(async (searchPath) => {
            return fs.pathExists(path.join(searchPath, fileToSearch));
        })
    );
}

export async function resolveFileLocationInPath(fileToSearch: string, additionalSearchPaths: (string | null | undefined)[] = []) {
    const searchPaths = resolveSearchPaths(additionalSearchPaths);

    const foundPaths = await Promise.all(
        searchPaths.map(async (searchPath) => {
            const filePath = path.join(searchPath, fileToSearch);
            if (await fs.pathExists(filePath))
                return filePath;

            return null;
        })
    );

    return foundPaths.filter((filePath): filePath is string => filePath != null);
}


function resolveSearchPaths(additionalSearchPaths: (string | null | undefined)[]) {
    return [
        // Windows checks the cwd before the path
        ...(
            process.platform === "win32"
                ? [process.cwd()]
                : []
        ),
        ...((process.env.PATH || "").split(path.delimiter)),
        ...(additionalSearchPaths.flatMap((searchPath) => (searchPath || "").split(path.delimiter)))
    ]
        .map((pathPart) => (
            (pathPart.length >= 2 && pathPart.startsWith('"') && pathPart.endsWith('"'))
                ? pathPart.slice(1, -1)
                : pathPart
        ))
        .filter((pathPart) => pathPart.length > 0);
}
