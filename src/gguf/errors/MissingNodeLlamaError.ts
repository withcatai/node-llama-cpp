export default class MissingNodeLlamaError extends Error {
    constructor(purpose: string) {
        super(`Missing nodeLlama options, this in required for ${purpose}`);
    }
}
