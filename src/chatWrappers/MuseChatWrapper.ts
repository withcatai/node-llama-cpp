import {ChatWrapper, ChatWrapperJinjaMatchConfiguration} from "../ChatWrapper.js";
import {
    ChatHistoryItem,
    ChatModelFunctionCall, ChatModelFunctions, ChatModelResponse, ChatWrapperGenerateContextStateOptions,
    ChatWrapperGeneratedContextState, ChatWrapperGenerateInitialHistoryOptions, ChatWrapperSettings
} from "../types.js";
import {LlamaText, SpecialToken, SpecialTokensText} from "../utils/LlamaText.js";
import {optionsMatrix} from "../utils/optionsMatrix.js";
import {jsonDumps} from "./utils/jsonDumps.js";

// source: https://dev.meta.ai/docs/muse-glimmer/prompting
// https://huggingface.co/meta-models/Muse-Glimmer-30B/blob/main/chat_template.jinja
export class MuseChatWrapper extends ChatWrapper {
    public readonly wrapperName: string = "Muse";

    public readonly reasoningStrength: "xhigh" | "high" | "medium" | "low";
    public readonly keepOnlyLastThought: boolean;
    public readonly knowledgeCutoff: Date | (() => Date) | null;
    public readonly todayDate: Date | (() => Date) | null;

    /** @internal */ private readonly _systemMessageInSpecialTokensText: boolean;

    public override readonly settings: ChatWrapperSettings = {
        supportsSystemMessages: true,
        functions: {
            call: {
                optionalPrefixSpace: false,
                prefix: LlamaText(new SpecialTokensText(" to=")),
                paramsPrefix: LlamaText([
                    new SpecialTokensText("<|message|><atem:function_calls>\n"),
                    new SpecialTokensText('<atem:invoke name="'), "{{functionName}}", new SpecialTokensText('">\n'),
                    new SpecialTokensText('<atem:parameter name="params">')
                ]),
                suffix: LlamaText(new SpecialTokensText("</atem:parameter>\n</atem:invoke>\n</atem:function_calls>")),
                emptyCallParamsPlaceholder: {}
            },
            parallelism: {
                call: {
                    sectionPrefix: "",
                    betweenCalls: LlamaText(new SpecialTokensText("<|eom|><|start|>assistant")),
                    sectionSuffix: LlamaText(new SpecialToken("EOT"))
                },
                result: {
                    sectionPrefix: ""
                }
            },
            result: {
                prefix: LlamaText([
                    new SpecialTokensText("<|start|>tool "), "{{functionName}}",
                    new SpecialTokensText('<|message|><tool_output name="'), "{{functionName}}", new SpecialTokensText('">\n')
                ]),
                suffix: LlamaText([new SpecialTokensText("\n</tool_output>"), new SpecialToken("EOT")])
            }
        },
        segments: {
            thought: {
                prefix: LlamaText(new SpecialTokensText(" to=self<|message|>")),
                suffix: LlamaText(new SpecialTokensText("<|eom|>"))
            }
        }
    };

    public constructor(options: {
        /**
         * The amount of reasoning to instruct the model to use.
         *
         * Defaults to `"high"`.
         */
        reasoningStrength?: "xhigh" | "high" | "medium" | "low",

        /**
         * Whether to keep only the chain of thought from the last model response.
         *
         * Defaults to `false`, matching the original chat template.
         */
        keepOnlyLastThought?: boolean,

        /**
         * The knowledge cutoff used by the default system message.
         * The default system message is applied only when you supply a chat history that don't have a system message at the beginning.
         *
         * Set to `null` to omit it.
         *
         * Defaults to `"2026-01-04"`.
         */
        knowledgeCutoff?: Date | (() => Date) | string | null,

        /**
         * The current date used by the default system message.
         * The default system message is applied only when you supply a chat history that don't have a system message at the beginning.
         *
         * Set to `null` to omit it.
         *
         * Defaults to the current date.
         */
        todayDate?: Date | (() => Date) | number | string | null,

        /** @internal */
        _systemMessageInSpecialTokensText?: boolean
    } = {}) {
        super();

        const {
            reasoningStrength = "high",
            keepOnlyLastThought = false,
            knowledgeCutoff = new Date("2026-01-04T00:00:00Z"),
            todayDate = () => new Date(),
            _systemMessageInSpecialTokensText = false
        } = options;

        this.reasoningStrength = reasoningStrength;
        this.keepOnlyLastThought = keepOnlyLastThought;
        this.knowledgeCutoff = knowledgeCutoff == null
            ? null
            : knowledgeCutoff instanceof Function
                ? knowledgeCutoff
                : new Date(knowledgeCutoff);
        this.todayDate = todayDate == null
            ? null
            : todayDate instanceof Function
                ? todayDate
                : new Date(todayDate);

        this._systemMessageInSpecialTokensText = _systemMessageInSpecialTokensText;
    }

    public override generateContextState({
        chatHistory, availableFunctions, documentFunctionParams
    }: ChatWrapperGenerateContextStateOptions): ChatWrapperGeneratedContextState {
        const hasFunctions = Object.keys(availableFunctions ?? {}).length > 0;
        const modifiedChatHistory = chatHistory.slice();

        let systemMessage: LlamaText = LlamaText();
        if (modifiedChatHistory[0]?.type === "system") {
            systemMessage = LlamaText([
                LlamaText.fromJSON(modifiedChatHistory[0].text),
                this._systemMessageInSpecialTokensText
                    ? new SpecialTokensText("\n")
                    : "\n"
            ]);
            modifiedChatHistory.shift();
        } else
            systemMessage = this._getDefaultSystemMessage();

        const contextContent: LlamaText[] = [
            LlamaText(new SpecialToken("BOS")),
            LlamaText(new SpecialTokensText("<|start|>system<|message|>")),
            systemMessage,
            this._getSystemMessage(availableFunctions, {documentParams: documentFunctionParams})
        ];

        let needsTriggers = true;
        for (let i = 0; i < modifiedChatHistory.length; i++) {
            const isLastItem = i === modifiedChatHistory.length - 1;
            const item = modifiedChatHistory[i];

            if (item == null)
                continue;

            if (item.type === "system") {
                contextContent.push(
                    LlamaText([
                        new SpecialTokensText("<|start|>system<|message|>"),
                        isLastItem
                            ? LlamaText([])
                            : new SpecialTokensText("<|eot|>")
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
                            : new SpecialTokensText("<|eot|>")
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
                    LlamaText(new SpecialTokensText("<|eot|>")),
                    LlamaText(new SpecialToken("EOT"))
                ],
                detectFunctionCalls: false,
                rerender: {
                    triggers: [LlamaText(new SpecialTokensText("<|eom|>"))],
                    action: "closeResponseItem"
                }
            };

        return {
            contextText,
            stopGenerationTriggers: [
                LlamaText(new SpecialToken("EOS")),
                LlamaText(new SpecialTokensText("<|eot|>")),
                LlamaText(new SpecialToken("EOT"))
            ],
            prefixTriggers: [{
                type: "segment",
                segmentType: "thought",
                triggers: [LlamaText(new SpecialTokensText(" to=self<|message|>"))]
            },
            {
                type: "response",
                triggers: [LlamaText(new SpecialTokensText(" to=user<|message|>"))]
            }],
            noPrefixTrigger: hasFunctions
                ? {
                    type: "functionCall",
                    inject: LlamaText(new SpecialTokensText(""))
                }
                : {
                    type: "response",
                    inject: LlamaText(new SpecialTokensText(" to=user<|message|>"))
                },
            detectFunctionCalls: true,
            rerender: {
                triggers: [LlamaText(new SpecialTokensText("<|eom|>"))],
                action: "closeResponseItem"
            }
        };
    }

    public override generateFunctionCall(name: string, params: any): LlamaText {
        const emptyCallParamsPlaceholder = this.settings.functions.call.emptyCallParamsPlaceholder;

        return LlamaText([
            new SpecialTokensText(" to="),
            name,
            new SpecialTokensText("<|message|><atem:function_calls>\n"),
            new SpecialTokensText('<atem:invoke name="'), name, new SpecialTokensText('">\n'),
            new SpecialTokensText('<atem:parameter name="params">'),
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
            new SpecialTokensText("<|start|>tool "),
            functionName,
            new SpecialTokensText('<|message|><tool_output name="'),
            functionName,
            new SpecialTokensText('">\n'),
            result === undefined
                ? ""
                : jsonDumps(result),
            new SpecialTokensText("\n</tool_output>"),
            new SpecialToken("EOT")
        ]);
    }

    public override generateModelResponseText(modelResponse: ChatModelResponse["response"], useRawValues: boolean = true): LlamaText {
        const {res} = this._getModelResponse(modelResponse, useRawValues, false, false);
        const [start, ...rest] = res.values;
        let newStart = start;
        let newEnd = rest.pop();

        if (newStart instanceof SpecialTokensText && newStart.value.startsWith("<|start|>assistant"))
            newStart = new SpecialTokensText(newStart.value.slice("<|start|>assistant".length));

        if (newEnd instanceof SpecialTokensText && newEnd.value.endsWith("<|eot|>"))
            newEnd = new SpecialTokensText(newEnd.value.slice(0, -"<|eot|>".length));

        return LlamaText([
            newStart ?? [],
            ...rest,
            newEnd ?? []
        ]);
    }

    public override generateAvailableFunctionsSystemText(availableFunctions: ChatModelFunctions, {documentParams = true}: {
        documentParams?: boolean
    }) {
        if (Object.keys(availableFunctions).length === 0)
            return LlamaText([]);

        const namespaceNames = new Set<string>();
        for (const functionName of Object.keys(availableFunctions))
            namespaceNames.add(functionName.split(".")[0]!);

        const toolMetadata = [...namespaceNames]
            .map((namespaceName) => jsonDumps({name: namespaceName, description: ""}))
            .join("\n");
        const functionSchemas = Object.entries(availableFunctions)
            .map(([name, definition]) => jsonDumps({
                name,
                description: definition.description ?? "",
                parameters: documentParams
                    ? (definition.params ?? {})
                    : undefined
            }))
            .join("\n");

        return LlamaText.joinValues("\n", [
            "In this environment you have access to a set of tools you can use to answer the user's question.",
            "",
            LlamaText([
                "You can invoke a function by writing a ",
                new SpecialTokensText('"<atem:function_calls>"'),
                " block like the following:"
            ]),
            new SpecialTokensText("<atem:function_calls>"),
            new SpecialTokensText('<atem:invoke name="$FUNCTION_NAME">'),
            new SpecialTokensText('<atem:parameter name="$PARAMETER_NAME">$PARAMETER_VALUE</atem:parameter>'),
            "...",
            new SpecialTokensText("</atem:invoke>"),
            new SpecialTokensText("</atem:function_calls>"),
            "",
            (
                "String and scalar parameters should be specified as is, while lists and objects should use JSON format. " +
                "Note that spaces for string values are not stripped. The output is not expected to be valid XML and is parsed with " +
                "regular expressions."
            ),
            "Here are the functions available in JSONSchema format:",
            "// Tool metadata",
            toolMetadata,
            "// Function schemas",
            functionSchemas,
            "Here's an example of how to call a function in the tool set:",
            "(If the tool namespace is not specified, invoke the function directly as `example_function_name` rather than " +
            "`example_tool_name.example_function_name`)",
            "",
            "to=example_tool_name.example_function_name",
            "",
            new SpecialTokensText("<atem:function_calls>"),
            new SpecialTokensText('<atem:invoke name="example_tool_name.example_function_name">'),
            LlamaText([
                new SpecialTokensText('<atem:parameter name="example_parameter_1">'),
                "value_1",
                new SpecialTokensText("</atem:parameter>")
            ]),
            LlamaText([
                new SpecialTokensText('<atem:parameter name="example_parameter_2">'),
                "This is the value for the second parameter"
            ]),
            "that can span",
            '"multiple" lines',
            new SpecialTokensText("</atem:parameter>"),
            new SpecialTokensText("</atem:invoke>"),
            new SpecialTokensText("</atem:function_calls>")
        ]);
    }

    public override generateInitialChatHistory({
        systemPrompt
    }: ChatWrapperGenerateInitialHistoryOptions = {}): ChatHistoryItem[] {
        if (systemPrompt === "")
            return [{
                type: "system",
                text: this._getDefaultSystemMessage().toJSON()
            }];

        return super.generateInitialChatHistory({systemPrompt});
    }

    /** @internal */
    private _getModelResponse(
        modelResponse: ChatModelResponse["response"],
        useRawValues: boolean,
        isLastItem: boolean,
        keepOnlyLastThought: boolean
    ) {
        const res: LlamaText[] = [];
        const pendingFunctionCalls: ChatModelFunctionCall[] = [];
        let canEnableTriggers = true;

        const addPendingFunctions = () => {
            if (pendingFunctionCalls.length === 0)
                return;

            res.push(LlamaText(new SpecialTokensText("<|start|>assistant")));
            res.push(this.generateFunctionCallsAndResults(pendingFunctionCalls, useRawValues));

            pendingFunctionCalls.length = 0;
        };

        for (let index = 0; index < modelResponse.length; index++) {
            const isLastResponse = index === modelResponse.length - 1;
            const response = modelResponse[index];

            if (response == null)
                continue;
            else if (response === "" && (!isLastResponse || !isLastItem))
                continue;

            if (typeof response === "string") {
                addPendingFunctions();
                res.push(LlamaText([
                    new SpecialTokensText("<|start|>assistant to=user<|message|>"),
                    response,
                    (isLastResponse && isLastItem)
                        ? LlamaText([])
                        : new SpecialTokensText("<|eot|>")
                ]));

                if (isLastResponse && isLastItem)
                    canEnableTriggers = false;
            } else if (response.type === "segment") {
                addPendingFunctions();

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
                            new SpecialTokensText("<|start|>assistant to=self<|message|>"),
                            response.text,
                            (isLastItem && !response.ended)
                                ? LlamaText([])
                                : new SpecialTokensText("<|eom|>")
                        ])
                    );

                    if (isLastItem && isLastResponse && !response.ended)
                        canEnableTriggers = false;
                } else if (response.segmentType === "comment")
                    continue; // unsupported
                else
                    void (response.segmentType satisfies never);
            } else if (response.type === "functionCall") {
                if (response.startsNewChunk)
                    addPendingFunctions();

                pendingFunctionCalls.push(response);
            } else
                void (response satisfies never);
        }

        addPendingFunctions();

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
    private _getDefaultSystemMessage() {
        const lines = ["You are a helpful AI assistant."];

        if (this.knowledgeCutoff != null) {
            const date = this.knowledgeCutoff instanceof Function
                ? this.knowledgeCutoff()
                : this.knowledgeCutoff;

            lines.push(`Knowledge cutoff: ${formatDate(date, "UTC")}.`);
        }

        if (this.todayDate != null) {
            const date = this.todayDate instanceof Function
                ? this.todayDate()
                : this.todayDate;
            lines.push(`Current date: ${formatDate(date)}.`);
        }

        return LlamaText(lines.join("\n"));
    }

    /** @internal */
    private _getSystemMessage(availableFunctions?: ChatModelFunctions, {documentParams = true}: {
        documentParams?: boolean
    } = {}) {
        const hasFunctions = Object.keys(availableFunctions ?? {}).length > 0;
        const recipientNames = [
            '"self"',
            ...(new Set(Object.keys(availableFunctions ?? {}).map((functionName) => ('"' + functionName.split(".")[0] + '.*"')))),
            '"user"'
        ];

        let res = LlamaText([
            "\n",
            `Reasoning strength: ${this.reasoningStrength}.`,
            hasFunctions
                ? LlamaText([
                    "\n\n",
                    this.generateAvailableFunctionsSystemText(availableFunctions ?? {}, {documentParams})
                ])
                : [],
            `\n\n# Valid recipients: ${recipientNames.join(", ")}.`,
            new SpecialTokensText("<|eot|>")
        ]);

        if (this._systemMessageInSpecialTokensText)
            res = LlamaText(res.values.map((value) => {
                if (typeof value === "string")
                    return new SpecialTokensText(value);

                return value;
            }));

        return res;
    }

    /** @internal */
    public static override _getOptionConfigurationsToTestIfCanSupersedeJinjaTemplate(): ChatWrapperJinjaMatchConfiguration<typeof this> {
        return [...optionsMatrix({
            _systemMessageInSpecialTokensText: [false, true]
        })].flatMap(({_systemMessageInSpecialTokensText}) => [
            [{_systemMessageInSpecialTokensText}, {}],
            [
                {
                    todayDate: new Date("2026-08-11T00:00:00"),
                    cuttingKnowledgeDate: new Date("2026-01-04T00:00:00Z"),
                    _systemMessageInSpecialTokensText
                },
                {},
                {
                    additionalRenderParameters: {
                        "current_date": "2026-08-11",
                        "knowledge_cutoff": "2026-01-04"
                    }
                }
            ]
        ]);
    }
}

function formatDate(date: Date, timezone?: "UTC") {
    const day = date.toLocaleDateString("en-US", {day: "numeric", timeZone: timezone}).padStart(2, "0");
    const month = date.toLocaleDateString("en-US", {month: "numeric", timeZone: timezone}).padStart(2, "0");
    const year = date.toLocaleDateString("en-US", {year: "numeric", timeZone: timezone}).padStart(4, "0");
    return `${day}-${month}-${year}`;
}
