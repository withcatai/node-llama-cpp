import {ChatWrapper} from "../../ChatWrapper.js";
import {ChatHistoryItem, ChatModelResponse, ChatUserMessage, Tokenizer} from "../../types.js";
import {JinjaTemplateChatWrapper, JinjaTemplateChatWrapperOptions} from "../generic/JinjaTemplateChatWrapper.js";
import {SpecialToken, LlamaText} from "../../utils/LlamaText.js";
import {compareTokens} from "../../utils/compareTokens.js";
import {StopGenerationDetector} from "../../utils/StopGenerationDetector.js";

export function isJinjaTemplateEquivalentToSpecializedChatWrapper(
    jinjaTemplateWrapperOptions: JinjaTemplateChatWrapperOptions,
    specializedChatWrapper: ChatWrapper,
    tokenizer?: Tokenizer
): boolean {
    const canTestMultipleConvertSystemMessagesToUserMessages =
        jinjaTemplateWrapperOptions.convertUnsupportedSystemMessagesToUserMessages == null ||
        jinjaTemplateWrapperOptions.convertUnsupportedSystemMessagesToUserMessages === "auto";

    try {
        const jinjaChatWrapper = new JinjaTemplateChatWrapper({
            ...jinjaTemplateWrapperOptions,
            convertUnsupportedSystemMessagesToUserMessages: canTestMultipleConvertSystemMessagesToUserMessages
                ? false
                : jinjaTemplateWrapperOptions.convertUnsupportedSystemMessagesToUserMessages
        });

        if (checkEquivalence(jinjaChatWrapper, specializedChatWrapper, testChatHistories, tokenizer))
            return true;
    } catch (err) {
        // Do nothing
    }

    if (!canTestMultipleConvertSystemMessagesToUserMessages)
        return false;

    try {
        const convertSystemMessagesToUserMessagesTemplate = "System: {{message}}";
        const jinjaChatWrapper = new JinjaTemplateChatWrapper({
            ...jinjaTemplateWrapperOptions,
            convertUnsupportedSystemMessagesToUserMessages: {
                use: "always",
                format: convertSystemMessagesToUserMessagesTemplate
            }
        });

        const transformedTestChatHistories = testChatHistories
            .map((history) => (
                history
                    .slice()
                    .map((item, index, array) => {
                        if (item.type === "system") {
                            if (index === 0 && array.length > 1 && array[1].type === "user") {
                                array[1] = {
                                    type: "user",
                                    text: convertSystemMessagesToUserMessagesTemplate.replace("{{message}}", item.text) + "\n\n" + array[1].text
                                } satisfies ChatHistoryItem;
                                return null;
                            }

                            return {
                                type: "user",
                                text: convertSystemMessagesToUserMessagesTemplate.replace("{{message}}", item.text)
                            } satisfies ChatHistoryItem;
                        }

                        return item;
                    })
                    .filter((item): item is ChatUserMessage | ChatModelResponse => item != null)
            ));

        if (checkEquivalence(jinjaChatWrapper, specializedChatWrapper, transformedTestChatHistories, tokenizer))
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
        const jinjaRes = jinjaChatWrapper.generateContextText(testChatHistory);
        const specializedWrapperRes = specializedChatWrapper.generateContextText(testChatHistory);

        if (!compareContextTexts(jinjaRes.contextText, specializedWrapperRes.contextText, tokenizer))
            return false;

        const jinjaHasAllSpecializedStopGenerationTriggers = jinjaRes.stopGenerationTriggers
            .every((trigger) => {
                return [trigger, trigger.trimEnd(), trigger.trimStart(), trigger.trimStart().trimEnd()].some((normalizedJinjaTrigger) => {
                    if (normalizedJinjaTrigger.values.length === 0)
                        return true;

                    const foundSimilarTriggers =  specializedWrapperRes.stopGenerationTriggers.some((specializedTrigger) => (
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
                                    else if (typeof item === "string" || typeof resolveTriggerItem === "string")
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

    const texts1 = (normalizedText1.length !== trimmedText1.length && tokenizer != null)
        ? [trimmedText1, normalizedText1]
        : [normalizedText1];

    const texts2 = (normalizedText2.length !== trimmedText2.length && tokenizer != null)
        ? [trimmedText2, normalizedText2]
        : [normalizedText2];

    return texts1.some((text1) => (
        texts2.some((text2) => (
            compare(text1, text2)
        ))
    ));
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

function removeLeadingBos(llamaText: LlamaText) {
    if (llamaText.values.length === 0)
        return llamaText;

    const firstValue = llamaText.values[0];

    if (firstValue instanceof SpecialToken && firstValue.value === "BOS")
        return LlamaText(llamaText.values.slice(1));

    return llamaText;
}
