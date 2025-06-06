import {splitText} from "lifecycle-utils";
import {ChatHistoryItem, ChatModelFunctions, ChatWrapperSettings} from "../../../types.js";
import {LlamaText, SpecialToken, SpecialTokensText} from "../../../utils/LlamaText.js";
import {UniqueIdGenerator} from "./UniqueIdGenerator.js";
import {getFirstValidResult} from "./getFirstValidResult.js";

export function extractFunctionCallSettingsFromJinjaTemplate({
    idsGenerator,
    renderTemplate
}: {
    idsGenerator: UniqueIdGenerator,
    renderTemplate({}: {
        chatHistory: ChatHistoryItem[], functions: ChatModelFunctions, additionalParams: Record<string, unknown>,
        stringifyFunctionParams: boolean, stringifyFunctionResults: boolean, combineModelMessageAndToolCalls: boolean,
        squashModelTextResponses?: boolean
    }): string
}): {
    settings: ChatWrapperSettings["functions"] | null,
    stringifyParams: boolean,
    stringifyResult: boolean,
    combineModelMessageAndToolCalls: boolean
} {
    const idToStaticContent = new Map<string, LlamaText | SpecialToken>();

    const bosTokenId = idsGenerator.generateId();
    const eosTokenId = idsGenerator.generateId();
    const eotTokenId = idsGenerator.generateId();

    idToStaticContent.set(bosTokenId, new SpecialToken("BOS"));
    idToStaticContent.set(eosTokenId, new SpecialToken("EOS"));
    idToStaticContent.set(eotTokenId, new SpecialToken("EOT"));

    const contentIds = new Set<string>();
    const addContentId = (id: string) => {
        contentIds.add(id);

        return id;
    };

    const systemMessage = addContentId(idsGenerator.generateId());
    const userMessage1 = addContentId(idsGenerator.generateId());
    const modelMessage1 = addContentId(idsGenerator.generateId());
    const func1name = addContentId(idsGenerator.generateId());
    const func1description = addContentId(idsGenerator.generateId());
    const func1params = addContentId(idsGenerator.generateId(true));
    const func1result = addContentId(idsGenerator.generateId(true));
    const func2name = addContentId(idsGenerator.generateId());
    const func2description = addContentId(idsGenerator.generateId());
    const func2params = addContentId(idsGenerator.generateId(true));
    const func2result = addContentId(idsGenerator.generateId(true));
    const modelMessage2 = addContentId(idsGenerator.generateId());
    const func1StringifyParam = addContentId(idsGenerator.generateId());
    const func1StringifyResult = addContentId(idsGenerator.generateId());

    const functions1: ChatModelFunctions = {
        [func1name]: {
            description: func1description,
            params: {
                type: "number"
            }
        }
    } as ChatModelFunctions;
    const functions2: ChatModelFunctions = {
        ...functions1,
        [func2name]: {
            description: func2description,
            params: {
                type: "number"
            }
        }
    } as ChatModelFunctions;

    const baseChatHistory: ChatHistoryItem[] = [{
        type: "system",
        text: systemMessage
    }, {
        type: "user",
        text: userMessage1
    }];
    const chatHistory1Call: ChatHistoryItem[] = [...baseChatHistory, {
        type: "model",
        response: [
            modelMessage1,
            {
                type: "functionCall",
                name: func1name,

                // convert to number since this will go through JSON.stringify,
                // and we want to avoid escaping characters in the rendered output
                params: Number(func1params),
                result: Number(func1result),
                startsNewChunk: true
            },
            modelMessage2
        ]
    }];
    const chatHistoryOnlyCall: ChatHistoryItem[] = [...baseChatHistory, {
        type: "model",
        response: [
            {
                type: "functionCall",
                name: func1name,

                // convert to number since this will go through JSON.stringify,
                // and we want to avoid escaping characters in the rendered output
                params: Number(func1params),
                result: Number(func1result),
                startsNewChunk: true
            },
            modelMessage2
        ]
    }];
    const chatHistory2Calls: ChatHistoryItem[] = [...baseChatHistory, {
        type: "model",
        response: [
            modelMessage1,
            {
                type: "functionCall",
                name: func1name,

                // convert to number since this will go through JSON.stringify,
                // and we want to avoid escaping characters in the rendered output
                params: Number(func1params),
                result: Number(func1result),
                startsNewChunk: true
            },
            {
                type: "functionCall",
                name: func2name,
                params: Number(func2params),
                result: Number(func2result),
                startsNewChunk: false
            },
            modelMessage2
        ]
    }];
    const chatHistory2CallsNewChunk: ChatHistoryItem[] = [...baseChatHistory, {
        type: "model",
        response: [
            modelMessage1,
            {
                type: "functionCall",
                name: func1name,

                // convert to number since this will go through JSON.stringify,
                // and we want to avoid escaping characters in the rendered output
                params: Number(func1params),
                result: Number(func1result),
                startsNewChunk: true
            },
            {
                type: "functionCall",
                name: func2name,
                params: Number(func2params),
                result: Number(func2result),
                startsNewChunk: true
            },
            modelMessage2
        ]
    }];

    const additionalParams = {
        "bos_token": bosTokenId,
        "eos_token": eosTokenId,
        "eot_token": eotTokenId
    };

    let combineModelMessageAndToolCalls = true;
    let stringifyParams = true;
    let stringifyResult = true;
    try {
        const paramsObjectTest = renderTemplate({
            chatHistory: [...baseChatHistory, {
                type: "model",
                response: [
                    modelMessage1,
                    {
                        type: "functionCall",
                        name: func1name,
                        params: {[func1StringifyParam]: "test"},
                        result: func1StringifyResult,
                        startsNewChunk: true
                    },
                    modelMessage2
                ]
            }],
            functions: functions1,
            additionalParams,
            stringifyFunctionParams: false,
            stringifyFunctionResults: false,
            combineModelMessageAndToolCalls
        });
        stringifyParams = (
            !paramsObjectTest.includes(`"${func1StringifyParam}":`) &&
            !paramsObjectTest.includes(`'${func1StringifyParam}':`)
        );
    } catch (err) {
        // do nothing
    }

    try {
        const resultObjectTest = renderTemplate({
            chatHistory: [...baseChatHistory, {
                type: "model",
                response: [
                    modelMessage1,
                    {
                        type: "functionCall",
                        name: func1name,
                        params: func1StringifyParam,
                        result: {[func1StringifyResult]: "test"},
                        startsNewChunk: true
                    },
                    modelMessage2
                ]
            }],
            functions: functions1,
            additionalParams,
            stringifyFunctionParams: false,
            stringifyFunctionResults: false,
            combineModelMessageAndToolCalls
        });
        stringifyResult = (
            !resultObjectTest.includes(`"${func1StringifyResult}":`) &&
            !resultObjectTest.includes(`'${func1StringifyResult}':`)
        );
    } catch (err) {
        // do nothing
    }

    combineModelMessageAndToolCalls = renderTemplate({
        chatHistory: chatHistory1Call,
        functions: functions1,
        additionalParams,
        stringifyFunctionParams: true,
        stringifyFunctionResults: true,
        combineModelMessageAndToolCalls
    }).includes(modelMessage1);

    let textBetween2TextualModelResponses: LlamaText = LlamaText();
    if (!combineModelMessageAndToolCalls) {
        try {
            const betweenModelTextualResponsesTest = renderTemplate({
                chatHistory: [...baseChatHistory, {
                    type: "model",
                    response: [modelMessage1]
                }, {
                    type: "model",
                    response: [modelMessage2]
                }],
                functions: {},
                additionalParams,
                stringifyFunctionParams: false,
                stringifyFunctionResults: false,
                combineModelMessageAndToolCalls,
                squashModelTextResponses: false
            });
            const textDiff = getTextBetweenIds(
                betweenModelTextualResponsesTest, modelMessage1, modelMessage2
            ).text ?? "";
            textBetween2TextualModelResponses = reviveSeparatorText(textDiff, idToStaticContent, contentIds);
        } catch (err) {
            // do nothing
        }
    }

    let usedNewChunkFor2Calls = false;
    const rendered1Call = renderTemplate({
        chatHistory: chatHistory1Call,
        functions: functions1,
        additionalParams,
        stringifyFunctionParams: stringifyParams,
        stringifyFunctionResults: stringifyResult,
        combineModelMessageAndToolCalls
    });
    const renderedOnlyCall = getFirstValidResult([
        () => renderTemplate({
            chatHistory: chatHistoryOnlyCall,
            functions: functions1,
            additionalParams,
            stringifyFunctionParams: stringifyParams,
            stringifyFunctionResults: stringifyResult,
            combineModelMessageAndToolCalls
        }),
        () => undefined
    ]);
    const rendered2Calls = getFirstValidResult([
        () => renderTemplate({
            chatHistory: chatHistory2Calls,
            functions: functions2,
            additionalParams,
            stringifyFunctionParams: stringifyParams,
            stringifyFunctionResults: stringifyResult,
            combineModelMessageAndToolCalls
        }),
        () => {
            usedNewChunkFor2Calls = true;
            return renderTemplate({
                chatHistory: chatHistory2CallsNewChunk,
                functions: functions2,
                additionalParams,
                stringifyFunctionParams: stringifyParams,
                stringifyFunctionResults: stringifyResult,
                combineModelMessageAndToolCalls
            });
        }
    ]);

    const modelMessage1ToFunc1Name = getTextBetweenIds(rendered2Calls, modelMessage1, func1name);
    const func1NameToFunc1Params = getTextBetweenIds(
        rendered2Calls, func1name, func1params, modelMessage1ToFunc1Name.endIndex
    );

    const func1ResultIndex = rendered2Calls.indexOf(func1result, func1NameToFunc1Params.endIndex);
    const func2NameIndex = rendered2Calls.indexOf(func2name, modelMessage1ToFunc1Name.endIndex);

    if (modelMessage1ToFunc1Name.text == null ||
        func1NameToFunc1Params.text == null ||
        func1ResultIndex < 0 ||
        func2NameIndex < 0
    )
        return {settings: null, stringifyParams, stringifyResult, combineModelMessageAndToolCalls};

    const supportsParallelCalls = func1ResultIndex > func2NameIndex;
    if (!supportsParallelCalls || usedNewChunkFor2Calls) {
        const prefix = getTextBetweenIds(rendered1Call, modelMessage1, func1name);
        const paramsPrefix = getTextBetweenIds(
            rendered1Call, func1name, func1params, prefix.endIndex
        );

        const resultPrefix = getTextBetweenIds(rendered1Call, func1params, func1result, paramsPrefix.endIndex);
        const resultSuffix = getTextBetweenIds(rendered1Call, func1result, modelMessage2, resultPrefix.endIndex);

        if (prefix.text == null || prefix.text === "" || paramsPrefix.text == null || resultPrefix.text == null || resultSuffix.text == null)
            return {settings: null, stringifyParams, stringifyResult, combineModelMessageAndToolCalls};

        return {
            stringifyParams,
            stringifyResult,
            combineModelMessageAndToolCalls,
            settings: {
                call: {
                    optionalPrefixSpace: true,
                    prefix: removeCommonRevivedPrefix(
                        reviveSeparatorText(prefix.text, idToStaticContent, contentIds),
                        !combineModelMessageAndToolCalls
                            ? textBetween2TextualModelResponses
                            : LlamaText()
                    ),
                    paramsPrefix: reviveSeparatorText(paramsPrefix.text, idToStaticContent, contentIds),
                    suffix: "",
                    emptyCallParamsPlaceholder: {}
                },
                result: {
                    prefix: reviveSeparatorText(
                        resultPrefix.text,
                        new Map([
                            ...idToStaticContent.entries(),
                            [func1name, LlamaText("{{functionName}}")],
                            [func1params, LlamaText("{{functionParams}}")]
                        ]),
                        contentIds
                    ),
                    suffix: reviveSeparatorText(
                        resultSuffix.text,
                        new Map([
                            ...idToStaticContent.entries(),
                            [func1name, LlamaText("{{functionName}}")],
                            [func1params, LlamaText("{{functionParams}}")]
                        ]),
                        contentIds
                    )
                }
            }
        };
    }

    const func1ParamsToFunc2Name = getTextBetweenIds(
        rendered2Calls, func1params, func2name, func1NameToFunc1Params.endIndex
    );
    const func2ParamsToFunc1Result = getTextBetweenIds(
        rendered2Calls, func2params, func1result, func1ParamsToFunc2Name.endIndex
    );
    const func1ResultToFunc2Result = getTextBetweenIds(
        rendered2Calls, func1result, func2result, func2ParamsToFunc1Result.endIndex
    );
    const func2ResultToModelMessage2 = getTextBetweenIds(
        rendered2Calls, func2result, modelMessage2, func1ResultToFunc2Result.endIndex
    );


    if (func1ParamsToFunc2Name.text == null || func2ParamsToFunc1Result.text == null || func1ResultToFunc2Result.text == null ||
        func2ResultToModelMessage2.text == null
    )
        return {settings: null, stringifyParams, stringifyResult, combineModelMessageAndToolCalls};

    const callPrefixLength = findCommonEndLength(modelMessage1ToFunc1Name.text, func1ParamsToFunc2Name.text);
    const callPrefixText = func1ParamsToFunc2Name.text.slice(-callPrefixLength);
    const parallelismCallPrefix = modelMessage1ToFunc1Name.text.slice(0, -callPrefixLength);

    const callSuffixLength = findCommandStartLength(func1ParamsToFunc2Name.text, func2ParamsToFunc1Result.text);
    const callSuffixText = func1ParamsToFunc2Name.text.slice(0, callSuffixLength);

    const parallelismBetweenCallsText = func1ParamsToFunc2Name.text.slice(callSuffixLength, -callPrefixLength);
    const callParamsPrefixText = func1NameToFunc1Params.text;

    const resultPrefixLength = findCommonEndLength(func2ParamsToFunc1Result.text, func1ResultToFunc2Result.text);
    const resultPrefixText = func2ParamsToFunc1Result.text.slice(-resultPrefixLength);

    const resultSuffixLength = findCommandStartLength(func1ResultToFunc2Result.text, func2ResultToModelMessage2.text);
    const resultSuffixText = func1ResultToFunc2Result.text.slice(0, resultSuffixLength);
    const parallelismResultBetweenResultsText = func1ResultToFunc2Result.text.slice(resultSuffixLength, -resultPrefixLength);
    const parallelismResultSuffixText = func2ResultToModelMessage2.text.slice(resultSuffixLength);

    const resolveParallelismBetweenSectionsParts = (betweenSectionsText: string) => {
        const {index: endTokenIndex, text: endTokenId} = findFirstTextMatch(betweenSectionsText, [eosTokenId, eosTokenId]);

        if (endTokenIndex >= 0 && endTokenId != null)
            return {
                parallelismCallSuffixText: betweenSectionsText.slice(0, endTokenIndex + endTokenId.length),
                parallelismResultPrefix: betweenSectionsText.slice(endTokenIndex + endTokenId.length)
            };

        const bosIndex = betweenSectionsText.indexOf(bosTokenId);
        if (bosIndex >= 0)
            return {
                parallelismCallSuffixText: betweenSectionsText.slice(0, bosIndex),
                parallelismResultPrefix: betweenSectionsText.slice(bosIndex)
            };

        return {
            parallelismCallSuffixText: betweenSectionsText,
            parallelismResultPrefix: ""
        };
    };
    const {
        parallelismCallSuffixText,
        parallelismResultPrefix
    } = resolveParallelismBetweenSectionsParts(func2ParamsToFunc1Result.text.slice(callSuffixLength, -resultPrefixLength));

    let revivedCallPrefix = reviveSeparatorText(callPrefixText, idToStaticContent, contentIds);
    const revivedParallelismCallSectionPrefix = removeCommonRevivedPrefix(
        reviveSeparatorText(parallelismCallPrefix, idToStaticContent, contentIds),
        !combineModelMessageAndToolCalls
            ? textBetween2TextualModelResponses
            : LlamaText()
    );
    let revivedParallelismCallBetweenCalls = reviveSeparatorText(parallelismBetweenCallsText, idToStaticContent, contentIds);

    if (revivedParallelismCallSectionPrefix.values.length === 0 && renderedOnlyCall != null) {
        const userMessage1ToModelMessage1Start = getTextBetweenIds(rendered1Call, userMessage1, modelMessage1);
        const onlyCallUserMessage1ToFunc1Name = getTextBetweenIds(renderedOnlyCall, userMessage1, func1name);

        if (userMessage1ToModelMessage1Start.text != null && onlyCallUserMessage1ToFunc1Name.text != null) {
            const onlyCallModelMessagePrefixLength = findCommandStartLength(
                userMessage1ToModelMessage1Start.text,
                onlyCallUserMessage1ToFunc1Name.text
            );
            const onlyCallCallPrefixText = onlyCallUserMessage1ToFunc1Name.text.slice(onlyCallModelMessagePrefixLength);
            const revivedOnlyCallCallPrefixText = reviveSeparatorText(onlyCallCallPrefixText, idToStaticContent, contentIds);

            const optionalCallPrefix = removeCommonRevivedSuffix(revivedCallPrefix, revivedOnlyCallCallPrefixText);
            if (optionalCallPrefix.values.length > 0) {
                revivedCallPrefix = removeCommonRevivedPrefix(revivedCallPrefix, optionalCallPrefix);
                revivedParallelismCallBetweenCalls = LlamaText([
                    optionalCallPrefix,
                    revivedParallelismCallBetweenCalls
                ]);
            }
        }
    }

    return {
        stringifyParams,
        stringifyResult,
        combineModelMessageAndToolCalls,
        settings: {
            call: {
                optionalPrefixSpace: true,
                prefix: revivedCallPrefix,
                paramsPrefix: reviveSeparatorText(callParamsPrefixText, idToStaticContent, contentIds),
                suffix: reviveSeparatorText(callSuffixText, idToStaticContent, contentIds),
                emptyCallParamsPlaceholder: {}
            },
            result: {
                prefix: reviveSeparatorText(
                    resultPrefixText,
                    new Map([
                        ...idToStaticContent.entries(),
                        [func1name, LlamaText("{{functionName}}")],
                        [func1params, LlamaText("{{functionParams}}")]
                    ]),
                    contentIds
                ),
                suffix: reviveSeparatorText(
                    resultSuffixText,
                    new Map([
                        ...idToStaticContent.entries(),
                        [func1name, LlamaText("{{functionName}}")],
                        [func1params, LlamaText("{{functionParams}}")]
                    ]),
                    contentIds
                )
            },
            parallelism: {
                call: {
                    sectionPrefix: revivedParallelismCallSectionPrefix,
                    betweenCalls: revivedParallelismCallBetweenCalls,
                    sectionSuffix: reviveSeparatorText(parallelismCallSuffixText, idToStaticContent, contentIds)
                },
                result: {
                    sectionPrefix: reviveSeparatorText(parallelismResultPrefix, idToStaticContent, contentIds),
                    betweenResults: reviveSeparatorText(parallelismResultBetweenResultsText, idToStaticContent, contentIds),
                    sectionSuffix: reviveSeparatorText(parallelismResultSuffixText, idToStaticContent, contentIds)
                }
            }
        }
    };
}

function getTextBetweenIds(
    text: string, startId: string, endId: string, startIndex: number = 0
): {text: string | undefined, endIndex: number} {
    const foundStartIndex = text.indexOf(startId, startIndex);
    if (foundStartIndex < 0)
        return {text: undefined, endIndex: -1};

    const foundEndIndex = text.indexOf(endId, foundStartIndex + startId.length);
    if (foundEndIndex < 0)
        return {text: undefined, endIndex: -1};

    return {
        text: text.slice(foundStartIndex + startId.length, foundEndIndex),
        endIndex: foundEndIndex
    };
}

function reviveSeparatorText(text: string, idMap: Map<string, LlamaText | SpecialToken>, contentIds: Set<string>): LlamaText {
    return LlamaText(
        splitText(text, [...new Set([...idMap.keys(), ...contentIds])])
            .map((item) => {
                if (typeof item === "string")
                    return new SpecialTokensText(item);

                const mappedItem = idMap.get(item.separator);
                if (mappedItem != null)
                    return mappedItem;

                if (contentIds.has(item.separator))
                    throw new Error("Content ID found in separator text");

                return new SpecialTokensText(item.separator);
            })
    );
}

function removeCommonRevivedPrefix(target: LlamaText, matchStart: LlamaText) {
    for (
        let commonStartLength = 0;
        commonStartLength < target.values.length && commonStartLength < matchStart.values.length;
        commonStartLength++
    ) {
        const targetValue = target.values[commonStartLength];
        const matchStartValue = matchStart.values[commonStartLength];

        if (typeof targetValue === "string" && typeof matchStartValue === "string") {
            if (targetValue === matchStartValue)
                continue;
        } else if (targetValue instanceof SpecialTokensText && matchStartValue instanceof SpecialTokensText) {
            const commonLength = findCommandStartLength(targetValue.value, matchStartValue.value);
            if (commonLength === targetValue.value.length && commonLength === matchStartValue.value.length)
                continue;

            return LlamaText([
                new SpecialTokensText(targetValue.value.slice(commonLength)),
                ...target.values.slice(commonStartLength + 1)
            ]);
        } else if (targetValue instanceof SpecialToken && matchStartValue instanceof SpecialToken) {
            if (targetValue.value === matchStartValue.value)
                continue;
        } else if (LlamaText(targetValue ?? "").compare(LlamaText(matchStartValue ?? "")))
            continue;

        return LlamaText(target.values.slice(commonStartLength));
    }

    return LlamaText(target.values.slice(matchStart.values.length));
}

function removeCommonRevivedSuffix(target: LlamaText, matchEnd: LlamaText) {
    for (
        let commonEndLength = 0;
        commonEndLength < target.values.length && commonEndLength < matchEnd.values.length;
        commonEndLength++
    ) {
        const targetValue = target.values[target.values.length - commonEndLength - 1];
        const matchEndValue = matchEnd.values[matchEnd.values.length - commonEndLength - 1];

        if (typeof targetValue === "string" && typeof matchEndValue === "string") {
            if (targetValue === matchEndValue)
                continue;
        } else if (targetValue instanceof SpecialTokensText && matchEndValue instanceof SpecialTokensText) {
            const commonLength = findCommonEndLength(targetValue.value, matchEndValue.value);
            if (commonLength === targetValue.value.length && commonLength === matchEndValue.value.length)
                continue;

            return LlamaText([
                ...target.values.slice(0, target.values.length - commonEndLength - 1),
                new SpecialTokensText(targetValue.value.slice(0, targetValue.value.length - commonLength))
            ]);
        } else if (targetValue instanceof SpecialToken && matchEndValue instanceof SpecialToken) {
            if (targetValue.value === matchEndValue.value)
                continue;
        } else if (LlamaText(targetValue ?? "").compare(LlamaText(matchEndValue ?? "")))
            continue;

        return LlamaText(target.values.slice(0, target.values.length - commonEndLength - 1));
    }

    return LlamaText(target.values.slice(0, target.values.length - matchEnd.values.length));
}

function findCommandStartLength(text1: string, text2: string) {
    let commonStartLength = 0;
    while (commonStartLength < text1.length && commonStartLength < text2.length) {
        if (text1[commonStartLength] !== text2[commonStartLength])
            break;

        commonStartLength++;
    }

    return commonStartLength;
}

function findCommonEndLength(text1: string, text2: string) {
    let commonEndLength = 0;
    while (commonEndLength < text1.length && commonEndLength < text2.length) {
        if (text1[text1.length - commonEndLength - 1] !== text2[text2.length - commonEndLength - 1])
            break;

        commonEndLength++;
    }

    return commonEndLength;
}

function findFirstTextMatch<const T extends string>(
    text: string, matchTexts: T[], startIndex: number = 0
): {index: number, text: T} | {index: -1, text: undefined} {
    for (const matchText of matchTexts) {
        const index = text.indexOf(matchText, startIndex);
        if (index >= 0)
            return {index, text: matchText};
    }

    return {index: -1, text: undefined};
}
