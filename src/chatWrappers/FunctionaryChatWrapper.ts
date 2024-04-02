import {ChatWrapper} from "../ChatWrapper.js";
import {ChatHistoryItem, ChatModelFunctions, isChatModelResponseFunctionCall} from "../types.js";
import {BuiltinSpecialToken, LlamaText, SpecialToken} from "../utils/LlamaText.js";
import {getTypeScriptTypeStringForGbnfJsonSchema} from "../utils/getTypeScriptTypeStringForGbnfJsonSchema.js";

// source: https://github.com/MeetKai/functionary/blob/main/tests/prompt_test_v2.txt
export class FunctionaryChatWrapper extends ChatWrapper {
    public readonly wrapperName: string = "Functionary";

    public override readonly settings = {
        functions: {
            call: {
                optionalPrefixSpace: true,
                prefix: "\n<|from|>assistant\n<|recipient|>",
                paramsPrefix: "\n<|content|>",
                suffix: "\n"
            },
            result: {
                prefix: "<|from|>{{functionName}}\n<|recipient|>all\n<|content|>",
                suffix: "\n"
            }
        }
    };

    public override generateContextText(history: readonly ChatHistoryItem[], {availableFunctions, documentFunctionParams}: {
        availableFunctions?: ChatModelFunctions,
        documentFunctionParams?: boolean
    } = {}): {
        contextText: LlamaText,
        stopGenerationTriggers: LlamaText[],
        ignoreStartText?: LlamaText[],
        functionCall?: {
            initiallyEngaged: boolean,
            disengageInitiallyEngaged: LlamaText[]
        }
    } {
        const hasFunctions = Object.keys(availableFunctions ?? {}).length > 0;

        const historyWithFunctions = this.addAvailableFunctionsSystemMessageToHistory(history, availableFunctions, {
            documentParams: documentFunctionParams
        });

        const contextText = LlamaText(
            new BuiltinSpecialToken("BOS"),
            historyWithFunctions.map((item, index) => {
                const isFirstItem = index === 0;
                const isLastItem = index === historyWithFunctions.length - 1;

                if (item.type === "system") {
                    if (item.text.length === 0)
                        return "";

                    return LlamaText([
                        isFirstItem
                            ? LlamaText([])
                            : new SpecialToken("\n"),
                        new SpecialToken("<|from|>system\n"),
                        new SpecialToken("<|recipient|>all\n"),
                        new SpecialToken("<|content|>"),
                        item.text
                    ]);
                } else if (item.type === "user") {
                    return LlamaText([
                        isFirstItem
                            ? LlamaText([])
                            : new SpecialToken("\n"),
                        new SpecialToken("<|from|>user\n"),
                        new SpecialToken("<|recipient|>all\n"),
                        new SpecialToken("<|content|>"),
                        item.text
                    ]);
                } else if (item.type === "model") {
                    if (isLastItem && item.response.length === 0 && !hasFunctions)
                        return LlamaText([
                            isFirstItem
                                ? LlamaText([])
                                : new SpecialToken("\n"),
                            new SpecialToken("<|from|>assistant\n"),
                            new SpecialToken("<|recipient|>all\n"),
                            new SpecialToken("<|content|>")
                        ]);

                    return LlamaText(
                        item.response.map((response, index) => {
                            const isFirstResponse = index === 0;
                            const isLastResponse = index === item.response.length - 1;

                            if (typeof response === "string")
                                return LlamaText([
                                    (isFirstItem && isFirstResponse)
                                        ? LlamaText([])
                                        : new SpecialToken("\n"),
                                    new SpecialToken("<|from|>assistant\n"),
                                    new SpecialToken("<|recipient|>all\n"),
                                    new SpecialToken("<|content|>"),
                                    response,
                                    (isLastResponse && isLastItem)
                                        ? ""
                                        : new SpecialToken("<|stop|>")
                                ]);
                            else if (isChatModelResponseFunctionCall(response)) {
                                return LlamaText([
                                    response.raw != null
                                        ? LlamaText(response.raw)
                                        : LlamaText([
                                            (isFirstItem && isFirstResponse)
                                                ? LlamaText([])
                                                : new SpecialToken("\n"),

                                            new SpecialToken("<|from|>assistant\n"),
                                            new SpecialToken("<|recipient|>"), response.name, new SpecialToken("\n"),
                                            new SpecialToken("<|content|>"),
                                            response.params === undefined
                                                ? ""
                                                : JSON.stringify(response.params),
                                            new SpecialToken("<|stop|>"),

                                            new SpecialToken("\n"),
                                            new SpecialToken("<|from|>"), response.name, new SpecialToken("\n"),
                                            new SpecialToken("<|recipient|>all\n"),
                                            new SpecialToken("<|content|>"),
                                            response.result === undefined
                                                ? "" // "void"
                                                : JSON.stringify(response.result)
                                        ]),

                                    hasFunctions
                                        ? LlamaText([])
                                        : LlamaText([
                                            new SpecialToken("\n"),
                                            new SpecialToken("<|from|>assistant\n"),
                                            new SpecialToken("<|recipient|>all\n"),
                                            new SpecialToken("<|content|>")
                                        ])
                                ]);
                            }

                            void (response satisfies never);
                            return "";
                        })
                    );
                }

                void (item satisfies never);
                return "";
            })
        );

        if (!hasFunctions) {
            return {
                contextText,
                stopGenerationTriggers: [
                    LlamaText(new BuiltinSpecialToken("EOS")),
                    LlamaText(new SpecialToken("<|stop|>")),
                    LlamaText(" <|stop|>"),
                    LlamaText("<|stop|>"),
                    LlamaText("\n<|from|>user"),
                    LlamaText("\n<|from|>assistant"),
                    LlamaText("\n<|from|>system"),

                    LlamaText(new SpecialToken(" <|stop|>")),
                    LlamaText(new SpecialToken("<|stop|>")),
                    LlamaText(new SpecialToken("\n<|from|>user")),
                    LlamaText(new SpecialToken("\n<|from|>assistant")),
                    LlamaText(new SpecialToken("\n<|from|>system"))
                ]
            };
        }

        return {
            contextText,
            stopGenerationTriggers: [
                LlamaText(new BuiltinSpecialToken("EOS")),
                LlamaText(new SpecialToken("<|stop|>")),

                LlamaText(" <|stop|>"),
                LlamaText("<|stop|>"),
                LlamaText("\n<|from|>user"),

                LlamaText(new SpecialToken(" <|stop|>")),
                LlamaText(new SpecialToken("<|stop|>")),
                LlamaText(new SpecialToken("\n<|from|>user"))
            ],
            ignoreStartText: [
                LlamaText("\n<|from|>assistant\n<|recipient|>all\n<|content|>"),
                LlamaText(new SpecialToken("\n<|from|>assistant\n<|recipient|>all\n<|content|>")),
                LlamaText("\n\n<|from|>assistant\n<|recipient|>all\n<|content|>"),
                LlamaText(new SpecialToken("\n\n<|from|>assistant\n<|recipient|>all\n<|content|>"))
            ],
            functionCall: {
                initiallyEngaged: true,
                disengageInitiallyEngaged: [
                    LlamaText("\n<|from|>assistant\n<|recipient|>all\n<|content|>"),
                    LlamaText(new SpecialToken("\n<|from|>assistant\n<|recipient|>all\n<|content|>")),
                    LlamaText("\n\n<|from|>assistant\n<|recipient|>all\n<|content|>"),
                    LlamaText(new SpecialToken("\n\n<|from|>assistant\n<|recipient|>all\n<|content|>"))
                ]
            }
        };
    }

    public override generateAvailableFunctionsSystemText(availableFunctions: ChatModelFunctions, {documentParams = true}: {
        documentParams?: boolean
    }) {
        const availableFunctionNames = Object.keys(availableFunctions ?? {});

        if (availableFunctionNames.length === 0)
            return "";

        return "// Supported function definitions that should be called when necessary.\n" +
            "namespace functions {\n\n" +
            availableFunctionNames
                .map((functionName) => {
                    if (functionName === "all")
                        throw new Error('Function name "all" is reserved and cannot be used');

                    const functionDefinition = availableFunctions[functionName];
                    let res = "";

                    if (functionDefinition?.description != null && functionDefinition.description.trim() !== "")
                        res += "// " + functionDefinition.description.split("\n").join("\n// ") + "\n";

                    res += "type " + functionName + " = (";

                    if (documentParams && functionDefinition?.params != null)
                        res += "_: " + getTypeScriptTypeStringForGbnfJsonSchema(functionDefinition.params);

                    res += ") => any;";

                    return res;
                })
                .join("\n\n") +
            "\n\n} // namespace functions";
    }

    public override addAvailableFunctionsSystemMessageToHistory(
        history: readonly ChatHistoryItem[],
        availableFunctions?: ChatModelFunctions,
        {
            documentParams = true
        }: {
            documentParams?: boolean
        } = {}
    ) {
        const availableFunctionNames = Object.keys(availableFunctions ?? {});

        if (availableFunctions == null || availableFunctionNames.length === 0)
            return history;

        const res = history.slice();

        const firstSystemMessageIndex = res.findIndex((item) => item.type === "system");
        res.splice(
            Math.max(0, firstSystemMessageIndex),
            0,
            {
                type: "system",
                text: this.generateAvailableFunctionsSystemText(availableFunctions, {documentParams})
            }, {
                type: "system",
                text: "The assistant calls functions with appropriate input when necessary. The assistant writes <|stop|> when finished answering."
            });

        return res;
    }

    public override getInternalBuiltinFunctions({initialFunctionCallEngaged}: {initialFunctionCallEngaged: boolean}): ChatModelFunctions {
        if (initialFunctionCallEngaged)
            return {
                all: {}
            };

        return {};
    }
}
