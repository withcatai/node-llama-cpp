export default class InvalidGGUFMagicError extends Error {
    constructor(message = "Invalid GGUF magic") {
        super(message);
    }
}
