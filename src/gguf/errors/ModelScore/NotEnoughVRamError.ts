import prettyBytes from "pretty-bytes";

export default class NotEnoughVRamError extends Error {
    public readonly requiredVRAM: number;
    public readonly availableVRAM: number;

    public constructor(requiredVRAM: number, availableVRAM: number) {
        super();
        this.availableVRAM = availableVRAM;
        this.requiredVRAM = requiredVRAM;
        this.message = `Not enough VRAM, require ${prettyBytes(requiredVRAM)}, but only ${prettyBytes(availableVRAM)} available`;
    }
}
