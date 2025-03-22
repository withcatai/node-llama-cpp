import {afterAll} from "vitest";
import {getLlama, Llama} from "../../src/index.js";
import {isCI} from "../../src/config.js";

let llamaPromise: Promise<Llama> | null = null;

afterAll(async () => {
    if (!isCI)
        return;

    if (llamaPromise != null) {
        const temp = llamaPromise;
        llamaPromise = null;
        await (await temp).dispose();
    }
});

export async function getTestLlama() {
    if (llamaPromise != null)
        return await llamaPromise;

    llamaPromise = createTestLlama();

    return await llamaPromise;
}

export function createTestLlama() {
    return getLlama();
}
