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

                /**
                 * Alternate section prefixes that can be used to detect a function call section,
                 * but won't be used to construct the context when building it from scratch.
                 */
                readonly sectionPrefixAlternateMatches?: Array<string | LlamaText>,

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
        },

        /**
         * Comment segment.
         *
         * Used by models such as gpt-oss.
         */
        readonly comment?: ChatWrapperSettingsSegment
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

export type ChatWrapperGeneratedContextState =
    ChatWrapperGeneratedPrefixTriggersContextState | ChatWrapperGeneratedInitiallyEngagedFunctionsContextState;

export type ChatWrapperGeneratedPrefixTriggersContextState = {
    /**
     * The rendered chat to load into the context sequence state
     */
    contextText: LlamaText,

    /**
     * Triggers to stop the generation
     */
    stopGenerationTriggers: LlamaText[],

    /**
     * When this option is set, after evaluating the `contextText`,
     * it'll look for any of the triggers to be the first generated output.
     *
     * When a trigger is matched, its type will determine the mode to enter to, a segment to open,
     * or to continue the generation as a textual output.
     *
     * If all the triggers are unmatched, the `noPrefixTrigger` will take effect.
     */
    prefixTriggers?: Array<{
        triggers: LlamaText[],

        /**
         * Enter into function calling mode.
         *
         * Entering this mode will put the function calling prefix into the context sequence state
         * and force it to choose a function to call.
         *
         * If no functions are available, this trigger will be ignored.
         */
        type: "functionCall",

        /**
         * Remove the trigger tokens and replace them with the function call prefix.
         *
         * Defaults to `true`.
         */
        replaceTrigger?: boolean,

        /**
         * Text to inject into the context sequence state when this trigger is matched.
         */
        inject?: LlamaText
    } | {
        triggers: LlamaText[],

        /**
         * Open a segment of the specified type.
         *
         * If the budget for this segment has exceeded, this trigger will be ignored,
         * so ensure to have a fallback for a response.
         */
        type: "segment",

        /**
         * Type of the segment to open.
         */
        segmentType: ChatModelSegmentType,

        /**
         * Text to inject into the context sequence state when this trigger is matched.
         */
        inject?: LlamaText
    } | {
        triggers: LlamaText[],

        /**
         * Continue the generation as a textual output.
         */
        type: "response",

        /**
         * Text to inject into the context sequence state when this trigger is matched.
         */
        inject?: LlamaText
    }>,

    /**
     * When no prefix triggers are matched or non are provided, after evaluating the `contextText`,
     * perform the action specified by this option.
     */
    noPrefixTrigger?: {
        /**
         * Enter into function calling mode.
         *
         * Entering this mode will put the function calling prefix into the context sequence state
         * and force it to choose a function to call.
         *
         * If no functions are available, this action will be ignored.
         */
        type: "functionCall",

        /**
         * Text to inject into the context sequence state when this action is performed.
         */
        inject: LlamaText
    } | {
        /**
         * Open a segment of the specified type.
         *
         * If the budget for this segment has exceeded, this action will be ignored.
         */
        type: "segment",

        /**
         * Type of the segment to open.
         */
        segmentType: ChatModelSegmentType,

        /**
         * Text to inject into the context sequence state when this action is performed.
         */
        inject: LlamaText
    } | {
        /**
         * Continue the generation as a textual output.
         */
        type: "response",

        /**
         * Text to inject into the context sequence state when this action is performed.
         */
        inject: LlamaText
    },

    /**
     * Trigger a rerender of the chat template when any of the provided triggers are matched.
     *
     * When a rerender it triggered, the chat template will be rendered again and the next trigger options will come into effect again,
     * so if no prefix triggers are required after the rerender, make sure to not provide any.
     *
     * When a rerender is triggered, the `action` will be performed.
     */
    rerender?: {
        triggers: LlamaText[],

        /**
         * Action to perform when the rerender is triggered.
         *
         * - **`"closeResponseItem"`**: Close the current segment or stop the textual response generation.
         */
        action?: "closeResponseItem"
    },

    /**
     * Whether to detect the function calling prefix syntax in the current text generation to dynamically enter into function calling mode.
     *
     * If it's only possible to enter function calling using a prefix trigger, then set this option to `false`.
     */
    detectFunctionCalls?: boolean,

    ignoreStartText?: never,
    functionCall?: never
};
export type ChatWrapperGeneratedInitiallyEngagedFunctionsContextState = {
    contextText: LlamaText,
    stopGenerationTriggers: LlamaText[],
    ignoreStartText?: LlamaText[],
    functionCall?: {
        initiallyEngaged: boolean,
        disengageInitiallyEngaged: LlamaText[]
    },

    detectFunctionCalls?: never,
    prefixTriggers?: never,
    noPrefixTrigger?: never,
    rerender?: never
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

export const allSegmentTypes = ["thought", "comment"] as const satisfies readonly ChatModelSegmentType[];
void (null as Exclude<ChatModelSegmentType, typeof allSegmentTypes[number]> satisfies never);

export type ChatModelSegmentType = "thought" | "comment";
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

export type LLamaContextualDryRepeatPenalty = {
    /**
     * A number between `0` and `1` representing the strength of the DRY (Don't Repeat Yourself) effect.
     *
     * Setting this to `0` will disable the DRY penalty completely.
     *
     * The recommended value is `0.8`.
     */
    strength: number,

    /**
     * The base value for the exponential penality calculation.
     *
     * A higher value will lead to more aggressive penalization of repetitions.
     *
     * Defaults to `1.75`.
     */
    base?: number,

    /**
     * The maximum sequence length (in tokens) that will be allowed to be repeated without being penalized.
     *
     * Repetitions shorter than or equal to this length will not be penalized,
     * allowing for natural repetitions of short phrases and common words.
     *
     * Defaults to `2`.
     */
    allowedLength?: number,

    /**
     * Number of recent tokens generated by the model to consider for sequence repetition matching.
     *
     * When set to `null`, the entire context sequence history will be considered for repetition matching.
     * Setting to `0` will disable DRY (Don't Repeat Yourself) penalty.
     *
     * Defaults to `null`.
     */
    lastTokens?: number | null,

    /**
     * Text sequences that will be considered as breakers for the repeated sequences.
     * These will never be penalized for being repeated, and are used to mark the boundaries of the repeated sequences.
     *
     * For example, setting this to `["\n", "*"]` will allow the model to make as many lists as it wants,
     * without being penalized for repeating the list item marker (like `*`).
     *
     * Defaults to `["\n", ":", '"', "*"]`.
     */
    sequenceBreakers?: string[]
};
