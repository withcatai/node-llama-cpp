import process from "process";
import path from "path";
import {AsyncDisposeAggregator, DisposedError, EventRelay, withLock} from "lifecycle-utils";
import {removeNullFields} from "../../utils/removeNullFields.js";
import {Token, Tokenizer} from "../../types.js";
import {AddonModel, AddonModelLora, ModelTypeDescription} from "../../bindings/AddonTypes.js";
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
import {GgufArchitectureType, GgufMetadata} from "../../gguf/types/GgufMetadataTypes.js";
import {OverridesObject} from "../../utils/OverridesObject.js";
import {maxRecentDetokenizerTokens} from "../../consts.js";
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

    /**
     * Only load the vocabulary, not weight tensors.
     *
     * Useful when you only want to use the model to use its tokenizer but not for evaluation.
     *
     * Defaults to `false`.
     */
    vocabOnly?: boolean,

    /**
     * Use mmap if possible.
     *
     * Defaults to `true`.
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
     *
     * Defaults to `false`.
     */
    checkTensors?: boolean,

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
    ignoreMemorySafetyChecks?: boolean,

    /**
     * Metadata overrides to load the model with.
     *
     * > **Note:** Most metadata value overrides aren't supported and overriding them will have no effect on `llama.cpp`.
     * > Only use this for metadata values that are explicitly documented to be supported by `llama.cpp` to be overridden,
     * > and only in cases when this is crucial, as this is not guaranteed to always work as expected.
     */
    metadataOverrides?: OverridesObject<GgufMetadata, number | bigint | boolean | string>
};

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
    /** @internal */ private readonly _vocabOnly: boolean;
    /** @internal */ private readonly _filename?: string;
    /** @internal */ private readonly _disposedState: DisposedState = {disposed: false};
    /** @internal */ private readonly _disposeAggregator = new AsyncDisposeAggregator();
    /** @internal */ private readonly _llamaPreventDisposalHandle: DisposalPreventionHandle;
    /** @internal */ private readonly _defaultContextFlashAttentionOptionEnabled: boolean;
    /** @internal */ private readonly _defaultContextFlashAttention: boolean;
    /** @internal */ private readonly _flashAttentionSupported: boolean;
    /** @internal */ private readonly _loraAdapters = new Map<string, AddonModelLora>();
    /** @internal */ private _typeDescription?: ModelTypeDescription;
    /** @internal */ private _trainContextSize?: number;
    /** @internal */ private _embeddingVectorSize?: number;
    /** @internal */ private _vocabularyType?: LlamaVocabularyType;

    public readonly tokenizer: Tokenizer;
    public readonly onDispose = new EventRelay<void>();

    private constructor({
        modelPath, gpuLayers, vocabOnly = false, useMmap, useMlock, checkTensors, onLoadProgress, loadSignal, metadataOverrides
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
        this._vocabOnly = vocabOnly ?? false;
        this._backendModelDisposeGuard = new DisposeGuard([this._llama._backendDisposeGuard]);
        this._llamaPreventDisposalHandle = this._llama._backendDisposeGuard.createPreventDisposalHandle();
        this._defaultContextFlashAttentionOptionEnabled = _defaultContextFlashAttentionOptionEnabled;
        this._defaultContextFlashAttention = _defaultContextFlashAttention;
        this._flashAttentionSupported = _flashAttentionSupported;
        const overridesList = ggufMetadataOverridesToList(metadataOverrides);
        this._model = new this._llama._bindings.AddonModel(this._modelPath, removeNullFields({
            addonExports: this._llama._bindings,
            gpuLayers,
            vocabOnly: this._vocabOnly,
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
            hasLoadAbortSignal: loadSignal != null,
            overridesList: overridesList.length > 0
                ? overridesList
                : undefined
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

        this._removeLoraUsage = this._removeLoraUsage.bind(this);

        this.tokenize = this.tokenize.bind(this);
        this.detokenize = this.detokenize.bind(this);
        this.isSpecialToken = this.isSpecialToken.bind(this);
        this.isEogToken = this.isEogToken.bind(this);

        (this.tokenize as Tokenizer as Writable<Tokenizer>).detokenize = this.detokenize;
        (this.tokenize as Tokenizer).isSpecialToken = this.isSpecialToken;
        (this.tokenize as Tokenizer).isEogToken = this.isEogToken;

        Object.freeze(this.tokenize);
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
                case "EOT": return this.tokens.eot == null ? [] : [this.tokens.eot];
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
                            : (this.tokens.eot != null && this.tokens.eotString != null)
                                ? [this.tokens.eot, this.tokens.eotString]
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
     *
     * Recommended for debugging purposes only.
     *
     * > **Note:** there may be additional spaces around special tokens that were not present in the original text - this is not a bug,
     * this is [how the tokenizer is supposed to work](https://github.com/ggerganov/llama.cpp/pull/7697#issuecomment-2144003246).
     *
     * Defaults to `false`.
     * @param [lastTokens] - the last few tokens that preceded the tokens to detokenize.
     * If provided, the last few tokens will be used to determine whether a space has to be added before the current tokens or not,
     * and apply other detokenizer-specific heuristics to provide the correct text continuation to the existing tokens.
     *
     * Using it may have no effect with some models, but it is still recommended.
     */
    public detokenize(tokens: readonly Token[], specialTokens: boolean = false, lastTokens?: readonly Token[]): string {
        this._ensureNotDisposed();

        if (tokens.length === 0)
            return "";

        if (lastTokens == null || lastTokens.length === 0)
            return this._model.detokenize(Uint32Array.from(tokens), Boolean(specialTokens));

        const addedTokens = lastTokens.slice(-maxRecentDetokenizerTokens);
        const addedTokensText = this._model.detokenize(Uint32Array.from(addedTokens), Boolean(specialTokens));
        if (addedTokensText === "")
            return this._model.detokenize(Uint32Array.from(tokens), Boolean(specialTokens));

        const text = this._model.detokenize(Uint32Array.from([...addedTokens, ...tokens]), Boolean(specialTokens));
        if (text.startsWith(addedTokensText))
            return text.slice(addedTokensText.length);

        return this._model.detokenize(Uint32Array.from(tokens), Boolean(specialTokens));
    }

    public getTokenAttributes(token: Token): TokenAttributes {
        if (token == null)
            throw new Error("Token cannot be null");

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

    public *iterateAllTokens() {
        if (this.vocabularyType === LlamaVocabularyType.none)
            return;

        const totalTokens = this.fileInfo.metadata?.tokenizer?.ggml?.tokens?.length;
        if (typeof totalTokens !== "number")
            return;

        for (let i = 0; i < totalTokens; i++)
            yield i as Token;
    }

    /** Check whether the given token is an EOG (End Of Generation) token, like EOS or EOT. */
    public isEogToken(token: Token | undefined): boolean {
        if (token == null)
            return false;

        return token === this.tokens.eos || token === this.tokens.eot || this._model.isEogToken(token);
    }

    public async createContext(options: LlamaContextOptions = {}) {
        if (this._vocabOnly)
            throw new Error("Model is loaded in vocabOnly mode, so no context can be created");

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
        if (this._vocabOnly)
            throw new Error("Model is loaded in vocabOnly mode, so no context can be created");

        return await LlamaEmbeddingContext._create({_model: this}, options);
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
            const beforeTextNoSpecialTokens = "some test text here";
            const afterTextNoSpecialTokens = this.detokenize(this.tokenize(beforeTextNoSpecialTokens, false, "trimLeadingSpace"), false);

            if (beforeTextNoSpecialTokens !== afterTextNoSpecialTokens)
                warnings.push(
                    `Using this model ${modelFilePathText} to tokenize text and then detokenize it resulted in a different text. ` +
                    "There might be an issue with the model or the tokenizer implementation. " +
                    "Using this model may not work as intended"
                );
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
    public async _getOrLoadLora(filePath: string) {
        const resolvedPath = path.resolve(process.cwd(), filePath);
        if (this._loraAdapters.has(resolvedPath))
            return this._loraAdapters.get(resolvedPath)!;

        return await withLock(this._loraAdapters, "modify", async () => {
            if (this._loraAdapters.has(resolvedPath))
                return this._loraAdapters.get(resolvedPath)!;

            const lora = new this._llama._bindings.AddonModelLora(this._model, resolvedPath);
            await this._model.loadLora(lora);
            this._loraAdapters.set(resolvedPath, lora);

            return lora;
        });
    }

    /** @internal */
    public async _removeLoraUsage(loraAdapters: Set<AddonModelLora>) {
        return await withLock(this._loraAdapters, "modify", async () => {
            await Promise.all(
                [...loraAdapters].map(async (lora) => {
                    lora.usages--;

                    if (lora.usages <= 0 && this._loraAdapters.get(lora.filePath) === lora) {
                        this._loraAdapters.delete(lora.filePath);
                        await lora.dispose();
                    }
                })
            );
        });
    }

    /** @internal */
    public static async _create(modelOptions: LlamaModelOptions, {
        _llama
    }: {
        _llama: Llama
    }) {
        const {loadSignal, defaultContextFlashAttention} = modelOptions;
        const useMmap = modelOptions.useMmap ?? defaultUseMmap;

        const fileInfo = await readGgufFileInfo(modelOptions.modelPath, {
            sourceType: "filesystem",
            signal: loadSignal
        });
        applyGgufMetadataOverrides(fileInfo, modelOptions.metadataOverrides);
        const ggufInsights = await GgufInsights.from(fileInfo, _llama);
        const flashAttentionSupported = ggufInsights.flashAttentionSupported;
        const resolvedDefaultContextFlashAttention = flashAttentionSupported
            ? (defaultContextFlashAttention ?? defaultContextFlashAttentionEnabled)
            : false;
        const gpuLayers = await ggufInsights.configurationResolver.resolveModelGpuLayers(modelOptions.gpuLayers, {
            ignoreMemorySafetyChecks: modelOptions.ignoreMemorySafetyChecks,
            defaultContextFlashAttention: resolvedDefaultContextFlashAttention
        });
        const resourceRequirementsEstimation = ggufInsights.estimateModelResourceRequirements({gpuLayers: gpuLayers});

        const model = new LlamaModel({...modelOptions, gpuLayers, useMmap}, {
            _fileInfo: fileInfo,
            _fileInsights: ggufInsights,
            _llama,
            _defaultContextFlashAttentionOptionEnabled: defaultContextFlashAttention ?? false,
            _flashAttentionSupported: flashAttentionSupported,
            _defaultContextFlashAttention: resolvedDefaultContextFlashAttention
        });
        const modelCreationVramReservation = modelOptions.ignoreMemorySafetyChecks
            ? null
            : _llama._vramOrchestrator.reserveMemory(resourceRequirementsEstimation.gpuVram);
        const modelCreationRamReservation = modelOptions.ignoreMemorySafetyChecks
            ? null
            : _llama._ramOrchestrator.reserveMemory(resourceRequirementsEstimation.cpuRam);
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

                throw loadSignal!.reason;
            } else if (!modelLoaded)
                throw new Error("Failed to load model");

            loadSignal?.removeEventListener("abort", onAbort);

            logWarnings(model.getWarnings());

            return model;
        } finally {
            loadSignal?.removeEventListener("abort", onAbort);
            modelCreationVramReservation?.dispose?.();
            modelCreationRamReservation?.dispose?.();
        }
    }
}

export class LlamaModelTokens {
    /** @internal */ private readonly _model: AddonModel;
    /** @internal */ private readonly _disposedState: DisposedState;
    /** @internal */ private _infillTokens?: LlamaModelInfillTokens;
    /** @internal */ private _bosToken?: Token;
    /** @internal */ private _eosToken?: Token;
    /** @internal */ private _eotToken?: Token;
    /** @internal */ private _clsToken?: Token;
    /** @internal */ private _sepToken?: Token;
    /** @internal */ private _nlToken?: Token;
    /** @internal */ private _bosString?: string;
    /** @internal */ private _eosString?: string;
    /** @internal */ private _eotString?: string;
    /** @internal */ private _clsString?: string;
    /** @internal */ private _sepString?: string;
    /** @internal */ private _nlString?: string;
    /** @internal */ private _shouldPrependBosToken?: boolean;
    /** @internal */ private _shouldAppendEosToken?: boolean;

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
     * @returns The EOT (End Of Turn) token.
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
     * @returns The CLS (Classification) token.
     */
    public get cls(): Token | null {
        this._ensureNotDisposed();

        if (this._clsToken == null)
            this._clsToken = this._model.clsToken();

        if (this._clsToken === -1)
            return null;

        return this._clsToken;
    }

    /**
     * @returns The SEP (Sentence Separator) token.
     */
    public get sep(): Token | null {
        this._ensureNotDisposed();

        if (this._sepToken == null)
            this._sepToken = this._model.sepToken();

        if (this._sepToken === -1)
            return null;

        return this._sepToken;
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
     * @returns The BOS (Beginning Of Sequence) token text representation.
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
     * @returns The EOS (End Of Sequence) token text representation.
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
     * @returns The EOT (End Of Turn) token text representation.
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

    /**
     * @returns The CLS (Classification) token text representation.
     */
    public get clsString(): string | null {
        this._ensureNotDisposed();

        const clsToken = this.cls;

        if (clsToken == null)
            return null;

        if (this._clsString == null)
            this._clsString = this._model.getTokenString(clsToken);

        return this._clsString;
    }

    /**
     * @returns The SEP (Sentence Separator) token text representation.
     */
    public get sepString(): string | null {
        this._ensureNotDisposed();

        const sepToken = this.sep;

        if (sepToken == null)
            return null;

        if (this._sepString == null)
            this._sepString = this._model.getTokenString(sepToken);

        return this._sepString;
    }

    /**
     * @returns The NL (New Line) token text representation.
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

    /**
     * @returns Whether we should append an EOS (End Of Sequence) token for evaluations with this model.
     */
    public get shouldAppendEosToken(): boolean {
        this._ensureNotDisposed();

        if (this._shouldAppendEosToken == null)
            this._shouldAppendEosToken = this.bos != null && this._model.shouldAppendEosToken();

        return this._shouldAppendEosToken;
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
    /** @internal */ private _prefixString?: string;
    /** @internal */ private _middleString?: string;
    /** @internal */ private _suffixString?: string;

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

function applyGgufMetadataOverrides(
    ggufFileInfo: GgufFileInfo,
    overrides?: OverridesObject<GgufMetadata, number | bigint | boolean | string>
) {
    function applyOverride(object: object, override?: object) {
        if (override == null || object == null)
            return;

        if (object instanceof Array || typeof object !== "object" || typeof override !== "object")
            return;

        for (const [key, value] of Object.entries(override)) {
            if (value instanceof Array || typeof value !== "object" || (
                typeof value === "object" && typeof (object as any)[key] !== "object"
            ))
                (object as any)[key] = value;
            else
                applyOverride((object as any)[key], value);
        }
    }

    applyOverride(ggufFileInfo.metadata, overrides);
}

function ggufMetadataOverridesToList(overrides?: OverridesObject<GgufMetadata, number | bigint | boolean | string>) {
    const maxStringLength = 127;
    const maxKeyLength = 127;

    const res: Array<[
        key: string,
        value: number | bigint | boolean | string,
        type: 0 | 1 | undefined
    ]> = [];

    function addItem(object: number | bigint | boolean | string | object, path: string[]) {
        if (object == null || object instanceof Array)
            return;

        if (typeof object !== "object") {
            if (typeof object === "string" && object.length > maxStringLength)
                throw new Error(`Metadata key "${path.join(".")}" override string value (${JSON.stringify(object)}) is longer than ${maxStringLength} characters`);

            const key = path.join(".");
            if (key.length > maxKeyLength)
                throw new Error(`Metadata key "${key}" override path is longer than ${maxKeyLength} characters`);

            let type: 0 | 1 | undefined = undefined;
            if (typeof object === "number") {
                if (typeof object === "bigint" || Number.isInteger(object))
                    type = 0;
                else
                    type = 1;
            }

            res.push([key, object, type]);
            return;
        }

        for (const [key, value] of Object.entries(object))
            addItem(value, [...path, key]);
    }

    addItem(overrides ?? {}, []);

    return res;
}

function disposeModelIfReferenced(modelRef: WeakRef<LlamaModel>) {
    const model = modelRef.deref();

    if (model != null)
        void model.dispose();
}

type DisposedState = {
    disposed: boolean
};
