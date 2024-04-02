import {ChatWrapper} from "../ChatWrapper.js";
import {ChatHistoryItem, ChatModelFunctions} from "../types.js";
import {LlamaText, BuiltinSpecialToken, SpecialToken} from "../utils/LlamaText.js";

export class FalconChatWrapper extends ChatWrapper {
    public readonly wrapperName: string = "Falcon";

    /** @internal */ private readonly _userMessageTitle: string;
    /** @internal */ private readonly _modelResponseTitle: string;
    /** @internal */ private readonly _middleSystemMessageTitle: string;
    /** @internal */ private readonly _allowSpecialTokensInTitles: boolean;

    public constructor({
        userMessageTitle = "User", modelResponseTitle = "Assistant", middleSystemMessageTitle = "System", allowSpecialTokensInTitles = false
    }: {
        userMessageTitle?: string, modelResponseTitle?: string, middleSystemMessageTitle?: string, allowSpecialTokensInTitles?: boolean
    } = {}) {
        super();

        this._userMessageTitle = userMessageTitle;
        this._modelResponseTitle = modelResponseTitle;
        this._middleSystemMessageTitle = middleSystemMessageTitle;
        this._allowSpecialTokensInTitles = allowSpecialTokensInTitles;
    }

    public get userMessageTitle() {
        return this._userMessageTitle;
    }

    public get modelResponseTitle() {
        return this._modelResponseTitle;
    }

    public get middleSystemMessageTitle() {
        return this._middleSystemMessageTitle;
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
                const isFirstItem = index === 0;
                const isLastItem = index === resultItems.length - 1;

                return LlamaText([
                    (system.length === 0)
                        ? LlamaText([])
                        : LlamaText([
                            isFirstItem
                                ? LlamaText([])
                                : SpecialToken.wrapIf(this._allowSpecialTokensInTitles, `${this._middleSystemMessageTitle}: `),
                            system,
                            SpecialToken.wrapIf(this._allowSpecialTokensInTitles, "\n\n")
                        ]),

                    (user.length === 0)
                        ? LlamaText([])
                        : LlamaText([
                            SpecialToken.wrapIf(this._allowSpecialTokensInTitles, `${this._userMessageTitle}: `),
                            user,
                            SpecialToken.wrapIf(this._allowSpecialTokensInTitles, "\n\n")
                        ]),

                    (model.length === 0 && !isLastItem)
                        ? LlamaText([])
                        : LlamaText([
                            SpecialToken.wrapIf(this._allowSpecialTokensInTitles, `${this._modelResponseTitle}: `),
                            model,
                            isLastItem
                                ? LlamaText([])
                                : SpecialToken.wrapIf(this._allowSpecialTokensInTitles, "\n\n")
                        ])
                ]);
            })
        );

        return {
            contextText,
            stopGenerationTriggers: [
                LlamaText(new BuiltinSpecialToken("EOS")),

                LlamaText(`\n${this._userMessageTitle}:`),
                LlamaText(`\n${this._modelResponseTitle}:`),
                LlamaText(`\n${this._middleSystemMessageTitle}:`),

                ...(
                    !this._allowSpecialTokensInTitles
                        ? []
                        : [
                            LlamaText(new SpecialToken(`\n${this._userMessageTitle}:`)),
                            LlamaText(new SpecialToken(`\n${this._modelResponseTitle}:`)),
                            LlamaText(new SpecialToken(`\n${this._middleSystemMessageTitle}:`))
                        ]
                )
            ]
        };
    }

    /** @internal */
    public static override _getOptionConfigurationsToTestIfCanSupersedeJinjaTemplate() {
        return [{}, {
            allowSpecialTokensInTitles: true
        }] satisfies Partial<ConstructorParameters<typeof this>[0]>[];
    }
}
