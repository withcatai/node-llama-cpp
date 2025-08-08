import {ChatWrapper, ChatWrapperJinjaMatchConfiguration} from "../ChatWrapper.js";
import {
    ChatModelFunctions, ChatModelResponse, ChatWrapperGenerateContextStateOptions, ChatWrapperGeneratedContextState,
    ChatWrapperGeneratedPrefixTriggersContextState, ChatWrapperSettings
} from "../types.js";
import {SpecialToken, LlamaText, SpecialTokensText} from "../utils/LlamaText.js";
import {ChatModelFunctionsDocumentationGenerator} from "./utils/ChatModelFunctionsDocumentationGenerator.js";
import {jsonDumps} from "./utils/jsonDumps.js";

const defaultModelIdentity = "You are ChatGPT, a large language model trained by OpenAI.";
const defaultCuttingKnowledgeDate = new Date("2024-06-01T00:00:00Z");
const defaultReasoningEffort = "medium";

// source: https://github.com/openai/harmony, https://cookbook.openai.com/articles/openai-harmony,
// https://github.com/openai/openai-cookbook/blob/main/articles/openai-harmony.md
export class HarmonyChatWrapper extends ChatWrapper {
    public readonly wrapperName: string = "Harmony";

    public readonly modelIdentity: string | null;
    public readonly cuttingKnowledgeDate?: Date | (() => Date) | null;
    public readonly todayDate: Date | (() => Date) | null;
    public readonly reasoningEffort: "high" | "medium" | "low" | null;
    public readonly requiredChannels: {
        analysis: boolean,
        commentary: boolean,
        final: boolean
    };
    public readonly keepOnlyLastThought: boolean;

    /** @internal */ private readonly _jinjaFlags: JinjaMatchFlags;

    public override readonly settings: ChatWrapperSettings = {
        supportsSystemMessages: true,
        functions: {
            call: {
                optionalPrefixSpace: true,
                prefix: LlamaText(new SpecialTokensText(" to="), "functions."),
                paramsPrefix: LlamaText(new SpecialTokensText("<|constrain|>json<|message|>")),
                suffix: LlamaText(new SpecialTokensText("<|call|>")),
                emptyCallParamsPlaceholder: {}
            },
            result: {
                prefix: LlamaText(new SpecialTokensText("<|start|>"), "functions.{{functionName}}", new SpecialTokensText(" to=assistant<|channel|>commentary<|message|>")),
                suffix: LlamaText(new SpecialTokensText("<|end|>"))
            }
        },
        segments: {
            thought: {
                prefix: LlamaText(new SpecialTokensText("<|channel|>analysis<|message|>")),
                suffix: LlamaText(new SpecialTokensText("<|end|>"))
            },
            comment: {
                prefix: LlamaText(new SpecialTokensText("<|channel|>commentary<|message|>")),
                suffix: LlamaText(new SpecialTokensText("<|end|>"))
            }
        }
    };

    public constructor(options: {
        /**
         * The model identity to use in the internal system message.
         *
         * Set to `null` to disable.
         *
         * Defaults to `"You are ChatGPT, a large language model trained by OpenAI."`
         */
        modelIdentity?: string | null,

        /**
         * Set to `null` to disable
         *
         * Defaults to `new Date("2024-06-01T00:00:00Z")`
         */
        cuttingKnowledgeDate?: Date | (() => Date) | number | string | null,

        /**
         * Set to `null` to disable
         *
         * Defaults to the current date
         */
        todayDate?: Date | (() => Date) | number | string | null,

        /**
         * The amount of reasoning to instruct the model to use.
         *
         * Not enforced, it's up to the model to follow this instruction.
         *
         * Set to `null` to omit the instruction.
         *
         * Defaults to `"medium"`.
         */
        reasoningEffort?: "high" | "medium" | "low" | null,

        requiredChannels?: {
            /**
             * Defaults to `true`
             */
            analysis?: boolean,

            /**
             * Defaults to `true`
             */
            commentary?: boolean,

            /**
             * Defaults to `true`
             */
            final?: boolean
        },

        /**
         * Whether to keep only the chain of thought from the last model response.
         *
         * Setting this to `false` will keep all the chain of thoughts from the model responses in the context state.
         *
         * Defaults to `true`.
         */
        keepOnlyLastThought?: boolean,

        /** @internal */
        _jinjaFlags?: JinjaMatchFlags
    } = {}) {
        super();

        const {
            modelIdentity = defaultModelIdentity,
            cuttingKnowledgeDate = defaultCuttingKnowledgeDate,
            todayDate = () => new Date(),
            reasoningEffort = defaultReasoningEffort,
            requiredChannels = {},
            keepOnlyLastThought = true,

            _jinjaFlags = {}
        } = options;

        this.modelIdentity = modelIdentity;
        this.cuttingKnowledgeDate = cuttingKnowledgeDate == null
            ? null
            : cuttingKnowledgeDate instanceof Function
                ? cuttingKnowledgeDate
                : new Date(cuttingKnowledgeDate);
        this.todayDate = todayDate == null
            ? null
            : todayDate instanceof Function
                ? todayDate
                : new Date(todayDate);
        this.reasoningEffort = reasoningEffort;
        this.requiredChannels = {
            analysis: requiredChannels.analysis ?? true,
            commentary: requiredChannels.commentary ?? true,
            final: requiredChannels.final ?? true
        };
        this.keepOnlyLastThought = keepOnlyLastThought;

        this._jinjaFlags = {
            emptyLastModelResponseIsFinalMessage: false,
            useSpecialTokensForFullSystemMessage: false,
            disableNonFinalFinalMessages: false,
            useNonFinalFinalMessage: false,
            noFinalMessages: false,
            ..._jinjaFlags
        };
    }

    public override generateContextState({
        chatHistory, availableFunctions, documentFunctionParams
    }: ChatWrapperGenerateContextStateOptions): ChatWrapperGeneratedContextState {
        const hasFunctions = Object.keys(availableFunctions ?? {}).length > 0;
        const modifiedChatHistory = chatHistory.slice();

        let systemMessage: LlamaText = LlamaText();
        if (modifiedChatHistory[0]?.type === "system") {
            systemMessage = LlamaText.fromJSON(modifiedChatHistory[0].text);
            modifiedChatHistory.shift();
        }

        const contextContent: LlamaText[] = [
            this._getPreamble(hasFunctions)
        ];

        if (systemMessage.values.length > 0 || hasFunctions)
            contextContent.push(
                LlamaText([
                    new SpecialTokensText("<|start|>developer<|message|>"),
                    this._getFirstDeveloperMessage(systemMessage, availableFunctions, {documentParams: documentFunctionParams}),
                    new SpecialTokensText("<|end|>")
                ])
            );

        let needsTriggers = true;
        for (let i = 0; i < modifiedChatHistory.length; i++) {
            const isLastItem = i === modifiedChatHistory.length - 1;
            const item = modifiedChatHistory[i];

            if (item == null)
                continue;

            if (item.type === "system") {
                contextContent.push(
                    LlamaText([
                        new SpecialTokensText("<|start|>developer<|message|>"),
                        LlamaText.fromJSON(item.text),
                        isLastItem
                            ? LlamaText([])
                            : new SpecialTokensText("<|end|>")
                    ])
                );

                if (isLastItem)
                    needsTriggers = false;
            } else if (item.type === "user") {
                contextContent.push(
                    LlamaText([
                        new SpecialTokensText("<|start|>user<|message|>"),
                        item.text,
                        isLastItem
                            ? LlamaText([])
                            : new SpecialTokensText("<|end|>")
                    ])
                );

                if (isLastItem)
                    needsTriggers = false;
            } else if (item.type === "model") {
                const {
                    res, needsTriggers: modelNeedsTriggers
                } = this._getModelResponse(item.response, true, isLastItem, this.keepOnlyLastThought);

                if (isLastItem)
                    needsTriggers = modelNeedsTriggers;

                contextContent.push(res);
            } else
                void (item satisfies never);
        }

        const contextText = LlamaText(contextContent);

        if (!needsTriggers)
            return {
                contextText,
                stopGenerationTriggers: [
                    LlamaText(new SpecialToken("EOS")),
                    LlamaText(new SpecialTokensText("<|return|>")),
                    LlamaText("<|return|>")
                ],
                detectFunctionCalls: false,
                rerender: {
                    triggers: [
                        LlamaText(new SpecialTokensText("<|end|>"))
                    ],
                    action: "closeResponseItem"
                }
            };

        return {
            contextText,
            stopGenerationTriggers: [
                LlamaText(new SpecialToken("EOS")),
                LlamaText(new SpecialTokensText("<|return|>")),
                LlamaText("<|return|>")
            ],
            prefixTriggers: [
                {
                    type: "segment",
                    segmentType: "thought",
                    triggers: [
                        LlamaText(new SpecialTokensText("<|channel|>analysis<|message|>"))
                    ]
                }, {
                    type: "segment",
                    segmentType: "comment",
                    triggers: [
                    // the trigger here includes the `<|message|>` part
                    // to not conflict with the `<|channel|>commentary to=` prefix used for function calls
                        LlamaText(new SpecialTokensText("<|channel|>commentary<|message|>"))
                    ]
                }, {
                    type: "response",
                    triggers: [
                        LlamaText(new SpecialTokensText("<|channel|>final"))
                    ],
                    inject: LlamaText(new SpecialTokensText("<|message|>"))
                },
                ...(
                    !hasFunctions ? [] : [{
                        type: "functionCall",
                        triggers: [
                            LlamaText(new SpecialTokensText("<|channel|>commentary to="))
                        ],
                        replaceTrigger: true,
                        inject: LlamaText(new SpecialTokensText("<|channel|>commentary"))
                    }, {
                        type: "functionCall",
                        triggers: [
                            LlamaText(new SpecialTokensText("<|channel|>analysis to="))
                        ],
                        replaceTrigger: true,
                        inject: LlamaText(new SpecialTokensText("<|channel|>analysis"))
                    }] satisfies ChatWrapperGeneratedPrefixTriggersContextState["prefixTriggers"]
                )
            ],
            noPrefixTrigger: {
                type: "response",
                inject: LlamaText(new SpecialTokensText("<|channel|>final<|message|>"))
            },
            detectFunctionCalls: false,
            rerender: {
                triggers: [
                    LlamaText(new SpecialTokensText("<|end|>"))
                ],
                action: "closeResponseItem"
            }
        };
    }

    public override generateFunctionCall(name: string, params: any): LlamaText {
        const emptyCallParamsPlaceholder = this.settings.functions.call.emptyCallParamsPlaceholder;
        return LlamaText([
            new SpecialTokensText("<|start|>assistant<|channel|>commentary to="),
            "functions.", name,
            this.settings.functions.call.paramsPrefix,
            params === undefined
                ? (emptyCallParamsPlaceholder === undefined || emptyCallParamsPlaceholder === "")
                    ? ""
                    : jsonDumps(emptyCallParamsPlaceholder)
                : jsonDumps(params),
            this.settings.functions.call.suffix
        ]);
    }

    public override generateFunctionCallResult(functionName: string, functionParams: any, result: any): LlamaText {
        return LlamaText([
            new SpecialTokensText("<|start|>"),
            "functions.", functionName,
            new SpecialTokensText(" to=assistant<|channel|>commentary<|message|>"),
            (
                result === undefined
                    ? ""
                    : jsonDumps(result)
            ),
            new SpecialTokensText("<|end|>")
        ]);
    }

    public override generateModelResponseText(modelResponse: ChatModelResponse["response"], useRawValues: boolean = true): LlamaText {
        const {res} = this._getModelResponse(modelResponse, useRawValues, false, false);
        const [start, ...rest] = res.values;
        let newStart = start;
        let newEnd = rest.pop();

        if (newStart instanceof SpecialTokensText && newStart.value.startsWith("<|start|>assistant"))
            newStart = new SpecialTokensText(newStart.value.slice("<|start|>assistant".length));

        if (newEnd instanceof SpecialTokensText && newEnd.value.startsWith("<|end|>"))
            newEnd = new SpecialTokensText(newEnd.value.slice("<|end|>".length));
        else if (newEnd instanceof SpecialTokensText && newEnd.value.startsWith("<|return|>"))
            newEnd = new SpecialTokensText(newEnd.value.slice("<|return|>".length));

        return LlamaText([
            newStart ?? [],
            ...rest,
            newEnd ?? []
        ]);
    }

    public override generateAvailableFunctionsSystemText(availableFunctions: ChatModelFunctions, {documentParams = true}: {
        documentParams?: boolean
    }) {
        const functionsDocumentationGenerator = new ChatModelFunctionsDocumentationGenerator(availableFunctions);

        if (!functionsDocumentationGenerator.hasAnyFunctions)
            return LlamaText([]);

        return LlamaText.joinValues("\n", [
            "# Tools",
            "",
            "## functions",
            "",
            "namespace functions {",
            "",
            functionsDocumentationGenerator
                .getTypeScriptFunctionTypes({documentParams})
                .split("\n")
                .map((line) => line.trim())
                .join("\n"),
            "",
            "} // namespace functions"
        ]);
    }

    /** @internal */
    private _getFirstDeveloperMessage(
        systemPrompt: LlamaText,
        availableFunctions?: ChatModelFunctions,
        {documentParams = true}: {documentParams?: boolean} = {}
    ) {
        const functionsDocumentationGenerator = new ChatModelFunctionsDocumentationGenerator(availableFunctions);

        if (!functionsDocumentationGenerator.hasAnyFunctions && systemPrompt.values.length === 0)
            return LlamaText([]);

        if (!functionsDocumentationGenerator.hasAnyFunctions)
            return LlamaText([
                this._jinjaFlags.useSpecialTokensForFullSystemMessage
                    ? new SpecialTokensText("# Instructions\n\n")
                    : "# Instruction\n\n",
                systemPrompt
            ]);

        return LlamaText([
            this._jinjaFlags.useSpecialTokensForFullSystemMessage
                ? new SpecialTokensText("# Instructions\n\n")
                : "# Instructions\n\n",
            systemPrompt.values.length > 0
                ? [systemPrompt, "\n\n"]
                : [],
            this.generateAvailableFunctionsSystemText(availableFunctions ?? {}, {documentParams})
        ]);
    }

    /** @internal */
    private _getModelResponse(
        modelResponse: ChatModelResponse["response"],
        useRawValues: boolean,
        isLastItem: boolean,
        keepOnlyLastThought: boolean
    ) {
        const res: LlamaText[] = [];
        let canEnableTriggers = true;

        for (let index = 0; index < modelResponse.length; index++) {
            const isLastResponse = index === modelResponse.length - 1;
            const response = modelResponse[index];

            if (response == null)
                continue;
            else if (response === "" && (!isLastResponse || !isLastItem))
                continue;

            if (typeof response === "string") {
                if (isLastItem && isLastResponse) {
                    if (response === "" && !this._jinjaFlags.emptyLastModelResponseIsFinalMessage)
                        canEnableTriggers = true;
                    else if (!this._jinjaFlags.useNonFinalFinalMessage) {
                        res.push(
                            LlamaText([
                                new SpecialTokensText("<|start|>assistant<|channel|>final<|message|>"),
                                response
                            ])
                        );
                        canEnableTriggers = false;
                    } else {
                        res.push(
                            LlamaText([
                                new SpecialTokensText("<|start|>assistant<|message|>"),
                                response
                            ])
                        );
                        canEnableTriggers = false;
                    }
                } else if (!this._jinjaFlags.noFinalMessages && (isLastResponse || !this._jinjaFlags.disableNonFinalFinalMessages))
                    res.push(
                        LlamaText([
                            new SpecialTokensText("<|start|>assistant<|channel|>final<|message|>"),
                            response,
                            new SpecialTokensText("<|end|>")
                        ])
                    );
                else
                    res.push(
                        LlamaText([
                            new SpecialTokensText("<|start|>assistant<|message|>"),
                            response,
                            new SpecialTokensText("<|end|>")
                        ])
                    );
            } else if (response.type === "segment") {
                if (response.ended && response.raw != null && useRawValues)
                    res.push(LlamaText([
                        new SpecialTokensText("<|start|>assistant"),
                        LlamaText.fromJSON(response.raw)
                    ]));
                else if (response.segmentType === "thought") {
                    if (keepOnlyLastThought && !isLastItem)
                        continue;

                    res.push(
                        LlamaText([
                            new SpecialTokensText("<|start|>assistant<|channel|>analysis<|message|>"),
                            response.text,
                            (isLastItem && !response.ended)
                                ? LlamaText([])
                                : new SpecialTokensText("<|end|>")
                        ])
                    );

                    if (isLastItem && isLastResponse && !response.ended)
                        canEnableTriggers = false;
                } else if (response.segmentType === "comment") {
                    res.push(
                        LlamaText([
                            new SpecialTokensText("<|start|>assistant<|channel|>commentary<|message|>"),
                            response.text,
                            (isLastItem && !response.ended)
                                ? LlamaText([])
                                : new SpecialTokensText("<|end|>")
                        ])
                    );

                    if (isLastItem && isLastResponse && !response.ended)
                        canEnableTriggers = false;
                } else
                    void (response.segmentType satisfies never);
            } else if (response.type === "functionCall") {
                res.push(
                    LlamaText([
                        (response.rawCall != null && useRawValues)
                            ? LlamaText.fromJSON(response.rawCall)
                            : this.generateFunctionCall(response.name, response.params),
                        this.generateFunctionCallResult(response.name, response.params, response.result)
                    ])
                );
            } else
                void (response satisfies never);
        }

        const needsTriggers = canEnableTriggers && isLastItem;
        if (needsTriggers)
            res.push(
                LlamaText([
                    new SpecialTokensText("<|start|>assistant")
                ])
            );

        return {
            res: LlamaText(res),
            needsTriggers
        };
    }

    /** @internal */
    private _getPreamble(hasFunctions: boolean) {
        const formatCutoff = (date: Date, timezone?: "UTC") => {
            const month = date.toLocaleDateString("en-US", {month: "numeric", timeZone: timezone}).padStart(2, "0");
            const year = date.toLocaleDateString("en-US", {year: "numeric", timeZone: timezone}).padStart(4, "0");
            return `${year}-${month}`;
        };

        const lines: string[] = [];

        if (this.modelIdentity != null && this.modelIdentity !== "")
            lines.push(this.modelIdentity);

        if (this.cuttingKnowledgeDate != null) {
            const date = this.cuttingKnowledgeDate instanceof Function
                ? this.cuttingKnowledgeDate()
                : this.cuttingKnowledgeDate;

            lines.push(`Knowledge cutoff: ${formatCutoff(date, "UTC")}`);

            if (this._jinjaFlags.formatting === 1)
                lines.push([lines.shift(), lines.shift()].filter(Boolean).join(""));
        }

        if (this.todayDate != null) {
            const date = this.todayDate instanceof Function
                ? this.todayDate()
                : this.todayDate;
            lines.push(`Current date: ${formatDate(date, undefined)}`);
        }

        if (this.reasoningEffort != null) {
            if (lines.length > 0)
                lines.push("");

            if (this._jinjaFlags.formatting === 1)
                lines.push(`reasoning: ${this.reasoningEffort}`);
            else
                lines.push(`Reasoning: ${this.reasoningEffort}`);
        }

        if (this.requiredChannels.analysis || this.requiredChannels.commentary || this.requiredChannels.final) {
            const channels: string[] = [
                ...(this.requiredChannels.analysis ? ["analysis"] : []),
                ...(this.requiredChannels.commentary ? ["commentary"] : []),
                ...(this.requiredChannels.final ? ["final"] : [])
            ];

            if (lines.length > 0)
                lines.push("");

            lines.push(`# Valid channels: ${channels.join(", ")}. Channel must be included for every message.`);

            if ((this.requiredChannels.commentary && hasFunctions) || this._jinjaFlags.formatting === 1)
                lines.push("Calls to these tools must go to the commentary channel: 'functions'.");
        }

        return LlamaText([
            new SpecialTokensText("<|start|>system<|message|>"),
            this._jinjaFlags.useSpecialTokensForFullSystemMessage
                ? new SpecialTokensText(lines.join("\n"))
                : lines.join("\n"),
            new SpecialTokensText("<|end|>")
        ]);
    }

    /** @internal */
    public static override _getOptionConfigurationsToTestIfCanSupersedeJinjaTemplate(): ChatWrapperJinjaMatchConfiguration<typeof this> {
        const jinjaParameters = {
            "model_identity": defaultModelIdentity,
            "reasoning_effort": defaultReasoningEffort
        };

        return [
            [{}, {}],
            [{_jinjaFlags: {emptyLastModelResponseIsFinalMessage: true}}, {}],
            [{}, {}, {additionalRenderParameters: jinjaParameters}],
            [{_jinjaFlags: {emptyLastModelResponseIsFinalMessage: true}}, {}, {additionalRenderParameters: jinjaParameters}],
            [{_jinjaFlags: {useSpecialTokensForFullSystemMessage: true}}, {}, {additionalRenderParameters: jinjaParameters}],
            [
                {_jinjaFlags: {emptyLastModelResponseIsFinalMessage: true, useSpecialTokensForFullSystemMessage: true}},
                {},
                {additionalRenderParameters: jinjaParameters}
            ],
            [
                {
                    _jinjaFlags: {
                        emptyLastModelResponseIsFinalMessage: true,
                        useSpecialTokensForFullSystemMessage: true,
                        disableNonFinalFinalMessages: true
                    }
                },
                {},
                {additionalRenderParameters: jinjaParameters}
            ],
            [
                {
                    _jinjaFlags: {
                        emptyLastModelResponseIsFinalMessage: true,
                        useSpecialTokensForFullSystemMessage: true,
                        disableNonFinalFinalMessages: true,
                        useNonFinalFinalMessage: true
                    }
                },
                {},
                {additionalRenderParameters: jinjaParameters}
            ],
            [
                {
                    _jinjaFlags: {
                        emptyLastModelResponseIsFinalMessage: true,
                        useSpecialTokensForFullSystemMessage: true,
                        useNonFinalFinalMessage: true
                    }
                },
                {},
                {additionalRenderParameters: jinjaParameters}
            ],
            [
                {
                    _jinjaFlags: {
                        emptyLastModelResponseIsFinalMessage: true,
                        useSpecialTokensForFullSystemMessage: true,
                        useNonFinalFinalMessage: true,
                        noFinalMessages: true
                    }
                },
                {},
                {additionalRenderParameters: jinjaParameters}
            ],
            [
                {
                    _jinjaFlags: {
                        emptyLastModelResponseIsFinalMessage: true,
                        useSpecialTokensForFullSystemMessage: true,
                        useNonFinalFinalMessage: true,
                        noFinalMessages: true,
                        formatting: 1
                    }
                },
                {},
                {additionalRenderParameters: jinjaParameters}
            ],

            [{todayDate: null}, {}, {}],
            [{cuttingKnowledgeDate: null}, {}, {}],
            [{reasoningEffort: null}, {}, {}],
            [{todayDate: null, cuttingKnowledgeDate: null}, {}, {}],
            [{todayDate: null, cuttingKnowledgeDate: null, reasoningEffort: null}, {}, {}]
        ];
    }
}

function formatDate(date: Date, timezone?: "UTC") {
    const day = date.toLocaleDateString("en-US", {day: "numeric", timeZone: timezone}).padStart(2, "0");
    const month = date.toLocaleDateString("en-US", {month: "numeric", timeZone: timezone}).padStart(2, "0");
    const year = date.toLocaleDateString("en-US", {year: "numeric", timeZone: timezone}).padStart(4, "0");
    return `${year}-${month}-${day}`;
}

type JinjaMatchFlags = {
    emptyLastModelResponseIsFinalMessage?: boolean,
    useSpecialTokensForFullSystemMessage?: boolean,
    disableNonFinalFinalMessages?: boolean,
    useNonFinalFinalMessage?: boolean,
    noFinalMessages?: boolean,
    formatting?: 1
};
