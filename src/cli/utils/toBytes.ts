import bytes from "bytes";

export function toBytes(value: number): string {
    return bytes(value) ?? String(value);
}
