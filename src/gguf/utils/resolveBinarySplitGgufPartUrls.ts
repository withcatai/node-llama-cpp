import filenamify from "filenamify";

const binarySplitGgufPartsRegex = /\.gguf\.part(?<part>\d+)of(?<parts>\d+)$/;

export function resolveBinarySplitGgufPartUrls(ggufUrl: string) {
    const parsedGgufUrl = new URL(ggufUrl);
    const binaryPartsMatch = parsedGgufUrl.pathname.match(binarySplitGgufPartsRegex);
    if (binaryPartsMatch != null) {
        const partString = binaryPartsMatch.groups?.part;
        const part = Number(partString);
        const partsString = binaryPartsMatch.groups?.parts;
        const parts = Number(partsString);

        if (partString == null || !Number.isFinite(part) || partsString == null || !Number.isFinite(parts) || part > parts || part === 0 ||
            parts === 0
        )
            return ggufUrl;

        const ggufIndex = parsedGgufUrl.pathname.indexOf(".gguf");
        const pathnameWithoutPart = parsedGgufUrl.pathname.slice(0, ggufIndex + ".gguf".length);

        const res: string[] = [];
        for (let i = 1; i <= parts; i++) {
            const url = new URL(parsedGgufUrl.href);
            url.pathname = pathnameWithoutPart + `.part${String(i).padStart(partString.length, "0")}of${partsString}`;
            res.push(url.href);
        }

        return res;
    }

    return ggufUrl;
}

export function getFilenameForBinarySplitGgufPartUrls(urls: string[]) {
    if (urls.length === 0)
        return undefined;

    const firstParsedUrl = new URL(urls[0]!);

    if (binarySplitGgufPartsRegex.test(firstParsedUrl.pathname)) {
        const ggufIndex = firstParsedUrl.pathname.toLowerCase().indexOf(".gguf");
        const urlWithoutPart = firstParsedUrl.pathname.slice(0, ggufIndex + ".gguf".length);

        const filename = decodeURIComponent(urlWithoutPart.split("/").pop()!);
        return filenamify(filename);
    }

    return undefined;
}
