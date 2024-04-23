import {ChatWrapper} from "../ChatWrapper.js";
import {ChatHistoryItem, ChatModelFunctions, isChatModelResponseFunctionCall} from "../types.js";
import {SpecialToken, LlamaText, SpecialTokensText} from "../utils/LlamaText.js";
import {ChatModelFunctionsDocumentationGenerator} from "./utils/ChatModelFunctionsDocumentationGenerator.js";

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
            new SpecialToken("BOS"),
            historyWithFunctions.map((item, index) => {
                const isFirstItem = index === 0;
                const isLastItem = index === historyWithFunctions.length - 1;

                if (item.type === "system") {
                    if (item.text.length === 0)
                        return "";

                    return LlamaText([
                        isFirstItem
                            ? LlamaText([])
                            : new SpecialTokensText("\n"),
                        new SpecialTokensText("<|from|>system\n"),
                        new SpecialTokensText("<|recipient|>all\n"),
                        new SpecialTokensText("<|content|>"),
                        item.text
                    ]);
                } else if (item.type === "user") {
                    return LlamaText([
                        isFirstItem
                            ? LlamaText([])
                            : new SpecialTokensText("\n"),
                        new SpecialTokensText("<|from|>user\n"),
                        new SpecialTokensText("<|recipient|>all\n"),
                        new SpecialTokensText("<|content|>"),
                        item.text
                    ]);
                } else if (item.type === "model") {
                    if (isLastItem && item.response.length === 0 && !hasFunctions)
                        return LlamaText([
                            isFirstItem
                                ? LlamaText([])
                                : new SpecialTokensText("\n"),
                            new SpecialTokensText("<|from|>assistant\n"),
                            new SpecialTokensText("<|recipient|>all\n"),
                            new SpecialTokensText("<|content|>")
                        ]);

                    return LlamaText(
                        item.response.map((response, index) => {
                            const isFirstResponse = index === 0;
                            const isLastResponse = index === item.response.length - 1;

                            if (typeof response === "string")
                                return LlamaText([
                                    (isFirstItem && isFirstResponse)
                                        ? LlamaText([])
                                        : new SpecialTokensText("\n"),
                                    new SpecialTokensText("<|from|>assistant\n"),
                                    new SpecialTokensText("<|recipient|>all\n"),
                                    new SpecialTokensText("<|content|>"),
                                    response,
                                    (isLastResponse && isLastItem)
                                        ? ""
                                        : new SpecialTokensText("<|stop|>")
                                ]);
                            else if (isChatModelResponseFunctionCall(response)) {
                                return LlamaText([
                                    response.raw != null
                                        ? LlamaText(
                                            response.raw.endsWith("\n")
                                                ? response.raw.slice(0, -"\n".length)
                                                : response.raw
                                        )
                                        : LlamaText([
                                            (isFirstItem && isFirstResponse)
                                                ? LlamaText([])
                                                : new SpecialTokensText("\n"),

                                            new SpecialTokensText("<|from|>assistant\n"),
                                            new SpecialTokensText("<|recipient|>"), response.name, new SpecialTokensText("\n"),
                                            new SpecialTokensText("<|content|>"),
                                            response.params === undefined
                                                ? ""
                                                : JSON.stringify(response.params),
                                            new SpecialTokensText("<|stop|>"),

                                            new SpecialTokensText("\n"),
                                            new SpecialTokensText("<|from|>"), response.name, new SpecialTokensText("\n"),
                                            new SpecialTokensText("<|recipient|>all\n"),
                                            new SpecialTokensText("<|content|>"),
                                            response.result === undefined
                                                ? "" // "void"
                                                : JSON.stringify(response.result)
                                        ]),

                                    (isLastResponse && isLastItem)
                                        ? hasFunctions
                                            ? LlamaText([
                                                new SpecialTokensText("\n"),
                                                new SpecialTokensText("<|from|>assistant\n")
                                            ])
                                            : LlamaText([
                                                new SpecialTokensText("\n"),
                                                new SpecialTokensText("<|from|>assistant\n"),
                                                new SpecialTokensText("<|recipient|>all\n"),
                                                new SpecialTokensText("<|content|>")
                                            ])
                                        : LlamaText([])
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
                    LlamaText(new SpecialToken("EOS")),
                    LlamaText(new SpecialTokensText("<|stop|>")),
                    LlamaText(" <|stop|>"),
                    LlamaText("<|stop|>"),
                    LlamaText("\n<|from|>user"),
                    LlamaText("\n<|from|>assistant"),
                    LlamaText("\n<|from|>system"),

                    LlamaText(new SpecialTokensText(" <|stop|>")),
                    LlamaText(new SpecialTokensText("<|stop|>")),
                    LlamaText(new SpecialTokensText("\n<|from|>user")),
                    LlamaText(new SpecialTokensText("\n<|from|>assistant")),
                    LlamaText(new SpecialTokensText("\n<|from|>system"))
                ]
            };
        }

        const textResponseStart = [
            " \n",
            " \n\n",
            "\n",
            "n\n"
        ].flatMap((prefix) => [
            LlamaText(prefix + "<|from|>assistant\n<|recipient|>all\n<|content|>"),
            LlamaText(new SpecialTokensText(prefix + "<|from|>assistant\n<|recipient|>all\n<|content|>"))
        ]);

        return {
            contextText,
            stopGenerationTriggers: [
                LlamaText(new SpecialToken("EOS")),
                LlamaText(new SpecialTokensText("<|stop|>")),

                LlamaText(" <|stop|>"),
                LlamaText("<|stop|>"),
                LlamaText("\n<|from|>user"),

                LlamaText(new SpecialTokensText(" <|stop|>")),
                LlamaText(new SpecialTokensText("<|stop|>")),
                LlamaText(new SpecialTokensText("\n<|from|>user"))
            ],
            ignoreStartText: textResponseStart,
            functionCall: {
                initiallyEngaged: true,
                disengageInitiallyEngaged: textResponseStart
            }
        };
    }

    public override generateAvailableFunctionsSystemText(availableFunctions: ChatModelFunctions, {documentParams = true}: {
        documentParams?: boolean
    }) {
        const functionsDocumentationGenerator = new ChatModelFunctionsDocumentationGenerator(availableFunctions);

        if (!functionsDocumentationGenerator.hasAnyFunctions)
            return "";

        const availableFunctionNames = Object.keys(availableFunctions ?? {});

        if (availableFunctionNames.length === 0)
            return "";

        return [
            "// Supported function definitions that should be called when necessary.",
            "namespace functions {",
            "",
            functionsDocumentationGenerator.getTypeScriptFunctionTypes({documentParams, reservedFunctionNames: ["all"]}),
            "",
            "} // namespace functions"
        ].join("\n");
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
