export default class MetadataNotParsedYetError extends Error {
    constructor(path: string) {
        super(`Metadata not parsed yet: "${path}"`);
    }
}
