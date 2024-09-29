import {isUrl} from "../../utils/isUrl.js";

const splitGgufPartRegex = /-(?<part>\d{5})-of-(?<parts>\d{5})\.gguf$/;

export function resolveSplitGgufParts(ggufPathOrUri: string) {
    if (isUrl(ggufPathOrUri)) {
        const parsedUrl = new URL(ggufPathOrUri);

        return resolveParts(parsedUrl.pathname).map((part) => {
            const url = new URL(ggufPathOrUri);
            url.pathname = part;
            return url.href;
        });
    }

    return resolveParts(ggufPathOrUri);
}

function resolveParts(ggufPath: string) {
    const splitPartMatch = ggufPath.match(splitGgufPartRegex);

    if (splitPartMatch != null) {
        const partsInfo = getGgufSplitPartsInfo(ggufPath);

        if (partsInfo == null)
            return [ggufPath];

        const {parts, matchLength} = partsInfo;

        const commonPath = ggufPath.slice(0, ggufPath.length - matchLength);

        const res: string[] = [];
        for (let i = 1; i <= parts; i++)
            res.push(commonPath + `-${String(i).padStart(5, "0")}-of-${String(parts).padStart(5, "0")}.gguf`);

        return res;
    }

    return [ggufPath];
}

export function getGgufSplitPartsInfo(ggufPath: string) {
    let checkPath = ggufPath;

    if (isUrl(checkPath)) {
        const parsedUrl = new URL(checkPath);
        checkPath = parsedUrl.pathname;
    }

    const splitPartMatch = checkPath.match(splitGgufPartRegex);

    if (splitPartMatch != null) {
        const part = Number(splitPartMatch.groups?.part);
        const parts = Number(splitPartMatch.groups?.parts);
        const matchLength = splitPartMatch[0]?.length;

        if (matchLength == null || !Number.isFinite(part) || !Number.isFinite(parts) || part > parts || part === 0 || parts === 0)
            return null;

        return {
            part,
            parts,
            matchLength
        };
    }

    return null;
}

export function createSplitPartFilename(filename: string, part: number, parts: number) {
    const splitPartMatch = filename.match(splitGgufPartRegex);
    if (splitPartMatch != null) {
        const partsInfo = getGgufSplitPartsInfo(filename);
        if (partsInfo != null) {
            const {matchLength} = partsInfo;
            const commonPath = filename.slice(0, filename.length - matchLength);

            filename = commonPath + ".gguf";
        }
    }

    if (filename.toLowerCase().endsWith(".gguf"))
        filename = filename.slice(0, -".gguf".length);

    return `${filename}-${String(part).padStart(5, "0")}-of-${String(parts).padStart(5, "0")}.gguf`;
}
