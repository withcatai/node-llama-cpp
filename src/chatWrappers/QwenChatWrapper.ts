import {ChatWrapper, ChatWrapperJinjaMatchConfiguration} from "../ChatWrapper.js";
import {
    ChatModelFunctions, ChatModelResponse, ChatModelSegment, ChatWrapperCheckModelCompatibilityParams,
    ChatWrapperGenerateContextStateOptions, ChatWrapperGeneratedContextState, ChatWrapperSettings, isChatModelResponseFunctionCall,
    isChatModelResponseSegment
} from "../types.js";
import {LlamaText, SpecialToken, SpecialTokensText} from "../utils/LlamaText.js";
import {GgufArchitectureType} from "../gguf/types/GgufMetadataTypes.js";
import {ChatModelFunctionsDocumentationGenerator} from "./utils/ChatModelFunctionsDocumentationGenerator.js";

// source: https://huggingface.co/Qwen/Qwen2.5-14B-Instruct-1M/blob/main/tokenizer_config.json#L197
export class QwenChatWrapper extends ChatWrapper {
    public readonly wrapperName: string = "Qwen";

    public readonly keepOnlyLastThought: boolean;
    public readonly thoughts: "auto" | "discourage";

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
         * Control the usage of thoughts in the model responses.
         *
         * Defaults to `"auto"`.
         */
        thoughts?: "auto" | "discourage",

        /** @internal */
        _lineBreakBeforeFunctionCallPrefix?: boolean
    } = {}) {
        super();

        const {
            keepOnlyLastThought = true,
            thoughts = "auto",
            _lineBreakBeforeFunctionCallPrefix = false
        } = options;

        this.keepOnlyLastThought = keepOnlyLastThought;
        this.thoughts = thoughts;

        this.settings = {
            supportsSystemMessages: true,
            functions: {
                call: {
                    optionalPrefixSpace: true,
                    prefix: LlamaText([
                        _lineBreakBeforeFunctionCallPrefix
                            ? "\n"
                            : "",
                        new SpecialTokensText("<tool_call>"), '\n{"name": "'
                    ]),
                    paramsPrefix: '", "arguments": ',
                    suffix: LlamaText("}\n", new SpecialTokensText("</tool_call>")),
                    emptyCallParamsPlaceholder: {}
                },
                result: {
                    prefix: LlamaText(new SpecialTokensText("\n<tool_response>\n")),
                    suffix: LlamaText(new SpecialTokensText("\n</tool_response>"))
                },
                parallelism: {
                    call: {
                        sectionPrefix: "",
                        betweenCalls: _lineBreakBeforeFunctionCallPrefix
                            ? ""
                            : "\n",
                        sectionSuffix: LlamaText(new SpecialTokensText("<|im_end|>\n"))
                    },
                    result: {
                        sectionPrefix: LlamaText(new SpecialTokensText("<|im_start|>user")),
                        sectionSuffix: LlamaText(new SpecialTokensText("<|im_end|>\n<|im_start|>assistant\n"))
                    }
                }
            },
            segments: {
                reiterateStackAfterFunctionCalls: true,
                thought: {
                    prefix: LlamaText(new SpecialTokensText("<think>\n")),
                    suffix: LlamaText(new SpecialTokensText("\n</think>"))
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

        const resultItems: Array<{
            system: LlamaText,
            user: LlamaText,
            model: LlamaText
        }> = [];

        let systemTexts: LlamaText[] = [];
        let userTexts: LlamaText[] = [];
        let modelTexts: LlamaText[] = [];
        let currentAggregateFocus: "system" | null = null;

        function flush() {
            if (systemTexts.length > 0 || userTexts.length > 0 || modelTexts.length > 0)
                resultItems.push({
                    system: LlamaText.joinValues("\n\n", systemTexts),
                    user: LlamaText.joinValues("\n\n", userTexts),
                    model: LlamaText.joinValues("\n\n", modelTexts)
                });

            systemTexts = [];
            userTexts = [];
            modelTexts = [];
        }

        for (let i = 0; i < historyWithFunctions.length; i++) {
            const item = historyWithFunctions[i]!;
            const isLastItem = i === historyWithFunctions.length - 1;

            if (item.type === "system") {
                if (currentAggregateFocus !== "system")
                    flush();

                currentAggregateFocus = "system";
                systemTexts.push(LlamaText.fromJSON(item.text));
            } else if (item.type === "user") {
                flush();

                currentAggregateFocus = null;
                userTexts.push(LlamaText(item.text));
            } else if (item.type === "model") {
                flush();

                const transformedModelResponse = (this.thoughts === "discourage" && isLastItem)
                    ? discourageThoughtsInModelResponse(item.response)
                    : item.response;

                currentAggregateFocus = null;
                modelTexts.push(
                    this.generateModelResponseText(
                        (this.keepOnlyLastThought && !isLastItem)
                            ? transformedModelResponse.filter((response) => (
                                !isChatModelResponseSegment(response) || response.segmentType !== "thought"
                            ))
                            : transformedModelResponse
                    )
                );
            } else
                void (item satisfies never);
        }

        flush();

        const contextText = LlamaText(
            resultItems.map(({system, user, model}, index) => {
                const isLastItem = index === resultItems.length - 1;

                return LlamaText([
                    (system.values.length === 0)
                        ? LlamaText([])
                        : LlamaText([
                            new SpecialTokensText("<|im_start|>system\n"),
                            system,
                            new SpecialTokensText("<|im_end|>\n")
                        ]),

                    (user.values.length === 0)
                        ? LlamaText([])
                        : LlamaText([
                            new SpecialTokensText("<|im_start|>user\n"),
                            user,
                            new SpecialTokensText("<|im_end|>\n")
                        ]),

                    (model.values.length === 0 && !isLastItem)
                        ? LlamaText([])
                        : LlamaText([
                            new SpecialTokensText("<|im_start|>assistant\n"),
                            model,

                            isLastItem
                                ? LlamaText([])
                                : new SpecialTokensText("<|im_end|>\n")
                        ])
                ]);
            })
        );

        return {
            contextText,
            stopGenerationTriggers: [
                LlamaText(new SpecialToken("EOS")),
                LlamaText(new SpecialTokensText("<|im_end|>")),
                LlamaText("<|im_end|>")
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
            "# Tools",
            "",
            "You may call one or more functions to assist with the user query.",
            "",
            LlamaText("You are provided with function signatures within ", new SpecialTokensText("<tools></tools>"), " XML tags:"),
            LlamaText(new SpecialTokensText("<tools>")),
            functionsDocumentationGenerator.getQwenFunctionSignatures({documentParams}),
            LlamaText(new SpecialTokensText("</tools>")),
            "",
            LlamaText("For each function call, return a json object with function name and arguments within ", new SpecialTokensText("<tool_call></tool_call>"), " XML tags:"),
            LlamaText(new SpecialTokensText("<tool_call>")),
            '{"name": <function-name>, "arguments": <args-json-object>}',
            LlamaText(new SpecialTokensText("</tool_call>"))
        ]);
    }

    /** @internal */
    public static override _checkModelCompatibility(options: ChatWrapperCheckModelCompatibilityParams): boolean {
        const architecture = options.fileInfo?.metadata.general.architecture;
        return (
            architecture == null ||
            architecture === GgufArchitectureType.qwen2 ||
            architecture === GgufArchitectureType.qwen2moe ||
            architecture === GgufArchitectureType.qwen2vl ||
            architecture === GgufArchitectureType.qwen3 ||
            architecture === GgufArchitectureType.qwen3moe ||
            architecture === GgufArchitectureType.qwen3vl ||
            architecture === GgufArchitectureType.qwen3vlmoe
        );
    }

    /** @internal */
    public static override _getOptionConfigurationsToTestIfCanSupersedeJinjaTemplate(): ChatWrapperJinjaMatchConfiguration<typeof this> {
        return [
            [{}, {}, {_requireFunctionCallSettingsExtraction: true}],
            [{_lineBreakBeforeFunctionCallPrefix: true}, {}, {_requireFunctionCallSettingsExtraction: true}],
            [{thoughts: "discourage"}, {}, {_requireFunctionCallSettingsExtraction: true}],
            [{thoughts: "discourage", _lineBreakBeforeFunctionCallPrefix: true}, {}, {_requireFunctionCallSettingsExtraction: true}]
        ];
    }
}

function discourageThoughtsInModelResponse(response: ChatModelResponse["response"]) {
    const emptyThought: ChatModelSegment = {
        type: "segment",
        segmentType: "thought",
        ended: true,
        text: "\n\n",
        raw: LlamaText(new SpecialTokensText("<think>\n\n</think>\n\n")).toJSON()
    };
    const res: ChatModelResponse["response"] = [...response];

    for (let i = res.length - 1; i >= 0; i--) {
        const item = res[i];

        if (isChatModelResponseFunctionCall(item)) {
            res.splice(i + 1, 0, emptyThought);
            return res;
        }
    }

    res.unshift(emptyThought);
    return res;
}
