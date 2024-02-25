export default class UnsupportedMetadataTypeError extends Error {
    public constructor(public readonly type: number) {
        super(`Unsupported metadata type: "${type}"`);
    }
}
