import {Token} from "../types.js";


export type BindingModule = {
    AddonModel: {
        new (modelPath: string, params: {
            gpuLayers?: number,
            vocabOnly?: boolean,
            useMmap?: boolean,
            useMlock?: boolean
        }): AddonModel
    },
    AddonContext: {
        new (model: AddonModel, params: {
            seed?: number,
            contextSize?: number,
            batchSize?: number,
            logitsAll?: boolean,
            embedding?: boolean,
            threads?: number,
        }): AddonContext,
    },
    AddonGrammar: {
        new (grammarPath: string, params?: {
            printGrammar?: boolean,
        }): AddonGrammar
    },
    AddonGrammarEvaluationState: {
        new (grammar: AddonGrammar): AddonGrammarEvaluationState
    },
    systemInfo(): string,
    setLogger(logger: (level: number, message: string) => void): void,
    setLoggerLogLevel(level: number): void
};

export type AddonModel = {
    dispose(): void,
    tokenize(text: string, specialTokens: boolean): Uint32Array,
    detokenize(tokens: Uint32Array): string,
    getTrainContextSize(): number,
    getTotalSize(): number,
    getTotalParameters(): number,
    getModelDescription(): ModelTypeDescription,
    tokenBos(): Token,
    tokenEos(): Token,
    tokenNl(): Token,
    prefixToken(): Token,
    middleToken(): Token,
    suffixToken(): Token,
    eotToken(): Token,
    getTokenString(token: number): string
};

export type AddonContext = {
    dispose(): void,
    getContextSize(): number
    initBatch(size: number): void, // size must be less or equal to batchSize
    addToBatch(
        sequenceId: number,
        firstTokenSequenceIndex: number,
        tokens: Uint32Array,
        generateLogitAtTheEnd: boolean
    ): BatchLogitIndex | undefined, // returns batchLogitIndex if `generateLogitAtTheEnd` is true
    decodeBatch(): Promise<void>,
    sampleToken(batchLogitIndex: BatchLogitIndex, options?: {
        temperature?: number,
        topK?: number,
        topP?: number,
        repeatPenalty?: number,
        repeatPenaltyTokens?: Uint32Array,
        repeatPenaltyPresencePenalty?: number, // alpha_presence
        repeatPenaltyFrequencyPenalty?: number, // alpha_frequency
        grammarEvaluationState?: AddonGrammarEvaluationState
    }): Promise<Token>,
    disposeSequence(sequenceId: number): void,

    // startPos in inclusive, endPos is exclusive
    removeTokenCellsFromSequence(sequenceId: number, startPos: number, endPos: number): void,

    // startPos in inclusive, endPos is exclusive
    shiftSequenceTokenCells(sequenceId: number, startPos: number, endPos: number, shiftDelta: number): void,

    acceptGrammarEvaluationStateToken(grammarEvaluationState: AddonGrammarEvaluationState, token: Token): void,
    getEmbedding(): Float64Array,
    printTimings(): void
};

export type BatchLogitIndex = number & {
    __batchLogitIndex: never
};

export type AddonGrammar = "AddonGrammar" & {
    __brand: never
};

export type AddonGrammarEvaluationState = "AddonGrammarEvaluationState" & {
    __brand: never
};

export type ModelTypeDescription = `${AddonModelArchName} ${AddonModelTypeName} ${AddonModelFileTypeName}`;
export type AddonModelArchName = "unknown" | "llama" | "falcon" | "gpt2" | "gptj" | "gptneox" | "mpt" | "baichuan" | "starcoder" | "persimmon" |
    "refact" | "bloom" | "stablelm";
export type AddonModelTypeName = "1B" | "3B" | "7B" | "8B" | "13B" | "15B" | "30B" | "34B" | "40B" | "65B" | "70B" | "?B";
export type AddonModelFileTypeName = _AddonModelFileTypeName | `${_AddonModelFileTypeName} (guessed)`;
type _AddonModelFileTypeName = "all F32" | "mostly F16" | "mostly Q4_0" | "mostly Q4_1" | "mostly Q4_1, some F16" | "mostly Q5_0" |
    "mostly Q5_1" | "mostly Q8_0" | "mostly Q2_K" | "mostly Q3_K - Small" | "mostly Q3_K - Medium" | "mostly Q3_K - Large" |
    "mostly Q4_K - Small" | "mostly Q4_K - Medium" | "mostly Q5_K - Small" | "mostly Q5_K - Medium" | "mostly Q6_K" |
    "unknown, may not work";
