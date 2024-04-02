import {ChatWrapper} from "../ChatWrapper.js";
import {ChatHistoryItem, ChatModelFunctions} from "../types.js";
import {SpecialToken, LlamaText, SpecialTokensText} from "../utils/LlamaText.js";

// source: https://huggingface.co/blog/llama2#how-to-prompt-llama-2
export class LlamaChatWrapper extends ChatWrapper {
    public readonly wrapperName: string = "LlamaChat";

    /** @internal */ private readonly _addSpaceBeforeEos: boolean;

    public constructor({
        addSpaceBeforeEos = true
    }: {
        /**
         * Default to `true`
         */
        addSpaceBeforeEos?: boolean
    } = {}) {
        super();

        this._addSpaceBeforeEos = addSpaceBeforeEos;
    }

    public override generateContextText(history: readonly ChatHistoryItem[], {availableFunctions, documentFunctionParams}: {
        availableFunctions?: ChatModelFunctions,
        documentFunctionParams?: boolean
    } = {}): {
        contextText: LlamaText,
        stopGenerationTriggers: LlamaText[]
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
        let currentAggregateFocus: "system" | "user" | "model" | null = null;

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
                if (currentAggregateFocus !== "system" && currentAggregateFocus !== "user")
                    flush();

                currentAggregateFocus = "user";
                userTexts.push(item.text);
            } else if (item.type === "model") {
                currentAggregateFocus = "model";
                modelTexts.push(this.generateModelResponseText(item.response));
            } else
                void (item satisfies never);
        }

        flush();

        const contextText = LlamaText(
            resultItems.map(({system, user, model}, index) => {
                const isLastItem = index === resultItems.length - 1;

                return LlamaText([
                    new SpecialToken("BOS"),
                    (system.length === 0 && user.length === 0)
                        ? LlamaText([])
                        : LlamaText([
                            new SpecialTokensText("[INST] "),
                            system.length === 0
                                ? LlamaText([])
                                : LlamaText([
                                    new SpecialTokensText("<<SYS>>\n"),
                                    system,
                                    new SpecialTokensText("\n<</SYS>>\n\n")
                                ]),
                            user,
                            new SpecialTokensText(" [/INST] ")
                        ]),
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

    /** @internal */
    public static override _getOptionConfigurationsToTestIfCanSupersedeJinjaTemplate() {
        return [{}, {
            addSpaceBeforeEos: false
        }] satisfies Partial<ConstructorParameters<typeof this>[0]>[];
    }
}
