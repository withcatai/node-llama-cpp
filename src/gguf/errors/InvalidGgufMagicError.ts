export class InvalidGgufMagicError extends Error {
    public constructor(expectedGgufMagic: string, actualGgufMagic: string) {
        super(`Invalid GGUF magic. Expected "${expectedGgufMagic}" but got "${actualGgufMagic}".`);
    }
}
