export default class InvalidGGUFMagicError extends Error {
    public constructor(message = "Invalid GGUF magic") {
        super(message);
    }
}
