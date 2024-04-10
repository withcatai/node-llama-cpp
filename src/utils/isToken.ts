import {Token} from "../types.js";

export function isToken(token: any): token is Token {
    return typeof token === "number";
}
