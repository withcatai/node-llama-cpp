import {ChatWrapper, ChatWrapperJinjaMatchConfiguration} from "../ChatWrapper.js";
import {
    ChatModelFunctions, ChatWrapperGenerateContextStateOptions, ChatWrapperGeneratedContextState, ChatWrapperSettings,
    isChatModelResponseSegment
} from "../types.js";
import {SpecialToken, LlamaText, SpecialTokensText} from "../utils/LlamaText.js";
import {ChatModelFunctionsDocumentationGenerator} from "./utils/ChatModelFunctionsDocumentationGenerator.js";


export class DeepSeekChatWrapper extends ChatWrapper {
    public readonly wrapperName: string = "DeepSeek";

    public readonly keepOnlyLastThought: boolean;
    public readonly functionCallingSyntax: "simplified" | "original";
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
         * Use a simplified function calling syntax to improve syntax compliance.
         *
         * Defaults to `"simplified"`.
         */
        functionCallingSyntax?: "simplified" | "original",

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
            functionCallingSyntax = "simplified",
            parallelFunctionCalling = false
        } = options;

        this.keepOnlyLastThought = keepOnlyLastThought;
        this.functionCallingSyntax = functionCallingSyntax;
        this.parallelFunctionCalling = parallelFunctionCalling;

        this.settings = {
            supportsSystemMessages: true,
            functions: this.parallelFunctionCalling
                ? {
                    call: this.functionCallingSyntax === "simplified"
                        ? {
                            optionalPrefixSpace: true,
                            prefix: LlamaText(new SpecialTokensText("<｜tool▁call▁begin｜>")),
                            paramsPrefix: LlamaText(new SpecialTokensText("<｜tool▁sep｜>\n```json\n")),
                            suffix: LlamaText([new SpecialTokensText("\n```<｜tool▁call▁end｜>")])
                        }
                        : {
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
                            sectionSuffix: this.functionCallingSyntax === "simplified"
                                ? LlamaText(new SpecialTokensText("<｜tool▁outputs▁end｜>"))
                                : LlamaText(new SpecialTokensText("<｜tool▁outputs▁end｜><｜Assistant｜>"))
                        }
                    }
                }
                : {
                    call: this.functionCallingSyntax === "simplified"
                        ? {
                            optionalPrefixSpace: true,
                            prefix: LlamaText(new SpecialTokensText("<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>")),
                            paramsPrefix: LlamaText(new SpecialTokensText("<｜tool▁sep｜>\n```json\n")),
                            suffix: LlamaText([new SpecialTokensText("\n```<｜tool▁call▁end｜><｜tool▁calls▁end｜><｜end▁of▁sentence｜>")])
                        }
                        : {
                            optionalPrefixSpace: true,
                            prefix: LlamaText(new SpecialTokensText("<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>function<｜tool▁sep｜>")),
                            paramsPrefix: LlamaText(new SpecialTokensText("\n```json\n")),
                            suffix: LlamaText([new SpecialTokensText("\n```<｜tool▁call▁end｜><｜tool▁calls▁end｜><｜end▁of▁sentence｜>")])
                        },
                    result: {
                        prefix: LlamaText(new SpecialTokensText("<｜tool▁outputs▁begin｜><｜tool▁output▁begin｜>")),
                        suffix: this.functionCallingSyntax === "simplified"
                            ? LlamaText(new SpecialTokensText("<｜tool▁output▁end｜><｜tool▁outputs▁end｜>"))
                            : LlamaText(new SpecialTokensText("<｜tool▁output▁end｜><｜tool▁outputs▁end｜><｜Assistant｜>"))
                    }
                },
            segments: {
                reiterateStackAfterFunctionCalls: true,
                thought: {
                    prefix: LlamaText(new SpecialTokensText("<think>")),
                    suffix: LlamaText(new SpecialTokensText("</think>"))
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

        const getFunctionCallingFormat = () => {
            if (!this.parallelFunctionCalling)
                return LlamaText.joinValues("\n", [
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
                    // "Note that the following syntax is mandatory to precede the function name:",
                    // this.settings.functions.call.prefix,
                ]);

            return LlamaText.joinValues("\n", [
                LlamaText.joinValues("", [
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
                // "Note that the following syntax is mandatory to precede the function name:",
                // this.settings.functions.call.prefix,
                "",
                "",
                "You can call multiple functions in parallel using the following format:",
                LlamaText.joinValues("", [
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
            ]);
        };

        return LlamaText.joinValues("\n", [
            "You have access to the following functions:",
            "",
            functionsDocumentationGenerator.getLlama3_2LightweightFunctionSignatures({documentParams}),
            "",
            "",
            "If you choose to call a function ONLY reply in the following format:",
            getFunctionCallingFormat(),
            "",
            "Reminder:",
            "- Function calls MUST follow the specified format verbatim",
            this.parallelFunctionCalling
                ? "- You can a single or multiple functions at a time, their responses will appear afterwards in the order they were called"
                : "- After calling a function, the result will appear afterwards and is only visible to you",
            "- After calling functions, the results will appear afterwards and are only visible to you",
            "- To make information visible to the user, you must include it in your response",
            "- Only call functions when needed, avoid redundant calls",
            LlamaText([
                "- After calling a function, ALWAYS use ", new SpecialTokensText("<think>"), " AGAIN to think"
            ])
        ]);
    }

    /** @internal */
    public static override _getOptionConfigurationsToTestIfCanSupersedeJinjaTemplate() {
        return [
            {},
            {keepOnlyLastThought: true},
            {functionCallingSyntax: "original"},
            {functionCallingSyntax: "original", keepOnlyLastThought: true}
        ] satisfies ChatWrapperJinjaMatchConfiguration<typeof this>;
    }
}
