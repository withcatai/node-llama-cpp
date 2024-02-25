import prettyBytes from "pretty-bytes";

export default class NotEnoughVRamError extends Error {
    public constructor(public readonly requiredVRAM: number, public readonly availableVRAM: number) {
        super();
        this.message = `Not enough VRAM, require ${prettyBytes(requiredVRAM)}, but only ${prettyBytes(availableVRAM)} available`;
    }
}
