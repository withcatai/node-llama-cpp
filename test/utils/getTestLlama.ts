import {getLlama, Llama} from "../../src/index.js";

let llamaPromise: Promise<Llama> | null = null;

export async function getTestLlama() {
    if (llamaPromise != null)
        return await llamaPromise;

    llamaPromise = createTestLlama();

    return await llamaPromise;
}

export function createTestLlama() {
    return getLlama();
}
