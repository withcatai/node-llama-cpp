import {ChatWrapper, ChatWrapperJinjaMatchConfiguration} from "../ChatWrapper.js";
import {
    ChatModelFunctions,
    ChatWrapperGenerateContextStateOptions,
    ChatWrapperGeneratedContextState,
    ChatWrapperSettings,
    isChatModelResponseSegment
} from "../types.js";
import {SpecialToken, LlamaText, SpecialTokensText} from "../utils/LlamaText.js";
import {ChatModelFunctionsDocumentationGenerator} from "./utils/ChatModelFunctionsDocumentationGenerator.js";


export class DeepSeekChatWrapper extends ChatWrapper {
    public readonly wrapperName: string = "DeepSeek";

    public readonly keepOnlyLastThought: boolean;

    public override readonly settings: ChatWrapperSettings = {
        supportsSystemMessages: true,
        functions: {
            call: {
                optionalPrefixSpace: true,
                prefix: LlamaText(new SpecialTokensText("<｜tool▁call▁begin｜>function<｜tool▁sep｜>")),
                paramsPrefix: LlamaText("\n```json\n"),
                suffix: LlamaText(["\n```", new SpecialTokensText("<｜tool▁call▁end｜>")])
            },
            result: {
                prefix: LlamaText(new SpecialTokensText("<｜tool▁output▁begin｜>")),
                suffix: LlamaText(new SpecialToken("EOT"), new SpecialTokensText("<｜tool▁output▁end｜>"))
            },
            parallelism: {
                call: {
                    sectionPrefix: LlamaText(new SpecialTokensText("<｜tool▁calls▁begin｜>")),
                    betweenCalls: LlamaText("\n"),
                    sectionSuffix: LlamaText(new SpecialTokensText("<｜tool▁calls▁end｜><｜end▁of▁sentence｜>"))
                },
                result: {
                    sectionPrefix: LlamaText(new SpecialTokensText("<｜tool▁outputs▁begin｜>")),
                    betweenResults: LlamaText("\n"),
                    sectionSuffix: LlamaText(new SpecialTokensText("<｜tool▁outputs▁end｜>"))
                }
            }
        },
        segments: {
            thought: {
                prefix: LlamaText(new SpecialTokensText("<think>")),
                suffix: LlamaText(new SpecialTokensText("</think>"))
            }
        }
    };

    public constructor(options: {
        /**
         * Whether to keep only the chain of thought from the last model response.
         *
         * Setting this to `false` will keep all the chain of thoughts from the model responses in the context state.
         *
         * Defaults to `true`.
         */
        keepOnlyLastThought?: boolean
    } = {}) {
        super();

        const {
            keepOnlyLastThought = true
        } = options;

        this.keepOnlyLastThought = keepOnlyLastThought;
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

        return LlamaText.joinValues("\n", [
            "You have access to the following functions:",
            "",
            functionsDocumentationGenerator.getLlama3_2LightweightFunctionSignatures({documentParams}),
            "",
            "",
            "If you choose to call a function ONLY reply in the following format:",
            LlamaText.joinValues("", [
                this.settings.functions.parallelism!.call.sectionPrefix,
                this.settings.functions.call.prefix,
                "functionName",
                this.settings.functions.call.paramsPrefix,
                "parameters",
                this.settings.functions.call.prefix,
                this.settings.functions.parallelism!.call.sectionSuffix!
            ]),
            "where",
            "",
            "functionName => the function name to call",
            "parameters => a JSON dict with the function arguments",
            "",
            "",
            "You can call multiple functions in parallel using the following format:",
            LlamaText.joinValues("", [
                this.settings.functions.parallelism!.call.sectionPrefix,
                this.settings.functions.call.prefix,
                "functionName1",
                this.settings.functions.call.paramsPrefix,
                "parameters1",
                this.settings.functions.call.prefix,
                this.settings.functions.parallelism!.call.betweenCalls!,
                this.settings.functions.call.prefix,
                "functionName2",
                this.settings.functions.call.paramsPrefix,
                "parameters2",
                this.settings.functions.call.prefix,
                this.settings.functions.parallelism!.call.sectionSuffix!
            ]),
            "",
            "Reminder:",
            "- Function calls MUST follow the specified format",
            "- You can call multiple functions at a time, their responses will appear in the order they were called"
        ]);
    }

    /** @internal */
    public static override _getOptionConfigurationsToTestIfCanSupersedeJinjaTemplate() {
        return [
            {},
            {keepOnlyLastThought: true}
        ] satisfies ChatWrapperJinjaMatchConfiguration<typeof this>;
    }
}
