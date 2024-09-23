import isUnicodeSupported from "is-unicode-supported";

const unicodeSupported = isUnicodeSupported();

export const maxRecentDetokenizerTokens = 3;
export const UNKNOWN_UNICODE_CHAR = "\ufffd";
export const clockChar = unicodeSupported
    ? "\u25f7"
    : "+";
export const arrowChar = unicodeSupported
    ? "\u276f"
    : ">";
