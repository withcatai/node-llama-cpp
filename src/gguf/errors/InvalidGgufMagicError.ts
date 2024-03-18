export class InvalidGgufMagicError extends Error {
    public constructor(message = "Invalid GGUF magic") {
        super(message);
    }
}
