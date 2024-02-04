import process from "process";
import path from "path";
import {DisposedError, EventRelay} from "lifecycle-utils";
import {removeNullFields} from "../utils/removeNullFields.js";
import {Token} from "../types.js";
import {ModelTypeDescription, AddonModel} from "../utils/getBin.js";
import {Llama} from "../llamaBin/Llama.js";
import type {BuiltinSpecialTokenValue} from "../utils/LlamaText.js";


export type LlamaModelOptions = {
    llama: Llama,

    /** path to the model on the filesystem */
    modelPath: string,

    /** number of layers to store in VRAM */
    gpuLayers?: number,

    /** only load the vocabulary, no weights */
    vocabOnly?: boolean,

    /** use mmap if possible */
    useMmap?: boolean,

    /** force system to keep model in RAM */
    useMlock?: boolean
};

export class LlamaModel {
    /** @internal */ public readonly _llama: Llama;
    /** @internal */ public readonly _model: AddonModel;
    /** @internal */ private readonly _tokens: LlamaModelTokens;
    /** @internal */ private readonly _filename?: string;
    /** @internal */ private readonly _disposedState: DisposedState = {disposed: false};
    /** @internal */ private _typeDescription?: ModelTypeDescription;
    /** @internal */ private _trainContextSize?: number;

    public readonly onDispose = new EventRelay<void>();

    /**
     * > options source:
     * > [github:ggerganov/llama.cpp/llama.h](
     * > https://github.com/ggerganov/llama.cpp/blob/05816027d649f977468fc804cdb54e99eac246d1/llama.h#L161) (`struct llama_model_params`)
     * @param options
     * @param options.modelPath - path to the model on the filesystem
     * @param [options.gpuLayers] - number of layers to store in VRAM
     * @param [options.vocabOnly] - only load the vocabulary, no weights
     * @param [options.useMmap] - use mmap if possible
     * @param [options.useMlock] - force system to keep model in RAM
     */
    public constructor({
        llama, modelPath, gpuLayers, vocabOnly, useMmap, useMlock
    }: LlamaModelOptions) {
        this._llama = llama;
        this._model = new this._llama._bindings.AddonModel(path.resolve(process.cwd(), modelPath), removeNullFields({
            gpuLayers,
            vocabOnly,
            useMmap,
            useMlock
        }));
        this._tokens = LlamaModelTokens._create(this._model, this._disposedState);
        this._filename = path.basename(modelPath);

        this.tokenize = this.tokenize.bind(this);
        this.detokenize = this.detokenize.bind(this);
    }

    public dispose() {
        if (this._disposedState.disposed)
            return;

        this.onDispose.dispatchEvent();
        this._model.dispose();
        this._disposedState.disposed = true;
    }

    /** @hidden */
    public [Symbol.dispose]() {
        this.dispose();
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

    /**
     * Transform text into tokens that can be fed to the model
     * @param text - the text to tokenize
     * @param [specialTokens] - if set to true, text that correspond to special tokens will be tokenized to those tokens.
     * For example, `<s>` will be tokenized to the BOS token if `specialTokens` is set to `true`,
     * otherwise it will be tokenized to tokens that corresponds to the plaintext `<s>` string.
     */
    public tokenize(text: string, specialTokens?: boolean): Token[];
    public tokenize(text: BuiltinSpecialTokenValue, specialTokens: "builtin"): Token[];
    public tokenize(text: string, specialTokens: boolean | "builtin" = false): Token[] {
        this._ensureNotDisposed();

        if (text === "")
            return [];

        if (specialTokens === "builtin") {
            const builtinToken = text as BuiltinSpecialTokenValue;

            switch (builtinToken) {
                case "BOS": return this.tokens.bos == null ? [] : [this.tokens.bos];
                case "EOS": return this.tokens.eos == null ? [] : [this.tokens.eos];
                case "NL": return this.tokens.nl == null ? [] : [this.tokens.nl];
            }

            void (builtinToken satisfies never);
            throw new Error(`Unknown builtin special token: ${builtinToken}`);
        }

        return Array.from(this._model.tokenize(text, specialTokens)) as Token[];
    }

    /** Transform tokens into text */
    public detokenize(tokens: readonly Token[]): string {
        this._ensureNotDisposed();

        if (tokens.length === 0)
            return "";

        return this._model.detokenize(Uint32Array.from(tokens));
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

    /** @internal */
    private _ensureNotDisposed() {
        if (this._disposedState.disposed)
            throw new DisposedError();
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
            this._prefixToken = this._model.prefixToken();

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
            this._middleToken = this._model.middleToken();

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
            this._suffixToken = this._model.suffixToken();

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
    public static _create(model: AddonModel, disposedState: DisposedState) {
        return new LlamaModelInfillTokens(model, disposedState);
    }
}

type DisposedState = {
    disposed: boolean
};
