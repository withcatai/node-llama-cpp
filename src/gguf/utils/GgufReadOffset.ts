export class GgufReadOffset {
    public offset: number;

    public constructor(offset: number | GgufReadOffset) {
        if (offset instanceof GgufReadOffset)
            this.offset = offset.offset;
        else
            this.offset = offset;
    }

    public moveBy(amount: number) {
        this.offset += amount;
    }

    public static resolveReadOffset(offset: number | GgufReadOffset) {
        if (offset instanceof GgufReadOffset)
            return offset;

        return new GgufReadOffset(offset);
    }
}
