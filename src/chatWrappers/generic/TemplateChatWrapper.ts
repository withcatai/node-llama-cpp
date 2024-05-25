import {ChatHistoryItem, ChatModelFunctions, ChatWrapperSettings} from "../../types.js";
import {SpecialToken, LlamaText, LlamaTextValue, SpecialTokensText} from "../../utils/LlamaText.js";
import {ChatWrapper} from "../../ChatWrapper.js";
import {parseTextTemplate} from "../../utils/parseTextTemplate.js";
import {ChatHistoryFunctionCallMessageTemplate, parseFunctionCallMessageTemplate} from "./utils/chatHistoryFunctionCallMessageTemplate.js";

export type TemplateChatWrapperOptions = {
    template: ChatTemplate,
    historyTemplate: ChatHistoryTemplate,
    modelRoleName: string,
    userRoleName: string,
    systemRoleName?: string,
    functionCallMessageTemplate?: ChatHistoryFunctionCallMessageTemplate,
    joinAdjacentMessagesOfTheSameType?: boolean
};

type ChatTemplate = `${`${string}{{systemPrompt}}` | ""}${string}{{history}}${string}{{completion}}${string}`;
type ChatHistoryTemplate = `${string}{{roleName}}${string}{{message}}${string}`;

/**
 * A chat wrapper based on a simple template.
 * @example
 * ```typescript
 * const chatWrapper = new TemplateChatWrapper({
 *     template: "{{systemPrompt}}\n{{history}}model:{{completion}}\nuser:",
 *     historyTemplate: "{{roleName}}: {{message}}\n",
 *     modelRoleName: "model",
 *     userRoleName: "user",
 *     systemRoleName: "system", // optional
 *     // functionCallMessageTemplate: [ // optional
 *     //     "[[call: {{functionName}}({{functionParams}})]]",
 *     //     " [[result: {{functionCallResult}}]]"
 *     // ]
 * });
 * ```
 *
 * **`{{systemPrompt}}`** is optional and is replaced with the first system message
 * (when is does, that system message is not included in the history).
 *
 * **`{{history}}`** is replaced with the chat history.
 * Each message in the chat history is converted using template passed to `historyTemplate`, and all messages are joined together.
 *
 * **`{{completion}}`** is where the model's response is generated.
 * The text that comes after `{{completion}}` is used to determine when the model has finished generating the response,
 * and thus is mandatory.
 *
 * **`functionCallMessageTemplate`** is used to specify the format in which functions can be called by the model and
 * how their results are fed to the model after the function call.
 */
export class TemplateChatWrapper extends ChatWrapper {
    public readonly wrapperName = "Template";
    public override readonly settings: ChatWrapperSettings;

    public readonly template: ChatTemplate;
    public readonly historyTemplate: ChatHistoryTemplate;
    public readonly modelRoleName: string;
    public readonly userRoleName: string;
    public readonly systemRoleName: string;
    public readonly joinAdjacentMessagesOfTheSameType: boolean;

    /** @internal */ private readonly _parsedChatTemplate: ReturnType<typeof parseChatTemplate>;
    /** @internal */ private readonly _parsedChatHistoryTemplate: ReturnType<typeof parseChatHistoryTemplate>;

    public constructor({
        template,
        historyTemplate,
        modelRoleName,
        userRoleName,
        systemRoleName = "System",
        functionCallMessageTemplate,
        joinAdjacentMessagesOfTheSameType = true
    }: TemplateChatWrapperOptions) {
        super();

        if (template == null || historyTemplate == null || modelRoleName == null || userRoleName == null)
            throw new Error("Template chat wrapper settings must have a template, historyTemplate, modelRoleName, and userRoleName.");

        this.template = template;
        this.historyTemplate = historyTemplate;
        this.modelRoleName = modelRoleName;
        this.userRoleName = userRoleName;
        this.systemRoleName = systemRoleName;
        this.joinAdjacentMessagesOfTheSameType = joinAdjacentMessagesOfTheSameType;

        this._parsedChatTemplate = parseChatTemplate(template);
        this._parsedChatHistoryTemplate = parseChatHistoryTemplate(historyTemplate);

        this.settings = {
            ...ChatWrapper.defaultSetting,
            functions: parseFunctionCallMessageTemplate(functionCallMessageTemplate) ?? ChatWrapper.defaultSetting.functions
        };
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

        const systemTexts: string[] = [];
        const userTexts: string[] = [];
        const modelTexts: string[] = [];
        let currentAggregateFocus: "system" | "user" | "model" | null = null;

        function flush() {
            if (systemTexts.length > 0 || userTexts.length > 0 || modelTexts.length > 0)
                resultItems.push({
                    system: systemTexts.join("\n\n"),
                    user: userTexts.join("\n\n"),
                    model: modelTexts.join("\n\n")
                });

            systemTexts.length = 0;
            userTexts.length = 0;
            modelTexts.length = 0;
        }

        for (const item of historyWithFunctions) {
            if (item.type === "system") {
                if (!this.joinAdjacentMessagesOfTheSameType || currentAggregateFocus !== "system")
                    flush();

                currentAggregateFocus = "system";
                systemTexts.push(item.text);
            } else if (item.type === "user") {
                if (!this.joinAdjacentMessagesOfTheSameType || (currentAggregateFocus !== "system" && currentAggregateFocus !== "user"))
                    flush();

                currentAggregateFocus = "user";
                userTexts.push(item.text);
            } else if (item.type === "model") {
                if (!this.joinAdjacentMessagesOfTheSameType)
                    flush();

                currentAggregateFocus = "model";
                modelTexts.push(this.generateModelResponseText(item.response));
            } else
                void (item satisfies never);
        }

        flush();

        const getHistoryItem = (role: "system" | "user" | "model", text: string, prefix?: string | null) => {
            const {roleNamePrefix, messagePrefix, messageSuffix} = this._parsedChatHistoryTemplate;
            return LlamaText([
                new SpecialTokensText((prefix ?? "") + roleNamePrefix + role + messagePrefix),
                text,
                new SpecialTokensText(messageSuffix)
            ]);
        };

        const contextText = LlamaText(
            resultItems.map(({system, user, model}, index) => {
                const isFirstItem = index === 0;
                const isLastItem = index === resultItems.length - 1;

                const res = LlamaText([
                    isFirstItem
                        ? system.length === 0
                            ? new SpecialTokensText(
                                (this._parsedChatTemplate.systemPromptPrefix ?? "") + this._parsedChatTemplate.historyPrefix
                            )
                            : this._parsedChatTemplate.systemPromptPrefix != null
                                ? LlamaText([
                                    new SpecialTokensText(this._parsedChatTemplate.systemPromptPrefix),
                                    system,
                                    new SpecialTokensText(this._parsedChatTemplate.historyPrefix)
                                ])
                                : getHistoryItem("system", system, this._parsedChatTemplate.historyPrefix)
                        : system.length === 0
                            ? LlamaText([])
                            : getHistoryItem("system", system),


                    user.length === 0
                        ? LlamaText([])
                        : getHistoryItem("user", user),

                    model.length === 0
                        ? LlamaText([])
                        : !isLastItem
                            ? getHistoryItem("model", model)
                            : LlamaText([
                                new SpecialTokensText(this._parsedChatTemplate.completionPrefix),
                                model
                            ])
                ]);

                return LlamaText(
                    res.values.reduce((res, value) => {
                        if (value instanceof SpecialTokensText) {
                            const lastItem = res[res.length - 1];

                            if (lastItem == null || !(lastItem instanceof SpecialTokensText))
                                return res.concat([value]);

                            return res.slice(0, -1).concat([
                                new SpecialTokensText(lastItem.value + value.value)
                            ]);
                        }

                        return res.concat([value]);
                    }, [] as LlamaTextValue[])
                );
            })
        );

        return {
            contextText,
            stopGenerationTriggers: [
                LlamaText(new SpecialToken("EOS")),
                LlamaText(this._parsedChatTemplate.completionSuffix),
                LlamaText(new SpecialTokensText(this._parsedChatTemplate.completionSuffix))
            ]
        };
    }
}

function parseChatTemplate(template: ChatTemplate): {
    systemPromptPrefix: string | null,
    historyPrefix: string,
    completionPrefix: string,
    completionSuffix: string
} {
    const parsedTemplate = parseTextTemplate(template, [{
        text: "{{systemPrompt}}",
        key: "systemPrompt",
        optional: true
    }, {
        text: "{{history}}",
        key: "history"
    }, {
        text: "{{completion}}",
        key: "completion"
    }]);

    if (parsedTemplate.completion.suffix.length == 0)
        throw new Error('Chat template must have text after "{{completion}}"');

    return {
        systemPromptPrefix: parsedTemplate.systemPrompt?.prefix ?? null,
        historyPrefix: parsedTemplate.history.prefix,
        completionPrefix: parsedTemplate.completion.prefix,
        completionSuffix: parsedTemplate.completion.suffix
    };
}

function parseChatHistoryTemplate(template: ChatHistoryTemplate): {
    roleNamePrefix: string,
    messagePrefix: string,
    messageSuffix: string
} {
    const parsedTemplate = parseTextTemplate(template, [{
        text: "{{roleName}}",
        key: "roleName"
    }, {
        text: "{{message}}",
        key: "message"
    }]);

    return {
        roleNamePrefix: parsedTemplate.roleName.prefix,
        messagePrefix: parsedTemplate.message.prefix,
        messageSuffix: parsedTemplate.message.suffix
    };
}
