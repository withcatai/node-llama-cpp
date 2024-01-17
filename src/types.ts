import {BuiltinSpecialTokenValue} from "./utils/LlamaText.js";
export type Token = number & {
    __token: never;
};

export type ConversationInteraction = {
    prompt: string,
    response: string
};

export type Tokenizer = {
    tokenize(text: string, specialTokens?: boolean): Token[];
    tokenize(text: BuiltinSpecialTokenValue, specialTokens: "builtin"): Token[];
}["tokenize"];