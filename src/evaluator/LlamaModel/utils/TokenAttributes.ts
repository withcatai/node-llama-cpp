import {Token} from "../../../types.js";

// updated against `enum llama_token_attr` from `llama.h`
export const enum TokenAttribute {
    undefined = 0,
    unknown = 1 << 0,
    unused = 1 << 1,
    normal = 1 << 2,
    control = 1 << 3, // SPECIAL
    userDefined = 1 << 4,
    byte = 1 << 5,
    normalized = 1 << 6,
    lstrip = 1 << 7,
    rstrip = 1 << 8,
    singleWord = 1 << 9
}

export class TokenAttributes {
    public readonly token: Token;
    /** @internal */ private readonly _attributes: TokenAttribute;

    private constructor(token: Token, attributes: TokenAttribute) {
        this.token = token;
        this._attributes = attributes;
    }

    public get undefined() {
        return this._attributes === TokenAttribute.undefined;
    }

    public get unknown() {
        return this._hasAttribute(TokenAttribute.unknown);
    }

    public get unused() {
        return this._hasAttribute(TokenAttribute.unused);
    }

    public get normal() {
        return this._hasAttribute(TokenAttribute.normal);
    }

    public get control() {
        return this._hasAttribute(TokenAttribute.control);
    }

    public get userDefined() {
        return this._hasAttribute(TokenAttribute.userDefined);
    }

    public get byte() {
        return this._hasAttribute(TokenAttribute.byte);
    }

    public get normalized() {
        return this._hasAttribute(TokenAttribute.normalized);
    }

    public get lstrip() {
        return this._hasAttribute(TokenAttribute.lstrip);
    }

    public get rstrip() {
        return this._hasAttribute(TokenAttribute.rstrip);
    }

    public get singleWord() {
        return this._hasAttribute(TokenAttribute.singleWord);
    }

    /** @internal */
    private _hasAttribute(attribute: TokenAttribute) {
        return (this._attributes & attribute) === attribute;
    }

    /** @internal */
    public static _create(token: Token, attributes: TokenAttribute) {
        return new TokenAttributes(token, attributes);
    }
}
