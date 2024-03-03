import {ChatWrapper} from "../ChatWrapper.js";
import {ChatHistoryItem, ChatModelFunctions} from "../types.js";
import {BuiltinSpecialToken, LlamaText, SpecialToken} from "../utils/LlamaText.js";

// source: https://ai.google.dev/gemma/docs/formatting
// source: https://www.promptingguide.ai/models/gemma
export class GemmaChatWrapper extends ChatWrapper {
    public readonly wrapperName: string = "Gemma";

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
            user: string,
            model: string
        }> = [];

        let systemTexts: string[] = [];
        let userTexts: string[] = [];
        let modelTexts: string[] = [];
        let currentAggregateFocus: "system" | "user" | "model" | null = null;

        function flush() {
            if (systemTexts.length > 0 || userTexts.length > 0 || modelTexts.length > 0) {
                const systemText = systemTexts.join("\n\n");
                let userText = userTexts.join("\n\n");

                // there's no system prompt support in Gemma, so we'll prepend the system text to the user message
                if (systemText.length > 0) {
                    if (userText.length === 0)
                        userText = systemText;
                    else
                        userText = systemText + "\n\n---\n\n" + userText;

                }
                resultItems.push({
                    user: userText,
                    model: modelTexts.join("\n\n")
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
                systemTexts.push(item.text);
            } else if (item.type === "user") {
                if (currentAggregateFocus !== "system" && currentAggregateFocus !== "user")
                    flush();

                currentAggregateFocus = "user";
                userTexts.push(item.text);
            } else if (item.type === "model") {
                currentAggregateFocus = "model";
                modelTexts.push(this.generateModelResponseText(item.response));
            }
        }

        flush();

        const contextText = LlamaText(
            resultItems.map(({user, model}, index) => {
                const isLastItem = index === resultItems.length - 1;

                return LlamaText([
                    (user.length === 0)
                        ? LlamaText([])
                        : LlamaText([
                            new SpecialToken("<start_of_turn>user\n"),
                            user,
                            new SpecialToken("<end_of_turn>\n")
                        ]),

                    (model.length === 0 && !isLastItem)
                        ? LlamaText([])
                        : LlamaText([
                            new SpecialToken("<start_of_turn>model\n"),
                            model,

                            isLastItem
                                ? LlamaText([])
                                : new SpecialToken("<end_of_turn>\n")
                        ])
                ]);
            })
        );

        return {
            contextText,
            stopGenerationTriggers: [
                LlamaText(new BuiltinSpecialToken("EOS")),
                LlamaText(new SpecialToken("<end_of_turn>\n")),
                LlamaText("<end_of_turn>")
            ]
        };
    }
}
