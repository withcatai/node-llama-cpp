export default class UnsupportedMetadataTypeError extends Error {
    public readonly metadataValueType: number;

    public constructor(metadataValueType: number) {
        super(`Unsupported GGUF metadata value type "${metadataValueType}"`);

        Object.defineProperty(this, "metadataValueType" satisfies keyof this, {enumerable: false});

        this.metadataValueType = metadataValueType;
    }
}
