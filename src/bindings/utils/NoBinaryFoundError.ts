export class NoBinaryFoundError extends Error {
    /** @internal */
    public constructor(message: string = "NoBinaryFoundError") {
        super(message);
    }
}
