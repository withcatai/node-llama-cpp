import {ChatWrapperSettings, Tokenizer} from "../../../types.js";
import {LlamaText, SpecialTokensText} from "../../../utils/LlamaText.js";
import {tryMatrix} from "../../../utils/optionsMatrix.js";
import {removeUndefinedFields} from "../../../utils/removeNullFields.js";
import {OpenAiChatMessage} from "../../../utils/OpenAIFormat.js";
import {UniqueIdGenerator} from "./UniqueIdGenerator.js";

const knownThinkingSegmentControls = new Map([
    ["<think>", "</think>"], // DeepSeek, QwQ
    ["<thought>", "</thought>"], // EXAONE Deep
    ["[THINK]", "[/THINK]"], // Mistral
    ["<|START_THINKING|>", "<|END_THINKING|>"], // Command R7B
    ["<|begin_of_thought|>", "<|end_of_thought|>"] // JoyAI
]);

export function extractSegmentSettingsFromTokenizerAndChatTemplate({
    chatTemplate,
    tokenizer,
    renderRawJinjaTemplate,
    idsGenerator,
    enableReasoning
}: {
    chatTemplate: string | undefined,
    tokenizer: Tokenizer | undefined,
    renderRawJinjaTemplate(params: Record<string, any>): string,
    idsGenerator: UniqueIdGenerator,
    enableReasoning: boolean | null
}): {
    settings: ChatWrapperSettings["segments"],
    keepOnlyLastThought?: boolean
} {
    function tryMatchPrefixSuffixPair(tryMatchGroups: Iterable<[prefix: string, suffix: string]>) {
        if (chatTemplate != null) {
            for (const [prefix, suffix] of tryMatchGroups) {
                if (
                    (
                        hasAll(chatTemplate.replaceAll(prefix + "\\n\\n" + suffix, ""), [
                            prefix + "\\n\\n",
                            "\\n\\n" + suffix
                        ])
                    ) || (
                        hasAll(chatTemplate.replaceAll(prefix + "\n\n" + suffix, ""), [
                            prefix + "\n\n",
                            "\n\n" + suffix
                        ])
                    )
                )
                    return {
                        prefix: LlamaText(new SpecialTokensText(prefix + "\n\n")),
                        suffix: LlamaText(new SpecialTokensText("\n\n" + suffix))
                    };

                if (
                    (
                        hasAll(chatTemplate.replaceAll(prefix + "\\n" + suffix, ""), [
                            prefix + "\\n",
                            "\\n" + suffix
                        ])
                    ) || (
                        hasAll(chatTemplate.replaceAll(prefix + "\n" + suffix, ""), [
                            prefix + "\n",
                            "\n" + suffix
                        ])
                    )
                )
                    return {
                        prefix: LlamaText(new SpecialTokensText(prefix + "\n")),
                        suffix: LlamaText(new SpecialTokensText("\n" + suffix))
                    };

                if (chatTemplate.includes(prefix) && chatTemplate.includes(suffix))
                    return {
                        prefix: LlamaText(new SpecialTokensText(prefix)),
                        suffix: LlamaText(new SpecialTokensText(suffix))
                    };
            }
        }

        if (tokenizer != null) {
            for (const [prefix, suffix] of tryMatchGroups) {
                const thinkTokens = tokenizer(prefix, true, "trimLeadingSpace");
                const thinkEndTokens = tokenizer(suffix, true, "trimLeadingSpace");

                const [thinkToken] = thinkTokens;
                const [thinkEndToken] = thinkEndTokens;

                if (thinkTokens.length === 1 && thinkEndTokens.length === 1 &&
                    thinkToken != null && thinkEndToken != null
                ) {
                    return {
                        prefix: LlamaText(new SpecialTokensText(prefix)),
                        suffix: LlamaText(new SpecialTokensText(suffix))
                    };
                }
            }
        }

        return undefined;
    }

    function extractThoughtSettingsFromRendering(): (
        {
            thoughtSegment: Exclude<ChatWrapperSettings["segments"], undefined>["thought"] | undefined,
            keepPastReasoning: boolean | undefined
        }
    ) {
        if (chatTemplate == null)
            return {
                thoughtSegment: undefined,
                keepPastReasoning: undefined
            };

        const systemMessage = idsGenerator.generateId();
        const userMessage1 = idsGenerator.generateId();
        const userMessage2 = idsGenerator.generateId();
        const modelResponse1 = idsGenerator.generateId();
        const modelResponse2 = idsGenerator.generateId();
        const modelResponse3 = idsGenerator.generateId();
        const modelReasoning2 = idsGenerator.generateId();
        const modelReasoning3 = idsGenerator.generateId();

        const bosTokenId = idsGenerator.generateId();
        const eosTokenId = idsGenerator.generateId();
        const eotTokenId = idsGenerator.generateId();

        const renderTemplate = (messages: OpenAiChatMessage[], params?: Record<string, any>) => tryMatrix({
            skipSystemPrompt: [false, true]
        }, ({skipSystemPrompt}) => {
            let messageToRender = messages;
            if (skipSystemPrompt)
                messageToRender = messageToRender.slice(1);

            return renderRawJinjaTemplate({
                messages: messageToRender,
                "bos_token": bosTokenId,
                "eos_token": eosTokenId,
                "eot_token": eotTokenId,
                ...params
            });
        });

        const baseMessages: OpenAiChatMessage[] = [{
            role: "system",
            content: systemMessage
        }, {
            role: "user",
            content: userMessage1
        }];
        const longBaseMessages: OpenAiChatMessage[] = [...baseMessages, {
            role: "assistant",
            content: modelResponse1
        }, {
            role: "user",
            content: userMessage2
        }];

        const messagesWithModelResponse: OpenAiChatMessage[] = [...baseMessages, {
            role: "assistant",
            content: modelResponse2
        }];
        const messagesWithModelResponseLongBase: OpenAiChatMessage[] = [...longBaseMessages, {
            role: "assistant",
            content: modelResponse2
        }];

        const messagesWithModelReasoning: OpenAiChatMessage[] = [...baseMessages, {
            role: "assistant",
            content: modelResponse2,
            "reasoning_content": modelReasoning2
        }];
        const messagesWithModelReasoningLongBase: OpenAiChatMessage[] = [...longBaseMessages, {
            role: "assistant",
            content: modelResponse2,
            "reasoning_content": modelReasoning2
        }];

        function extractControls() {
            const {responseOnly, withReasoning} = tryMatrix({
                enableThinking: [true, null],
                variation: ["simple", "separateReasoning", "nullContent", "reasoningFirst", "reasoningFirstNullMessage"]
            }, ({enableThinking, variation}) => {
                const thinkingParam = enableThinking === true
                    ? {"enable_thinking": true}
                    : {};

                if (variation === "simple")
                    return {
                        responseOnly: renderTemplate(messagesWithModelResponseLongBase, thinkingParam),
                        withReasoning: {
                            long: renderTemplate(messagesWithModelReasoningLongBase, thinkingParam),
                            short: renderTemplate(messagesWithModelReasoning, thinkingParam)
                        }
                    };
                else if (variation === "separateReasoning" || variation === "nullContent")
                    return {
                        responseOnly: renderTemplate([...messagesWithModelResponseLongBase, {
                            role: "assistant",
                            content: ""
                        }], thinkingParam),
                        withReasoning: {
                            long: renderTemplate([...messagesWithModelResponseLongBase, {
                                role: "assistant",
                                ...(variation === "nullContent" ? {} : {
                                    content: ""
                                }),
                                "reasoning_content": modelReasoning2
                            }], thinkingParam),
                            short: renderTemplate([...messagesWithModelResponse, {
                                role: "assistant",
                                ...(variation === "nullContent" ? {} : {
                                    content: ""
                                }),
                                "reasoning_content": modelReasoning2
                            }], thinkingParam)
                        }
                    };
                else if (variation === "reasoningFirst" || variation === "reasoningFirstNullMessage")
                    return {
                        responseOnly: renderTemplate(messagesWithModelResponseLongBase, thinkingParam),
                        withReasoning: {
                            long: renderTemplate([...longBaseMessages, {
                                role: "assistant",
                                ...(variation === "reasoningFirstNullMessage" ? {} : {
                                    content: ""
                                }),
                                "reasoning_content": modelReasoning2
                            }, {
                                role: "assistant",
                                content: modelResponse2
                            }], thinkingParam),
                            short: renderTemplate([...baseMessages, {
                                role: "assistant",
                                ...(variation === "reasoningFirstNullMessage" ? {} : {
                                    content: ""
                                }),
                                "reasoning_content": modelReasoning2
                            }, {
                                role: "assistant",
                                content: modelResponse2
                            }], thinkingParam)
                        }
                    };

                void (variation satisfies never);
                throw new Error(`Unsupported variation: ${variation}`);
            });

            let reasoningSectionStartPrefix: string | undefined = undefined;
            let reasoningSectionEndPrefix: string | undefined = undefined;

            if (responseOnly === withReasoning.long)
                return undefined;

            const modelResponseIndex = responseOnly.indexOf(modelResponse1);
            if (modelResponseIndex < 0)
                return undefined;

            const modelResponsePrefix = responseOnly.slice(0, modelResponseIndex);
            const withReasoningPrefixContent = withReasoning.short.slice(0, modelResponseIndex);

            if (modelResponsePrefix !== withReasoningPrefixContent)
                return undefined;

            const reasoningSectionStartIndex = modelResponseIndex;
            const reasoningContentStartIndex = withReasoning.short.indexOf(modelReasoning2, reasoningSectionStartIndex);
            if (reasoningContentStartIndex < 0)
                return undefined;

            reasoningSectionStartPrefix = withReasoning.short.slice(modelResponseIndex, reasoningContentStartIndex);

            const reasoningContentEndIndex = reasoningContentStartIndex + modelReasoning2.length;
            const modelResponseStartIndex = withReasoning.short.indexOf(modelResponse2, reasoningContentEndIndex);
            if (modelResponseStartIndex < 0)
                return undefined;

            reasoningSectionEndPrefix = withReasoning.short.slice(reasoningContentEndIndex, modelResponseStartIndex);

            return {
                prefix: reasoningSectionStartPrefix,
                suffix: reasoningSectionEndPrefix
            };
        }

        function shouldKeepPastThinking() {
            const renderedOutput = tryMatrix({
                enableThinking: [true, null],
                variation: ["simple", "reasoningFirst", "reasoningFirstNullMessage"]
            }, ({enableThinking, variation}) => {
                const thinkingParam = enableThinking === true
                    ? {"enable_thinking": true}
                    : {};

                if (variation === "simple")
                    return renderTemplate([...messagesWithModelReasoning, {
                        role: "user",
                        content: userMessage2
                    }, {
                        role: "assistant",
                        content: modelResponse3,
                        "reasoning_content": modelReasoning3
                    }], thinkingParam);
                else if (variation === "reasoningFirst" || variation === "reasoningFirstNullMessage")
                    return renderTemplate([...baseMessages, {
                        role: "assistant",
                        ...(variation === "reasoningFirstNullMessage" ? {} : {
                            content: ""
                        }),
                        "reasoning_content": modelReasoning2
                    }, {
                        role: "assistant",
                        content: modelResponse2
                    }, {
                        role: "user",
                        content: userMessage2
                    }, {
                        role: "assistant",
                        ...(variation === "reasoningFirstNullMessage" ? {} : {
                            content: ""
                        }),
                        "reasoning_content": modelReasoning3
                    }, {
                        role: "assistant",
                        content: modelResponse3
                    }], thinkingParam);

                void (variation satisfies never);
                throw new Error(`Unsupported variation: ${variation}`);
            });

            return renderedOutput.includes(modelReasoning2) && renderedOutput.includes(modelReasoning3);
        }

        function shouldOpenThinkingSegmentOnModelResponseStart(reasoningSectionPrefix: string, reasoningSectionSuffix: string) {
            if (!enableReasoning)
                return false;

            const {responseOnly, withGenerationPrompt} = tryMatrix({
                enableThinking: enableReasoning
                    ? [true, null]
                    : [null]
            }, ({enableThinking}) => {
                const thinkingParam = (enableThinking === true || enableThinking === false)
                    ? {"enable_thinking": enableThinking}
                    : {};

                return {
                    responseOnly: renderTemplate(baseMessages, thinkingParam),
                    withGenerationPrompt: renderTemplate(baseMessages, {
                        ...thinkingParam,
                        "add_generation_prompt": true
                    })
                };
            });

            if (responseOnly === withGenerationPrompt)
                return false;

            const userMessage1Index = responseOnly.indexOf(userMessage1);
            if (userMessage1Index < 0)
                return false;

            const withReasoningUserMessage1Index = withGenerationPrompt.indexOf(userMessage1);
            if (withReasoningUserMessage1Index < 0)
                return false;

            if (responseOnly.indexOf(reasoningSectionPrefix, userMessage1Index) >= 0)
                return false;

            const reasoningSectionPrefixIndex = withGenerationPrompt.indexOf(reasoningSectionPrefix, withReasoningUserMessage1Index);
            if (reasoningSectionPrefixIndex < 0)
                return false;

            const reasoningSectionSuffixIndex = withGenerationPrompt.indexOf(reasoningSectionSuffix, reasoningSectionPrefixIndex);
            if (reasoningSectionSuffixIndex >= 0) {
                const reasoningSectionContent = withGenerationPrompt.slice(
                    reasoningSectionPrefixIndex + reasoningSectionPrefix.length,
                    reasoningSectionSuffixIndex
                );

                if (reasoningSectionContent.trim() === "")
                    return false;
            }

            return true;
        }

        let controls: ReturnType<typeof extractControls>;
        let keepPastReasoning: boolean | undefined = undefined;
        let openOnResponseStart: boolean | undefined = undefined;
        try {
            controls = extractControls();

            if (controls == null || controls.prefix.trim() === "")
                return {
                    thoughtSegment: undefined,
                    keepPastReasoning: undefined
                };
        } catch (err) {
            return {
                thoughtSegment: undefined,
                keepPastReasoning: undefined
            };
        }

        try {
            keepPastReasoning = shouldKeepPastThinking();
        } catch (err) {
            // do nothing
        }

        try {
            openOnResponseStart = controls != null && shouldOpenThinkingSegmentOnModelResponseStart(controls.prefix, controls.suffix);
        } catch (err) {
            // do nothing
        }

        const thoughtSuffix = controls.suffix.trim() === ""
            ? (
                knownThinkingSegmentControls.get(controls.prefix) ??
                knownThinkingSegmentControls.get(controls.prefix.trim())
            )
            : controls.suffix;

        return {
            thoughtSegment: {
                prefix: LlamaText(new SpecialTokensText(controls.prefix)),
                suffix: thoughtSuffix != null
                    ? LlamaText(new SpecialTokensText(thoughtSuffix))
                    : undefined,
                openOnResponseStart
            },
            keepPastReasoning
        };
    }

    const extractedFromRendering = extractThoughtSettingsFromRendering();

    return {
        settings: removeUndefinedFields({
            thought: extractedFromRendering.thoughtSegment ?? tryMatchPrefixSuffixPair(knownThinkingSegmentControls)
        }),
        keepOnlyLastThought: !extractedFromRendering.keepPastReasoning
    };
}

function hasAll(text: string, matches: string[]) {
    return matches.every((match) => text.includes(match));
}
