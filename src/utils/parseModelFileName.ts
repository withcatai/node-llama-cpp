import {ggufQuantNames} from "../gguf/utils/ggufQuantNames.js";

export function parseModelFileName(filename: string) {
    const parts = filename.split("-");
    let quantization: string | undefined;
    let fileType: string | undefined;
    let version: string | undefined;
    let contextSize: string | undefined;
    let filePart: string | undefined;
    let fileParts: string | undefined;

    if (parts.at(-2) === "of" && isFilePartText(parts.at(-1)?.slice(0, 5)) && isFilePartText(parts.at(-3))) {
        filePart = parts.at(-3);
        fileParts = parts.at(-1)?.slice(0, 5);

        const lastPart = parts.pop();
        parts.pop(); // of
        parts.pop(); // part number

        const partWithoutNumber = lastPart?.slice(5);
        if (partWithoutNumber != null && partWithoutNumber !== "")
            parts.push(partWithoutNumber);
    }

    if (parts.length > 0) {
        const lastPart = parts.at(-1)!;
        const lastParts = lastPart.split(".");
        fileType = lastParts.pop();
        quantization = lastParts.pop()?.toUpperCase();

        if (lastParts.length > 0)
            parts[parts.length - 1] = lastParts.join(".");
        else
            parts.pop();
    }

    if (parts.length > 0 && (quantization == null || quantization === "")) {
        const lastPart = parts.at(-1)!.toUpperCase();
        if (ggufQuantNames.has(lastPart)) {
            quantization = lastPart;
            parts.pop();
        }
    }

    if (quantization != null && !ggufQuantNames.has(quantization))
        quantization = undefined;

    if (quantization == null) {
        const potentialParts = filename
            .replaceAll(".", "-")
            .replaceAll(" ", "-")
            .split("-")
            .reverse();

        for (const part of potentialParts) {
            const upperPart = part.toUpperCase();
            if (ggufQuantNames.has(upperPart)) {
                quantization = upperPart;
                break;
            }
        }
    }

    const {previousParts, parameters, nextParts} = splitByModelParameters(parts);

    const name = previousParts.shift();
    const otherInfo: string[] = [];

    for (let i = 0; i < nextParts.length; i++) {
        const part = nextParts[i]!;
        if (isContextSizeText(part)) {
            contextSize = part.toUpperCase();
            nextParts.splice(i, 1);
            i--;
        } else if (isVersionText(part)) {
            version = part.toLowerCase();
            nextParts.splice(i, 1);
            i--;
        } else {
            otherInfo.push(part);
        }
    }

    return {
        name,
        subType: previousParts.join("-"),
        quantization,
        fileType,
        version,
        contextSize,
        parameters,
        parts: (filePart != null && fileParts != null)
            ? {
                part: filePart,
                parts: fileParts
            }
            : undefined,
        otherInfo
    };
}

function isParametersText(text: string): text is `${number}${"B" | "b"}` {
    return /^[0-9]+[Bb]$/.test(text);
}

function isVersionText(text: string) {
    return /^[vV]?[0-9]/.test(text);
}

function isContextSizeText(text: string) {
    return /^[0-9]+[kKmM]$/.test(text);
}

export function isFilePartText(text?: string) {
    if (text == null)
        return false;

    return /^\d{5}$/.test(text);
}

function splitByModelParameters(parts: string[]) {
    parts = parts.slice();

    for (let i = 0; i < parts.length; i++) {
        let part = parts[i]!;
        let isParameters = isParametersText(part);
        if (!isParameters && isParametersText(part.split(".").shift()!)) {
            const [parameters, ...rest] = part.split(".");
            part = parameters!;
            parts[i] = part;

            if (rest.length > 0) {
                while (rest.length > 0)
                    parts.splice(i + 1, 0, rest.pop()!);
            }

            isParameters = true;
        }

        if (isParameters) {
            return {
                parameters: part.toUpperCase() as `${number}B`,
                previousParts: parts.slice(0, i),
                nextParts: parts.slice(i + 1)
            };
        }
    }

    return {
        parameters: undefined,
        previousParts: parts,
        nextParts: [] as string[]
    };
}
