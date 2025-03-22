import {ChatWrapper, ChatWrapperJinjaMatchConfiguration} from "../ChatWrapper.js";
import {
    ChatHistoryItem, ChatModelFunctions, ChatSystemMessage, ChatWrapperGenerateContextStateOptions, ChatWrapperGeneratedContextState,
    ChatWrapperGenerateInitialHistoryOptions, ChatWrapperSettings
} from "../types.js";
import {SpecialToken, LlamaText, SpecialTokensText} from "../utils/LlamaText.js";
import {jsonDumps} from "./utils/jsonDumps.js";
import {chunkChatItems} from "./utils/chunkChatItems.js";

// source:
// https://github.com/mistralai/platform-docs-public/blob/02c3f50e427ce5cf96bba9710501598f621babea/docs/guides/tokenization.mdx#v3-tokenizer
//
// source: https://docs.mistral.ai/guides/tokenization/#v3-tokenizer
export class MistralChatWrapper extends ChatWrapper {
    public readonly wrapperName: string = "Mistral";

    public override readonly settings: ChatWrapperSettings;

    /** @internal */ private readonly _addSpaceBeforeEos: boolean;
    /** @internal */ private readonly _stringifyFunctionCallResult: boolean;

    public constructor(options: {
        /**
         * Default to `true`
         */
        addSpaceBeforeEos?: boolean,

        /** @internal */
        _noFunctionNameInResult?: boolean,

        /** @internal */
        _stringifyFunctionCallResult?: boolean
    } = {}) {
        super();
        const {
            addSpaceBeforeEos = false,
            _noFunctionNameInResult = false,
            _stringifyFunctionCallResult = false
        } = options;

        this._addSpaceBeforeEos = addSpaceBeforeEos;
        this._stringifyFunctionCallResult = _stringifyFunctionCallResult;
        this.settings = {
            supportsSystemMessages: true,
            functions: {
                call: {
                    optionalPrefixSpace: true,
                    prefix: '{"name": "',
                    paramsPrefix: '", "arguments": ',
                    suffix: "}",
                    emptyCallParamsPlaceholder: {}
                },
                result: {
                    prefix: _noFunctionNameInResult
                        ? LlamaText(new SpecialTokensText("[TOOL_RESULTS]"), '{"content": ')
                        : LlamaText(new SpecialTokensText("[TOOL_RESULTS]"), '{"name": "{{functionName}}", "content": '),
                    suffix: LlamaText("}", new SpecialTokensText("[/TOOL_RESULTS]"))
                },
                parallelism: {
                    call: {
                        sectionPrefix: LlamaText(new SpecialTokensText("[TOOL_CALLS]"), "["),
                        betweenCalls: ", ",
                        sectionSuffix: LlamaText("]", new SpecialToken("EOS"))
                    }
                }
            }
        };
    }

    public override addAvailableFunctionsSystemMessageToHistory(history: readonly ChatHistoryItem[]) {
        return history;
    }

    public override generateContextState({
        chatHistory, availableFunctions, documentFunctionParams
    }: ChatWrapperGenerateContextStateOptions): ChatWrapperGeneratedContextState {
        const toolsText = this._generateAvailableToolsText({availableFunctions, documentFunctionParams});
        const {systemMessage, chatHistory: chatHistoryWithoutSystemMessage} = this._splitSystemMessageFromChatHistory(chatHistory);
        const {lastInteraction, chatHistory: cleanChatHistory} = this._splitLastInteractionFromChatHistory(chatHistoryWithoutSystemMessage);

        const chunkedChatHistory = chunkChatItems(cleanChatHistory, {
            generateModelResponseText: this.generateModelResponseText.bind(this)
        });
        const chunkedLastInteraction = chunkChatItems(lastInteraction, {
            generateModelResponseText: this.generateModelResponseText.bind(this)
        });

        const contextText = LlamaText(
            new SpecialToken("BOS"),
            chunkedChatHistory.map(({system, user, model}) => {
                return LlamaText([
                    new SpecialTokensText("[INST]"),
                    LlamaText.joinValues("\n\n",
                        [
                            system,
                            user
                        ].filter((item) => item.values.length > 0)
                    ),
                    new SpecialTokensText("[/INST]"),
                    model,
                    this._addSpaceBeforeEos
                        ? " "
                        : "",
                    new SpecialToken("EOS")
                ]);
            }),
            toolsText === ""
                ? ""
                : [
                    new SpecialTokensText("[AVAILABLE_TOOLS]"),
                    toolsText,
                    new SpecialTokensText("[/AVAILABLE_TOOLS]")
                ],
            chunkedLastInteraction.map(({system, user, model}, index) => {
                const isLastItem = index === chunkedLastInteraction.length - 1;

                return LlamaText([
                    new SpecialTokensText("[INST]"),
                    (isLastItem && LlamaText(systemMessage).values.length > 0)
                        ? [systemMessage, "\n\n"]
                        : "",
                    LlamaText.joinValues("\n\n",
                        [
                            system,
                            user
                        ].filter((item) => item.values.length > 0)
                    ),
                    new SpecialTokensText("[/INST]"),
                    model,
                    this._addSpaceBeforeEos
                        ? " "
                        : "",
                    isLastItem
                        ? LlamaText([])
                        : new SpecialToken("EOS")
                ]);
            })
        );

        return {
            contextText,
            stopGenerationTriggers: [
                LlamaText(new SpecialToken("EOS")),
                LlamaText("</s>")
            ]
        };
    }

    public override generateInitialChatHistory({
        systemPrompt
    }: ChatWrapperGenerateInitialHistoryOptions = {}): ChatHistoryItem[] {
        if (systemPrompt == null || systemPrompt.trim() === "")
            return [];

        return [{
            type: "system",
            text: LlamaText(systemPrompt).toJSON()
        }];
    }

    public override generateFunctionCallResult(functionName: string, functionParams: any, result: any) {
        if (this._stringifyFunctionCallResult && result !== undefined)
            return super.generateFunctionCallResult(functionName, functionParams, jsonDumps(result));

        return super.generateFunctionCallResult(functionName, functionParams, result);
    }

    /** @internal */
    private _generateAvailableToolsText({
        availableFunctions,
        documentFunctionParams = true
    }: {
        availableFunctions?: ChatModelFunctions,
        documentFunctionParams?: boolean
    }) {
        const availableFunctionNames = Object.keys(availableFunctions ?? {});

        if (availableFunctions == null || availableFunctionNames.length === 0)
            return "";

        const availableTools = availableFunctionNames.map((functionName) => {
            const functionDefinition = availableFunctions[functionName];

            return {
                type: "function",
                function: {
                    name: functionName,
                    description: functionDefinition?.description != null && functionDefinition.description.trim() !== ""
                        ? functionDefinition.description
                        : undefined,
                    parameters: documentFunctionParams && functionDefinition?.params != null
                        ? functionDefinition.params
                        : undefined
                }
            };
        });

        return jsonDumps(availableTools);
    }

    /** @internal */
    private _splitSystemMessageFromChatHistory(history: readonly ChatHistoryItem[]) {
        const systemMessages: LlamaText[] = [];
        const newHistory = history.slice();

        while (newHistory.length > 0 && newHistory[0]!.type === "system")
            systemMessages.push(LlamaText.fromJSON((newHistory.shift()! as ChatSystemMessage).text));

        return {
            systemMessage: LlamaText.joinValues("\n\n", systemMessages),
            chatHistory: newHistory
        };
    }

    /** @internal */
    private _splitLastInteractionFromChatHistory(history: readonly ChatHistoryItem[]) {
        const lastInteraction: ChatHistoryItem[] = [];
        const newHistory = history.slice();

        while (newHistory.length > 0) {
            const item = newHistory.pop()!;
            lastInteraction.unshift(item);

            if (item.type === "user")
                break;
        }

        return {
            lastInteraction,
            chatHistory: newHistory
        };
    }

    /** @internal */
    public static override _getOptionConfigurationsToTestIfCanSupersedeJinjaTemplate(): ChatWrapperJinjaMatchConfiguration<typeof this> {
        return [
            [{addSpaceBeforeEos: false, _noFunctionNameInResult: true, _stringifyFunctionCallResult: true}, {addSpaceBeforeEos: false}],
            [{addSpaceBeforeEos: true, _noFunctionNameInResult: true, _stringifyFunctionCallResult: true}, {addSpaceBeforeEos: true}],
            [{addSpaceBeforeEos: false, _noFunctionNameInResult: true}, {addSpaceBeforeEos: false}],
            [{addSpaceBeforeEos: true, _noFunctionNameInResult: true}, {addSpaceBeforeEos: true}],
            [{addSpaceBeforeEos: false}, {addSpaceBeforeEos: false}],
            [{addSpaceBeforeEos: true}, {addSpaceBeforeEos: true}]
        ];
    }
}
