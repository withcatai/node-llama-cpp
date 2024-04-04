import {Token, Tokenizer} from "../types.js";
import {isLlamaText, LlamaText} from "./LlamaText.js";

export function tokenizeInput(input: Token[] | string | LlamaText, tokenizer: Tokenizer, options?: "trimLeadingSpace") {
    if (typeof input === "string")
        return tokenizer(input, false, options);
    else if (isLlamaText(input))
        return input.tokenize(tokenizer, options);

    return input;
}
