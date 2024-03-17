export default class UnsupportedMetadataTypeError extends Error {
    public readonly type: number;

    public constructor(type: number) {
        super(`Unsupported metadata type: "${type}"`);
        this.type = type;
    }
}
