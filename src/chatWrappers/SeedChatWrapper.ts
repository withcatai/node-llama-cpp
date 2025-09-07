import {ChatWrapper} from "../ChatWrapper.js";
import {
    ChatModelFunctions, ChatWrapperGenerateContextStateOptions, ChatWrapperGeneratedContextState, ChatWrapperSettings,
    isChatModelResponseSegment
} from "../types.js";
import {SpecialToken, LlamaText, SpecialTokensText} from "../utils/LlamaText.js";
import {ChatModelFunctionsDocumentationGenerator} from "./utils/ChatModelFunctionsDocumentationGenerator.js";

const defaultThinkingBudget = null;

// source: https://huggingface.co/ByteDance-Seed/Seed-OSS-36B-Instruct/blob/main/chat_template.jinja
export class SeedChatWrapper extends ChatWrapper {
    public readonly wrapperName: string = "Seed";

    public readonly thinkingBudget: number | 0 | null;

    public override readonly settings: ChatWrapperSettings = {
        supportsSystemMessages: true,
        functions: {
            call: {
                optionalPrefixSpace: true,
                prefix: LlamaText(new SpecialTokensText("<seed:tool_call>\n"), "<function="),
                paramsPrefix: LlamaText(new SpecialTokensText(">")),
                suffix: LlamaText(new SpecialTokensText("\n</function>\n</seed:tool_call>\n")),
                emptyCallParamsPlaceholder: {}
            },
            result: {
                prefix: LlamaText(new SpecialTokensText("<seed:bos>tool\n")),
                suffix: LlamaText(new SpecialTokensText("<seed:eos>"))
            }
        },
        segments: {
            thought: {
                prefix: LlamaText(new SpecialTokensText("<seed:think>")),
                suffix: LlamaText(new SpecialTokensText("</seed:think>")),
                reopenAfterFunctionCalls: true
            }
        }
    };

    public constructor(options: {
        /**
         * The thinking budget to instruct the model to conform to.
         *
         * This is purely a request, the model may ignore it.
         *
         * Set to `0` to instruct the model to not use any reasoning.
         *
         * When set to `null`, the instruction will be omitted (unlimited reasoning).
         *
         * Defaults to `null`.
         */
        thinkingBudget?: number | 0 | null
    } = {}) {
        super();

        const {
            thinkingBudget = defaultThinkingBudget
        } = options;

        this.thinkingBudget = thinkingBudget;
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

        const contextContent: LlamaText[] = [];

        if (systemMessage.values.length > 0 || hasFunctions)
            contextContent.push(
                LlamaText([
                    new SpecialTokensText("<seed:bos>system\n"),
                    this._getFirstSystemMessage(systemMessage, availableFunctions, {documentParams: documentFunctionParams}),
                    new SpecialTokensText("\n<seed:eos>")
                ])
            );

        const thinkingBudgetSystemMessage = this._getThinkingBudgetSystemMessage();
        if (thinkingBudgetSystemMessage.values.length > 0)
            contextContent.push(
                LlamaText([
                    new SpecialTokensText("<seed:bos>system\n"),
                    thinkingBudgetSystemMessage,
                    new SpecialTokensText("\n<seed:eos>")
                ])
            );

        for (let i = 0; i < modifiedChatHistory.length; i++) {
            const isLastItem = i === modifiedChatHistory.length - 1;
            const item = modifiedChatHistory[i];

            if (item == null)
                continue;

            if (item.type === "system") {
                contextContent.push(
                    LlamaText([
                        new SpecialTokensText("<seed:bos>system\n"),
                        LlamaText.fromJSON(item.text),
                        isLastItem
                            ? LlamaText([])
                            : new SpecialTokensText("\n<seed:eos>")
                    ])
                );
            } else if (item.type === "user") {
                contextContent.push(
                    LlamaText([
                        new SpecialTokensText("<seed:bos>system\n"),
                        item.text,
                        isLastItem
                            ? LlamaText([])
                            : new SpecialTokensText("\n<seed:eos>")
                    ])
                );
            } else if (item.type === "model") {
                const injectNoThinkingThought = this.thinkingBudget === 0 && (
                    isLastItem ||
                    !item.response.some(
                        (item) => (
                            isChatModelResponseSegment(item) && item.segmentType === "thought"
                        )
                    )
                );

                contextContent.push(
                    LlamaText([
                        new SpecialTokensText("<seed:bos>assistant\n"),
                        !injectNoThinkingThought
                            ? []
                            : [
                                new SpecialTokensText("<seed:think>\n"),
                                [
                                    new SpecialTokensText("<seed:cot_budget_reflect>"),
                                    "The current thinking budget is 0, so I will directly start answering the question.",
                                    new SpecialTokensText("</seed:cot_budget_reflect>")
                                ],
                                new SpecialTokensText("\n</seed:think>")
                            ],
                        this.generateModelResponseText(item.response, true),
                        isLastItem
                            ? LlamaText([])
                            : new SpecialTokensText("\n<seed:eos>")
                    ])
                );
            } else
                void (item satisfies never);
        }

        const contextText = LlamaText(contextContent);

        return {
            contextText,
            stopGenerationTriggers: [
                LlamaText(new SpecialToken("EOS")),
                LlamaText(new SpecialTokensText("<seed:eos>")),
                LlamaText("<seed:eos>")
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
            "",
            "Tool List:",
            (
                "You are authorized to use the following tools (described in JSON Schema format). " +
                "Before performing any task, you must decide how to call them based on the descriptions and parameters of these tools."
            ),
            functionsDocumentationGenerator.getSeedFunctionSignatures({documentParams}),
            "When invoking tools, strictly adhere to the following format:", // the original text for this is in Chinese, translated to English here
            new SpecialTokensText("<seed:tool_call>\n<function=example_function_name>\n{\"example_parameter_1\": \"value_1\", \"example_parameter_2\": \"This is the value for the second parameter\"}</function>\n</seed:tool_call>")
        ]);
    }

    /** @internal */
    private _getFirstSystemMessage(
        systemPrompt: LlamaText,
        availableFunctions?: ChatModelFunctions,
        {documentParams = true}: {documentParams?: boolean} = {}
    ) {
        const res: LlamaText[] = [];

        const functionsDocumentationGenerator = new ChatModelFunctionsDocumentationGenerator(availableFunctions);

        if (systemPrompt.values.length === 0 && functionsDocumentationGenerator.hasAnyFunctions)
            res.push(
                LlamaText("You are Doubao, a helpful AI assistant. You may call one or more functions to assist with the user query.")
            );
        else if (systemPrompt.values.length > 0)
            res.push(systemPrompt);

        if (functionsDocumentationGenerator.hasAnyFunctions)
            res.push(this.generateAvailableFunctionsSystemText(availableFunctions!, {documentParams}));

        return LlamaText(res);
    }

    /** @internal */
    private _getThinkingBudgetSystemMessage() {
        if (this.thinkingBudget == null || this.thinkingBudget < 0)
            return LlamaText([]);

        if (this.thinkingBudget === 0)
            return LlamaText([
                "You are an intelligent assistant that can answer questions in one step without the need for reasoning and thinking, " +
                "that is, your thinking budget is 0. " +
                "Next, please skip the thinking process and directly start answering the user's questions."
            ]);

        let reflectionInterval: number = 1024;
        const reflectionIntervals = new Map<number, number>([
            [16384, 1024],
            [8192, 1024],
            [4096, 512],
            [2048, 512],
            [1024, 256],
            [512, 128],
            [0, 0]
        ]);
        for (const [maxBudget, interval] of reflectionIntervals.entries()) {
            if (this.thinkingBudget <= maxBudget) {
                reflectionInterval = interval;
                break;
            }
        }

        return LlamaText([
            new SpecialTokensText("<seed:bos>system\n"),
            "You are an intelligent assistant with reflective ability. In the process of thinking and reasoning, you need to strictly follow the thinking budget, which is ",
            this.thinkingBudget,
            ". That is, you need to complete your thinking within ",
            this.thinkingBudget,
            " tokens and start answering the user's questions. You will reflect on your thinking process every ",
            reflectionInterval,
            " tokens, stating how many tokens have been used and how many are left.",
            new SpecialTokensText("\n<seed:eos>")
        ]);
    }
}
