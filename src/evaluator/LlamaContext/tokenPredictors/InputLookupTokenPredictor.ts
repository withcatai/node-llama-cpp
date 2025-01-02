import {DisposedError} from "lifecycle-utils";
import {Token} from "../../../types.js";
import {pushAll} from "../../../utils/pushAll.js";
import {TokenPredictor} from "../TokenPredictor.js";

const defaultPatternMinLength = 1;
const defaultPatternMaxLength = 0;
const defaultPredictionMinLength = 1;
const defaultPredictionMaxLength = 3;

/**
 * Attempts to find the last few generated tokens in the input (prompt) tokens to predict the next tokens.
 *
 * This is useful in input-grounded tasks (when the model frequently repeats some of the input tokens in the output,
 * such as in text summarization or modifying code).
 *
 * This works in all completion classes, including `LlamaChatSession`, `LlamaChat`, and `LlamaCompletion`.
 *
 * Based on https://github.com/apoorvumang/prompt-lookup-decoding.
 * @see [Using Token Predictors: Input Lookup Token Predictor](https://node-llama-cpp.withcat.ai/guide/token-prediction#input-lookup)
 */
export class InputLookupTokenPredictor extends TokenPredictor {
    /** @internal */ private readonly _patternMinLength: number;
    /** @internal */ private readonly _patternMaxLength: number;
    /** @internal */ private readonly _predictionMinLength: number;
    /** @internal */ private readonly _predictionMaxLength: number;
    /** @internal */ private _lastPredictionMatchStartIndex: number | undefined = undefined;
    /** @internal */ private _lastPredictionMatchLength: number | undefined = undefined;
    /** @internal */ private _stateTokens: Token[] = [];
    /** @internal */ private _inputTokens: Token[] = [];
    /** @internal */ private _disposed = false;

    public constructor(options: {
        patternLength?: {
            /**
             * Min pattern length to look for in the input tokens.
             *
             * Defaults to `1`.
             */
            min?: number,

            /**
             * Max pattern length to look for in the input tokens.
             *
             * Set to `0` to disable the max pattern size.
             *
             * Defaults to `0`.
             */
            max?: number
        },

        predictionLength?: {
            /**
             * Minimum number of tokens to predict.
             *
             * Defaults to `1`.
             */
            min?: number,

            /**
             * Maximum number of tokens to predict.
             *
             * Defaults to `3`.
             */
            max?: number
        }
    } = {}) {
        super();

        this._patternMinLength = Math.floor(Math.max(1, options?.patternLength?.min ?? defaultPatternMinLength));
        this._patternMaxLength = Math.floor(
            Math.max(
                0,
                Math.max(this._patternMinLength, options?.patternLength?.max ?? defaultPatternMaxLength)
            )
        );
        this._predictionMinLength = Math.floor(Math.max(1, options.predictionLength?.min ?? defaultPredictionMinLength));
        this._predictionMaxLength = Math.floor(
            Math.max(
                this._patternMinLength,
                options.predictionLength?.max ?? defaultPredictionMaxLength
            )
        );
    }

    public get patternMinLength() {
        return this._patternMinLength;
    }

    public get patternMaxLength() {
        return this._patternMaxLength;
    }

    public get predictionMinLength() {
        return this._predictionMinLength;
    }

    public get predictionMaxLength() {
        return this._predictionMaxLength;
    }

    public reset({stateTokens}: {
        stateTokens: Token[]
    }) {
        this._stateTokens = stateTokens.slice();
        delete this._lastPredictionMatchStartIndex;
        delete this._lastPredictionMatchLength;
    }

    public override updateInputTokens(tokens: Token[]) {
        this._inputTokens = tokens.slice();
        delete this._lastPredictionMatchStartIndex;
        delete this._lastPredictionMatchLength;
    }

    public pushTokens(tokens: Token[]) {
        pushAll(this._stateTokens, tokens);

        if (this._lastPredictionMatchStartIndex != null && this._lastPredictionMatchLength != null) {
            this._lastPredictionMatchLength += tokens.length;
        }
    }

    public predictTokens() {
        if (this._disposed)
            throw new DisposedError();

        if (this._inputTokens.length === 0 || this._stateTokens.length === 0)
            return [];

        if (this._lastPredictionMatchStartIndex != null && this._lastPredictionMatchLength != null) {
            for (
                let p = this._lastPredictionMatchStartIndex + this._lastPredictionMatchLength - 1,
                    s = this._stateTokens.length - 1;
                p >= this._lastPredictionMatchStartIndex && s >= 0;
                p--, s--
            ) {
                if (this._inputTokens[p] !== this._stateTokens[s]) {
                    delete this._lastPredictionMatchStartIndex;
                    delete this._lastPredictionMatchLength;
                    break;
                }
            }

            if (this._lastPredictionMatchStartIndex != null && this._lastPredictionMatchLength != null) {
                const predictionEndIndex = this._lastPredictionMatchStartIndex + this._lastPredictionMatchLength;
                if (predictionEndIndex < this._inputTokens.length) {
                    return this._inputTokens.slice(predictionEndIndex, predictionEndIndex + this._predictionMaxLength);
                }
            }
        }

        const [matchStartIndex, matchLength] = this._findLongestPatternIndex(this._inputTokens, this._stateTokens);
        if (matchStartIndex == null || matchLength == null)
            return [];

        const predictionEndIndex = matchStartIndex + matchLength;
        const res = this._inputTokens.slice(predictionEndIndex, predictionEndIndex + this._predictionMaxLength);

        if (res.length >= this._predictionMinLength) {
            this._lastPredictionMatchStartIndex = matchStartIndex;
            this._lastPredictionMatchLength = matchLength;
            return res;
        }

        return [];
    }

    public override dispose() {
        this._disposed = true;
        this._stateTokens = [];
        this._inputTokens = [];
        delete this._lastPredictionMatchStartIndex;
        delete this._lastPredictionMatchLength;
    }

    /** @internal */
    private _findLongestPatternIndex(findIn: Token[], lookupPattern: Token[]): [index: number, length: number] | [] {
        const checkIndexes: number[] = [];
        let bestIndex = -1;
        let bestIndexDiff = -1;

        for (let i = findIn.length - this._predictionMinLength; i >= 0; i--) {
            const token = findIn[i];

            for (let j = checkIndexes.length - 1; j >= 0; j--) {
                const startIndex = checkIndexes[j]!;
                const indexDiff = startIndex - i;
                if (lookupPattern[lookupPattern.length - 1 - indexDiff] !== token || (
                    this._patternMaxLength > 0 && indexDiff >= this._patternMaxLength
                )) {
                    checkIndexes.splice(j, 1);

                    if (indexDiff >= this._patternMinLength && indexDiff >= bestIndexDiff) {
                        bestIndex = startIndex;
                        bestIndexDiff = indexDiff;
                    }
                }
            }

            if (token === lookupPattern[lookupPattern.length - 1])
                checkIndexes.unshift(i);
        }

        for (let j = checkIndexes.length - 1; j >= 0; j--) {
            const startIndex = checkIndexes[j]!;
            const indexDiff = startIndex + 1;
            checkIndexes.splice(j, 1);

            if (indexDiff >= this._patternMinLength && indexDiff >= bestIndexDiff) {
                bestIndex = startIndex;
                bestIndexDiff = indexDiff;
            }
        }

        if (bestIndex >= 0)
            return [bestIndex - (bestIndexDiff - 1), bestIndexDiff];

        return [];
    }
}
