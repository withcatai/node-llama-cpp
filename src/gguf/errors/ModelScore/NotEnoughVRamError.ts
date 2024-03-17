import bytes from "bytes";

export default class NotEnoughVRamError extends Error {
    public readonly requiredVRAM: number;
    public readonly availableVRAM: number;

    public constructor(requiredVRAM: number, availableVRAM: number) {
        super(`${bytes(requiredVRAM)} of VRAM is required, but only ${bytes(availableVRAM)} is available`);
        this.availableVRAM = availableVRAM;
        this.requiredVRAM = requiredVRAM;
    }
}
