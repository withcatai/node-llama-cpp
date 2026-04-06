import {ChatWrapper, ChatWrapperJinjaMatchConfiguration} from "../ChatWrapper.js";
import {
    ChatModelFunctionCall, ChatModelFunctions, ChatModelResponse, ChatWrapperGenerateContextStateOptions, ChatWrapperGeneratedContextState,
    ChatWrapperSettings
} from "../types.js";
import {LlamaText, SpecialToken, SpecialTokensText} from "../utils/LlamaText.js";
import {jsonDumps} from "./utils/jsonDumps.js";

// source: https://ai.google.dev/gemma/docs/core/prompt-formatting-gemma4
export class Gemma4ChatWrapper extends ChatWrapper {
    public readonly wrapperName: string = "Gemma 4";

    public readonly reasoning: boolean;
    public readonly keepOnlyLastThought: boolean;

    public override readonly settings: ChatWrapperSettings = {
        supportsSystemMessages: true,
        functions: {
            call: {
                optionalPrefixSpace: false,
                prefix: LlamaText(new SpecialTokensText("<|tool_call>call:")),
                paramsPrefix: "{",
                suffix: LlamaText(new SpecialTokensText("}<tool_call|>")),
                emptyCallParamsPlaceholder: undefined
            },
            result: {
                prefix: LlamaText(new SpecialTokensText("<tool_response>response:"), "{{functionName}}", "{"),
                suffix: LlamaText(new SpecialTokensText("}</tool_response>"))
            }
        },
        segments: {
            reiterateStackAfterFunctionCalls: true,
            thought: {
                prefix: LlamaText(new SpecialTokensText("<|channel>thought\n")),
                suffix: LlamaText(new SpecialTokensText("<channel|>"))
            }
        }
    };

    public constructor(options: {
        /**
         * Whether to promote the model to perform reasoning.
         *
         * Defaults to `true`.
         */
        reasoning?: boolean,

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
            reasoning = true,
            keepOnlyLastThought = true
        } = options;

        this.reasoning = reasoning;
        this.keepOnlyLastThought = keepOnlyLastThought;
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

        if (hasFunctions)
            systemMessage = LlamaText([
                systemMessage,
                this.generateAvailableFunctionsSystemText(availableFunctions ?? {}, {documentParams: documentFunctionParams})
            ]);

        if (this.reasoning)
            systemMessage = LlamaText([
                new SpecialTokensText("<|think|>"),
                systemMessage
            ]);

        if (systemMessage.values.length > 0)
            modifiedChatHistory.unshift({
                type: "system",
                text: systemMessage.toJSON()
            });

        const contextContent: LlamaText[] = [
            LlamaText(new SpecialToken("BOS"))
        ];

        for (let i = 0; i < modifiedChatHistory.length; i++) {
            const isLastItem = i === modifiedChatHistory.length - 1;
            const item = modifiedChatHistory[i];

            if (item == null)
                continue;

            if (item.type === "system")
                contextContent.push(
                    LlamaText([
                        new SpecialTokensText("<|turn>system\n"),
                        LlamaText.fromJSON(item.text),
                        isLastItem
                            ? LlamaText([])
                            : new SpecialTokensText("<turn|>\n")
                    ])
                );
            else if (item.type === "user")
                contextContent.push(
                    LlamaText([
                        new SpecialTokensText("<|turn>user\n"),
                        item.text,
                        isLastItem
                            ? LlamaText([])
                            : new SpecialTokensText("<turn|>\n")
                    ])
                );
            else if (item.type === "model")
                contextContent.push(this._getModelResponse(item.response, true, isLastItem, this.keepOnlyLastThought));
            else
                void (item satisfies never);
        }

        return {
            contextText: LlamaText(contextContent),
            stopGenerationTriggers: [
                LlamaText(new SpecialToken("EOS")),
                LlamaText(new SpecialToken("EOT")),
                LlamaText(new SpecialTokensText("<turn|>")),
                LlamaText(new SpecialTokensText("<turn|>\n")),
                LlamaText("<|return|>")
            ]
        };
    }

    public override generateAvailableFunctionsSystemText(availableFunctions: ChatModelFunctions, {documentParams = true}: {
        documentParams?: boolean
    }): LlamaText {
        return LlamaText(
            Object.entries(availableFunctions)
                .map(([name, definition]) => {
                    return LlamaText([
                        new SpecialTokensText("<|tool>"),
                        "declaration:", name, "{",
                        jsonDumps({
                            description: definition.description || undefined,
                            parameters: documentParams
                                ? (definition.params || {})
                                : undefined
                        }),
                        "}", new SpecialTokensText("<tool|>")
                    ]);
                })
        );
    }

    public override generateModelResponseText(modelResponse: ChatModelResponse["response"], useRawValues: boolean = true): LlamaText {
        return this._getModelResponse(modelResponse, useRawValues, false, false);
    }

    /** @internal */
    private _getModelResponse(
        modelResponse: ChatModelResponse["response"],
        useRawValues: boolean,
        isLastItem: boolean,
        keepOnlyLastThought: boolean
    ) {
        const res: LlamaText[] = [
            LlamaText(new SpecialTokensText("<|turn>model\n"))
        ];
        const pendingFunctionCalls: ChatModelFunctionCall[] = [];

        const addPendingFunctions = () => {
            if (pendingFunctionCalls.length === 0)
                return;

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
                res.push(LlamaText(response));
            } else if (response.type === "segment") {
                addPendingFunctions();

                if (response.ended && response.raw != null && useRawValues)
                    res.push(LlamaText.fromJSON(response.raw));
                else if (response.segmentType === "thought") {
                    if (keepOnlyLastThought && !isLastItem)
                        continue;

                    res.push(
                        LlamaText([
                            new SpecialTokensText("<|channel>thought"),
                            response.text,
                            (isLastItem && !response.ended)
                                ? LlamaText([])
                                : new SpecialTokensText("<channel|>")
                        ])
                    );
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

        return LlamaText(res);
    }

    /** @internal */
    public static override _getOptionConfigurationsToTestIfCanSupersedeJinjaTemplate(): ChatWrapperJinjaMatchConfiguration<typeof this> {
        return [
            [{}, {}],
            [{reasoning: false}, {}],
            [
                {reasoning: true},
                {},
                {additionalRenderParameters: {"enable_thinking": true}}
            ]
        ];
    }
}
