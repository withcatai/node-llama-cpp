export function getGgufMetadataKeyValue(metadata: Record<string, any>, key: string) {
    return readMedataKey(metadata, key.split("."));
}

function readMedataKey(metadata: Record<string, any>, keyParts: string[]): any {
    for (const [metadataKey, value] of Object.entries(metadata)) {
        const matchLength = checkMatchLength(metadataKey, keyParts);
        if (matchLength === 0)
            continue;

        if (matchLength === keyParts.length)
            return value;

        const res = readMedataKey(value, keyParts.slice(matchLength));
        if (res !== undefined)
            return res;
    }

    return undefined;
}

function checkMatchLength(metadataKey: string, keyParts: string[]) {
    const metadataKeyParts = metadataKey.split(".");

    if (metadataKeyParts.length > keyParts.length)
        return 0;

    for (let i = 0; i < metadataKeyParts.length; i++) {
        if (metadataKeyParts[i] !== keyParts[i])
            return 0;
    }

    return metadataKeyParts.length;
}
