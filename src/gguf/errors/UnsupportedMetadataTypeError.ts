export default class UnsupportedMetadataTypeError extends Error {
    constructor(public readonly type: number) {
        super(`Unsupported metadata type: "${type}"`);
    }
}
