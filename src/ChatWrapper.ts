import {ChatHistoryItem, ChatModelFunctions, ChatModelResponse} from "./types.js";
import {LlamaText} from "./utils/LlamaText.js";
import {getTypeScriptTypeStringForGbnfJsonSchema} from "./utils/getTypeScriptTypeStringForGbnfJsonSchema.js";

export abstract class ChatWrapper {
    public abstract readonly wrapperName: string;

    public readonly settings: {
        readonly functions: {
            readonly call: {
                readonly optionalPrefixSpace: boolean,
                readonly prefix: string,
                readonly paramsPrefix: string,
                readonly suffix: string
            },
            readonly result: {
                readonly prefix: string,
                readonly suffix: string
            }
        }
    } = {
            functions: {
                call: {
                    optionalPrefixSpace: true,
                    prefix: "[[call: ",
                    paramsPrefix: "(",
                    suffix: ")]]"
                },
                result: {
                    prefix: " [[result: ",
                    suffix: "]]"
                }
            }
        };

    public generateContextText(history: readonly ChatHistoryItem[], {availableFunctions, documentFunctionParams}: {
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

        const texts = historyWithFunctions
            .map((item) => {
                if (item.type === "system")
                    return LlamaText `system: ${item.text}`;
                else if (item.type === "user")
                    return LlamaText `user: ${item.text}`;
                else if (item.type === "model")
                    return LlamaText `model: ${this.generateModelResponseText(item.response)}`;

                return item satisfies never;
            });

        return {
            contextText: LlamaText(texts).joinValues("\n"),
            stopGenerationTriggers: []
        };
    }

    public generateFunctionCallAndResult(name: string, params: any, result: any): string {
        return this.generateFunctionCall(name, params) + this.generateFunctionCallResult(name, params, result);
    }

    public generateFunctionCall(name: string, params: any): string {
        return this.settings.functions.call.prefix +
            name +
            this.settings.functions.call.paramsPrefix +
            (
                params === undefined
                    ? ""
                    : JSON.stringify(params)
            ) +
            this.settings.functions.call.suffix;
    }

    public generateFunctionCallResult(functionName: string, functionParams: any, result: any): string {
        const resolveParameters = (text: string) =>
            text.replaceAll("{{functionName}}", functionName)
                .replaceAll("{{functionParams}}", functionParams === undefined ? "" : JSON.stringify(functionParams));

        return resolveParameters(this.settings.functions.result.prefix) +
            (
                result === undefined
                    ? "void"
                    : JSON.stringify(result)
            ) +
            resolveParameters(this.settings.functions.result.suffix);
    }

    public generateModelResponseText(modelResponse: ChatModelResponse["response"]) {
        return modelResponse
            .map((item) => {
                if (typeof item === "string")
                    return item;

                return item.raw ?? this.generateFunctionCallAndResult(item.name, item.params, item.result);
            })
            .join("\n");
    }

    public generateAvailableFunctionsSystemText(availableFunctions: ChatModelFunctions, {documentParams = true}: {
        documentParams?: boolean
    }) {
        const availableFunctionNames = Object.keys(availableFunctions ?? {});

        if (availableFunctionNames.length === 0)
            return "";

        return "The assistant calls the provided functions as needed to retrieve information instead of relying on things it already knows.\n" +
            "Provided functions:\n```\n" +
            availableFunctionNames
                .map((functionName) => {
                    const functionDefinition = availableFunctions[functionName];
                    let res = "";

                    if (functionDefinition?.description != null && functionDefinition.description.trim() !== "")
                        res += "// " + functionDefinition.description.split("\n").join("\n// ") + "\n";

                    res += "function " + functionName + "(";

                    if (documentParams && functionDefinition?.params != null)
                        res += "params: " + getTypeScriptTypeStringForGbnfJsonSchema(functionDefinition.params);
                    else if (!documentParams && functionDefinition?.params != null)
                        res += "params";

                    res += ");";

                    return res;
                })
                .join("\n\n") +
            "\n```\n\n" +

            "Calling any of the provided functions can be done like this:\n" +
            this.settings.functions.call.prefix.trimStart() +
            "functionName" +
            this.settings.functions.call.paramsPrefix +
            '{ someKey: "someValue" }' +
            this.settings.functions.call.suffix + "\n\n" +

            "After calling a function the result will appear afterwards and be visible only to the assistant, so the assistant has to tell the user about it outside of the function call context.\n" +
            "The assistant calls the functions in advance before telling the user about the result";
    }

    public addAvailableFunctionsSystemMessageToHistory(history: readonly ChatHistoryItem[], availableFunctions?: ChatModelFunctions, {
        documentParams = true
    }: {
        documentParams?: boolean
    } = {}) {
        const availableFunctionNames = Object.keys(availableFunctions ?? {});

        if (availableFunctions == null || availableFunctionNames.length === 0)
            return history;

        const res = history.slice();

        const firstNonSystemMessageIndex = res.findIndex((item) => item.type !== "system");
        res.splice(Math.max(0, firstNonSystemMessageIndex), 0, {
            type: "system",
            text: this.generateAvailableFunctionsSystemText(availableFunctions, {documentParams})
        });

        return res;
    }

    /**
     * Functions that should be made available as part of the function calling grammar and are handled by the chat wrapper
     * for grammar purposes only
     */
    public getInternalBuiltinFunctions({initialFunctionCallEngaged}: {initialFunctionCallEngaged: boolean}): ChatModelFunctions {
        if (initialFunctionCallEngaged)
            return {};

        return {};
    }
}
