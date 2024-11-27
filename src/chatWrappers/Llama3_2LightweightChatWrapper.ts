import {ChatWrapper, ChatWrapperJinjaMatchConfiguration} from "../ChatWrapper.js";
import {
    ChatHistoryItem, ChatModelFunctions, ChatSystemMessage, ChatWrapperCheckModelCompatibilityParams,
    ChatWrapperGenerateContextStateOptions, ChatWrapperGeneratedContextState, ChatWrapperSettings
} from "../types.js";
import {SpecialToken, LlamaText, SpecialTokensText} from "../utils/LlamaText.js";
import {ChatModelFunctionsDocumentationGenerator} from "./utils/ChatModelFunctionsDocumentationGenerator.js";
import {isLlama3_2LightweightModel} from "./utils/isLlama3_2LightweightModel.js";

// source: https://llama.meta.com/docs/model-cards-and-prompt-formats/llama3_2/
export class Llama3_2LightweightChatWrapper extends ChatWrapper {
    public readonly wrapperName: string = "Llama 3.2 lightweight";

    public readonly cuttingKnowledgeDate?: Date | (() => Date) | null;
    public readonly todayDate: Date | (() => Date) | null;
    public readonly noToolInstructions: boolean;

    /** @internal */ private readonly _specialTokensTextForPreamble: boolean;

    public override readonly settings: ChatWrapperSettings = {
        supportsSystemMessages: true,
        functions: {
            call: {
                optionalPrefixSpace: true,
                prefix: '{"name": "',
                paramsPrefix: '", "parameters": ',
                suffix: LlamaText("}", new SpecialToken("EOT"))
            },
            result: {
                prefix: LlamaText(new SpecialToken("EOT"), new SpecialTokensText("<|start_header_id|>ipython<|end_header_id|>\n\n")),
                suffix: LlamaText(new SpecialToken("EOT"), new SpecialTokensText("<|start_header_id|>assistant<|end_header_id|>\n\n"))
            }
        }
    };

    /**
     * @param options
     */
    public constructor(options: {
        /**
         * Set to `null` to disable
         *
         * Defaults to December 2023
         */
        cuttingKnowledgeDate?: Date | (() => Date) | number | string | null,

        /**
         * Set to `null` to disable
         *
         * Defaults to current date
         */
        todayDate?: Date | (() => Date) | number | string | null,

        noToolInstructions?: boolean,

        /** @internal */
        _specialTokensTextForPreamble?: boolean
    } = {}) {
        super();

        const {
            cuttingKnowledgeDate = new Date("2023-12-01T00:00:00Z"),
            todayDate = () => new Date(),
            noToolInstructions = false,

            _specialTokensTextForPreamble = false
        } = options;

        this.cuttingKnowledgeDate = cuttingKnowledgeDate == null
            ? null
            : cuttingKnowledgeDate instanceof Function
                ? cuttingKnowledgeDate
                : new Date(cuttingKnowledgeDate);
        this.todayDate = todayDate == null
            ? null
            : todayDate instanceof Function
                ? todayDate
                : new Date(todayDate);
        this.noToolInstructions = noToolInstructions;

        this._specialTokensTextForPreamble = _specialTokensTextForPreamble;
    }

    public override addAvailableFunctionsSystemMessageToHistory(
        history: readonly ChatHistoryItem[],
        availableFunctions?: ChatModelFunctions, {
            documentParams = true
        }: {
            documentParams?: boolean
        } = {}
    ) {
        const availableFunctionNames = Object.keys(availableFunctions ?? {});

        if (availableFunctions == null || availableFunctionNames.length === 0)
            return history;

        const res = history.slice();

        const functionsSystemMessage: ChatSystemMessage = {
            type: "system",
            text: this.generateAvailableFunctionsSystemText(availableFunctions, {documentParams}).toJSON()
        };

        if (res.length >= 2 && res[0]!.type === "system" && res[1]!.type === "system")
            res.splice(1, 0, functionsSystemMessage);
        else
            res.unshift({
                type: "system",
                text: this.generateAvailableFunctionsSystemText(availableFunctions, {documentParams}).toJSON()
            });

        return res;
    }

    public override generateContextState({
        chatHistory, availableFunctions, documentFunctionParams
    }: ChatWrapperGenerateContextStateOptions): ChatWrapperGeneratedContextState {
        const chatHistoryWithPreamble = this.prependPreambleToChatHistory(chatHistory);
        const historyWithFunctions = this.addAvailableFunctionsSystemMessageToHistory(chatHistoryWithPreamble, availableFunctions, {
            documentParams: documentFunctionParams
        });

        const resultItems: Array<{
            system: LlamaText | null,
            user: LlamaText | null,
            model: LlamaText | null
        }> = [];

        let systemTexts: LlamaText[] = [];
        let userTexts: LlamaText[] = [];
        let modelTexts: LlamaText[] = [];
        let currentAggregateFocus: "system" | "user" | "model" | null = null;

        const flush = () => {
            if (systemTexts.length > 0 || userTexts.length > 0 || modelTexts.length > 0)
                resultItems.push({
                    system: systemTexts.length === 0
                        ? null
                        : LlamaText.joinValues(
                            resultItems.length === 0 && this._specialTokensTextForPreamble
                                ? LlamaText(new SpecialTokensText("\n\n"))
                                : "\n\n",
                            systemTexts
                        ),
                    user: userTexts.length === 0
                        ? null
                        : LlamaText.joinValues("\n\n", userTexts),
                    model: modelTexts.length === 0
                        ? null
                        : LlamaText.joinValues("\n\n", modelTexts)
                });

            systemTexts = [];
            userTexts = [];
            modelTexts = [];
        };

        for (const item of historyWithFunctions) {
            if (item.type === "system") {
                if (currentAggregateFocus !== "system")
                    flush();

                currentAggregateFocus = "system";
                systemTexts.push(LlamaText.fromJSON(item.text));
            } else if (item.type === "user") {
                if (currentAggregateFocus !== "user")
                    flush();

                currentAggregateFocus = "user";
                userTexts.push(LlamaText(item.text));
            } else if (item.type === "model") {
                if (currentAggregateFocus !== "model")
                    flush();

                currentAggregateFocus = "model";
                modelTexts.push(this.generateModelResponseText(item.response));
            } else
                void (item satisfies never);
        }

        flush();

        const contextText = LlamaText(
            new SpecialToken("BOS"),
            resultItems.map((item, index) => {
                const isLastItem = index === resultItems.length - 1;
                const res: LlamaText[] = [];

                if (item.system != null) {
                    res.push(
                        LlamaText([
                            new SpecialTokensText("<|start_header_id|>system<|end_header_id|>\n\n"),
                            item.system,
                            new SpecialToken("EOT")
                        ])
                    );
                }

                if (item.user != null) {
                    res.push(
                        LlamaText([
                            new SpecialTokensText("<|start_header_id|>user<|end_header_id|>\n\n"),
                            item.user,
                            new SpecialToken("EOT")
                        ])
                    );
                }

                if (item.model != null) {
                    res.push(
                        LlamaText([
                            new SpecialTokensText("<|start_header_id|>assistant<|end_header_id|>\n\n"),
                            item.model,
                            isLastItem
                                ? LlamaText([])
                                : new SpecialToken("EOT")
                        ])
                    );
                }

                return LlamaText(res);
            })
        );

        return {
            contextText,
            stopGenerationTriggers: [
                LlamaText(new SpecialToken("EOS")),
                LlamaText(new SpecialToken("EOT")),
                LlamaText(new SpecialTokensText("<|eot_id|>")),
                LlamaText(new SpecialTokensText("<|end_of_text|>")),
                LlamaText("<|eot_id|>"),
                LlamaText("<|end_of_text|>")
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
            "You have access to the following functions. To call a function, please respond with JSON for a function call.",
            'Respond in the format {"name": function name, "parameters": function call parameters}.',
            "Do not use variables.",
            "",
            functionsDocumentationGenerator.getLlama3_2LightweightFunctionSignatures({documentParams}),
            "",
            "After calling a function, the result will appear afterwards and is only visible to you.",
            "To make information visible to the user, you must include it in your response.",
            "Do not tell the user about the functions your are using.",
            "Only call functions when needed."
        ]);
    }

    public prependPreambleToChatHistory(chatHistory: readonly ChatHistoryItem[]): readonly ChatHistoryItem[] {
        const res = chatHistory.slice();

        const formatMonthDate = (date: Date, timezone?: "UTC") => {
            const today = this.todayDate instanceof Function
                ? this.todayDate()
                : (this.todayDate ?? new Date());

            if (today.getUTCMonth() === date.getUTCMonth() && today.getUTCFullYear() === date.getUTCFullYear())
                return formatDate(date, timezone);

            const month = date.toLocaleDateString("en-US", {month: "long", timeZone: timezone});
            const year = date.toLocaleDateString("en-US", {year: "numeric", timeZone: timezone});
            return `${month} ${year}`;
        };

        const lines: string[] = [];

        if (this.cuttingKnowledgeDate != null) {
            const date = this.cuttingKnowledgeDate instanceof Function
                ? this.cuttingKnowledgeDate()
                : this.cuttingKnowledgeDate;

            lines.push(`Cutting Knowledge Date: ${formatMonthDate(date, "UTC")}`);
        }

        if (this.todayDate != null) {
            const date = this.todayDate instanceof Function
                ? this.todayDate()
                : this.todayDate;
            lines.push(`Today Date: ${formatDate(date, undefined)}`);
        }

        if (lines.length > 0)
            res.unshift({
                type: "system",
                text: this._specialTokensTextForPreamble
                    ? LlamaText(new SpecialTokensText(lines.join("\n"))).toJSON()
                    : LlamaText.joinValues("\n", lines).toJSON()
            });

        return res;
    }

    /** @internal */
    public static override _checkModelCompatibility(options: ChatWrapperCheckModelCompatibilityParams): boolean {
        if (options.tokenizer != null) {
            const tokens = options.tokenizer("<|eom_id|>", true, "trimLeadingSpace");
            return tokens.length === 1 && options.tokenizer.isSpecialToken(tokens[0]!) && isLlama3_2LightweightModel(options);
        }

        return isLlama3_2LightweightModel(options);
    }

    /** @internal */
    public static override _getOptionConfigurationsToTestIfCanSupersedeJinjaTemplate() {
        return [
            {},
            [{todayDate: null}, {}],
            [{cuttingKnowledgeDate: null}, {}],
            [{noToolInstructions: true}, {}],
            [{todayDate: null, cuttingKnowledgeDate: null}, {}],
            [{todayDate: null, cuttingKnowledgeDate: null, noToolInstructions: true}, {}],
            [{todayDate: new Date("2024-07-26T00:00:00"), cuttingKnowledgeDate: null, noToolInstructions: true}, {}],

            [
                {
                    todayDate: new Date("2024-07-26T00:00:00"),
                    cuttingKnowledgeDate: new Date("2023-12-01T00:00:00Z"),
                    noToolInstructions: true
                },
                {cuttingKnowledgeDate: new Date("2023-12-01T00:00:00Z")},
                {"date_string": formatDate(new Date("2024-07-26T00:00:00"), undefined)}
            ],

            [
                {
                    todayDate: new Date("2024-07-26T00:00:00"),
                    cuttingKnowledgeDate: new Date("2023-12-01T00:00:00Z"),
                    noToolInstructions: true,
                    _specialTokensTextForPreamble: true
                },
                {cuttingKnowledgeDate: new Date("2023-12-01T00:00:00Z")},
                {"date_string": formatDate(new Date("2024-07-26T00:00:00"), undefined)}
            ]
        ] satisfies ChatWrapperJinjaMatchConfiguration<typeof this>;
    }
}

function formatDate(date: Date, timezone?: "UTC") {
    const day = date.toLocaleDateString("en-US", {day: "numeric", timeZone: timezone});
    const month = date.toLocaleDateString("en-US", {month: "short", timeZone: timezone});
    const year = date.toLocaleDateString("en-US", {year: "numeric", timeZone: timezone});
    return `${day} ${month} ${year}`;
}
