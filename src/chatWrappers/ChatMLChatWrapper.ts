import {ChatWrapper} from "../ChatWrapper.js";
import {ChatHistoryItem, ChatModelFunctions} from "../types.js";
import {BuiltinSpecialToken, LlamaText, SpecialTokensText} from "../utils/LlamaText.js";

// source: https://github.com/openai/openai-python/blob/120d225b91a8453e15240a49fb1c6794d8119326/chatml.md
export class ChatMLChatWrapper extends ChatWrapper {
    public readonly wrapperName: string = "ChatML";

    public override generateContextText(history: readonly ChatHistoryItem[], {availableFunctions, documentFunctionParams}: {
        availableFunctions?: ChatModelFunctions,
        documentFunctionParams?: boolean
    } = {}): {
        contextText: LlamaText,
        stopGenerationTriggers: LlamaText[],
        ignoreStartText?: LlamaText[],
        functionCall?: {
            initiallyEngaged: boolean,
            disengageInitiallyEngaged: LlamaText[]
        }
    } {
        const historyWithFunctions = this.addAvailableFunctionsSystemMessageToHistory(history, availableFunctions, {
            documentParams: documentFunctionParams
        });

        const resultItems: Array<{
            system: string,
            user: string,
            model: string
        }> = [];

        let systemTexts: string[] = [];
        let userTexts: string[] = [];
        let modelTexts: string[] = [];
        let currentAggregateFocus: "system" | null = null;

        function flush() {
            if (systemTexts.length > 0 || userTexts.length > 0 || modelTexts.length > 0)
                resultItems.push({
                    system: systemTexts.join("\n\n"),
                    user: userTexts.join("\n\n"),
                    model: modelTexts.join("\n\n")
                });

            systemTexts = [];
            userTexts = [];
            modelTexts = [];
        }

        for (const item of historyWithFunctions) {
            if (item.type === "system") {
                if (currentAggregateFocus !== "system")
                    flush();

                currentAggregateFocus = "system";
                systemTexts.push(item.text);
            } else if (item.type === "user") {
                flush();

                currentAggregateFocus = null;
                userTexts.push(item.text);
            } else if (item.type === "model") {
                flush();

                currentAggregateFocus = null;
                modelTexts.push(this.generateModelResponseText(item.response));
            } else
                void (item satisfies never);
        }

        flush();

        const contextText = LlamaText(
            new BuiltinSpecialToken("BOS"),
            resultItems.map(({system, user, model}, index) => {
                const isLastItem = index === resultItems.length - 1;

                return LlamaText([
                    (system.length === 0)
                        ? LlamaText([])
                        : LlamaText([
                            new SpecialTokensText("<|im_start|>system\n"),
                            system,
                            new SpecialTokensText("<|im_end|>\n")
                        ]),

                    (user.length === 0)
                        ? LlamaText([])
                        : LlamaText([
                            new SpecialTokensText("<|im_start|>user\n"),
                            user,
                            new SpecialTokensText("<|im_end|>\n")
                        ]),

                    (model.length === 0 && !isLastItem)
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
                LlamaText(new BuiltinSpecialToken("EOS")),
                LlamaText(new SpecialTokensText("<|im_end|>")),
                LlamaText("<|im_end|>")
            ]
        };
    }
}
