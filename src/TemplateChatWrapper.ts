import {ChatHistoryItem, ChatModelFunctions} from "./types.js";
import {BuiltinSpecialToken, LlamaText, LlamaTextValue, SpecialToken} from "./utils/LlamaText.js";
import {ChatWrapper, ChatWrapperSettings} from "./ChatWrapper.js";
import {parseTextTemplate} from "./utils/parseTextTemplate.js";

export type TemplateChatWrapperOptions = {
    template: ChatTemplate,
    historyTemplate: ChatHistoryTemplate,
    modelRoleName: string,
    userRoleName: string,
    systemRoleName?: string,
    functionCallMessageTemplate?: ChatHistoryFunctionCallMessageTemplate,
    joinAdjacentMessagesOfTheSameType?: boolean
};

/**
 * A chat wrapper based on a simple template.
 *
 * Example usage:
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

        this.template = template;
        this.historyTemplate = historyTemplate;
        this.modelRoleName = modelRoleName;
        this.userRoleName = userRoleName;
        this.systemRoleName = systemRoleName;
        this.joinAdjacentMessagesOfTheSameType = joinAdjacentMessagesOfTheSameType;

        this._parsedChatTemplate = parseChatTemplate(template);
        this._parsedChatHistoryTemplate = parseChatHistoryTemplate(historyTemplate);

        this.settings = {
            ...super.settings,
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

        const getHistoryItem = (role: "system" | "user" | "model", text: string, prefix?: string | null) => {
            const {roleNamePrefix, messagePrefix, messageSuffix} = this._parsedChatHistoryTemplate;
            return LlamaText([
                new SpecialToken((prefix ?? "") + roleNamePrefix + role + messagePrefix),
                text,
                new SpecialToken(messageSuffix)
            ]);
        };

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
            }
        }

        flush();

        const contextText = LlamaText(
            resultItems.map(({system, user, model}, index) => {
                const isFirstItem = index === 0;
                const isLastItem = index === resultItems.length - 1;

                const res = LlamaText([
                    isFirstItem
                        ? system.length === 0
                            ? new SpecialToken((this._parsedChatTemplate.systemPromptPrefix ?? "") + this._parsedChatTemplate.historyPrefix)
                            : this._parsedChatTemplate.systemPromptPrefix != null
                                ? LlamaText([
                                    new SpecialToken(this._parsedChatTemplate.systemPromptPrefix),
                                    system,
                                    new SpecialToken(this._parsedChatTemplate.historyPrefix)
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
                                new SpecialToken(this._parsedChatTemplate.completionPrefix),
                                model
                            ])
                ]);

                return LlamaText(
                    res.values.reduce((res, value) => {
                        if (value instanceof SpecialToken) {
                            const lastItem = res[res.length - 1];

                            if (lastItem == null || !(lastItem instanceof SpecialToken))
                                return res.concat([value]);

                            return res.slice(0, -1).concat([
                                new SpecialToken(lastItem.value + value.value)
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
                LlamaText(new BuiltinSpecialToken("EOS")),
                LlamaText(this._parsedChatTemplate.completionSuffix),
                LlamaText(new SpecialToken(this._parsedChatTemplate.completionSuffix))
            ]
        };
    }
}

type ChatTemplate = `${`${string}{{systemPrompt}}` | ""}${string}{{history}}${string}{{completion}}${string}`;
type ChatHistoryTemplate = `${string}{{roleName}}${string}{{message}}${string}`;

type ChatHistoryFunctionCallMessageTemplate = [
    call: `${string}{{functionName}}${string}{{functionParams}}${string}`,
    result: `${string}{{functionCallResult}}${string}`
];

function parseFunctionCallMessageTemplate(template?: ChatHistoryFunctionCallMessageTemplate) {
    if (template == null)
        return null;

    const [functionCallTemplate, functionCallResultTemplate] = template;

    if (functionCallTemplate == null || functionCallResultTemplate == null)
        throw new Error("Both function call and function call result templates are required");

    const parsedFunctionCallTemplate = parseTextTemplate(functionCallTemplate, [{
        text: "{{functionName}}",
        key: "functionName"
    }, {
        text: "{{functionParams}}",
        key: "functionParams"
    }]);
    const parsedFunctionCallResultTemplate = parseTextTemplate(functionCallResultTemplate, [{
        text: "{{functionCallResult}}",
        key: "functionCallResult"
    }]);

    const callPrefix = parsedFunctionCallTemplate.functionName.prefix;
    const callParamsPrefix = parsedFunctionCallTemplate.functionParams.prefix;
    const callSuffix = parsedFunctionCallTemplate.functionParams.suffix;

    const resultPrefix = parsedFunctionCallResultTemplate.functionCallResult.prefix;
    const resultSuffix = parsedFunctionCallResultTemplate.functionCallResult.suffix;

    if (callPrefix.length === 0)
        throw new Error('Function call template must have text before "{{functionName}}"');

    if (callSuffix.length === 0)
        throw new Error('Function call template must have text after "{{functionParams}}"');

    if (resultPrefix.length === 0)
        throw new Error('Function call result template must have text before "{{functionCallResult}}"');

    if (resultSuffix.length === 0)
        throw new Error('Function call result template must have text after "{{functionCallResult}}"');

    return {
        call: {
            optionalPrefixSpace: true,
            prefix: callPrefix,
            paramsPrefix: callParamsPrefix,
            suffix: callSuffix
        },
        result: {
            prefix: resultPrefix,
            suffix: resultSuffix
        }
    };
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
