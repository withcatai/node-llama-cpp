import {splitText} from "lifecycle-utils";
import {ChatWrapper} from "../../ChatWrapper.js";
import {ChatHistoryItem, ChatModelResponse, ChatUserMessage, ChatWrapperSettings, Tokenizer} from "../../types.js";
import {JinjaTemplateChatWrapper, JinjaTemplateChatWrapperOptions} from "../generic/JinjaTemplateChatWrapper.js";
import {SpecialToken, LlamaText, SpecialTokensText} from "../../utils/LlamaText.js";
import {compareTokens} from "../../utils/compareTokens.js";
import {StopGenerationDetector} from "../../utils/StopGenerationDetector.js";
import {Writable} from "../../utils/utilTypes.js";
import {jsonDumps} from "./jsonDumps.js";

export function isJinjaTemplateEquivalentToSpecializedChatWrapper(
    jinjaTemplateWrapperOptions: JinjaTemplateChatWrapperOptions,
    specializedChatWrapper: ChatWrapper,
    tokenizer?: Tokenizer
): boolean {
    const getCheckChatHistories = (jinjaChatWrapper: JinjaTemplateChatWrapper) => [
        ...testChatHistories,
        ...(
            (jinjaChatWrapper.usingJinjaFunctionCallTemplate || jinjaTemplateWrapperOptions.functionCallMessageTemplate === "auto")
                ? testChatHistoriesWithFunctionCalls
                : []
        )
    ];

    const canTestMultipleConvertSystemMessagesToUserMessages =
        jinjaTemplateWrapperOptions.convertUnsupportedSystemMessagesToUserMessages == null ||
        jinjaTemplateWrapperOptions.convertUnsupportedSystemMessagesToUserMessages === "auto";

    try {
        const jinjaChatWrapper = new JinjaTemplateChatWrapper({
            ...jinjaTemplateWrapperOptions,
            convertUnsupportedSystemMessagesToUserMessages: canTestMultipleConvertSystemMessagesToUserMessages
                ? false
                : jinjaTemplateWrapperOptions.convertUnsupportedSystemMessagesToUserMessages,
            trimLeadingWhitespaceInResponses: false
        });
        const checkChatHistories = getCheckChatHistories(jinjaChatWrapper);

        if (checkEquivalence(jinjaChatWrapper, specializedChatWrapper, checkChatHistories, tokenizer))
            return true;
    } catch (err) {
        // Do nothing
    }


    try {
        const jinjaChatWrapperWithLeadingWhitespaceTrimming = new JinjaTemplateChatWrapper({
            ...jinjaTemplateWrapperOptions,
            convertUnsupportedSystemMessagesToUserMessages: canTestMultipleConvertSystemMessagesToUserMessages
                ? false
                : jinjaTemplateWrapperOptions.convertUnsupportedSystemMessagesToUserMessages,
            trimLeadingWhitespaceInResponses: true
        });
        const checkChatHistories = getCheckChatHistories(jinjaChatWrapperWithLeadingWhitespaceTrimming);

        if (checkEquivalence(jinjaChatWrapperWithLeadingWhitespaceTrimming, specializedChatWrapper, checkChatHistories, tokenizer))
            return true;
    } catch (err) {
        // Do nothing
    }

    if (!canTestMultipleConvertSystemMessagesToUserMessages)
        return false;

    const convertSystemMessagesToUserMessagesTemplate = "### System message\n\n{{message}}\n\n----";

    try {
        const jinjaChatWrapper = new JinjaTemplateChatWrapper({
            ...jinjaTemplateWrapperOptions,
            convertUnsupportedSystemMessagesToUserMessages: {
                use: "always",
                format: convertSystemMessagesToUserMessagesTemplate
            },
            trimLeadingWhitespaceInResponses: false
        });
        const checkChatHistories = getCheckChatHistories(jinjaChatWrapper);
        const transformedCheckChatHistories = convertTestChatHistoriesSystemMessagesToUserMessages(
            checkChatHistories,
            convertSystemMessagesToUserMessagesTemplate
        );

        if (checkEquivalence(jinjaChatWrapper, specializedChatWrapper, transformedCheckChatHistories, tokenizer))
            return true;
    } catch (err) {
        // Do nothing
    }


    try {
        const jinjaChatWrapperWithLeadingWhitespaceTrimming = new JinjaTemplateChatWrapper({
            ...jinjaTemplateWrapperOptions,
            convertUnsupportedSystemMessagesToUserMessages: {
                use: "always",
                format: convertSystemMessagesToUserMessagesTemplate
            },
            trimLeadingWhitespaceInResponses: true
        });
        const checkChatHistories = getCheckChatHistories(jinjaChatWrapperWithLeadingWhitespaceTrimming);
        const transformedCheckChatHistories = convertTestChatHistoriesSystemMessagesToUserMessages(
            checkChatHistories,
            convertSystemMessagesToUserMessagesTemplate
        );

        if (checkEquivalence(
            jinjaChatWrapperWithLeadingWhitespaceTrimming, specializedChatWrapper, transformedCheckChatHistories, tokenizer
        ))
            return true;
    } catch (err) {
        // Do nothing
    }

    return false;
}

function checkEquivalence(
    jinjaChatWrapper: JinjaTemplateChatWrapper,
    specializedChatWrapper: ChatWrapper,
    testChatHistories: ChatHistoryItem[][],
    tokenizer?: Tokenizer
): boolean {
    for (const testChatHistory of testChatHistories) {
        const jinjaRes = jinjaChatWrapper.generateContextState({chatHistory: testChatHistory});
        jinjaRes.contextText = convertFunctionNameAndParamsToRegularText(jinjaRes.contextText, testChatHistory);

        const convertedSettings = convertChatWrapperSettingsToUseSpecialTokensText(specializedChatWrapper.settings);
        const originalSpecializedSettings = specializedChatWrapper.settings;

        if (convertedSettings != null)
            (specializedChatWrapper as Writable<ChatWrapper>).settings = convertedSettings;

        let specializedWrapperRes: ReturnType<typeof specializedChatWrapper.generateContextState>;
        try {
            specializedWrapperRes = specializedChatWrapper.generateContextState({chatHistory: testChatHistory});
        } finally {
            if (convertedSettings != null)
                (specializedChatWrapper as Writable<ChatWrapper>).settings = originalSpecializedSettings;
        }

        if (!compareContextTexts(jinjaRes.contextText, specializedWrapperRes.contextText, tokenizer))
            return false;

        const jinjaHasAllSpecializedStopGenerationTriggers = jinjaRes.stopGenerationTriggers
            .every((trigger) => {
                return [trigger, trigger.trimEnd(), trigger.trimStart(), trigger.trimStart().trimEnd()].some((normalizedJinjaTrigger) => {
                    if (normalizedJinjaTrigger.values.length === 0)
                        return true;

                    const foundSimilarTriggers = specializedWrapperRes.stopGenerationTriggers.some((specializedTrigger) => (
                        normalizedJinjaTrigger.includes(specializedTrigger)
                    ));

                    if (foundSimilarTriggers)
                        return true;

                    if (tokenizer != null) {
                        const resolvedStopGenerationTrigger = StopGenerationDetector.resolveLlamaTextTrigger(
                            normalizedJinjaTrigger,
                            tokenizer
                        );

                        const foundSimilarOrShorterTokenizedTriggers = specializedWrapperRes.stopGenerationTriggers
                            .some((specializedTrigger) => {
                                const resolvedSpecializedTrigger = StopGenerationDetector.resolveLlamaTextTrigger(
                                    specializedTrigger,
                                    tokenizer
                                );

                                return resolvedSpecializedTrigger.every((item, index) => {
                                    const resolveTriggerItem = resolvedStopGenerationTrigger[index];

                                    if (typeof item === "string" && typeof resolveTriggerItem === "string")
                                        return item === resolveTriggerItem;
                                    else if (typeof item === "string" || typeof resolveTriggerItem === "string" ||
                                        resolveTriggerItem == null
                                    )
                                        return false;

                                    return compareTokens(item, resolveTriggerItem);
                                });
                            });

                        if (foundSimilarOrShorterTokenizedTriggers)
                            return true;
                    }

                    return false;
                });
            });

        if (!jinjaHasAllSpecializedStopGenerationTriggers)
            return false;
    }

    return true;
}

function compareContextTexts(text1: LlamaText, text2: LlamaText, tokenizer?: Tokenizer) {
    function compare(text1: LlamaText, text2: LlamaText) {
        if (LlamaText.compare(text1, text2))
            return true;

        if (tokenizer != null) {
            const tokenizedText1 = text1.tokenize(tokenizer);
            const tokenizedText2 = text2.tokenize(tokenizer);

            if (tokenizedText1.length === tokenizedText2.length)
                return tokenizedText1.every((token, index) => compareTokens(token, tokenizedText2[index]));
        }

        return false;
    }

    const trimmedText1 = text1.trimEnd();
    const trimmedText2 = text2.trimEnd();

    const normalizedText1 = removeLeadingBos(trimmedText1);
    const normalizedText2 = removeLeadingBos(trimmedText2);

    const texts1 = (normalizedText1.values.length !== trimmedText1.values.length && tokenizer != null)
        ? [trimmedText1, normalizedText1]
        : [normalizedText1];

    const texts2 = (normalizedText2.values.length !== trimmedText2.values.length && tokenizer != null)
        ? [trimmedText2, normalizedText2]
        : [normalizedText2];

    return texts1.some((text1) => (
        texts2.some((text2) => (
            compare(text1, text2)
        ))
    ));
}

function convertTestChatHistoriesSystemMessagesToUserMessages(chatHistories: ChatHistoryItem[][], template: string) {
    return chatHistories
        .map((history) => (
            history
                .slice()
                .map((item, index, array) => {
                    if (item.type === "system") {
                        if (index === 0 && array.length > 1 && array[1]!.type === "user") {
                            array[1] = {
                                type: "user",
                                text: LlamaText([
                                    LlamaText.joinValues(
                                        LlamaText.fromJSON(item.text),
                                        template.split("{{message}}")
                                    ),
                                    "\n\n",
                                    array[1]!.text
                                ]).toString()
                            } satisfies ChatHistoryItem;
                            return null;
                        }

                        return {
                            type: "user",
                            text: LlamaText.joinValues(
                                LlamaText.fromJSON(item.text),
                                template.split("{{message}}")
                            ).toString()
                        } satisfies ChatHistoryItem;
                    }

                    return item;
                })
                .filter((item): item is ChatUserMessage | ChatModelResponse => item != null)
        ));
}

function convertChatWrapperSettingsToUseSpecialTokensText(settings: ChatWrapperSettings): ChatWrapperSettings | null {
    if (settings?.functions == null)
        return null;

    function convertToSpecialTokensText(value: string | LlamaText, keepTexts?: string[]): string | LlamaText;
    function convertToSpecialTokensText(value: string | LlamaText | undefined, keepTexts?: string[]): string | LlamaText | undefined;
    function convertToSpecialTokensText(value: string | LlamaText | undefined, keepTexts?: string[]): string | LlamaText | undefined {
        if (value == null)
            return value;

        return LlamaText(
            LlamaText(value).values
                .map((item) => {
                    if (typeof item !== "string")
                        return item;

                    if (keepTexts == null || keepTexts.length === 0)
                        return new SpecialTokensText(item);

                    return splitText(item, keepTexts).map((textPart) => {
                        if (typeof textPart === "string")
                            return new SpecialTokensText(textPart);

                        return textPart.separator;
                    });
                })
        );
    }

    return {
        ...settings,
        functions: {
            ...settings.functions,
            call: {
                ...settings.functions.call,
                prefix: convertToSpecialTokensText(settings.functions.call.prefix),
                suffix: convertToSpecialTokensText(settings.functions.call.suffix),
                paramsPrefix: convertToSpecialTokensText(settings.functions.call.paramsPrefix)
            },
            result: {
                ...settings.functions.result,
                prefix: convertToSpecialTokensText(settings.functions.result.prefix, ["{{functionName}}", "{{functionParams}}"]),
                suffix: convertToSpecialTokensText(settings.functions.result.suffix, ["{{functionName}}", "{{functionParams}}"])
            },
            parallelism: settings.functions.parallelism == null
                ? settings.functions.parallelism
                : {
                    ...settings.functions.parallelism,
                    call: {
                        ...settings.functions.parallelism.call,
                        sectionPrefix: convertToSpecialTokensText(settings.functions.parallelism.call.sectionPrefix),
                        betweenCalls: convertToSpecialTokensText(settings.functions.parallelism.call.betweenCalls),
                        sectionSuffix: convertToSpecialTokensText(settings.functions.parallelism.call.sectionSuffix)
                    },
                    result: settings.functions.parallelism.result == null
                        ? settings.functions.parallelism.result
                        : {
                            ...settings.functions.parallelism.result,
                            sectionPrefix: convertToSpecialTokensText(settings.functions.parallelism.result.sectionPrefix),
                            betweenResults: convertToSpecialTokensText(settings.functions.parallelism.result.betweenResults),
                            sectionSuffix: convertToSpecialTokensText(settings.functions.parallelism.result.sectionSuffix)
                        }
                }
        }
    };
}

function convertFunctionNameAndParamsToRegularText(contextText: LlamaText, chatHistory: ChatHistoryItem[]): LlamaText {
    const ensureRegularTextItems = new Set<string>();

    for (const item of chatHistory) {
        if (item.type !== "model")
            continue;

        for (const response of item.response) {
            if (typeof response === "string" || response.type !== "functionCall")
                continue;

            ensureRegularTextItems.add(response.name);
            if (response.params !== undefined && response.params !== "")
                ensureRegularTextItems.add(jsonDumps(response.params));
        }
    }

    const ensureRegularTextItemsArray = [...ensureRegularTextItems];

    return LlamaText(
        contextText.values.map((item) => {
            if (!(item instanceof SpecialTokensText))
                return item;

            return splitText(item.value, ensureRegularTextItemsArray)
                .map((textPart) => {
                    if (typeof textPart === "string")
                        return new SpecialTokensText(textPart);

                    return textPart.separator;
                });
        })
    );
}

const testChatHistories: ChatHistoryItem[][] = [
    [{
        type: "system",
        text: "System message ~!@#$%^&*()\n*"
    }, {
        type: "user",
        text: "Message 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"
    }, {
        type: "model",
        response: [""]
    }],

    [{
        type: "system",
        text: "System message ~!@#$%^&*()\n*"
    }, {
        type: "user",
        text: "Message 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"
    }, {
        type: "model",
        response: ["Result 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"]
    }],

    [{
        type: "system",
        text: "System message ~!@#$%^&*()\n*"
    }, {
        type: "user",
        text: "Message 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"
    }, {
        type: "model",
        response: ["Result 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"]
    }, {
        type: "user",
        text: "Message2 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"
    }, {
        type: "model",
        response: [""]
    }],

    [{
        type: "system",
        text: "System message ~!@#$%^&*()\n*"
    }, {
        type: "user",
        text: "Message 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"
    }, {
        type: "model",
        response: ["Result 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"]
    }, {
        type: "user",
        text: "Message2 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"
    }, {
        type: "model",
        response: ["Result2 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"]
    }]
];
const testChatHistoriesWithFunctionCalls: ChatHistoryItem[][] = [
    [{
        type: "system",
        text: "System message ~!@#$%^&*()\n*"
    }, {
        type: "user",
        text: "Message 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"
    }, {
        type: "model",
        response: ["Result 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"]
    }, {
        type: "user",
        text: "Message2 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"
    }, {
        type: "model",
        response: [
            "Result2 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~",
            {
                type: "functionCall",
                name: "func1name",
                params: {param1: "value1"},
                result: "func1result"
            },
            "Result3 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"
        ]
    }],

    [{
        type: "system",
        text: "System message ~!@#$%^&*()\n*"
    }, {
        type: "user",
        text: "Message 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"
    }, {
        type: "model",
        response: ["Result 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"]
    }, {
        type: "user",
        text: "Message2 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"
    }, {
        type: "model",
        response: [
            "Result2 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~",
            {
                type: "functionCall",
                name: "func1name",
                params: {param1: "value1"},
                result: "func1result"
            },
            {
                type: "functionCall",
                name: "func2name",
                params: {param1: "value2"},
                result: "func2result"
            },
            "Result3 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"
        ]
    }]
];

function removeLeadingBos(llamaText: LlamaText) {
    if (llamaText.values.length === 0)
        return llamaText;

    const firstValue = llamaText.values[0];

    if (firstValue instanceof SpecialToken && firstValue.value === "BOS")
        return LlamaText(llamaText.values.slice(1));

    return llamaText;
}
