import {ChatWrapper, ChatWrapperJinjaMatchConfiguration} from "../ChatWrapper.js";
import {
    ChatModelFunctions, ChatWrapperGenerateContextStateOptions, ChatWrapperGeneratedContextState, ChatWrapperSettings,
    isChatModelResponseSegment
} from "../types.js";
import {SpecialToken, LlamaText, SpecialTokensText} from "../utils/LlamaText.js";
import {ChatModelFunctionsDocumentationGenerator} from "./utils/ChatModelFunctionsDocumentationGenerator.js";
import {jsonDumps} from "./utils/jsonDumps.js";


export class DeepSeekChatWrapper extends ChatWrapper {
    public readonly wrapperName: string = "DeepSeek";

    public readonly keepOnlyLastThought: boolean;
    public readonly functionCallingSyntax: "r1-workaround" | "simplified" | "original";
    public readonly parallelFunctionCalling: boolean;

    public override readonly settings: ChatWrapperSettings;

    public constructor(options: {
        /**
         * Whether to keep only the chain of thought from the last model response.
         *
         * Setting this to `false` will keep all the chain of thoughts from the model responses in the context state.
         *
         * Defaults to `true`.
         */
        keepOnlyLastThought?: boolean,

        /**
         * Use a different variation function calling syntax to improve syntax compliance.
         *
         * Defaults to `"r1-workaround"`.
         */
        functionCallingSyntax?: "r1-workaround" | "simplified" | "original",

        /**
         * Support parallel function calling.
         *
         * May not work well with all distill model variations, as some distillation models make unnecessary additional calls in parallel.
         *
         * Defaults to `false`.
         */
        parallelFunctionCalling?: boolean
    } = {}) {
        super();

        const {
            keepOnlyLastThought = true,
            functionCallingSyntax = "r1-workaround",
            parallelFunctionCalling = false
        } = options;

        this.keepOnlyLastThought = keepOnlyLastThought;
        this.functionCallingSyntax = functionCallingSyntax;
        this.parallelFunctionCalling = parallelFunctionCalling;

        const getFunctionsSettings = (): ChatWrapperSettings["functions"] => {
            if (functionCallingSyntax === "original") {
                if (parallelFunctionCalling)
                    return {
                        call: {
                            optionalPrefixSpace: true,
                            prefix: LlamaText(new SpecialTokensText("<｜tool▁call▁begin｜>function<｜tool▁sep｜>")),
                            paramsPrefix: LlamaText(new SpecialTokensText("\n```json\n")),
                            suffix: LlamaText([new SpecialTokensText("\n```<｜tool▁call▁end｜>")])
                        },
                        result: {
                            prefix: LlamaText(new SpecialTokensText("<｜tool▁output▁begin｜>")),
                            suffix: LlamaText(new SpecialTokensText("<｜tool▁output▁end｜>"))
                        },
                        parallelism: {
                            call: {
                                sectionPrefix: LlamaText(new SpecialTokensText("<｜tool▁calls▁begin｜>")),
                                betweenCalls: LlamaText(new SpecialTokensText("\n")),
                                sectionSuffix: LlamaText(new SpecialTokensText("<｜tool▁calls▁end｜><｜end▁of▁sentence｜>"))
                            },
                            result: {
                                sectionPrefix: LlamaText(new SpecialTokensText("<｜tool▁outputs▁begin｜>")),
                                betweenResults: LlamaText(new SpecialTokensText("\n")),
                                sectionSuffix: LlamaText(new SpecialTokensText("<｜tool▁outputs▁end｜><｜Assistant｜>"))
                            }
                        }
                    };
                else
                    return {
                        call: {
                            optionalPrefixSpace: true,
                            prefix: LlamaText(new SpecialTokensText("<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>function<｜tool▁sep｜>")),
                            paramsPrefix: LlamaText(new SpecialTokensText("\n```json\n")),
                            suffix: LlamaText([new SpecialTokensText("\n```<｜tool▁call▁end｜><｜tool▁calls▁end｜><｜end▁of▁sentence｜>")])
                        },
                        result: {
                            prefix: LlamaText(new SpecialTokensText("<｜tool▁outputs▁begin｜><｜tool▁output▁begin｜>")),
                            suffix: LlamaText(new SpecialTokensText("<｜tool▁output▁end｜><｜tool▁outputs▁end｜><｜Assistant｜>"))
                        }
                    };
            } else if (functionCallingSyntax === "simplified") {
                if (parallelFunctionCalling)
                    return {
                        call: {
                            optionalPrefixSpace: true,
                            prefix: LlamaText(new SpecialTokensText("<｜tool▁call▁begin｜>")),
                            paramsPrefix: LlamaText(new SpecialTokensText("<｜tool▁sep｜>\n```json\n")),
                            suffix: LlamaText([new SpecialTokensText("\n```<｜tool▁call▁end｜>")])
                        },
                        result: {
                            prefix: LlamaText(new SpecialTokensText("<｜tool▁output▁begin｜>")),
                            suffix: LlamaText(new SpecialTokensText("<｜tool▁output▁end｜>"))
                        },
                        parallelism: {
                            call: {
                                sectionPrefix: LlamaText(new SpecialTokensText("<｜tool▁calls▁begin｜>")),
                                betweenCalls: LlamaText(new SpecialTokensText("\n")),
                                sectionSuffix: LlamaText(new SpecialTokensText("<｜tool▁calls▁end｜><｜end▁of▁sentence｜>"))
                            },
                            result: {
                                sectionPrefix: LlamaText(new SpecialTokensText("<｜tool▁outputs▁begin｜>")),
                                betweenResults: LlamaText(new SpecialTokensText("\n")),
                                sectionSuffix: LlamaText(new SpecialTokensText("<｜tool▁outputs▁end｜>"))
                            }
                        }
                    };
                else
                    return {
                        call: {
                            optionalPrefixSpace: true,
                            prefix: LlamaText(new SpecialTokensText("<｜tool▁call▁begin｜>")),
                            paramsPrefix: LlamaText(new SpecialTokensText("<｜tool▁sep｜>\n```json\n")),
                            suffix: LlamaText([new SpecialTokensText("\n```<｜tool▁call▁end｜><｜end▁of▁sentence｜>")])
                        },
                        result: {
                            prefix: LlamaText(new SpecialTokensText("<｜tool▁output▁begin｜>")),
                            suffix: LlamaText(new SpecialTokensText("<｜tool▁output▁end｜>"))
                        }
                    };
            }

            void (functionCallingSyntax satisfies "r1-workaround");
            if (parallelFunctionCalling)
                throw new Error(
                    `parallel function calling is not supported with "${"r1-workaround" satisfies typeof functionCallingSyntax}" syntax`
                );

            return {
                call: {
                    optionalPrefixSpace: true,
                    prefix: LlamaText(new SpecialTokensText("<function=")),
                    paramsPrefix: LlamaText(new SpecialTokensText(">")),
                    suffix: LlamaText(new SpecialTokensText("</function>"))
                },
                result: {
                    prefix: LlamaText(new SpecialTokensText("<｜tool▁output▁begin｜>")),
                    suffix: LlamaText(new SpecialTokensText("<｜tool▁output▁end｜>\n"))
                }
            };
        };

        this.settings = {
            supportsSystemMessages: true,
            functions: getFunctionsSettings(),
            segments: {
                reiterateStackAfterFunctionCalls: true,
                thought: {
                    prefix: LlamaText(new SpecialTokensText("<think>")),
                    suffix: LlamaText(new SpecialTokensText("</think>")),
                    reopenAfterFunctionCalls: functionCallingSyntax === "simplified"
                }
            }
        };
    }

    public override generateContextState({
        chatHistory, availableFunctions, documentFunctionParams
    }: ChatWrapperGenerateContextStateOptions): ChatWrapperGeneratedContextState {
        const historyWithFunctions = this.addAvailableFunctionsSystemMessageToHistory(chatHistory, availableFunctions, {
            documentParams: documentFunctionParams
        });

        const systemTexts = historyWithFunctions
            .filter((item) => item.type === "system")
            .map((item) => LlamaText.fromJSON(item.text));

        const contextText = LlamaText(
            new SpecialToken("BOS"),
            LlamaText.joinValues("\n\n", systemTexts),
            historyWithFunctions.map((item, index) => {
                const isLastItem = index === historyWithFunctions.length - 1;

                // system messages are already prepended at the beginning
                if (item.type === "system")
                    return LlamaText([]);

                if (item.type === "user")
                    return LlamaText([
                        new SpecialTokensText("<｜User｜>"),
                        item.text
                    ]);
                else if (item.type === "model")
                    return LlamaText([
                        new SpecialTokensText("<｜Assistant｜>"),
                        this.generateModelResponseText(
                            (this.keepOnlyLastThought && !isLastItem)
                                ? item.response.filter((response) => (
                                    !isChatModelResponseSegment(response) || response.segmentType !== "thought"
                                ))
                                : item.response
                        ),
                        isLastItem
                            ? LlamaText([])
                            : new SpecialTokensText("<｜end▁of▁sentence｜>")
                    ]);

                void (item satisfies never);
                return LlamaText([]);
            })
        );

        return {
            contextText,
            stopGenerationTriggers: [
                LlamaText(new SpecialToken("EOS")),
                LlamaText(new SpecialToken("EOT")),
                LlamaText(new SpecialTokensText("<｜end▁of▁sentence｜>")),
                LlamaText(new SpecialTokensText("<｜User｜>"))
            ]
        };
    }

    public override generateAvailableFunctionsSystemText(availableFunctions: ChatModelFunctions, {documentParams = true}: {
        documentParams?: boolean
    }) {
        const functionsDocumentationGenerator = new ChatModelFunctionsDocumentationGenerator(availableFunctions);

        if (!functionsDocumentationGenerator.hasAnyFunctions)
            return LlamaText([]);

        if (this.functionCallingSyntax === "r1-workaround") {
            return LlamaText.joinValues("\n", [
                "The assistant calls the provided functions as needed to retrieve information instead of relying on existing knowledge.",
                "To fulfill a request, the assistant calls relevant functions in advance when needed before responding to the request, and does not tell the user prior to calling a function.",
                "If the result of function calls from previous turns might be stale, the assistant will call the functions again if needed.",
                // "The assistant NEVER relies on existing knowledge when there's a function that can be used instead.",
                "Provided functions:",
                functionsDocumentationGenerator.getLlama3_2LightweightFunctionSignatures({documentParams}),
                "",
                "Calling any of the provided functions can be done like this:",
                LlamaText.joinValues("", [
                    this.settings.functions.call.prefix,
                    "getSomeInfo",
                    this.settings.functions.call.paramsPrefix,
                    jsonDumps({someKey: "someValue"}),
                    this.settings.functions.call.suffix
                ]),
                "",
                LlamaText(["Note that the verbatim ", this.settings.functions.call.prefix, " prefix is mandatory."]),
                "",
                "The assistant never assumes the results of function calls, and instead uses the raw results directly for processing.",
                "The assistant does not inform the user about using functions and does not explain anything before calling a function.",
                "After calling a function, the raw result appears afterwards and is not part of the conversation.",
                "To make information be part of the conversation, the assistant paraphrases and repeats the information without the function syntax.",
                "The assistant never repeats itself unless necessary."
            ]);
        }

        return LlamaText.joinValues("\n", [
            "You have access to the following functions:",
            functionsDocumentationGenerator.getLlama3_2LightweightFunctionSignatures({documentParams}),
            "",
            this.parallelFunctionCalling
                ? LlamaText.joinValues("\n", [
                    "If you choose to call a function, use the following format:",
                    LlamaText([
                        this.settings.functions.parallelism!.call.sectionPrefix,
                        this.settings.functions.call.prefix,
                        "funcName",
                        this.settings.functions.call.paramsPrefix,
                        "parameters",
                        this.settings.functions.call.suffix,
                        this.settings.functions.parallelism!.call.sectionSuffix!
                    ]),
                    "where",
                    "",
                    "funcName => the function name to call",
                    "parameters => a JSON dict with the function arguments",
                    // "",
                    // "Note that the following syntax is mandatory to precede the function name:",
                    // LlamaText([
                    //     this.settings.functions.parallelism!.call.sectionPrefix,
                    //     this.settings.functions.call.prefix
                    // ]),
                    "",
                    "You can call multiple functions in parallel using the following format:",
                    LlamaText([
                        this.settings.functions.parallelism!.call.sectionPrefix,
                        this.settings.functions.call.prefix,
                        "funcName1",
                        this.settings.functions.call.paramsPrefix,
                        "parameters1",
                        this.settings.functions.call.suffix,
                        this.settings.functions.parallelism!.call.betweenCalls ?? "",
                        this.settings.functions.call.prefix,
                        "funcName2",
                        this.settings.functions.call.paramsPrefix,
                        "parameters2",
                        this.settings.functions.call.suffix,
                        this.settings.functions.parallelism!.call.sectionSuffix!
                    ])
                ])
                : LlamaText.joinValues("\n", [
                    "If you choose to call a function, use the following format:",
                    LlamaText.joinValues("", [
                        this.settings.functions.call.prefix,
                        "funcName",
                        this.settings.functions.call.paramsPrefix,
                        "parameters",
                        this.settings.functions.call.suffix
                    ]),
                    "where",
                    "",
                    "funcName => the function name to call",
                    "parameters => a JSON dict with the function arguments"
                ]),
            "",
            "Reminder:",
            "- Function calls MUST follow the specified format verbatim",
            this.parallelFunctionCalling
                ? LlamaText.joinValues("\n", [
                    "- You can call a single or multiple functions at a time, their responses will appear afterwards in the order they were called",
                    "- After calling functions, the results will appear afterwards and are visible only to you"
                ])
                : LlamaText.joinValues("\n", [
                    "- Only call one function at a time",
                    "- After calling a function, the result will appear afterwards and is visible only to you"
                ]),
            "- Do not inform the user about using functions and do not explain anything before calling a function",
            "- After calling a function, the raw result appears afterwards and is not part of the conversation.",
            "- To make information be part of the conversation, paraphrase and repeat the information without the function syntax.",
            "- To make information visible to the user, you MUST include it in your response",
            "- Call functions when needed and avoid redundant calls",
            "- NEVER speak about functions, just use them",
            "- NEVER tell the user about the functions you are using",
            "- NEVER repeat yourself unless necessary",
            LlamaText([
                "- After calling a function, use ", new SpecialTokensText("</think>"), " to finish thinking and respond to the user"
            ])
        ]);
    }

    /** @internal */
    public static override _getOptionConfigurationsToTestIfCanSupersedeJinjaTemplate(): ChatWrapperJinjaMatchConfiguration<typeof this> {
        return [
            [undefined, {}, {functionCallMessageTemplate: "noJinja"}],
            [undefined, {keepOnlyLastThought: true}, {functionCallMessageTemplate: "noJinja"}],
            [undefined, {functionCallingSyntax: "simplified"}, {functionCallMessageTemplate: "noJinja"}],
            [undefined, {functionCallingSyntax: "simplified", keepOnlyLastThought: true}, {functionCallMessageTemplate: "noJinja"}],
            [undefined, {functionCallingSyntax: "original"}, {functionCallMessageTemplate: "noJinja"}],
            [undefined, {functionCallingSyntax: "original", keepOnlyLastThought: true}, {functionCallMessageTemplate: "noJinja"}]
        ];
    }
}
