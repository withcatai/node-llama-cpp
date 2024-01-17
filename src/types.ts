import {GbnfJsonSchema, GbnfJsonSchemaToType} from "./utils/gbnfJson/types.js";
import {BuiltinSpecialTokenValue} from "./utils/LlamaText.js";

export type Token = number & {
    __token: never;
};

export type Tokenizer = {
    tokenize(text: string, specialTokens?: boolean): Token[];
    tokenize(text: BuiltinSpecialTokenValue, specialTokens: "builtin"): Token[];
}["tokenize"];


export type ChatHistoryItem = ChatSystemMessage | ChatUserMessage | ChatModelResponse;

export type ChatSystemMessage = {
    type: "system",
    text: string
};
export type ChatUserMessage = {
    type: "user",
    text: string
};
export type ChatModelResponse = {
    type: "model",
    response: (string | ChatModelFunctionCall)[]
};
export type ChatModelFunctionCall = {
    type: "functionCall",
    name: string,
    description?: string,
    params: any,
    result: any,
    raw?: string
};

export type ChatModelFunctions = {
    readonly [name: string]: {
        readonly description?: string,
        readonly params?: GbnfJsonSchema | undefined | null
    }
};

export type ChatSessionModelFunctions = {
    readonly [name: string]: ChatSessionModelFunction<any>
};

export type ChatSessionModelFunction<Params extends GbnfJsonSchema | undefined = GbnfJsonSchema | undefined> = {
    readonly description?: string,
    readonly params?: Params,
    readonly handler: (params: GbnfJsonSchemaToType<Params>) => any
};

export function isChatModelResponseFunctionCall(item: ChatModelResponse["response"][number]): item is ChatModelFunctionCall {
    if (typeof item === "string")
        return false;

    return item.type === "functionCall";
}
