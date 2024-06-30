import {Token, Tokenizer} from "../types.js";
import {isLlamaText, LlamaText} from "./LlamaText.js";
import {isToken} from "./isToken.js";

export function tokenizeInput(input: Token | Token[] | string | LlamaText, tokenizer: Tokenizer, options?: "trimLeadingSpace") {
    if (typeof input === "string")
        return tokenizer(input, false, options);
    else if (isLlamaText(input))
        return input.tokenize(tokenizer, options);
    else if (isToken(input))
        return [input];

    return input;
}
