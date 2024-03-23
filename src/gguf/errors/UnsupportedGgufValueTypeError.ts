export class UnsupportedGgufValueTypeError extends Error {
    public readonly ggufValueType: number;

    public constructor(ggufValueType: number) {
        super(`Unsupported GGUF value type "${ggufValueType}"`);

        Object.defineProperty(this, "ggufValueType" satisfies keyof this, {enumerable: false});

        this.ggufValueType = ggufValueType;
    }
}
