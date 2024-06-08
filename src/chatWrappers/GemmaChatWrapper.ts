import {ChatWrapper} from "../ChatWrapper.js";
import {ChatWrapperGenerateContextStateOptions, ChatWrapperGeneratedContextState, ChatWrapperSettings} from "../types.js";
import {SpecialToken, LlamaText, SpecialTokensText} from "../utils/LlamaText.js";

// source: https://ai.google.dev/gemma/docs/formatting
// source: https://www.promptingguide.ai/models/gemma
export class GemmaChatWrapper extends ChatWrapper {
    public readonly wrapperName: string = "Gemma";

    public override readonly settings: ChatWrapperSettings = {
        ...ChatWrapper.defaultSettings,
        supportsSystemMessages: false
    };

    public override generateContextState({
        chatHistory, availableFunctions, documentFunctionParams
    }: ChatWrapperGenerateContextStateOptions): ChatWrapperGeneratedContextState {
        const historyWithFunctions = this.addAvailableFunctionsSystemMessageToHistory(chatHistory, availableFunctions, {
            documentParams: documentFunctionParams
        });

        const resultItems: Array<{
            user: LlamaText,
            model: LlamaText
        }> = [];

        let systemTexts: LlamaText[] = [];
        let userTexts: LlamaText[] = [];
        let modelTexts: LlamaText[] = [];
        let currentAggregateFocus: "system" | "user" | "model" | null = null;

        function flush() {
            if (systemTexts.length > 0 || userTexts.length > 0 || modelTexts.length > 0) {
                const systemText = LlamaText.joinValues("\n\n", systemTexts);
                let userText = LlamaText.joinValues("\n\n", userTexts);

                // there's no system prompt support in Gemma, so we'll prepend the system text to the user message
                if (systemText.values.length > 0) {
                    if (userText.values.length === 0)
                        userText = systemText;
                    else
                        userText = LlamaText([
                            systemText,
                            "\n\n---\n\n",
                            userText
                        ]);

                }
                resultItems.push({
                    user: userText,
                    model: LlamaText.joinValues("\n\n", modelTexts)
                });
            }

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
                if (currentAggregateFocus !== "system" && currentAggregateFocus !== "user")
                    flush();

                currentAggregateFocus = "user";
                userTexts.push(LlamaText(item.text));
            } else if (item.type === "model") {
                currentAggregateFocus = "model";
                modelTexts.push(this.generateModelResponseText(item.response));
            } else
                void (item satisfies never);
        }

        flush();

        const contextText = LlamaText(
            resultItems.map(({user, model}, index) => {
                const isLastItem = index === resultItems.length - 1;

                return LlamaText([
                    (user.values.length === 0)
                        ? LlamaText([])
                        : LlamaText([
                            new SpecialTokensText("<start_of_turn>user\n"),
                            user,
                            new SpecialTokensText("<end_of_turn>\n")
                        ]),

                    (model.values.length === 0 && !isLastItem)
                        ? LlamaText([])
                        : LlamaText([
                            new SpecialTokensText("<start_of_turn>model\n"),
                            model,

                            isLastItem
                                ? LlamaText([])
                                : new SpecialTokensText("<end_of_turn>\n")
                        ])
                ]);
            })
        );

        return {
            contextText,
            stopGenerationTriggers: [
                LlamaText(new SpecialToken("EOS")),
                LlamaText(new SpecialTokensText("<end_of_turn>\n")),
                LlamaText("<end_of_turn>")
            ]
        };
    }
}
