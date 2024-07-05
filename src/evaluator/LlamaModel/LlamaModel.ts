import process from "process";
import path from "path";
import {AsyncDisposeAggregator, DisposedError, EventRelay, withLock} from "lifecycle-utils";
import {removeNullFields} from "../../utils/removeNullFields.js";
import {Token, Tokenizer} from "../../types.js";
import {AddonModel, ModelTypeDescription} from "../../bindings/AddonTypes.js";
import {DisposalPreventionHandle, DisposeGuard} from "../../utils/DisposeGuard.js";
import {LlamaLocks, LlamaLogLevel, LlamaVocabularyType, LlamaVocabularyTypeValues} from "../../bindings/types.js";
import {GgufFileInfo} from "../../gguf/types/GgufFileInfoTypes.js";
import {readGgufFileInfo} from "../../gguf/readGgufFileInfo.js";
import {GgufInsights} from "../../gguf/insights/GgufInsights.js";
import {getConsoleLogPrefix} from "../../utils/getConsoleLogPrefix.js";
import {Writable} from "../../utils/utilTypes.js";
import {getReadablePath} from "../../cli/utils/getReadablePath.js";
import {LlamaContextOptions} from "../LlamaContext/types.js";
import {LlamaContext} from "../LlamaContext/LlamaContext.js";
import {LlamaEmbeddingContext, LlamaEmbeddingContextOptions} from "../LlamaEmbeddingContext.js";
import {GgufArchitectureType} from "../../gguf/types/GgufMetadataTypes.js";
import {TokenAttribute, TokenAttributes} from "./utils/TokenAttributes.js";
import type {Llama} from "../../bindings/Llama.js";
import type {BuiltinSpecialTokenValue} from "../../utils/LlamaText.js";

export type LlamaModelOptions = {
    /** path to the model on the filesystem */
    modelPath: string,

    /**
     * Number of layers to store in VRAM.
     * - **`"auto"`** - adapt to the current VRAM state and try to fit as many layers as possible in it.
     * Takes into account the VRAM required to create a context with a `contextSize` set to `"auto"`.
     * - **`"max"`** - store all layers in VRAM. If there's not enough VRAM, an error will be thrown. Use with caution.
     * - **`number`** - store the specified number of layers in VRAM. If there's not enough VRAM, an error will be thrown. Use with caution.
     * - **`{min?: number, max?: number, fitContext?: {contextSize: number}}`** - adapt to the current VRAM state and try to fit as
     * many layers as possible in it, but at least `min` and at most `max` layers. Set `fitContext` to the parameters of a context you
     * intend to create with the model, so it'll take it into account in the calculations and leave enough memory for such a context.
     *
     * If GPU support is disabled, will be set to `0` automatically.
     *
     * Defaults to `"auto"`.
     */
    gpuLayers?: "auto" | "max" | number | {
        min?: number,
        max?: number,
        fitContext?: {
            contextSize?: number,

            /**
             * Defaults to `false`.
             */
            embeddingContext?: boolean
        }
    },

    /** only load the vocabulary, no weights */
    vocabOnly?: boolean,

    /**
     * Use mmap if possible.
     * Defaults to `true`.
     * If LoRA is used, this will always be set to `false`.
     */
    useMmap?: boolean,

    /**
     * Force the system to keep the model in the RAM/VRAM.
     * Use with caution as this can crash your system if the available resources are insufficient.
     */
    useMlock?: boolean,

    /**
     * Check for tensor validity before actually loading the model.
     * Using it increases the time it takes to load the model.
     * Defaults to `false`.
     */
    checkTensors?: boolean,

    /**
     * Load the provided LoRA adapters onto the model after loading the model.
     * LoRA adapters are used to modify the weights of a pretrained model to adapt to new tasks or domains
     * without the need for extensive retraining from scratch.
     *
     * If a string is provided, it will be treated as a path to a single LoRA adapter file.
     */
    lora?: string | {
        adapters: Array<{
            loraFilePath: string,
            baseModelPath?: string,

            /**
             * Defaults to `1`.
             */
            scale?: number
        }>,

        /**
         * The number of threads to use when loading the LoRA adapters.
         * set to 0 to use the maximum threads supported by the current machine hardware.
         *
         * Defaults to `6`.
         */
        threads?: number,

        /**
         * Called with the LoRA adapters load percentage when the LoRA adapters are being loaded.
         * @param loadProgress - a number between 0 (exclusive) and 1 (inclusive).
         */
        onLoadProgress?(loadProgress: number): void
    },

    /**
     * Enable flash attention by default for contexts created with this model.
     * Only works with models that support flash attention.
     *
     * Flash attention is an optimization in the attention mechanism that makes inference faster, more efficient and uses less memory.
     *
     * The support for flash attention is currently experimental and may not always work as expected.
     * Use with caution.
     *
     * This option will be ignored if flash attention is not supported by the model.
     *
     * Enabling this affects the calculations of default values for the model and contexts created with it
     * as flash attention reduces the amount of memory required,
     * which allows for more layers to be offloaded to the GPU and for context sizes to be bigger.
     *
     * Defaults to `false`.
     *
     * Upon flash attention exiting the experimental status, the default value will become `true`.
     */
    defaultContextFlashAttention?: boolean,

    /**
     * Called with the load percentage when the model is being loaded.
     * > **Note:** This progress does not include the progress of loading the provided LoRA adapters (when `lora` is used)
     * @param loadProgress - a number between 0 (exclusive) and 1 (inclusive).
     */
    onLoadProgress?(loadProgress: number): void,

    /** An abort signal to abort the model load */
    loadSignal?: AbortSignal,

    /**
     * Ignore insufficient memory errors and continue with the model load.
     * Can cause the process to crash if there's not enough VRAM to fit the model.
     *
     * Defaults to `false`.
     */
    ignoreMemorySafetyChecks?: boolean
};

const defaultLoraThreads = 6;
const defaultLoraScale = 1;
const defaultUseMmap = true;
const defaultContextFlashAttentionEnabled = false;

export class LlamaModel {
    /** @internal */ public readonly _llama: Llama;
    /** @internal */ public readonly _model: AddonModel;
    /** @internal */ public readonly _backendModelDisposeGuard: DisposeGuard;
    /** @internal */ private readonly _tokens: LlamaModelTokens;
    /** @internal */ private readonly _modelPath: string;
    /** @internal */ private readonly _fileInfo: GgufFileInfo;
    /** @internal */ private readonly _fileInsights: GgufInsights;
    /** @internal */ private readonly _gpuLayers: number;
    /** @internal */ private readonly _filename?: string;
    /** @internal */ private readonly _disposedState: DisposedState = {disposed: false};
    /** @internal */ private readonly _disposeAggregator = new AsyncDisposeAggregator();
    /** @internal */ private readonly _llamaPreventDisposalHandle: DisposalPreventionHandle;
    /** @internal */ private readonly _defaultContextFlashAttentionOptionEnabled: boolean;
    /** @internal */ private readonly _defaultContextFlashAttention: boolean;
    /** @internal */ private readonly _flashAttentionSupported: boolean;
    /** @internal */ private _typeDescription?: ModelTypeDescription;
    /** @internal */ private _trainContextSize?: number;
    /** @internal */ private _embeddingVectorSize?: number;
    /** @internal */ private _vocabularyType?: LlamaVocabularyType;

    public readonly tokenizer: Tokenizer;
    public readonly onDispose = new EventRelay<void>();

    private constructor({
        modelPath, gpuLayers, vocabOnly, useMmap, useMlock, checkTensors, onLoadProgress, loadSignal
    }: LlamaModelOptions & {
        gpuLayers: number
    }, {
        _llama,
        _fileInfo,
        _fileInsights,
        _defaultContextFlashAttentionOptionEnabled,
        _defaultContextFlashAttention,
        _flashAttentionSupported
    }: {
        _llama: Llama,
        _fileInfo: GgufFileInfo,
        _fileInsights: GgufInsights,
        _defaultContextFlashAttentionOptionEnabled: boolean,
        _defaultContextFlashAttention: boolean,
        _flashAttentionSupported: boolean
    }) {
        this._llama = _llama;
        this._fileInfo = _fileInfo;
        this._modelPath = path.resolve(process.cwd(), modelPath);
        this._fileInsights = _fileInsights;
        this._gpuLayers = gpuLayers;
        this._backendModelDisposeGuard = new DisposeGuard([this._llama._backendDisposeGuard]);
        this._llamaPreventDisposalHandle = this._llama._backendDisposeGuard.createPreventDisposalHandle();
        this._defaultContextFlashAttentionOptionEnabled = _defaultContextFlashAttentionOptionEnabled;
        this._defaultContextFlashAttention = _defaultContextFlashAttention;
        this._flashAttentionSupported = _flashAttentionSupported;
        this._model = new this._llama._bindings.AddonModel(this._modelPath, removeNullFields({
            addonExports: this._llama._bindings,
            gpuLayers,
            vocabOnly,
            useMmap,
            useMlock: _llama.supportsMlock
                ? useMlock
                : undefined,
            checkTensors: checkTensors ?? false,
            onLoadProgress: onLoadProgress == null
                ? undefined
                : (loadPercentage: number) => {
                    try {
                        onLoadProgress(loadPercentage);
                    } catch (err) {
                        // the native addon code calls this function, so there's no use to throw an error here
                        console.error(err);
                    }
                },
            hasLoadAbortSignal: loadSignal != null
        }));
        this._tokens = LlamaModelTokens._create(this._model, this._disposedState);
        this._filename = path.basename(modelPath);

        this._disposeAggregator.add(() => {
            this._disposedState.disposed = true;
        });
        this._disposeAggregator.add(this.onDispose.dispatchEvent);
        this._disposeAggregator.add(
            this._llama.onDispose.createListener(
                disposeModelIfReferenced.bind(null, new WeakRef(this))
            )
        );

        this._disposeAggregator.add(async () => {
            await this._backendModelDisposeGuard.acquireDisposeLock();
            await this._model.dispose();
            this._llamaPreventDisposalHandle.dispose();
        });

        this.tokenize = this.tokenize.bind(this);
        this.detokenize = this.detokenize.bind(this);
        this.isSpecialToken = this.isSpecialToken.bind(this);

        (this.tokenize as Tokenizer as Writable<Tokenizer>).detokenize = this.detokenize;
        (this.tokenize as Tokenizer).isSpecialToken = this.isSpecialToken;
        this.tokenizer = this.tokenize as Tokenizer;
    }

    public async dispose() {
        if (this._disposedState.disposed)
            return;

        this._disposedState.disposed = true;

        await this._disposeAggregator.dispose();
    }

    /** @hidden */
    public async [Symbol.asyncDispose]() {
        await this.dispose();
    }

    public get disposed() {
        return this._disposedState.disposed;
    }

    public get tokens() {
        return this._tokens;
    }

    public get filename() {
        return this._filename;
    }

    public get fileInfo(): GgufFileInfo {
        return this._fileInfo;
    }

    public get fileInsights(): GgufInsights {
        return this._fileInsights;
    }

    /**
     * Number of layers offloaded to the GPU.
     * If GPU support is disabled, this will always be `0`.
     */
    public get gpuLayers(): number {
        return this._gpuLayers;
    }

    /**
     * Total model size in memory in bytes
     */
    public get size() {
        this._ensureNotDisposed();

        return this._model.getModelSize();
    }

    public get flashAttentionSupported() {
        return this._flashAttentionSupported;
    }

    public get defaultContextFlashAttention() {
        return this._defaultContextFlashAttention;
    }

    /**
     * Transform text into tokens that can be fed to the model
     * @param text - the text to tokenize
     * @param [specialTokens] - if set to true, text that correspond to special tokens will be tokenized to those tokens.
     * For example, `<s>` will be tokenized to the BOS token if `specialTokens` is set to `true`,
     * otherwise it will be tokenized to tokens that corresponds to the plaintext `<s>` string.
     * @param [options] - additional options for tokenization.
     * If set to `"trimLeadingSpace"`, a leading space will be trimmed from the tokenized output if the output has an
     * additional space at the beginning.
     */
    public tokenize(text: string, specialTokens?: boolean, options?: "trimLeadingSpace"): Token[];
    public tokenize(text: BuiltinSpecialTokenValue, specialTokens: "builtin"): Token[];
    public tokenize(text: string, specialTokens: boolean | "builtin" = false, options?: "trimLeadingSpace"): Token[] {
        this._ensureNotDisposed();

        if (text === "")
            return [];

        if (specialTokens === "builtin") {
            const builtinToken = text as BuiltinSpecialTokenValue;

            switch (builtinToken) {
                case "BOS": return this.tokens.bos == null ? [] : [this.tokens.bos];
                case "EOS": return this.tokens.eos == null ? [] : [this.tokens.eos];
                case "NL": return this.tokens.nl == null ? [] : [this.tokens.nl];
                case "EOT": return this.tokens.infill.eot == null ? [] : [this.tokens.infill.eot];
            }

            void (builtinToken satisfies never);
            throw new Error(`Unknown builtin special token: ${builtinToken}`);
        }

        if (options === "trimLeadingSpace") {
            if (specialTokens) {
                const countLeadingSpaces = (text: string) => {
                    let count = 0;
                    for (; count < text.length; count++) {
                        if (text[count] !== " ")
                            break;
                    }
                    return count;
                };
                const textLeadingSpaces = countLeadingSpaces(text);
                const [workaroundToken, workaroundTokenString] = (this.tokens.bos != null && this.tokens.bosString != null)
                    ? [this.tokens.bos, this.tokens.bosString]
                    : (this.tokens.eos != null && this.tokens.eosString != null)
                        ? [this.tokens.eos, this.tokens.eosString]
                        : (this.tokens.nl != null && this.tokens.nlString != null)
                            ? [this.tokens.nl, this.tokens.nlString]
                            : (this.tokens.infill.eot != null && this.tokens.infill.eotString != null)
                                ? [this.tokens.infill.eot, this.tokens.infill.eotString]
                                : [null, null];

                if (workaroundToken != null && workaroundTokenString != null) {
                    const tokens = Array.from(this._model.tokenize(workaroundTokenString + text, true)) as Token[];
                    const workaroundTokenIndex = tokens.indexOf(workaroundToken);

                    // only use the tokenized output if it can be corrected, otherwise fallback to the default tokenization
                    if (workaroundTokenIndex >= 0 && workaroundTokenIndex <= 1) {
                        tokens.splice(0, workaroundTokenIndex + 1);

                        if (countLeadingSpaces(this.detokenize(tokens, true)) === textLeadingSpaces)
                            return tokens;
                    }
                }

                const workaroundTokensString = "\n";
                const workaroundTokens = Array.from(this._model.tokenize(workaroundTokensString, true)) as Token[];

                if (text.startsWith(workaroundTokensString)) {
                    const tokens = Array.from(this._model.tokenize(text, true)) as Token[];
                    if (this.detokenize(tokens, true).startsWith(workaroundTokensString))
                        return tokens;
                }

                const tokens = Array.from(this._model.tokenize(workaroundTokensString + text, true)) as Token[];

                // only use the tokenized output if it can be corrected, otherwise fallback to the default tokenization
                if (workaroundTokens.length > 0 && workaroundTokens.every((token, index) => tokens[index] === token)) {
                    tokens.splice(0, workaroundTokens.length);

                    if (countLeadingSpaces(this.detokenize(tokens, true)) === textLeadingSpaces)
                        return tokens;
                }
            } else {
                const workaroundTokensString = "\n";
                const workaroundTokens = Array.from(this._model.tokenize(workaroundTokensString, false)) as Token[];

                if (text.startsWith(workaroundTokensString)) {
                    const tokens = Array.from(this._model.tokenize(text, false)) as Token[];
                    if (this.detokenize(tokens, false).startsWith(workaroundTokensString))
                        return tokens;
                }

                const tokens = Array.from(this._model.tokenize(workaroundTokensString + text, false)) as Token[];

                // only use the tokenized output if it can be corrected, otherwise fallback to the default tokenization
                if (workaroundTokens.length > 0 && workaroundTokens.every((token, index) => tokens[index] === token)) {
                    tokens.splice(0, workaroundTokens.length);
                    return tokens;
                }
            }
        }

        return Array.from(this._model.tokenize(text, specialTokens)) as Token[];
    }

    /**
     * Transform tokens into text
     * @param tokens - the tokens to detokenize.
     * @param [specialTokens] - if set to `true`, special tokens will be detokenized to their corresponding token text representation.
     * Recommended for debugging purposes only.
     * Defaults to `false`.
     */
    public detokenize(tokens: readonly Token[], specialTokens: boolean = false): string {
        this._ensureNotDisposed();

        if (tokens.length === 0)
            return "";

        return this._model.detokenize(Uint32Array.from(tokens), Boolean(specialTokens));
    }

    public getTokenAttributes(token: Token): TokenAttributes {
        if (this.vocabularyType === LlamaVocabularyType.none)
            return TokenAttributes._create(token, TokenAttribute.undefined);

        return TokenAttributes._create(token, this._model.getTokenAttributes(token));
    }

    /** Check whether the given token is a special token (a control-type token or a token with no normal text representation) */
    public isSpecialToken(token: Token | undefined): boolean {
        if (token == null)
            return false;

        if (this.getTokenAttributes(token).control)
            return true;

        const normalText = this.detokenize([token], false);

        if (normalText === "")
            return this.detokenize([token], true) !== "";

        return false;
    }

    /** Check whether the given token is an EOG (End Of Generation) token, like EOS or EOT. */
    public isEogToken(token: Token | undefined): boolean {
        if (token == null)
            return false;

        return token === this.tokens.eos || token === this.tokens.infill.eot || this._model.isEogToken(token);
    }

    public async createContext(options: LlamaContextOptions = {}) {
        return await withLock(this._llama._memoryLock, LlamaLocks.loadToMemory, options.createSignal, async () => {
            const preventDisposalHandle = this._backendModelDisposeGuard.createPreventDisposalHandle();
            try {
                return await LlamaContext._create(options, {_model: this});
            } finally {
                preventDisposalHandle.dispose();
            }
        });
    }

    public async createEmbeddingContext(options: LlamaEmbeddingContextOptions = {}) {
        return await withLock(this._llama._memoryLock, LlamaLocks.loadToMemory, options.createSignal, async () => {
            const preventDisposalHandle = this._backendModelDisposeGuard.createPreventDisposalHandle();
            try {
                return await LlamaEmbeddingContext._create({_model: this}, options);
            } finally {
                preventDisposalHandle.dispose();
            }
        });
    }

    /**
     * Get warnings about the model file that would affect its usage.
     *
     * These warnings include all the warnings generated by `GgufInsights`, but are more comprehensive.
     */
    public getWarnings() {
        this._ensureNotDisposed();

        const warnings = this._fileInsights.getWarnings(this._modelPath);
        const modelFilePathText = `("${getReadablePath(this._modelPath)}")`;

        try {
            const specialTokenString = this.tokens.bosString || this.tokens.eosString || this.tokens.infill.eotString;
            if (specialTokenString != null && specialTokenString !== "") {
                const beforeTextNoSpecialTokens = "some test text here";
                const afterTextNoSpecialTokens = this.detokenize(this.tokenize(beforeTextNoSpecialTokens, false, "trimLeadingSpace"));

                if (beforeTextNoSpecialTokens !== afterTextNoSpecialTokens)
                    warnings.push(
                        `Using this model ${modelFilePathText} to tokenize text and then detokenize it resulted in a different text. ` +
                        "There might be an issue with the model or the tokenizer implementation. " +
                        "Using this model may not work as intended"
                    );

                const beforeTextWithSpecialTokens = specialTokenString + beforeTextNoSpecialTokens;
                const afterTextWithSpecialTokens = this.detokenize(this.tokenize(beforeTextWithSpecialTokens, true, "trimLeadingSpace"), true);

                if (beforeTextWithSpecialTokens !== afterTextWithSpecialTokens)
                    warnings.push(
                        `Using this model ${modelFilePathText} to tokenize text with special tokens and then ` +
                        "detokenize it resulted in a different text. " +
                        "There might be an issue with the model or the tokenizer implementation. " +
                        "Using this model may not work as intended"
                    );
            }
        } catch (err) {
            // do nothing
        }

        try {
            if (this._defaultContextFlashAttentionOptionEnabled && !this._flashAttentionSupported) {
                if (this.fileInfo.metadata?.general?.architecture === GgufArchitectureType.grok)
                    warnings.push("Flash attention is incompatible with Grok and thus was turned off");
                else if (this.fileInfo.metadata?.general?.architecture === GgufArchitectureType.gemma2)
                    warnings.push("Flash attention is incompatible with Gemma2 and thus was turned off");
                else {
                    const nHead = this.fileInfo.architectureMetadata?.attention?.head_count ?? 0;
                    const nEmbd = this.fileInfo.architectureMetadata?.embedding_length ?? 0;
                    const nEmbdHeadK = this.fileInfo.architectureMetadata?.attention?.key_length ?? ((nHead == 0) ? 0 : (nEmbd / nHead));
                    const nEmbdHeadV = this.fileInfo.architectureMetadata?.attention?.value_length ?? ((nHead == 0) ? 0 : nEmbd / nHead);

                    if (nEmbdHeadK !== nEmbdHeadV)
                        warnings.push("Flash attention is incompatible with this model and thus was turned off");
                }
            }
        } catch (err) {
            // do nothing
        }

        return warnings;
    }

    /** @hidden `ModelTypeDescription` type alias is too long in the documentation */
    public get typeDescription(): ModelTypeDescription {
        this._ensureNotDisposed();

        if (this._typeDescription == null)
            this._typeDescription = this._model.getModelDescription();

        return this._typeDescription;
    }

    /** The context size the model was trained on */
    public get trainContextSize(): number {
        this._ensureNotDisposed();

        if (this._trainContextSize == null)
            this._trainContextSize = this._model.getTrainContextSize();

        return this._trainContextSize;
    }

    /** The size of an embedding vector the model can produce */
    public get embeddingVectorSize(): number {
        this._ensureNotDisposed();

        if (this._embeddingVectorSize == null)
            this._embeddingVectorSize = this._model.getEmbeddingVectorSize();

        return this._embeddingVectorSize;
    }

    public get vocabularyType(): LlamaVocabularyType {
        this._ensureNotDisposed();

        if (this._vocabularyType == null) {
            const vocabType = this._model.getVocabularyType();
            this._vocabularyType = LlamaVocabularyTypeValues[vocabType];

            if (this._vocabularyType == null) {
                console.warn(getConsoleLogPrefix() + "Unknown vocabulary type:", vocabType);
                this._vocabularyType = LlamaVocabularyType.none;
            }
        }

        return this._vocabularyType;
    }

    /** @internal */
    private _ensureNotDisposed() {
        if (this._disposedState.disposed)
            throw new DisposedError();
    }

    /** @internal */
    private async _loadLora({
        loraFilePath, baseModelPath, scale, threads
    }: {
        loraFilePath: string, baseModelPath?: string, scale?: number, threads: number
    }) {
        await this._model.loadLora(
            path.resolve(process.cwd(), loraFilePath),
            scale ?? defaultLoraScale,
            Math.max(0, Math.floor(threads)),
            baseModelPath == null
                ? undefined
                : path.resolve(process.cwd(), baseModelPath)
        );
    }

    /** @internal */
    public static async _create(modelOptions: LlamaModelOptions, {
        _llama
    }: {
        _llama: Llama
    }) {
        const {loadSignal, defaultContextFlashAttention} = modelOptions;
        let useMmap = modelOptions.useMmap ?? defaultUseMmap;
        const loraOptions: LlamaModelOptions["lora"] = typeof modelOptions.lora === "string"
            ? {adapters: [{loraFilePath: modelOptions.lora}]}
            : modelOptions.lora;

        if (loraOptions?.adapters != null && loraOptions.adapters.length > 0)
            useMmap = false; // using LoRA with nmap crashes the process

        const fileInfo = await readGgufFileInfo(modelOptions.modelPath, {
            sourceType: "filesystem",
            signal: loadSignal
        });
        const ggufInsights = await GgufInsights.from(fileInfo, _llama);
        const flashAttentionSupported = ggufInsights.flashAttentionSupported;
        const resolvedDefaultContextFlashAttention = flashAttentionSupported
            ? (defaultContextFlashAttention ?? defaultContextFlashAttentionEnabled)
            : false;
        const gpuLayers = await ggufInsights.configurationResolver.resolveModelGpuLayers(modelOptions.gpuLayers, {
            ignoreMemorySafetyChecks: modelOptions.ignoreMemorySafetyChecks,
            defaultContextFlashAttention: resolvedDefaultContextFlashAttention
        });
        const vramRequiredEstimate = ggufInsights.estimateModelResourceRequirements({gpuLayers: gpuLayers}).gpuVram;

        const model = new LlamaModel({...modelOptions, gpuLayers, useMmap}, {
            _fileInfo: fileInfo,
            _fileInsights: ggufInsights,
            _llama,
            _defaultContextFlashAttentionOptionEnabled: defaultContextFlashAttention ?? false,
            _flashAttentionSupported: flashAttentionSupported,
            _defaultContextFlashAttention: resolvedDefaultContextFlashAttention
        });
        const modelCreationMemoryReservation = modelOptions.ignoreMemorySafetyChecks
            ? null
            : _llama._vramOrchestrator.reserveMemory(vramRequiredEstimate);
        const loggedWarnings = new Set<string>();

        function onAbort() {
            model._model.abortActiveModelLoad();
            loadSignal?.removeEventListener("abort", onAbort);
        }

        function logWarnings(warnings: string[]) {
            for (const warning of warnings) {
                if (loggedWarnings.has(warning))
                    continue;

                _llama._log(LlamaLogLevel.warn, warning);
                loggedWarnings.add(warning);
            }
        }

        if (loadSignal != null) {
            if (loadSignal.aborted)
                throw loadSignal.reason;

            loadSignal.addEventListener("abort", onAbort);
        }

        logWarnings(ggufInsights.getWarnings(modelOptions.modelPath));

        try {
            const modelLoaded = await model._model.init();

            if (loadSignal?.aborted) {
                if (modelLoaded)
                    await model._model.dispose();

                throw loadSignal.reason;
            } else if (!modelLoaded)
                throw new Error("Failed to load model");

            loadSignal?.removeEventListener("abort", onAbort);

            logWarnings(model.getWarnings());

            if (loraOptions != null && loraOptions.adapters.length > 0) {
                const loraThreads = loraOptions.threads ?? defaultLoraThreads;
                let loadedAdapters = 0;

                for (const adapter of loraOptions.adapters) {
                    try {
                        await model._loadLora({
                            loraFilePath: adapter.loraFilePath,
                            baseModelPath: adapter.baseModelPath,
                            scale: adapter.scale,
                            threads: loraThreads
                        });
                        loadedAdapters++;

                        try {
                            loraOptions.onLoadProgress?.(loadedAdapters / loraOptions.adapters.length);
                        } catch (err) {
                            console.error(err);
                        }
                    } catch (err) {
                        await model._model.dispose();
                        throw err;
                    }

                    if (loadSignal?.aborted) {
                        await model._model.dispose();
                        throw loadSignal.reason;
                    }
                }

                logWarnings(model.getWarnings());
            } else if (loraOptions?.onLoadProgress != null) {
                try {
                    loraOptions.onLoadProgress(1);
                } catch (err) {
                    console.error(err);
                }
            }

            return model;
        } finally {
            loadSignal?.removeEventListener("abort", onAbort);
            modelCreationMemoryReservation?.dispose?.();
        }
    }
}

export class LlamaModelTokens {
    /** @internal */ private readonly _model: AddonModel;
    /** @internal */ private readonly _disposedState: DisposedState;
    /** @internal */ private _infillTokens?: LlamaModelInfillTokens;
    /** @internal */ private _bosToken?: Token;
    /** @internal */ private _eosToken?: Token;
    /** @internal */ private _nlToken?: Token;
    /** @internal */ private _bosString?: string;
    /** @internal */ private _eosString?: string;
    /** @internal */ private _nlString?: string;
    /** @internal */ private _shouldPrependBosToken?: boolean;

    private constructor(model: AddonModel, disposedState: DisposedState) {
        this._model = model;
        this._disposedState = disposedState;
    }

    /**
     * @returns infill tokens
     */
    public get infill() {
        this._ensureNotDisposed();

        if (this._infillTokens == null)
            this._infillTokens = LlamaModelInfillTokens._create(this._model, this._disposedState);

        return this._infillTokens;
    }

    /**
     * @returns The BOS (Beginning Of Sequence) token.
     */
    public get bos(): Token | null {
        this._ensureNotDisposed();

        if (this._bosToken == null)
            this._bosToken = this._model.tokenBos();

        if (this._bosToken === -1)
            return null;

        return this._bosToken;
    }

    /**
     * @returns The EOS (End Of Sequence) token.
     */
    public get eos(): Token | null {
        this._ensureNotDisposed();

        if (this._eosToken == null)
            this._eosToken = this._model.tokenEos();

        if (this._eosToken === -1)
            return null;

        return this._eosToken;
    }

    /**
     * @returns The NL (New Line) token.
     */
    public get nl(): Token | null {
        this._ensureNotDisposed();

        if (this._nlToken == null)
            this._nlToken = this._model.tokenNl();

        if (this._nlToken === -1)
            return null;

        return this._nlToken;
    }

    /**
     * @returns The BOS (Beginning Of Sequence) token as a string.
     */
    public get bosString(): string | null {
        this._ensureNotDisposed();

        const bosToken = this.bos;

        if (bosToken == null)
            return null;

        if (this._bosString == null)
            this._bosString = this._model.getTokenString(bosToken);

        return this._bosString;
    }

    /**
     * @returns The EOS (End Of Sequence) token as a string.
     */
    public get eosString(): string | null {
        this._ensureNotDisposed();

        const eosToken = this.eos;

        if (eosToken == null)
            return null;

        if (this._eosString == null)
            this._eosString = this._model.getTokenString(eosToken);

        return this._eosString;
    }

    /**
     * @returns The NL (New Line) token as a string.
     */
    public get nlString(): string | null {
        this._ensureNotDisposed();

        const nlToken = this.nl;

        if (nlToken == null)
            return null;

        if (this._nlString == null)
            this._nlString = this._model.getTokenString(nlToken);

        return this._nlString;
    }

    /**
     * @returns Whether we should prepend a BOS (Beginning Of Sequence) token for evaluations with this model.
     */
    public get shouldPrependBosToken(): boolean {
        this._ensureNotDisposed();

        if (this._shouldPrependBosToken == null)
            this._shouldPrependBosToken = this.bos != null && this._model.shouldPrependBosToken();

        return this._shouldPrependBosToken;
    }

    /** @internal */
    private _ensureNotDisposed() {
        if (this._disposedState.disposed)
            throw new DisposedError();
    }

    /** @internal */
    public static _create(model: AddonModel, disposedState: DisposedState) {
        return new LlamaModelTokens(model, disposedState);
    }
}

export class LlamaModelInfillTokens {
    /** @internal */ private readonly _model: AddonModel;
    /** @internal */ private readonly _disposedState: DisposedState;
    /** @internal */ private _prefixToken?: Token;
    /** @internal */ private _middleToken?: Token;
    /** @internal */ private _suffixToken?: Token;
    /** @internal */ private _eotToken?: Token;
    /** @internal */ private _prefixString?: string;
    /** @internal */ private _middleString?: string;
    /** @internal */ private _suffixString?: string;
    /** @internal */ private _eotString?: string;

    private constructor(model: AddonModel, disposedState: DisposedState) {
        this._model = model;
        this._disposedState = disposedState;
    }

    /**
     * @returns The beginning of infill prefix token.
     */
    public get prefix(): Token | null {
        this._ensureNotDisposed();

        if (this._prefixToken == null)
            this._prefixToken = this._resolveSpecialToken(this._model.prefixToken(), ["<fim_prefix>"]);

        if (this._prefixToken === -1)
            return null;

        return this._prefixToken;
    }

    /**
     * @returns The beginning of infill middle token.
     */
    public get middle(): Token | null {
        this._ensureNotDisposed();

        if (this._middleToken == null)
            this._middleToken = this._resolveSpecialToken(this._model.middleToken(), ["<fim_middle>"]);

        if (this._middleToken === -1)
            return null;

        return this._middleToken;
    }

    /**
     * @returns The beginning of infill suffix token.
     */
    public get suffix(): Token | null {
        this._ensureNotDisposed();

        if (this._suffixToken == null)
            this._suffixToken = this._resolveSpecialToken(this._model.suffixToken(), ["<fim_suffix>"]);

        if (this._suffixToken === -1)
            return null;

        return this._suffixToken;
    }

    /**
     * @returns End of infill middle token (End Of Text).
     */
    public get eot(): Token | null {
        this._ensureNotDisposed();

        if (this._eotToken == null)
            this._eotToken = this._model.eotToken();

        if (this._eotToken === -1)
            return null;

        return this._eotToken;
    }

    /**
     * @returns The beginning of infill prefix token as a string.
     */
    public get prefixString(): string | null {
        this._ensureNotDisposed();

        const prefixToken = this.prefix;

        if (prefixToken == null)
            return null;

        if (this._prefixString == null)
            this._prefixString = this._model.getTokenString(prefixToken);

        return this._prefixString;
    }

    /**
     * @returns The beginning of infill middle token as a string.
     */
    public get middleString(): string | null {
        this._ensureNotDisposed();

        const middleToken = this.middle;

        if (middleToken == null)
            return null;

        if (this._middleString == null)
            this._middleString = this._model.getTokenString(middleToken);

        return this._middleString;
    }

    /**
     * @returns The beginning of infill suffix token as a string.
     */
    public get suffixString(): string | null {
        this._ensureNotDisposed();

        const suffixToken = this.suffix;

        if (suffixToken == null)
            return null;

        if (this._suffixString == null)
            this._suffixString = this._model.getTokenString(suffixToken);

        return this._suffixString;
    }

    /**
     * @returns End of infill middle token (End Of Text) as a string.
     */
    public get eotString(): string | null {
        this._ensureNotDisposed();

        const eotToken = this.eot;

        if (eotToken == null)
            return null;

        if (this._eotString == null)
            this._eotString = this._model.getTokenString(eotToken);

        return this._eotString;
    }

    /** @internal */
    private _ensureNotDisposed() {
        if (this._disposedState.disposed)
            throw new DisposedError();
    }

    /** @internal */
    private _resolveSpecialToken(token: Token, fallbackTexts: string[]): Token {
        if (token != null && token !== -1)
            return token;

        for (const text of fallbackTexts) {
            const tokens = this._model.tokenize(text, true);
            if (tokens.length !== 1)
                continue;

            return tokens[0] as Token;
        }

        return -1 as Token;
    }

    /** @internal */
    public static _create(model: AddonModel, disposedState: DisposedState) {
        return new LlamaModelInfillTokens(model, disposedState);
    }
}

function disposeModelIfReferenced(modelRef: WeakRef<LlamaModel>) {
    const model = modelRef.deref();

    if (model != null)
        void model.dispose();
}

type DisposedState = {
    disposed: boolean
};
