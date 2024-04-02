import {Token, Tokenizer} from "../types.js";

export type LlamaTextClass = {
    <const V extends LlamaTextValue = LlamaTextValue, const V2 extends LlamaTextValue = LlamaTextValue>(
        strings: TemplateStringsArray | V | LlamaText<V> | readonly (LlamaText<V> | V)[],
        ...values: readonly (V | LlamaText<V> | V2 | LlamaText<V2> | number | boolean |
            readonly (LlamaText<V> | V | LlamaText<V2> | V2)[])[]
    ): LlamaText<V | V2>,
    fromJSON(json: LlamaTextJSON): LlamaText,
    compare(a: LlamaText, b: LlamaText): boolean
};

export type LlamaText<T extends LlamaTextValue = LlamaTextValue> = {
    <const V extends LlamaTextValue = LlamaTextValue, const V2 extends LlamaTextValue = LlamaTextValue>(
        strings: TemplateStringsArray | V | LlamaText | readonly (LlamaText | V)[],
        ...values: readonly (V | V2| LlamaText | number | boolean | readonly (LlamaText | V | V2)[])[]
    ): LlamaText<T | V>,
    readonly type: "LlamaText",
    readonly values: readonly T[],
    mapValues<V extends LlamaTextValue = LlamaTextValue>(mapper: (value: T) => V): LlamaText<V>,
    joinValues<V extends LlamaTextValue = LlamaTextValue>(separator: LlamaText<V> | V): LlamaText<T | V>,
    toString(): string,
    toJSON(): LlamaTextJSON,
    tokenize(tokenizer: Tokenizer): Token[],
    compare(other: LlamaText): boolean,
    trimStart(): LlamaText<T>,
    trimEnd(): LlamaText<T>,
    includes(value: LlamaText): boolean
};

export type LlamaTextValue = string | SpecialTokensText | SpecialToken;

export type LlamaTextJSON = Array<LlamaTextJSONValue>;
export type LlamaTextJSONValue = string | LlamaTextSpecialTokensTextJSON | LlamaTextSpecialTokenJSON;
export type LlamaTextSpecialTokensTextJSON = {type: "specialTokensText", value: string};
export type LlamaTextSpecialTokenJSON = {type: "specialToken", value: string};

export const LlamaText: LlamaTextClass = function LlamaText(
    strings: TemplateStringsArray | string | string[] | SpecialTokensText | SpecialToken | LlamaText | LlamaText[],
    ...values: (SpecialTokensText | SpecialToken | string | string[] | number | boolean | LlamaText | LlamaText[])[]
) {
    return createLlamaText(createHistoryFromStringsAndValues(strings, values));
} as LlamaTextClass;
LlamaText.fromJSON = function fromJSON(json: LlamaTextJSON) {
    return createLlamaText(
        json.map((value) => {
            if (typeof value === "string")
                return value;
            else if (SpecialToken.isSpecialTokenJSON(value))
                return SpecialToken.fromJSON(value);
            else if (SpecialTokensText.isSpecialTokensTextJSON(value))
                return SpecialTokensText.fromJSON(value);
            else {
                void (value satisfies never);
                throw new Error(`Unknown value type: ${value}`);
            }
        })
    );
};
LlamaText.compare = function compare(a: LlamaText, b: LlamaText) {
    if (!isLlamaText(a) || !isLlamaText(b))
        return false;

    if (a.values.length !== b.values.length)
        return false;

    for (let i = 0; i < a.values.length; i++) {
        if (!compareLlamaTextValues(a.values[i], b.values[i]))
            return false;
    }

    return true;
};

export class SpecialTokensText {
    public readonly value: string;

    public constructor(value: string) {
        this.value = value;
    }

    public toString() {
        return this.value;
    }

    public tokenize(tokenizer: Tokenizer, trimLeadingSpace: boolean = false): Token[] {
        return tokenizer(this.value, true, trimLeadingSpace ? "trimLeadingSpace" : undefined);
    }

    public toJSON(): LlamaTextSpecialTokensTextJSON {
        return {
            type: "specialTokensText",
            value: this.value
        };
    }

    public static fromJSON(json: LlamaTextSpecialTokensTextJSON): SpecialTokensText {
        if (SpecialTokensText.isSpecialTokensTextJSON(json))
            return new SpecialTokensText(json.value);

        throw new Error(`Invalid JSON for SpecialTokensText: ${JSON.stringify(json)}`);
    }

    public static isSpecialTokensTextJSON(value: LlamaTextJSONValue): value is LlamaTextSpecialTokensTextJSON {
        return value != null && typeof value === "object" && value.type === "specialTokensText";
    }

    /**
     * Wraps the value with a `SpecialTokensText` only if `shouldWrap` is true
     */
    public static wrapIf(shouldWrap: boolean, value: string): SpecialTokensText | string {
        if (shouldWrap)
            return new SpecialTokensText(value);
        else
            return value;
    }
}

export type BuiltinSpecialTokenValue = "BOS" | "EOS" | "NL";
export class SpecialToken {
    public readonly value: BuiltinSpecialTokenValue;

    public constructor(value: BuiltinSpecialTokenValue) {
        this.value = value;
    }

    public toString() {
        return this.value;
    }

    public tokenize(tokenizer: Tokenizer): Token[] {
        return tokenizer(this.value, "builtin");
    }

    public toJSON(): LlamaTextSpecialTokenJSON {
        return {
            type: "specialToken",
            value: this.value
        };
    }

    public static fromJSON(json: LlamaTextSpecialTokenJSON): SpecialToken {
        if (SpecialToken.isSpecialTokenJSON(json))
            return new SpecialToken(json.value as BuiltinSpecialTokenValue);

        throw new Error(`Invalid JSON for SpecialToken: ${JSON.stringify(json)}`);
    }

    public static isSpecialTokenJSON(value: LlamaTextJSONValue): value is LlamaTextSpecialTokenJSON {
        return value != null && typeof value === "object" && value.type === "specialToken";
    }
}

export function isLlamaText(value: unknown): value is LlamaText {
    return typeof value === "function" && "type" in value && value.type === "LlamaText";
}

export function tokenizeText(text: string | LlamaText, tokenizer: Tokenizer) {
    if (typeof text === "string")
        return tokenizer(text, false);
    else
        return text.tokenize(tokenizer);
}

type LlamaTextInputValue<V extends LlamaTextValue = LlamaTextValue> =
    LlamaTextValue | LlamaText<V> | number | boolean | (LlamaText<V> | LlamaTextValue)[];

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

const LlamaTextPrototypeFunctions: Partial<LlamaText> = {
    mapValues: function mapValues(this: LlamaText, mapper) {
        return createLlamaText(
            this.values.map(mapper)
        );
    } as LlamaText["mapValues"],
    joinValues(this: LlamaText, separator: LlamaText | LlamaTextValue): LlamaText {
        const newValues: LlamaTextValue[] = [];

        for (let i = 0; i < this.values.length; i++) {
            newValues.push(this.values[i]);

            if (i !== this.values.length - 1) {
                if (isLlamaText(separator))
                    newValues.push(...separator.values);
                else
                    newValues.push(separator);
            }
        }

        return createLlamaText(newValues);
    },
    toString(this: LlamaText) {
        return this.values
            .map((value) => {
                if (value instanceof SpecialToken)
                    return value.toString();
                else if (value instanceof SpecialTokensText)
                    return value.toString();
                else
                    return value;
            })
            .join("");
    },
    tokenize(this: LlamaText, tokenizer): Token[] {
        let textToTokenize = "";
        const res: Token[] = [];
        const hasContent = () => (res.length > 0 || textToTokenize.length > 0);

        for (const value of this.values) {
            if (value instanceof SpecialToken) {
                res.push(...tokenizer(textToTokenize, false, hasContent() ? "trimLeadingSpace" : undefined), ...value.tokenize(tokenizer));
                textToTokenize = "";
            } else if (value instanceof SpecialTokensText) {
                res.push(...tokenizer(textToTokenize, false, hasContent() ? "trimLeadingSpace" : undefined), ...value.tokenize(tokenizer, hasContent()));
                textToTokenize = "";
            } else
                textToTokenize += value;
        }

        res.push(...tokenizer(textToTokenize, false, hasContent() ? "trimLeadingSpace" : undefined));

        return res;
    },
    toJSON(this: LlamaText) {
        return this.values.map((value) => {
            if (value instanceof SpecialToken)
                return value.toJSON() satisfies LlamaTextJSONValue;
            else if (value instanceof SpecialTokensText)
                return value.toJSON() satisfies LlamaTextJSONValue;
            else
                return value satisfies LlamaTextJSONValue;
        });
    },
    compare(this: LlamaText, other: LlamaText) {
        return LlamaText.compare(this, other);
    },
    trimStart(this: LlamaText) {
        const newValues = this.values.slice();

        while (newValues.length > 0) {
            const firstValue = newValues[0];

            if (firstValue instanceof SpecialToken)
                break;

            if (firstValue instanceof SpecialTokensText) {
                const newValue = firstValue.value.trimStart();
                if (newValue === "") {
                    newValues.shift();
                    continue;
                } else if (newValue !== firstValue.value) {
                    newValues[0] = new SpecialTokensText(newValue);
                    break;
                }

                break;
            } else if (typeof firstValue === "string") {
                const newValue = firstValue.trimStart();
                if (newValue === "") {
                    newValues.shift();
                    continue;
                } else if (newValue !== firstValue) {
                    newValues[0] = newValue;
                    break;
                }

                break;
            } else
                void (firstValue satisfies never);
        }

        return createLlamaText(newValues);
    },
    trimEnd(this: LlamaText) {
        const newValues = this.values.slice();

        while (newValues.length > 0) {
            const lastValue = newValues[newValues.length - 1];

            if (lastValue instanceof SpecialToken)
                break;

            if (lastValue instanceof SpecialTokensText) {
                const newValue = lastValue.value.trimEnd();
                if (newValue === "") {
                    newValues.pop();
                    continue;
                } else if (newValue !== lastValue.value) {
                    newValues[newValues.length - 1] = new SpecialTokensText(newValue);
                    break;
                }

                break;
            } else if (typeof lastValue === "string") {
                const newValue = lastValue.trimEnd();
                if (newValue === "") {
                    newValues.pop();
                    continue;
                } else if (newValue !== lastValue) {
                    newValues[newValues.length - 1] = newValue;
                    break;
                }

                break;
            } else
                void (lastValue satisfies never);
        }

        return createLlamaText(newValues);
    },
    includes(this: LlamaText, value: LlamaText) {
        for (let i = 0; i < this.values.length; i++) {
            if (compareLlamaTextValues(this.values[i], value.values[0])) {
                let j = 1;
                for (; j < value.values.length; j++) {
                    if (!compareLlamaTextValues(this.values[i + j], value.values[j]))
                        break;
                }

                if (j === value.values.length)
                    return true;
            }
        }

        return false;
    }
};

function createLlamaText(history: readonly LlamaTextValue[]): LlamaText {
    const llamaText: Mutable<LlamaText> = function LlamaText<const V extends LlamaTextValue = LlamaTextValue>(
        strings: TemplateStringsArray | V | LlamaText<V> | readonly (LlamaText<V> | V)[],
        ...values: LlamaTextInputValue<V>[]
    ) {
        return createLlamaText(
            llamaText.values.concat(
                createHistoryFromStringsAndValues(strings, values)
            )
        );
    } as LlamaText;

    Object.defineProperties(llamaText, {
        ["type" satisfies keyof LlamaText]: {
            value: "LlamaText" satisfies LlamaText["type"],
            writable: false,
            configurable: false,
            enumerable: true
        },
        ["values" satisfies keyof LlamaText]: {
            value: Object.freeze(history.slice()) satisfies LlamaText["values"],
            writable: false,
            configurable: false,
            enumerable: true
        },
        ["mapValues" satisfies keyof LlamaText]: {
            value: LlamaTextPrototypeFunctions.mapValues,
            writable: false,
            configurable: false,
            enumerable: false
        },
        ["joinValues" satisfies keyof LlamaText]: {
            value: LlamaTextPrototypeFunctions.joinValues,
            writable: false,
            configurable: false,
            enumerable: false
        },
        ["toString" satisfies keyof LlamaText]: {
            value: LlamaTextPrototypeFunctions.toString,
            writable: false,
            configurable: false,
            enumerable: false
        },
        ["tokenize" satisfies keyof LlamaText]: {
            value: LlamaTextPrototypeFunctions.tokenize,
            writable: false,
            configurable: false,
            enumerable: false
        },
        ["toJSON" satisfies keyof LlamaText]: {
            value: LlamaTextPrototypeFunctions.toJSON,
            writable: false,
            configurable: false,
            enumerable: false
        },
        ["compare" satisfies keyof LlamaText]: {
            value: LlamaTextPrototypeFunctions.compare,
            writable: false,
            configurable: false,
            enumerable: false
        },
        ["trimStart" satisfies keyof LlamaText]: {
            value: LlamaTextPrototypeFunctions.trimStart,
            writable: false,
            configurable: false,
            enumerable: false
        },
        ["trimEnd" satisfies keyof LlamaText]: {
            value: LlamaTextPrototypeFunctions.trimEnd,
            writable: false,
            configurable: false,
            enumerable: false
        },
        ["includes" satisfies keyof LlamaText]: {
            value: LlamaTextPrototypeFunctions.includes,
            writable: false,
            configurable: false,
            enumerable: false
        }
    });

    return llamaText as LlamaText;
}

function createHistoryFromStringsAndValues<const V extends LlamaTextValue = LlamaTextValue>(
    strings: TemplateStringsArray | V | LlamaText<V> | readonly (LlamaText<V> | V)[],
    values: LlamaTextInputValue<V>[]
): Array<LlamaTextValue> {
    function addItemToRes(res: Array<LlamaTextValue>, item: LlamaTextInputValue) {
        if (item === undefined || item === "" || (item instanceof SpecialTokensText && item.value === ""))
            return res;
        else if (typeof item === "string" || item instanceof SpecialTokensText || item instanceof SpecialToken)
            return res.concat([item]);
        else if (isLlamaText(item))
            return res.concat(item.values);
        else if (item instanceof Array) {
            return res.concat(
                item.reduce((res, value) => {
                    if (isLlamaText(value))
                        return res.concat(value.values);
                    else if (value === "" || (value instanceof SpecialTokensText && value.value === ""))
                        return res;

                    return res.concat([value]);
                }, [] as Array<LlamaTextValue>)
            );
        } else if (typeof item === "number" || typeof item === "boolean")
            return res.concat([String(item)]);

        return item satisfies never;
    }

    function squashAdjacentItems(res: Array<LlamaTextValue>, item: LlamaTextValue) {
        if (res.length === 0) {
            res.push(item);
            return res;
        }

        const lastItem = res[res.length - 1];

        if (lastItem instanceof SpecialToken || item instanceof SpecialToken) {
            res.push(item);
            return res;
        }

        if (typeof lastItem === "string" && typeof item === "string") {
            res[res.length - 1] += item;
            return res;
        } else if (lastItem instanceof SpecialTokensText && item instanceof SpecialTokensText) {
            res[res.length - 1] = new SpecialTokensText(lastItem.value + item.value);
            return res;
        }

        res.push(item);
        return res;
    }

    if (!isTemplateStringsArray(strings)) {
        return ([strings] as LlamaTextInputValue[])
            .concat(values)
            .reduce(addItemToRes, [])
            .reduce(squashAdjacentItems, []);
    }


    let res: Array<LlamaTextValue> = [];

    for (let i = 0; i < strings.length; i++) {
        res.push(strings[i]);

        if (i < values.length)
            res = addItemToRes(res, values[i]);
    }

    return res.reduce(squashAdjacentItems, []);
}

function isTemplateStringsArray(value: unknown): value is TemplateStringsArray {
    return value instanceof Array && (value as any as TemplateStringsArray).raw instanceof Array &&
        value.length === (value as any as TemplateStringsArray).raw.length;
}

function compareLlamaTextValues(a: LlamaTextValue, b: LlamaTextValue) {
    if (a instanceof SpecialTokensText && b instanceof SpecialTokensText)
        return a.value === b.value;
    else if (a instanceof SpecialToken && b instanceof SpecialToken)
        return a.value === b.value;
    else if (a !== a)
        return false;

    return true;
}
