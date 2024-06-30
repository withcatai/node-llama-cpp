export class InsufficientMemoryError extends Error {
    public constructor(message: string = "Insufficient memory") {
        super(message);
    }
}
