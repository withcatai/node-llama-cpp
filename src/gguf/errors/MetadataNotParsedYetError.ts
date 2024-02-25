export default class MetadataNotParsedYetError extends Error {
    public constructor(path: string) {
        super(`Metadata not parsed yet: "${path}"`);
    }
}
