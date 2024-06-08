import {ChatWrapper} from "../ChatWrapper.js";
import {ChatWrapperGenerateContextStateOptions, ChatWrapperGeneratedContextState} from "../types.js";
import {SpecialToken, LlamaText, SpecialTokensText} from "../utils/LlamaText.js";

// source: https://github.com/openai/openai-python/blob/120d225b91a8453e15240a49fb1c6794d8119326/chatml.md
export class ChatMLChatWrapper extends ChatWrapper {
    public readonly wrapperName: string = "ChatML";

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

        for (const item of historyWithFunctions) {
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

                currentAggregateFocus = null;
                modelTexts.push(this.generateModelResponseText(item.response));
            } else
                void (item satisfies never);
        }

        flush();

        const contextText = LlamaText(
            new SpecialToken("BOS"),
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
}
