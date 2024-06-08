import {ChatWrapper} from "../ChatWrapper.js";
import {ChatWrapperGenerateContextStateOptions, ChatWrapperGeneratedContextState} from "../types.js";
import {SpecialToken, LlamaText, SpecialTokensText} from "../utils/LlamaText.js";

// source: https://huggingface.co/blog/llama2#how-to-prompt-llama-2
export class Llama2ChatWrapper extends ChatWrapper {
    public readonly wrapperName: string = "Llama2Chat";

    /** @internal */ private readonly _addSpaceBeforeEos: boolean;

    public constructor({
        addSpaceBeforeEos = false
    }: {
        /**
         * Default to `true`
         */
        addSpaceBeforeEos?: boolean
    } = {}) {
        super();

        this._addSpaceBeforeEos = addSpaceBeforeEos;
    }

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
        let currentAggregateFocus: "system" | "user" | "model" | null = null;

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
            resultItems.map(({system, user, model}, index) => {
                const isLastItem = index === resultItems.length - 1;

                return LlamaText([
                    new SpecialToken("BOS"),
                    (system.values.length === 0 && user.values.length === 0)
                        ? LlamaText([])
                        : LlamaText([
                            new SpecialTokensText("[INST] "),
                            system.values.length === 0
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
        return [{
            addSpaceBeforeEos: false
        }, {
            addSpaceBeforeEos: true
        }] satisfies Partial<ConstructorParameters<typeof this>[0]>[];
    }
}
