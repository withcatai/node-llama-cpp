import {Token, Tokenizer} from "../types.js";

export type LlamaTextClass = {
    <const V extends LlamaTextValue = LlamaTextValue, const V2 extends LlamaTextValue = LlamaTextValue>(
        strings: TemplateStringsArray | V | LlamaText<V> | readonly (LlamaText<V> | V)[],
        ...values: readonly (V | LlamaText<V> | V2 | LlamaText<V2> | number | boolean |
            readonly (LlamaText<V> | V | LlamaText<V2> | V2)[])[]
    ): LlamaText<V | V2>,
    fromJSON(json: LlamaTextJSON): LlamaText
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
    tokenize(tokenizer: Tokenizer): Token[]
};

export type LlamaTextValue = string | SpecialToken;

export type LlamaTextJSON = Array<LlamaTextJSONValue>;
export type LlamaTextJSONValue = string | LlamaTextSpecialTokenJSON;
export type LlamaTextSpecialTokenJSON = {type: "specialToken", value: string, builtin?: true};

export const LlamaText: LlamaTextClass = function LlamaText(
    strings: TemplateStringsArray | string | string[] | SpecialToken | LlamaText | LlamaText[],
    ...values: (SpecialToken | string | string[] | number | boolean | LlamaText | LlamaText[])[]
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
            else {
                void (value satisfies never);
                throw new Error(`Unknown value type: ${value}`);
            }
        })
    );
};

export class SpecialToken {
    public readonly value: string;

    public constructor(value: string) {
        this.value = value;
    }

    public toString() {
        return this.value;
    }

    public tokenize(tokenizer: Tokenizer): Token[] {
        return tokenizer(this.value, true);
    }

    public toJSON(): LlamaTextSpecialTokenJSON {
        return {
            type: "specialToken",
            value: this.value
        };
    }

    public static fromJSON(json: LlamaTextSpecialTokenJSON): SpecialToken {
        if (json.builtin)
            return new BuiltinSpecialToken(json.value as BuiltinSpecialTokenValue);
        else
            return new SpecialToken(json.value);
    }

    public static isSpecialTokenJSON(value: LlamaTextJSONValue): value is LlamaTextSpecialTokenJSON {
        return value != null && typeof value === "object" && value.type === "specialToken";
    }
}

export type BuiltinSpecialTokenValue = "BOS" | "EOS" | "NL";
export class BuiltinSpecialToken extends SpecialToken {
    public override readonly value: BuiltinSpecialTokenValue;

    public constructor(value: BuiltinSpecialTokenValue) {
        super(value);

        this.value = value;
    }

    public override tokenize(tokenizer: Tokenizer): Token[] {
        return tokenizer(this.value, "builtin");
    }

    public override toJSON(): LlamaTextSpecialTokenJSON {
        return {
            type: "specialToken",
            value: this.value,
            builtin: true
        };
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
                else
                    return value;
            })
            .join("");
    },
    tokenize(this: LlamaText, tokenizer): Token[] {
        let textToTokenize = "";
        const res: Token[] = [];

        for (const value of this.values) {
            if (value instanceof SpecialToken) {
                res.push(...tokenizer(textToTokenize, false), ...value.tokenize(tokenizer));
                textToTokenize = "";
            } else
                textToTokenize += value;
        }

        res.push(...tokenizer(textToTokenize, false));

        return res;
    },
    toJSON(this: LlamaText) {
        return this.values.map((value) => {
            if (value instanceof SpecialToken)
                return {type: "specialToken", value: value.value} satisfies LlamaTextJSONValue;
            else
                return value satisfies LlamaTextJSONValue;
        });
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
        }
    });

    return llamaText as LlamaText;
}

function createHistoryFromStringsAndValues<const V extends LlamaTextValue = LlamaTextValue>(
    strings: TemplateStringsArray | V | LlamaText<V> | readonly (LlamaText<V> | V)[],
    values: LlamaTextInputValue<V>[]
): Array<LlamaTextValue> {
    function addItemToRes(res: Array<LlamaTextValue>, item: LlamaTextInputValue) {
        if (item === undefined || item === "")
            return res;
        else if (typeof item === "string" || item instanceof SpecialToken)
            return res.concat([item]);
        else if (isLlamaText(item))
            return res.concat(item.values);
        else if (item instanceof Array) {
            return res.concat(
                item.reduce((res, value) => {
                    if (isLlamaText(value))
                        return res.concat(value.values);
                    else if (value === "")
                        return res;

                    return res.concat([value]);
                }, [] as Array<LlamaTextValue>)
            );
        } else if (typeof item === "number" || typeof item === "boolean")
            return res.concat([String(item)]);

        return item satisfies never;
    }

    if (!isTemplateStringsArray(strings)) {
        return ([strings] as LlamaTextInputValue[])
            .concat(values)
            .reduce(addItemToRes, []);
    }


    let res: Array<LlamaTextValue> = [];

    for (let i = 0; i < strings.length; i++) {
        res.push(strings[i]);

        if (i < values.length)
            res = addItemToRes(res, values[i]);
    }

    return res;
}

function isTemplateStringsArray(value: unknown): value is TemplateStringsArray {
    return value instanceof Array && (value as any as TemplateStringsArray).raw instanceof Array &&
        value.length === (value as any as TemplateStringsArray).raw.length;
}
