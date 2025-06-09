import {GbnfJsonSchema, GbnfJsonSchemaToType} from "./utils/gbnfJson/types.js";
import {LlamaText, BuiltinSpecialTokenValue, LlamaTextJSON} from "./utils/LlamaText.js";
import type {GgufFileInfo} from "./gguf/types/GgufFileInfoTypes.js";

export type Token = number & {
    __token: never
};

export type Detokenizer = {
    detokenize(tokens: readonly Token[], specialTokens?: boolean, lastTokens?: readonly Token[]): string
}["detokenize"];
export type Tokenizer = {
    tokenize(text: string, specialTokens?: boolean, options?: "trimLeadingSpace"): Token[],
    tokenize(text: BuiltinSpecialTokenValue, specialTokens: "builtin"): Token[]
}["tokenize"] & {
    readonly detokenize: Detokenizer,
    isSpecialToken(token: Token): boolean,
    isEogToken(token: Token): boolean
};


export type ChatWrapperSettings = {
    readonly supportsSystemMessages: boolean,
    readonly functions: {
        readonly call: {
            readonly optionalPrefixSpace: boolean,
            readonly prefix: string | LlamaText,
            readonly paramsPrefix: string | LlamaText,
            readonly suffix: string | LlamaText,

            /**
             * The value to use when the function has no arguments.
             *
             * Will be stringified using `jsonDumps`.
             *
             * Defaults to `""`.
             */
            readonly emptyCallParamsPlaceholder?: object | string | number | boolean | null
        },

        readonly result: {
            /**
             * Supported template parameters:
             * - <span v-pre>`{{functionName}}`</span>
             * - <span v-pre>`{{functionParams}}`</span>
             *
             * Template parameters can only appear in a string or a string in a `LlamaText`.
             *
             * Template parameters inside a `SpecialTokensText` inside a `LlamaText` won't be replaced.
             *
             * Example of supported values:
             * - `"text{{functionName}}text"`
             * - `LlamaText(["text{{functionName}}text"])`
             *
             * Example of unsupported values:
             * - `LlamaText([new SpecialTokensText("text{{functionName}}text")])`
             */
            readonly prefix: string | LlamaText,

            /**
             * Supported template parameters:
             * - <span v-pre>`{{functionName}}`</span>
             * - <span v-pre>`{{functionParams}}`</span>
             *
             * Template parameters can only appear in a string or a string in a `LlamaText`.
             *
             * Template parameters inside a `SpecialTokensText` inside a `LlamaText` won't be replaced.
             *
             * Example of **supported** values:
             * - `"text{{functionName}}text"`
             * - `LlamaText(["text{{functionName}}text"])`
             *
             * Example of **unsupported** values:
             * - `LlamaText([new SpecialTokensText("text{{functionName}}text")])`
             */
            readonly suffix: string | LlamaText
        },

        /** If this field is present, parallel function calling is supported */
        readonly parallelism?: {
            readonly call: {
                readonly sectionPrefix: string | LlamaText,
                readonly betweenCalls?: string | LlamaText,
                readonly sectionSuffix?: string | LlamaText
            },
            readonly result?: {
                readonly sectionPrefix?: string | LlamaText,
                readonly betweenResults?: string | LlamaText,
                readonly sectionSuffix?: string | LlamaText
            }
        }
    },

    readonly segments?: {
        /** Consider all active segments to be closed when this text is detected */
        readonly closeAllSegments?: string | LlamaText,

        /**
         * After function calls, reiterate the stack of the active segments to remind the model of the context.
         *
         * Defaults to `false`.
         */
        readonly reiterateStackAfterFunctionCalls?: boolean,

        /** Chain of Thought text segment */
        readonly thought?: ChatWrapperSettingsSegment & {
            reopenAfterFunctionCalls?: boolean
        }
    }
};
export type ChatWrapperSettingsSegment = {
    readonly prefix: string | LlamaText,
    readonly suffix?: string | LlamaText
};

export type ChatWrapperGenerateContextStateOptions = {
    chatHistory: readonly ChatHistoryItem[],
    availableFunctions?: ChatModelFunctions,
    documentFunctionParams?: boolean
};

export type ChatWrapperCheckModelCompatibilityParams = {
    tokenizer?: Tokenizer,
    fileInfo?: GgufFileInfo
};

export type ChatWrapperGeneratedContextState = {
    contextText: LlamaText,
    stopGenerationTriggers: LlamaText[],
    ignoreStartText?: LlamaText[],
    functionCall?: {
        initiallyEngaged: boolean,
        disengageInitiallyEngaged: LlamaText[]
    }
};

export type ChatWrapperGenerateInitialHistoryOptions = {
    systemPrompt?: string
};

export type ChatHistoryItem = ChatSystemMessage | ChatUserMessage | ChatModelResponse;

export type ChatSystemMessage = {
    type: "system",
    text: string | LlamaTextJSON
};
export type ChatUserMessage = {
    type: "user",
    text: string
};
export type ChatModelResponse = {
    type: "model",
    response: Array<string | ChatModelFunctionCall | ChatModelSegment>
};
export type ChatModelFunctionCall = {
    type: "functionCall",
    name: string,
    description?: string,
    params: any,
    result: any,
    rawCall?: LlamaTextJSON,

    /**
     * Whether this function call starts a new function calling chunk.
     *
     * Relevant only when parallel function calling is supported.
     */
    startsNewChunk?: boolean
};

export const allSegmentTypes = ["thought"] as const satisfies ChatModelSegmentType[];
export type ChatModelSegmentType = "thought";
export type ChatModelSegment = {
    type: "segment",
    segmentType: ChatModelSegmentType,
    text: string,
    ended: boolean,
    raw?: LlamaTextJSON,
    startTime?: string,
    endTime?: string
};

export type ChatModelFunctions = {
    readonly [name: string]: {
        readonly description?: string,
        readonly params?: Readonly<GbnfJsonSchema> | undefined | null
    }
};

export type ChatSessionModelFunctions = {
    readonly [name: string]: ChatSessionModelFunction<any>
};

export type ChatSessionModelFunction<Params extends GbnfJsonSchema | undefined = GbnfJsonSchema | undefined> = {
    readonly description?: string,
    readonly params?: Params,
    readonly handler: (params: GbnfJsonSchemaToType<NoInfer<Params>>) => any
};

export function isChatModelResponseFunctionCall(item: ChatModelResponse["response"][number] | undefined): item is ChatModelFunctionCall {
    if (item == null || typeof item === "string")
        return false;

    return item.type === "functionCall";
}

export function isChatModelResponseSegment(item: ChatModelResponse["response"][number] | undefined): item is ChatModelSegment {
    if (item == null || typeof item === "string")
        return false;

    return item.type === "segment";
}

export type LLamaContextualRepeatPenalty = {
    /**
     * Number of recent tokens generated by the model to apply penalties to repetition of.
     * Defaults to `64`.
     */
    lastTokens?: number,

    punishTokensFilter?: (tokens: Token[]) => Token[],

    /**
     * Penalize new line tokens.
     * Enabled by default.
     */
    penalizeNewLine?: boolean,

    /**
     * The relative amount to lower the probability of the tokens in `punishTokens` by
     * Defaults to `1.1`.
     * Set to `1` to disable.
     */
    penalty?: number,

    /**
     * For n time a token is in the `punishTokens` array, lower its probability by `n * frequencyPenalty`
     * Disabled by default (`0`).
     * Set to a value between `0` and `1` to enable.
     */
    frequencyPenalty?: number,

    /**
     * Lower the probability of all the tokens in the `punishTokens` array by `presencePenalty`
     * Disabled by default (`0`).
     * Set to a value between `0` and `1` to enable.
     */
    presencePenalty?: number
};
