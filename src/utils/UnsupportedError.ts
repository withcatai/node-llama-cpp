export class UnsupportedError extends Error {
    /** @internal */
    public constructor(message: string = "UnsupportedError") {
        super(message);
    }
}
