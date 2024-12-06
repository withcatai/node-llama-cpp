import {Token} from "../types.js";


export type BindingModule = {
    AddonModel: {
        new (modelPath: string, params: {
            addonExports?: BindingModule,
            gpuLayers?: number,
            vocabOnly?: boolean,
            useMmap?: boolean,
            useMlock?: boolean,
            checkTensors?: boolean,
            onLoadProgress?(loadPercentage: number): void,
            hasLoadAbortSignal?: boolean,
            overridesList?: Array<[key: string, value: number | bigint | boolean | string, type: 0 | 1 | undefined]>
        }): AddonModel
    },
    AddonModelLora: {
        new (model: AddonModel, filePath: string): AddonModelLora
    },
    AddonContext: {
        new (model: AddonModel, params: {
            contextSize?: number,
            batchSize?: number,
            sequences?: number,
            flashAttention?: boolean,
            logitsAll?: boolean,
            embeddings?: boolean,
            threads?: number,
            performanceTracking?: boolean
        }): AddonContext
    },
    AddonGrammar: {
        new (grammarPath: string, params?: {
            addonExports?: BindingModule,
            rootRuleName?: string
        }): AddonGrammar
    },
    AddonGrammarEvaluationState: {
        new (model: AddonModel, grammar: AddonGrammar): AddonGrammarEvaluationState
    },
    AddonSampler: {
        new (model: AddonModel): AddonSampler,
        acceptGrammarEvaluationStateToken(grammarEvaluationState: AddonGrammarEvaluationState, token: Token): void,
        canBeNextTokenForGrammarEvaluationState(grammarEvaluationState: AddonGrammarEvaluationState, token: Token): boolean
    },
    systemInfo(): string,
    getSupportsGpuOffloading(): boolean,
    getSupportsMmap(): boolean,
    getSupportsMlock(): boolean,
    getMathCores(): number,
    getBlockSizeForGgmlType(ggmlType: number): number | undefined,
    getTypeSizeForGgmlType(ggmlType: number): number | undefined,
    getConsts(): {
        ggmlMaxDims: number,
        ggmlTypeF16Size: number,
        ggmlTypeF32Size: number,
        ggmlTensorOverhead: number,
        llamaPosSize: number,
        llamaSeqIdSize: number
    },
    setLogger(logger: (level: number, message: string) => void): void,
    setLoggerLogLevel(level: number): void,
    getGpuVramInfo(): {
        total: number,
        used: number,
        unifiedSize: number
    },
    getGpuDeviceInfo(): {
        deviceNames: string[]
    },
    getGpuType(): "cuda" | "vulkan" | "metal" | false | undefined,
    getSwapInfo(): {
        total: number,
        maxSize: number,
        free: number
    },
    init(): Promise<void>,
    loadBackends(forceLoadLibraries?: boolean): void,
    dispose(): Promise<void>
};

export type AddonModel = {
    init(): Promise<boolean>,
    loadLora(lora: AddonModelLora): Promise<void>,
    abortActiveModelLoad(): void,
    dispose(): Promise<void>,
    tokenize(text: string, specialTokens: boolean): Uint32Array,
    detokenize(tokens: Uint32Array, specialTokens?: boolean): string,
    getTrainContextSize(): number,
    getEmbeddingVectorSize(): number,
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
    clsToken(): Token,
    sepToken(): Token,
    getTokenString(token: number): string,
    getTokenAttributes(token: Token): number,
    isEogToken(token: Token): boolean,
    getVocabularyType(): number,
    shouldPrependBosToken(): boolean,
    shouldAppendEosToken(): boolean,
    getModelSize(): number
};

export type AddonContext = {
    init(): Promise<boolean>,
    dispose(): Promise<void>,
    getContextSize(): number,
    initBatch(size: number): void, // size must be less or equal to batchSize
    addToBatch(
        sequenceId: number,
        firstTokenSequenceIndex: number,
        tokens: Uint32Array,
        generateLogitAtTheEnd: boolean
    ): BatchLogitIndex | undefined, // returns batchLogitIndex if `generateLogitAtTheEnd` is true
    decodeBatch(): Promise<void>,
    sampleToken(batchLogitIndex: BatchLogitIndex, sampler: AddonSampler): Promise<Token>,
    disposeSequence(sequenceId: number): void,

    // startPos in inclusive, endPos is exclusive
    removeTokenCellsFromSequence(sequenceId: number, startPos: number, endPos: number): boolean,

    // startPos in inclusive, endPos is exclusive
    shiftSequenceTokenCells(sequenceId: number, startPos: number, endPos: number, shiftDelta: number): void,

    getEmbedding(inputTokensLength: number): Float64Array,
    getStateSize(): number,
    getThreads(): number,
    setThreads(threads: number): void,
    printTimings(): void,
    setLora(lora: AddonModelLora, scale: number): void
};

export type BatchLogitIndex = number & {
    __batchLogitIndex: never
};

export type AddonGrammar = {
    isTextCompatible(testText: string): boolean
};

export type AddonGrammarEvaluationState = "AddonGrammarEvaluationState" & {
    __brand: never
};

export type AddonSampler = {
    dispose(): void,
    applyConfig(config: {
        temperature?: number,
        minP?: number,
        topK?: number,
        topP?: number,
        seed?: number,
        repeatPenalty?: number,
        repeatPenaltyMaxTokens?: number,
        repeatPenaltyTokens?: Uint32Array,
        repeatPenaltyPresencePenalty?: number, // alpha_presence
        repeatPenaltyFrequencyPenalty?: number, // alpha_frequency
        grammarEvaluationState?: AddonGrammarEvaluationState,
        tokenBiasKeys?: Uint32Array,
        tokenBiasValues?: Float32Array
    }): void
};

export type AddonModelLora = {
    usages: number,
    readonly filePath: string,
    readonly disposed: boolean,
    dispose(): Promise<void>
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
